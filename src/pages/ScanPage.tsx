import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, CircleAlert, ScanText, Zap, Crop, FileOutput } from 'lucide-react';
import { Header } from '../components';
import { pdfService } from '../services/pdfService';
import { useTranslation } from '../i18n';
import { generateFileName } from '../utils/format';
import styles from './ScanPage.module.css';

type ScanState = 'idle' | 'camera' | 'processing' | 'done' | 'error';

declare const cv: any;

export function ScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [state, setState] = useState<ScanState>('idle');
  const [scannedPages, setScannedPages] = useState<Blob[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');
  const [cvReady, setCvReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Load OpenCV.js dynamically
  useEffect(() => {
    if (typeof cv !== 'undefined' && cv.Mat) { setCvReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.onload = () => {
      const check = setInterval(() => {
        if (typeof cv !== 'undefined' && cv.Mat) {
          setCvReady(true);
          clearInterval(check);
        }
      }, 100);
    };
    document.head.appendChild(script);
    return () => { if (script.parentNode) script.parentNode.removeChild(script); };
  }, []);

  // Stop camera on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [stream]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  }, [stream]);

  const startCamera = async () => {
    setState('camera');
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
    } catch (e: any) {
      setError(t('scan_permission_message'));
      setState('error');
    }
  };

  // Edge detection overlay loop
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
    canvas.width  = video.videoWidth  || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;

    try {
      const src = cv.imread(video);
      const gray = new cv.Mat();
      const blurred = new cv.Mat();
      const edges = new cv.Mat();
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      cv.Canny(blurred, edges, 75, 200);
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      // Find largest quadrilateral contour
      let bestContour = null;
      let bestArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < (canvas.width * canvas.height * 0.05)) { cnt.delete(); continue; }
        const peri = cv.arcLength(cnt, true);
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

      // Draw on overlay canvas
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bestContour) {
        const scaleX = canvas.clientWidth  / canvas.width;
        const scaleY = canvas.clientHeight / canvas.height;
        const pts: [number, number][] = [];
        for (let i = 0; i < bestContour.rows; i++) {
          pts.push([bestContour.data32S[i*2] * scaleX, bestContour.data32S[i*2+1] * scaleY]);
        }
        ctx.strokeStyle = '#E53935';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(229,57,53,0.6)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        ctx.stroke();
        // Corner dots
        ctx.fillStyle = '#E53935';
        pts.forEach(p => {
          ctx.beginPath();
          ctx.arc(p[0], p[1], 8, 0, Math.PI * 2);
          ctx.fill();
        });
        bestContour.delete();
      }

      src.delete(); gray.delete(); blurred.delete(); edges.delete();
      contours.delete(); hierarchy.delete();
    } catch (_) {}

    animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
  }, [cvReady]);

  useEffect(() => {
    if (state === 'camera' && videoRef.current) {
      animFrameRef.current = requestAnimationFrame(drawEdgeOverlay);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state, drawEdgeOverlay]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    if (cvReady) {
      try {
        const src = cv.imread(canvas);
        const corrected = perspectiveCorrect(src, canvas.width, canvas.height);
        cv.imshow(canvas, corrected ?? src);
        corrected?.delete();
        src.delete();
      } catch (_) {}
    }

    canvas.toBlob(blob => {
      if (blob) setScannedPages(prev => [...prev, blob]);
    }, 'image/jpeg', 0.95);

    if ('vibrate' in navigator) navigator.vibrate([30, 30, 30]);
  };

  function perspectiveCorrect(src: any, w: number, h: number): any | null {
    try {
      const gray = new cv.Mat(), blurred = new cv.Mat(), edges = new cv.Mat();
      const contours = new cv.MatVector(), hierarchy = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5,5), 0);
      cv.Canny(blurred, edges, 75, 200);
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let bestContour = null, bestArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        if (area < w * h * 0.1) { cnt.delete(); continue; }
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4 && area > bestArea) {
          bestArea = area;
          if (bestContour) bestContour.delete();
          bestContour = approx;
        } else { approx.delete(); }
        cnt.delete();
      }
      gray.delete(); blurred.delete(); edges.delete(); contours.delete(); hierarchy.delete();

      if (!bestContour) return null;
      const pts = [];
      for (let i = 0; i < 4; i++) pts.push({ x: bestContour.data32S[i*2], y: bestContour.data32S[i*2+1] });
      bestContour.delete();

      // Sort points: top-left, top-right, bottom-right, bottom-left
      pts.sort((a, b) => (a.x + a.y) - (b.x + b.y));
      const [tl, br] = [pts[0], pts[3]];
      pts.sort((a, b) => (a.x - a.y) - (b.x - b.y));
      const [bl, tr] = [pts[0], pts[3]];

      const maxW = Math.max(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(br.x - bl.x, br.y - bl.y));
      const maxH = Math.max(Math.hypot(bl.x - tl.x, bl.y - tl.y), Math.hypot(br.x - tr.x, br.y - tr.y));

      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x,tl.y, tr.x,tr.y, br.x,br.y, bl.x,bl.y]);
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0,0, maxW,0, maxW,maxH, 0,maxH]);
      const M = cv.getPerspectiveTransform(srcPts, dstPts);
      const dst = new cv.Mat();
      cv.warpPerspective(src, dst, M, new cv.Size(maxW, maxH));
      srcPts.delete(); dstPts.delete(); M.delete();
      return dst;
    } catch (_) { return null; }
  }

  const savePdf = async () => {
    if (scannedPages.length === 0) return;
    stopCamera();
    setState('processing');
    try {
      const name = generateFileName('scan');
      await pdfService.imagesToPdf(scannedPages, name);
      setPageCount(scannedPages.length);
      setState('done');
      if ('vibrate' in navigator) navigator.vibrate(100);
    } catch (e: any) {
      setError(e?.message ?? 'PDF creation failed');
      setState('error');
    }
  };

  const reset = () => { setScannedPages([]); setPageCount(0); setError(''); setState('idle'); stopCamera(); };

  // ---- UI ----
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
              { icon: <Zap size={16} />, label: t('scan_feature_auto_detect') },
              { icon: <Crop size={16} />, label: t('scan_feature_bg_remove') },
              { icon: <FileOutput size={16} />, label: t('scan_feature_save_pdf') },
            ].map((f, i) => (
              <div key={i} className={styles.featureRow}>
                <span className={styles.featureIcon}>{f.icon}</span>
                <span className={styles.featureLabel}>{f.label}</span>
              </div>
            ))}
          </div>
          <button
            className={styles.startBtn}
            onClick={startCamera}
            disabled={!cvReady}
          >
            {cvReady ? t('scan_start') : 'Loading AI…'}
          </button>
        </div>
      </div>
    </div>
  );

  if (state === 'camera') return (
    <div className={styles.cameraPage}>
      <div className={styles.cameraView}>
        <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
        <canvas ref={overlayCanvasRef} className={styles.overlayCanvas} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      <div className={styles.cameraControls}>
        <div className={styles.pageCount}>{scannedPages.length} page(s)</div>
        <button className={styles.captureBtn} onClick={capture}>
          <div className={styles.captureInner} />
        </button>
        <div className={styles.cameraActions}>
          {scannedPages.length > 0 && (
            <button className={styles.saveBtn} onClick={savePdf}>Save PDF</button>
          )}
          <button className={styles.cancelBtn} onClick={() => { stopCamera(); setState('idle'); }}>Cancel</button>
        </div>
      </div>
    </div>
  );

  if (state === 'processing') return (
    <div className="page"><Header /><div className={styles.center}>
      <div className={styles.spinner} />
      <p className={styles.statusTitle}>{t('scan_processing')}</p>
      <p className={styles.statusSub}>{t('scan_processing_subtitle').replace('%d', String(scannedPages.length))}</p>
    </div></div>
  );

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
