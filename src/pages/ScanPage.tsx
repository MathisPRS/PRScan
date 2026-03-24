import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, CircleAlert, X, Save } from 'lucide-react';
import { Header } from '../components';
import { pdfService } from '../services/pdfService';
import { warmupOCR, recognizeText, detectTextBounds } from '../services/ocrService';
import { useTranslation } from '../i18n';
import { generateFileName } from '../utils/format';
import styles from './ScanPage.module.css';

// 'starting' = waiting for getUserMedia, 'camera' = live, rest = post-capture
type ScanState = 'starting' | 'camera' | 'processing' | 'done' | 'error';

declare const cv: any;

// ~1.5 s at ~15 processed fps
const STABLE_FRAMES_REQUIRED = 22;
const STABLE_DIST_THRESHOLD  = 20; // px

interface Quad { pts: [number, number][] }

function quadCenter(q: Quad): [number, number] {
  const xs = q.pts.map(p => p[0]);
  const ys = q.pts.map(p => p[1]);
  return [xs.reduce((a, b) => a + b) / 4, ys.reduce((a, b) => a + b) / 4];
}
function quadDist(a: Quad, b: Quad): number {
  const [ax, ay] = quadCenter(a);
  const [bx, by] = quadCenter(b);
  return Math.hypot(ax - bx, ay - by);
}

