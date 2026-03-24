import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, CircleAlert, ScanText, Zap, Crop, FileOutput, X, Save } from 'lucide-react';
import { Header } from '../components';
import { pdfService } from '../services/pdfService';
import { warmupOCR, recognizeText, detectTextBounds } from '../services/ocrService';
import { useTranslation } from '../i18n';
import { generateFileName } from '../utils/format';
import styles from './ScanPage.module.css';

type ScanState = 'idle' | 'camera' | 'processing' | 'done' | 'error';

declare const cv: any;

// ~1.5 s at ~15 processed fps
const STABLE_FRAMES_REQUIRED  = 22;
const STABLE_DIST_THRESHOLD   = 20; // px

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

  const [state, setState]           = useState<ScanState>('idle');
  const [scannedPages, setScannedPages] = useState<Blob[]>([]);
  const [pageCount, setPageCount]   = useState(0);
  const [error, setError]           = useState('');
  const [cvReady, setCvReady]       = useState(false);
  const [stream, setStream]         = useState<MediaStream | null>(null);
  const [autoProgress, setAutoProgress] = useState(0); // 0–1
  const [flashGreen, setFlashGreen] = useState(false);

  const videoRef         = useRef<HTMLVideoElement>(null);
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef     = useRef<number>(0);
  const stableCountRef   = useRef<number>(0);
  const lastQuadRef      = useRef<Quad | null>(null);
  const capturingRef     = useRef<boolean>(false);
  const ocrTextRef       = useRef<string>('');
  // Timestamp of last OCR fallback attempt (throttle to once every 2 s)
  const lastOcrFallbackRef = useRef<number>(0);

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

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [stream]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    capturingRef.current   = false;
    stableCountRef.current = 0;
    lastQuadRef.current    = null;
    setAutoProgress(0);
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  }, [stream]);

  // ── Start camera ──────────────────────────────────────────────────────────
  const startCamera = async () => {
    setState('camera');
    capturingRef.current   = false;
    stableCountRef.current = 0;
    lastQuadRef.current    = null;
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      // Pre-warm Tesseract in background so first OCR call is fast
      warmupOCR();
    } catch (e: any) {
      setError(t('scan_permission_message'));
      setState('error');
    }
  };

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
    canvas.width  = W;
    canvas.height = H;

    try {
      const src      = cv.imread(video);
      const small    = new cv.Mat();
      const gray     = new cv.Mat();
      const blurred  = new cv.Mat();
      const edges    = new cv.Mat();
      const contours = new cv.MatVector();
      const hier     = new cv.Mat();

      // Process at half resolution for performance
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
        // Scale back: half-res × 2, then CSS scale
        const scaleX = (canvas.clientWidth  / W) * 2;
        const scaleY = (canvas.clientHeight / H) * 2;
        const pts: [number, number][] = [];
        for (let i = 0; i < bestContour.rows; i++) {
          pts.push([bestContour.data32S[i * 2] * scaleX, bestContour.data32S[i * 2 + 1] * scaleY]);
        }
        const detected: Quad = { pts };

        // Stability tracking
        const isStable = lastQuadRef.current !== null &&
          quadDist(lastQuadRef.current, detected) < STABLE_DIST_THRESHOLD;

        stableCountRef.current = isStable
          ? Math.min(stableCountRef.current + 1, STABLE_FRAMES_REQUIRED)
          : 0;
        lastQuadRef.current = detected;

        const progress = stableCountRef.current / STABLE_FRAMES_REQUIRED;
        setAutoProgress(progress);

        // Color transitions blue → green as stability grows
        const r = 0;
        const g = Math.round(150 + 105 * progress);       // 150→255
        const b = Math.round(243 * (1 - progress));        // 243→0
        const color = `rgb(${r},${g},${b})`;
        const glowA = 0.3 + 0.3 * progress;

        // Semi-transparent fill
        ctx.fillStyle = `rgba(${r},${g},${b},${0.07 + 0.06 * progress})`;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.fill();

        // Outline
        ctx.strokeStyle = color;
        ctx.lineWidth   = 3;
        ctx.shadowColor = `rgba(${r},${g},${b},${glowA})`;
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.stroke();

        // Corner circles: outer colored, inner white
        ctx.shadowBlur = 0;
        pts.forEach(p => {
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(p[0], p[1], 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, Math.PI * 2); ctx.fill();
        });

        // Auto-capture when fully stable
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

        // OCR fallback: at most once every 2 s, snapshot current frame and
        // draw a dashed rectangle around the detected text bounds
        const now = Date.now();
        if (now - lastOcrFallbackRef.current > 2000) {
          lastOcrFallbackRef.current = now;
          const snap = document.createElement('canvas');
          snap.width  = W;
          snap.height = H;
          snap.getContext('2d')!.drawImage(video, 0, 0);
          detectTextBounds(snap).then(bounds => {
            if (!bounds || !overlayCanvasRef.current) return;
            const oCtx = overlayCanvasRef.current.getContext('2d');
            if (!oCtx) return;
            // Scale from snap (native res) to overlay CSS size
            const scaleX = overlayCanvasRef.current.clientWidth  / W;
            const scaleY = overlayCanvasRef.current.clientHeight / H;
            const rx = bounds.x * scaleX;
            const ry = bounds.y * scaleY;
            const rw = bounds.w * scaleX;
            const rh = bounds.h * scaleY;
            oCtx.clearRect(0, 0, W, H);
            oCtx.strokeStyle = '#2196F3';
            oCtx.lineWidth   = 2;
            oCtx.setLineDash([10, 6]);
            oCtx.shadowColor = 'rgba(33,150,243,0.4)';
            oCtx.shadowBlur  = 10;
            oCtx.strokeRect(rx, ry, rw, rh);
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

  // ── Auto-capture: green flash → vibrate → capture → resume loop ──────────
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

  // ── Capture one frame (perspective-corrected) ─────────────────────────────
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

    // Run OCR asynchronously — doesn't block the capture flow
    // We grab the pixel data now (synchronously) so it isn't overwritten
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

  // Manual shutter
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
      const M = cv.getPerspectiveTransform(srcPts, dstPts);
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
      const name = generateFileName('scan');
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
    setState('idle'); stopCamera();
  };

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (state === 'idle') return (
    <div className="page">
      <Header />
      <div className="page-content">
        <div className={styles.idleContainer}>
          <div className={styles.scanIcon}><ScanText size={48} color="var(--color-primary)" /></div>
          <h2 className={styles.idleTitle}>{t('scan_title')}</h2>
          <p className={styles.idleSub}>{t('scan_subtitle').replace(/\\n/g, '\n')}</p>
          <div className={styles.features}>
            {[
              { icon: <Zap size={16} />,        label: t('scan_feature_auto_detect') },
              { icon: <Crop size={16} />,       label: t('scan_feature_bg_remove') },
              { icon: <FileOutput size={16} />, label: t('scan_feature_save_pdf') },
            ].map((f, i) => (
              <div key={i} className={styles.featureRow}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <span className={styles.featureLabel}>{f.label}</span>
              </div>
            ))}
          </div>
          <button className={styles.startBtn} onClick={startCamera} disabled={!cvReady}>
            {cvReady ? t('scan_start') : 'Loading AI…'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── CAMERA — true fullscreen, no header, no bottom nav ───────────────────
  if (state === 'camera') return (
    <div className={styles.cameraPage}>

      {/* Green flash on auto-capture */}
      {flashGreen && <div className={styles.flashOverlay} />}

      {/* Full-bleed video + detection overlay */}
      <div className={styles.cameraView}>
        <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
        <canvas ref={overlayCanvasRef} className={styles.overlayCanvas} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Top bar: page count (left) + Save PDF / × (right) */}
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

      {/* Bottom bar: hint + shutter with progress ring */}
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
            {/* Track */}
            <circle cx="40" cy="40" r="34" fill="none"
              stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
            {/* Progress arc */}
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

        {/* Safe-area spacer */}
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
