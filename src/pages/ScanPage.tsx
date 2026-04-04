import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CircleCheck, CircleAlert, RotateCcw, Check } from 'lucide-react';
import { Header } from '../components';
import { pdfService } from '../services/pdfService';
import { recognizeText, warmupOCR } from '../services/ocrService';
import { useTranslation } from '../i18n';
import { generateFileName } from '../utils/format';
import styles from './ScanPage.module.css';

declare const cv: any;

type ScanState = 'processing' | 'review' | 'saving' | 'done' | 'error' | 'idle';

// ─── OpenCV lazy loader ────────────────────────────────────────────────────────
let cvLoadPromise: Promise<void> | null = null;
function loadOpenCV(): Promise<void> {
  if (cvLoadPromise) return cvLoadPromise;
  cvLoadPromise = new Promise((resolve) => {
    if (typeof cv !== 'undefined' && cv.Mat) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.onload = () => {
      const check = setInterval(() => {
        if (typeof cv !== 'undefined' && cv.Mat) { clearInterval(check); resolve(); }
      }, 100);
    };
    script.onerror = () => resolve(); // fail gracefully — detection skipped
    document.head.appendChild(script);
  });
  return cvLoadPromise;
}

// ─── Perspective correction ────────────────────────────────────────────────────
function tryPerspectiveCorrect(
  srcCanvas: HTMLCanvasElement,
): { canvas: HTMLCanvasElement; detected: boolean } {
  const out = document.createElement('canvas');

  try {
    const src  = cv.imread(srcCanvas);
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const edge = new cv.Mat();
    const cnts = new cv.MatVector();
    const hier = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edge, 35, 120);

    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edge, edge, kernel);
    kernel.delete();

    cv.findContours(edge, cnts, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const W = srcCanvas.width;
    const H = srcCanvas.height;
    let best: any = null;
    let bestArea = 0;

    for (let i = 0; i < cnts.size(); i++) {
      const cnt  = cnts.get(i);
      const area = cv.contourArea(cnt);
      if (area < W * H * 0.05) { cnt.delete(); continue; }
      const peri   = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
      if (approx.rows === 4 && area > bestArea) {
        bestArea = area;
        if (best) best.delete();
        best = approx;
      } else { approx.delete(); }
      cnt.delete();
    }

    gray.delete(); blur.delete(); edge.delete(); cnts.delete(); hier.delete();

    if (!best) {
      src.delete();
      out.width  = W;
      out.height = H;
      out.getContext('2d')!.drawImage(srcCanvas, 0, 0);
      return { canvas: out, detected: false };
    }

    const raw: { x: number; y: number }[] = [];
    for (let i = 0; i < 4; i++)
      raw.push({ x: best.data32S[i * 2], y: best.data32S[i * 2 + 1] });
    best.delete();

    raw.sort((a, b) => (a.x + a.y) - (b.x + b.y));
    const tl = raw[0];
    const br = raw[3];
    raw.sort((a, b) => (a.x - a.y) - (b.x - b.y));
    const tr = raw[3];
    const bl = raw[0];

    const maxW = Math.round(Math.max(
      Math.hypot(tr.x - tl.x, tr.y - tl.y),
      Math.hypot(br.x - bl.x, br.y - bl.y),
    ));
    const maxH = Math.round(Math.max(
      Math.hypot(bl.x - tl.x, bl.y - tl.y),
      Math.hypot(br.x - tr.x, br.y - tr.y),
    ));

    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2,
      [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2,
      [0, 0, maxW, 0, maxW, maxH, 0, maxH]);
    const M   = cv.getPerspectiveTransform(srcPts, dstPts);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(maxW, maxH));

    srcPts.delete(); dstPts.delete(); M.delete(); src.delete();

    out.width  = maxW;
    out.height = maxH;
    cv.imshow(out, dst);
    dst.delete();

    return { canvas: out, detected: true };
  } catch (_) {
    out.width  = srcCanvas.width;
    out.height = srcCanvas.height;
    out.getContext('2d')!.drawImage(srcCanvas, 0, 0);
    return { canvas: out, detected: false };
  }
}