export function ScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [state, setState]               = useState<ScanState>('starting');
  const [scannedPages, setScannedPages] = useState<Blob[]>([]);
  const [pageCount, setPageCount]       = useState(0);
  const [error, setError]               = useState('');
  const [cvReady, setCvReady]           = useState(false);
  const [stream, setStream]             = useState<MediaStream | null>(null);
  const [autoProgress, setAutoProgress] = useState(0); // 0–1
  const [flashGreen, setFlashGreen]     = useState(false);

  const videoRef           = useRef<HTMLVideoElement>(null);
  const canvasRef          = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef   = useRef<HTMLCanvasElement>(null);
  const animFrameRef       = useRef<number>(0);
  const stableCountRef     = useRef<number>(0);
  const lastQuadRef        = useRef<Quad | null>(null);
  const capturingRef       = useRef<boolean>(false);
  const ocrTextRef         = useRef<string>('');
  const lastOcrFallbackRef = useRef<number>(0);
  const streamRef          = useRef<MediaStream | null>(null); // mirror for callbacks

  // ── Load OpenCV.js ────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof cv !== 'undefined' && cv.Mat) { setCvReady(true); return; }
    const script = document.createElement('script');
    script.src   = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.onload = () => {
      const check = setInterval(() => {
        if (typeof cv !== 'undefined' && cv.Mat) { setCvReady(true); clearInterval(check); }
      }, 100);
    };
    document.head.appendChild(script);
    return () => { if (script.parentNode) script.parentNode.removeChild(script); };
  }, []);

  // ── Auto-start camera on mount ────────────────────────────────────────────
  useEffect(() => {
    startCamera();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    capturingRef.current   = false;
    stableCountRef.current = 0;
    lastQuadRef.current    = null;
    setAutoProgress(0);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = async () => {
    setState('starting');
    capturingRef.current   = false;
    stableCountRef.current = 0;
    lastQuadRef.current    = null;
    ocrTextRef.current     = '';
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setState('camera');
      // warmup Tesseract in background
      warmupOCR();
    } catch (e: any) {
      setError(t('scan_permission_message'));
      setState('error');
    }
  };

  // Attach stream to <video> once both stream and video element are ready
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // Persistent off-screen canvas used to snapshot video frames for OpenCV.
  // cv.imread(videoElement) silently fails on many mobile browsers when the
  // video is hardware-accelerated; drawing to an intermediate canvas first
  // is the reliable cross-browser approach.
  const snapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  function getSnapCanvas(w: number, h: number): HTMLCanvasElement {
    if (!snapCanvasRef.current) {
      snapCanvasRef.current = document.createElement('canvas');
    }
    const c = snapCanvasRef.current;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  // ── Edge-detection + auto-capture loop ───────────────────────────────────
  const drawEdgeOverlay = useCallback(() => {
    if (!cvReady || !videoRef.current || !overlayCanvasRef.current) {
      animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
      return;
    }
    const video  = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
      return;
    }

    const W = video.videoWidth  || video.clientWidth;
    const H = video.videoHeight || video.clientHeight;
    if (W === 0 || H === 0) {
      animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
      return;
    }
    canvas.width  = W;
    canvas.height = H;

    try {
      // Draw video to intermediate canvas first — required on mobile browsers
      const snap = getSnapCanvas(W, H);
      snap.getContext('2d')!.drawImage(video, 0, 0, W, H);
      const src      = cv.imread(snap);
      const small    = new cv.Mat();
      const gray     = new cv.Mat();
      const blurred  = new cv.Mat();
      const edges    = new cv.Mat();
      const contours = new cv.MatVector();
      const hier     = new cv.Mat();

      cv.resize(src, small, new cv.Size(W / 2, H / 2));
      cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      cv.Canny(blurred, edges, 50, 150);
      cv.findContours(edges, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let bestContour: any = null;
      let bestArea = 0;
      const minArea = (W / 2) * (H / 2) * 0.04;

      for (let i = 0; i < contours.size(); i++) {
        const cnt  = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < minArea) { cnt.delete(); continue; }
        const peri   = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4 && area > bestArea) {
          bestArea = area;
          if (bestContour) bestContour.delete();
          bestContour = approx;
        } else {
          approx.delete();
        }
        cnt.delete();
      }

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      if (bestContour) {
        // Contour coords are in half-res space (W/2 × H/2).
        // The overlay canvas intrinsic size is W×H → just ×2, no CSS ratio needed.
        const pts: [number, number][] = [];
        for (let i = 0; i < bestContour.rows; i++) {
          pts.push([bestContour.data32S[i * 2] * 2, bestContour.data32S[i * 2 + 1] * 2]);
        }
        const detected: Quad = { pts };

        const isStable = lastQuadRef.current !== null &&
          quadDist(lastQuadRef.current, detected) < STABLE_DIST_THRESHOLD;

        stableCountRef.current = isStable
          ? Math.min(stableCountRef.current + 1, STABLE_FRAMES_REQUIRED)
          : 0;
        lastQuadRef.current = detected;

        const progress = stableCountRef.current / STABLE_FRAMES_REQUIRED;
        setAutoProgress(progress);

        const r = 0;
        const g = Math.round(150 + 105 * progress);
        const b = Math.round(243 * (1 - progress));
        const color = `rgb(${r},${g},${b})`;
        const glowA = 0.3 + 0.3 * progress;

        ctx.fillStyle = `rgba(${r},${g},${b},${0.07 + 0.06 * progress})`;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth   = 3;
        ctx.shadowColor = `rgba(${r},${g},${b},${glowA})`;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.stroke();

        ctx.shadowBlur = 0;
        pts.forEach(p => {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill();
        });

        if (progress >= 1 && !capturingRef.current) {
          capturingRef.current = true;
          cancelAnimationFrame(animFrameRef.current);
          bestContour.delete();
          src.delete(); small.delete(); gray.delete(); blurred.delete();
          edges.delete(); contours.delete(); hier.delete();
          triggerAutoCapture();
          return;
        }

        bestContour.delete();
      } else {
        stableCountRef.current = 0;
        lastQuadRef.current    = null;
        setAutoProgress(0);

        // OCR fallback: throttled to once every 2 s
        // Reuse the snap canvas already drawn above (no new drawImage needed)
        const now = Date.now();
        if (now - lastOcrFallbackRef.current > 2000) {
          lastOcrFallbackRef.current = now;
          // Clone pixels from the already-drawn snap canvas
          const ocrSnap = document.createElement('canvas');
          ocrSnap.width  = W;
          ocrSnap.height = H;
          ocrSnap.getContext('2d')!.drawImage(snap, 0, 0);
          detectTextBounds(ocrSnap).then(bounds => {
            if (!bounds || !overlayCanvasRef.current) return;
            const oCtx = overlayCanvasRef.current.getContext('2d');
            if (!oCtx) return;
            // bounds are in native-res space (W×H) → draw directly, no CSS scale
            oCtx.clearRect(0, 0, W, H);
            oCtx.strokeStyle = '#2196F3';
            oCtx.lineWidth   = 3;
            oCtx.setLineDash([10, 6]);
            oCtx.shadowColor = 'rgba(33,150,243,0.4)';
            oCtx.shadowBlur  = 10;
            oCtx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
            oCtx.setLineDash([]);
            oCtx.shadowBlur = 0;
          }).catch(() => {});
        }
      }

      src.delete(); small.delete(); gray.delete(); blurred.delete();
      edges.delete(); contours.delete(); hier.delete();
    } catch (_) {
      stableCountRef.current = 0;
    }

    animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvReady]);

  useEffect(() => {
    if (state === 'camera') {
      animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state, drawEdgeOverlay]);

  // ── Auto-capture ──────────────────────────────────────────────────────────
  const triggerAutoCapture = () => {
    setFlashGreen(true);
    if ('vibrate' in navigator) navigator.vibrate([30, 20, 30]);
    setTimeout(() => {
      setFlashGreen(false);
      captureFrame(() => {
        capturingRef.current   = false;
        stableCountRef.current = 0;
        lastQuadRef.current    = null;
        setAutoProgress(0);
        setTimeout(() => {
          animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
        }, 600);
      });
    }, 250);
  };

  // ── Capture one frame ─────────────────────────────────────────────────────
  const captureFrame = (onDone?: () => void) => {
    if (!videoRef.current || !canvasRef.current) { onDone?.(); return; }
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    if (cvReady) {
      try {
        const src       = cv.imread(canvas);
        const corrected = perspectiveCorrect(src, canvas.width, canvas.height);
        cv.imshow(canvas, corrected ?? src);
        corrected?.delete();
        src.delete();
      } catch (_) {}
    }

    // OCR async — snapshot before toBlob overwrites
    const ocrCanvas = document.createElement('canvas');
    ocrCanvas.width  = canvas.width;
    ocrCanvas.height = canvas.height;
    ocrCanvas.getContext('2d')!.drawImage(canvas, 0, 0);
    recognizeText(ocrCanvas).then(text => {
      if (text) {
        ocrTextRef.current = ocrTextRef.current
          ? ocrTextRef.current + '\n\n--- Page ---\n\n' + text
          : text;
      }
    }).catch(() => {});

    canvas.toBlob(blob => {
      if (blob) setScannedPages(prev => [...prev, blob]);
      onDone?.();
    }, 'image/jpeg', 0.97);
  };

  const captureManual = () => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    cancelAnimationFrame(animFrameRef.current);
    if ('vibrate' in navigator) navigator.vibrate(30);
    captureFrame(() => {
      capturingRef.current   = false;
      stableCountRef.current = 0;
      lastQuadRef.current    = null;
      setAutoProgress(0);
      animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
    });
  };

  // ── Perspective correction ────────────────────────────────────────────────
  function perspectiveCorrect(src: any, w: number, h: number): any | null {
    try {
      const gray = new cv.Mat(), blurred = new cv.Mat(), edges = new cv.Mat();
      const contours = new cv.MatVector(), hier = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      cv.Canny(blurred, edges, 50, 150);
      cv.findContours(edges, contours, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let bestContour: any = null, bestArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const cnt  = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < w * h * 0.08) { cnt.delete(); continue; }
        const peri   = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4 && area > bestArea) {
          bestArea = area;
          if (bestContour) bestContour.delete();
          bestContour = approx;
        } else { approx.delete(); }
        cnt.delete();
      }
      gray.delete(); blurred.delete(); edges.delete(); contours.delete(); hier.delete();

      if (!bestContour) return null;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 4; i++)
        pts.push({ x: bestContour.data32S[i * 2], y: bestContour.data32S[i * 2 + 1] });
      bestContour.delete();

      pts.sort((a, b) => (a.x + a.y) - (b.x + b.y));
      const [tl, br] = [pts[0], pts[3]];
      pts.sort((a, b) => (a.x - a.y) - (b.x - b.y));
      const [bl, tr] = [pts[0], pts[3]];

      const maxW = Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y));
      const maxH = Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y));

      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxW, 0, maxW, maxH, 0, maxH]);
      const M   = cv.getPerspectiveTransform(srcPts, dstPts);
      const dst = new cv.Mat();
      cv.warpPerspective(src, dst, M, new cv.Size(maxW, maxH));
      srcPts.delete(); dstPts.delete(); M.delete();
      return dst;
    } catch (_) { return null; }
  }

  // ── Save PDF ──────────────────────────────────────────────────────────────
  const savePdf = async () => {
    if (scannedPages.length === 0) return;
    stopCamera();
    setState('processing');
    try {
      const name    = generateFileName('scan');
      const ocrText = ocrTextRef.current || undefined;
      await pdfService.imagesToPdf(scannedPages, name, ocrText);
      setPageCount(scannedPages.length);
      setState('done');
      if ('vibrate' in navigator) navigator.vibrate(100);
    } catch (e: any) {
      setError(e?.message ?? 'PDF creation failed');
      setState('error');
    }
  };

  const reset = () => {
    setScannedPages([]); setPageCount(0); setError('');
    ocrTextRef.current = '';
    startCamera();
  };

  // ── STARTING — fond noir, pas de header/nav ───────────────────────────────
  if (state === 'starting') return (
    <div className={styles.cameraPage}>
      <div className={styles.cameraView} />
      {/* Top bar already visible so X button works during permission prompt */}
      <div className={styles.topBar} style={{ background: 'transparent' }}>
        <div />
        <button className={styles.closeBtn} onClick={() => navigate(-1)}>
          <X size={20} strokeWidth={2.5} />
        </button>
      </div>
      <div className={styles.bottomBar}>
        <p className={styles.hintText}>Starting camera…</p>
        <div className={styles.shutterWrap} style={{ opacity: 0.3, pointerEvents: 'none' }}>
          <svg className={styles.progressRing} viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
          </svg>
          <div className={styles.shutterInner} />
        </div>
        <div style={{ height: 'env(safe-area-inset-bottom, 12px)' }} />
      </div>
    </div>
  );

  // ── CAMERA ────────────────────────────────────────────────────────────────
  if (state === 'camera') return (
    <div className={styles.cameraPage}>

      {flashGreen && <div className={styles.flashOverlay} />}

      <div className={styles.cameraView}>
        <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
        <canvas ref={overlayCanvasRef} className={styles.overlayCanvas} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className={styles.topBar}>
        <div className={styles.pageCounter}>
          <span className={styles.pageCountNum}>{scannedPages.length}</span>
          <span className={styles.pageCountLabel}> page{scannedPages.length !== 1 ? 's' : ''}</span>
        </div>
        <div className={styles.topActions}>
          {scannedPages.length > 0 && (
            <button className={styles.savePdfBtn} onClick={savePdf}>
              <Save size={15} strokeWidth={2.5} />
              <span>Save PDF</span>
            </button>
          )}
          <button className={styles.closeBtn} onClick={() => { stopCamera(); navigate(-1); }}>
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className={styles.bottomBar}>
        <p className={styles.hintText}>
          {autoProgress >= 1
            ? 'Capturing…'
            : autoProgress > 0
              ? 'Hold still…'
              : 'Point at a document'}
        </p>

        <button className={styles.shutterWrap} onClick={captureManual} aria-label="Capture">
          <svg className={styles.progressRing} viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none"
              stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
            <circle cx="40" cy="40" r="34" fill="none"
              stroke={autoProgress > 0.5 ? '#4caf50' : '#2196F3'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - autoProgress)}`}
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 0.08s linear, stroke 0.25s' }}
            />
          </svg>
          <div className={styles.shutterInner} />
        </button>

        <div style={{ height: 'env(safe-area-inset-bottom, 12px)' }} />
      </div>
    </div>
  );

  // ── PROCESSING ────────────────────────────────────────────────────────────
  if (state === 'processing') return (
    <div className="page"><Header /><div className={styles.center}>
      <div className={styles.spinner} />
      <p className={styles.statusTitle}>{t('scan_processing')}</p>
      <p className={styles.statusSub}>{t('scan_processing_subtitle').replace('%d', String(scannedPages.length))}</p>
    </div></div>
  );

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (state === 'done') return (
    <div className="page"><Header /><div className={styles.center}>
      <CircleCheck size={72} color="var(--color-success)" />
      <p className={styles.statusTitle}>{t('scan_done_title')}</p>
      <p className={styles.statusSub}>{t('scan_done_subtitle').replace('%d', String(pageCount))}</p>
      <div className={styles.btnRow}>
        <button className={styles.secondaryBtn} onClick={reset}>{t('scan_another')}</button>
        <button className={styles.primaryBtn} onClick={() => navigate('/files')}>{t('scan_go_files')}</button>
      </div>
    </div></div>
  );

  // ── ERROR ─────────────────────────────────────────────────────────────────
  return (
    <div className="page"><Header /><div className={styles.center}>
      <CircleAlert size={72} color="var(--color-error)" />
      <p className={styles.statusTitle}>{t('scan_failed_title')}</p>
      <p className={styles.statusSub}>{error}</p>
      <div className={styles.btnRow}>
        <button className={styles.secondaryBtn} onClick={reset}>{t('common_retry')}</button>
        <button className={styles.primaryBtn} onClick={() => navigate(-1)}>{t('common_cancel')}</button>
      </div>
    </div></div>
  );
}