// ─── Load image file into a canvas ────────────────────────────────────────────
function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas');
      c.width  = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState]             = useState<ScanState>('idle');
  const [rawUrl, setRawUrl]           = useState<string | null>(null);   // photo brute
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);   // photo corrigée
  const [detected, setDetected]       = useState(false);
  const [error, setError]             = useState('');
  const [pageCount, setPageCount]     = useState(0);

  const pagesRef       = useRef<Blob[]>([]);
  const ocrTextRef     = useRef<string>('');
  const resultCanvas   = useRef<HTMLCanvasElement | null>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // ── On mount: process file passed via navigate state, or show idle ──────────
  useEffect(() => {
    warmupOCR();
    loadOpenCV();

    const file: File | undefined = (location.state as any)?.file;
    if (file) {
      processFile(file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCamera = () => inputRef.current?.click();

  const clearPreview = () => {
    if (rawUrl)     { URL.revokeObjectURL(rawUrl);     setRawUrl(null); }
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    resultCanvas.current = null;
  };

  // ── Core processing ─────────────────────────────────────────────────────────
  const processFile = async (file: File) => {
    setState('processing');

    // Show raw photo immediately as background
    const objectUrl = URL.createObjectURL(file);
    setRawUrl(objectUrl);
    setPreviewUrl(null);

    try {
      await loadOpenCV();
      const srcCanvas = await fileToCanvas(file);
      const { canvas, detected: det } = tryPerspectiveCorrect(srcCanvas);

      resultCanvas.current = canvas;
      setDetected(det);
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.95));
      // Keep rawUrl visible until corrected is ready — replaced by previewUrl in review state
      setState('review');
    } catch (err: any) {
      setError(err?.message ?? 'Processing failed');
      setState('error');
    }
  };

  // ── File selected from native camera (for "retry" / "add page" flows) ───────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      if (pagesRef.current.length === 0) navigate(-1);
      return;
    }
    clearPreview();
    await processFile(file);
  };

  // ── Commit current page to session, then save PDF ──────────────────────────
  const commitAndSave = async () => {
    if (!resultCanvas.current) return;
    setState('saving');

    const blob = await new Promise<Blob>((res, rej) =>
      resultCanvas.current!.toBlob(
        b => b ? res(b) : rej(new Error('toBlob failed')),
        'image/jpeg', 0.95,
      ));
    pagesRef.current = [...pagesRef.current, blob];

    const ocrC = document.createElement('canvas');
    ocrC.width  = resultCanvas.current.width;
    ocrC.height = resultCanvas.current.height;
    ocrC.getContext('2d')!.drawImage(resultCanvas.current, 0, 0);
    recognizeText(ocrC).then(text => {
      if (text) ocrTextRef.current += (ocrTextRef.current ? '\n\n--- Page ---\n\n' : '') + text;
    }).catch(() => {});

    try {
      const name = generateFileName('scan');
      await pdfService.imagesToPdf(pagesRef.current, name, ocrTextRef.current || undefined);
      setPageCount(pagesRef.current.length);
      setState('done');
      if ('vibrate' in navigator) navigator.vibrate(100);
    } catch (err: any) {
      setError(err?.message ?? 'PDF creation failed');
      setState('error');
    }
  };

  // ── Commit current page, then open camera for another ─────────────────────
  const commitAndContinue = async () => {
    if (!resultCanvas.current) return;

    const blob = await new Promise<Blob>((res, rej) =>
      resultCanvas.current!.toBlob(
        b => b ? res(b) : rej(new Error('toBlob failed')),
        'image/jpeg', 0.95,
      ));
    pagesRef.current = [...pagesRef.current, blob];

    const ocrC = document.createElement('canvas');
    ocrC.width  = resultCanvas.current.width;
    ocrC.height = resultCanvas.current.height;
    ocrC.getContext('2d')!.drawImage(resultCanvas.current, 0, 0);
    recognizeText(ocrC).then(text => {
      if (text) ocrTextRef.current += (ocrTextRef.current ? '\n\n--- Page ---\n\n' : '') + text;
    }).catch(() => {});

    clearPreview();
    setState('idle');
    openCamera();
  };

  const handleRetry = () => {
    clearPreview();
    setState('idle');
    openCamera();
  };

  const reset = () => {
    pagesRef.current   = [];
    ocrTextRef.current = '';
    clearPreview();
    setPageCount(0);
    navigate('/');   // back to tools — user will tap Scan again to start fresh
  };

  // ── Hidden file input (for retry / add page flows) ─────────────────────────
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      style={{ display: 'none' }}
      onChange={handleFile}
    />
  );

  // ── PROCESSING — raw photo as bg + overlay spinner ─────────────────────────
  if (state === 'processing') return (
    <div className="page">
      {fileInput}
      <div className={styles.processingScreen}>
        {/* Raw photo fills the screen */}
        {rawUrl && (
          <img src={rawUrl} alt="" className={styles.processingBg} />
        )}
        {/* Dark overlay + spinner on top */}
        <div className={styles.processingOverlay}>
          <div className={styles.spinner} />
          <p className={styles.overlayText}>Analyse du document…</p>
          <p className={styles.overlaySub}>Détection des bords en cours</p>
        </div>
      </div>
    </div>
  );

  // ── SAVING ─────────────────────────────────────────────────────────────────
  if (state === 'saving') return (
    <div className="page">
      {fileInput}
      <Header showBack onBack={() => navigate(-1)} />
      <div className={styles.center}>
        <div className={styles.spinner} />
        <p className={styles.statusTitle}>{t('scan_processing')}</p>
        <p className={styles.statusSub}>
          {t('scan_processing_subtitle').replace('%d', String(pagesRef.current.length))}
        </p>
      </div>
    </div>
  );

  // ── REVIEW ─────────────────────────────────────────────────────────────────
  if (state === 'review' && previewUrl) return (
    <div className="page">
      {fileInput}
      <Header
        showBack
        onBack={handleRetry}
        title={detected ? 'Document détecté' : 'Photo capturée'}
        subtitle={
          pagesRef.current.length > 0
            ? `Page ${pagesRef.current.length + 1} — ${detected ? 'bords corrigés' : 'bords non détectés'}`
            : detected ? 'Bords corrigés automatiquement' : 'Bords non détectés'
        }
      />
      <div className={styles.reviewContent}>

        <div className={styles.previewWrapper}>
          <img src={previewUrl} alt="Document" className={styles.previewImg} />
          {detected ? (
            <span className={styles.badgeGreen}>✓ Perspective corrigée</span>
          ) : (
            <span className={styles.badgeOrange}>⚠ Bords non détectés</span>
          )}
        </div>

        <div className={styles.reviewActions}>
          {pagesRef.current.length > 0 && (
            <p className={styles.pageHint}>
              {pagesRef.current.length} page{pagesRef.current.length > 1 ? 's' : ''} déjà ajoutée{pagesRef.current.length > 1 ? 's' : ''}
            </p>
          )}

          <button className={styles.btnPrimary} onClick={commitAndSave}>
            <Check size={18} strokeWidth={2.5} />
            {pagesRef.current.length > 0 ? `Enregistrer PDF (${pagesRef.current.length + 1} p.)` : 'Utiliser — Enregistrer PDF'}
          </button>

          <button className={styles.btnSecondary} onClick={commitAndContinue}>
            + Ajouter une autre page
          </button>

          <button className={styles.btnGhost} onClick={handleRetry}>
            <RotateCcw size={15} strokeWidth={2.5} />
            Réessayer la photo
          </button>
        </div>
      </div>
    </div>
  );

  // ── DONE ───────────────────────────────────────────────────────────────────
  if (state === 'done') return (
    <div className="page">
      {fileInput}
      <Header />
      <div className={styles.center}>
        <CircleCheck size={72} color="var(--color-success)" />
        <p className={styles.statusTitle}>{t('scan_done_title')}</p>
        <p className={styles.statusSub}>
          {t('scan_done_subtitle').replace('%d', String(pageCount))}
        </p>
        <div className={styles.btnRow}>
          <button className={styles.btnSecondary} onClick={reset}>{t('scan_another')}</button>
          <button className={styles.btnPrimary} onClick={() => navigate('/files')}>{t('scan_go_files')}</button>
        </div>
      </div>
    </div>
  );

  // ── ERROR ──────────────────────────────────────────────────────────────────
  if (state === 'error') return (
    <div className="page">
      {fileInput}
      <Header />
      <div className={styles.center}>
        <CircleAlert size={72} color="var(--color-error)" />
        <p className={styles.statusTitle}>{t('scan_failed_title')}</p>
        <p className={styles.statusSub}>{error}</p>
        <div className={styles.btnRow}>
          <button className={styles.btnGhost} onClick={handleRetry}>{t('common_retry')}</button>
          <button className={styles.btnSecondary} onClick={() => navigate(-1)}>{t('common_cancel')}</button>
        </div>
      </div>
    </div>
  );

  // ── IDLE — shown if user navigates to /scan directly without a file ─────────
  return (
    <div className="page">
      {fileInput}
      <Header showBack onBack={() => navigate(-1)} title={t('scan_title')} />
      <div className={styles.center}>
        {pagesRef.current.length > 0 ? (
          <>
            <p className={styles.statusTitle}>
              {pagesRef.current.length} page{pagesRef.current.length > 1 ? 's' : ''} en attente
            </p>
            <p className={styles.statusSub}>Prenez une autre photo ou enregistrez le PDF</p>
            <div className={styles.btnRow}>
              <button className={styles.btnSecondary} onClick={openCamera}>+ Ajouter une page</button>
              <button className={styles.btnPrimary} onClick={async () => {
                setState('saving');
                try {
                  const name = generateFileName('scan');
                  await pdfService.imagesToPdf(pagesRef.current, name, ocrTextRef.current || undefined);
                  setPageCount(pagesRef.current.length);
                  setState('done');
                } catch (e: any) { setError(e?.message); setState('error'); }
              }}>
                Enregistrer PDF ({pagesRef.current.length} p.)
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.statusSub}>Appuyez sur "Scan Document" pour commencer</p>
            <button className={styles.btnGhost} onClick={() => navigate('/')}>
              Retour
            </button>
          </>
        )}
      </div>
    </div>
  );
}
