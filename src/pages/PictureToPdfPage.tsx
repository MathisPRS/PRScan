import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, ChevronLeft, ChevronRight, X, CircleCheck, CircleAlert } from 'lucide-react';
import { Header, ActionCard } from '../components';
import { pdfService } from '../services/pdfService';
import { useTranslation } from '../i18n';
import { generateFileName } from '../utils/format';
import styles from './PictureToPdfPage.module.css';

type PageState = 'idle' | 'converting' | 'done' | 'error';

export function PictureToPdfPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [state, setState] = useState<PageState>('idle');
  const [savedName, setSavedName] = useState('');
  const [error, setError] = useState('');

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    newFiles.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
    setImages(prev => [...prev, ...newFiles]);
  };

  const removeImage = (i: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => {
      const updated = prev.filter((_, idx) => idx !== i);
      return updated;
    });
  };

  const moveLeft  = (i: number) => {
    if (i === 0) return;
    setImages(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; });
    setPreviews(prev => { const a = [...prev]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a; });
  };
  const moveRight = (i: number) => {
    if (i === images.length - 1) return;
    setImages(prev => { const a = [...prev]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; });
    setPreviews(prev => { const a = [...prev]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; });
  };

  const convert = async () => {
    if (images.length === 0) { alert(t('pdf_no_images_message')); return; }
    setState('converting');
    try {
      const name = generateFileName('scan');
      await pdfService.imagesToPdf(images, name);
      setSavedName(`${name}.pdf`);
      setState('done');
    } catch (e: any) {
      setError(e?.message ?? 'Conversion failed');
      setState('error');
    }
  };

  const reset = () => {
    setImages([]);
    setPreviews([]);
    setState('idle');
    setError('');
  };

  if (state === 'converting') return (
    <div className="page">
      <Header showBack onBack={() => navigate(-1)} title={t('pdf_title')} />
      <div className={styles.center}>
        <div className={styles.spinner} />
        <p className={styles.statusTitle}>{t('pdf_converting')}</p>
      </div>
    </div>
  );

  if (state === 'done') return (
    <div className="page">
      <Header showBack onBack={() => navigate(-1)} title={t('pdf_title')} />
      <div className={styles.center}>
        <CircleCheck size={64} color="var(--color-success)" />
        <p className={styles.statusTitle}>{t('pdf_done_title')}</p>
        <p className={styles.statusSub}>{t('pdf_done_detail').replace('%d', String(images.length))}</p>
        <p className={styles.fileName}>{savedName}</p>
        <div className={styles.btnRow}>
          <button className={styles.secondaryBtn} onClick={reset}>{t('pdf_convert_more')}</button>
          <button className={styles.primaryBtn} onClick={() => navigate('/files')}>{t('pdf_go_files')}</button>
        </div>
      </div>
    </div>
  );

  if (state === 'error') return (
    <div className="page">
      <Header showBack onBack={() => navigate(-1)} title={t('pdf_title')} />
      <div className={styles.center}>
        <CircleAlert size={64} color="var(--color-error)" />
        <p className={styles.statusTitle}>{t('common_error')}</p>
        <p className={styles.statusSub}>{error}</p>
        <div className={styles.btnRow}>
          <button className={styles.secondaryBtn} onClick={() => setState('idle')}>{t('common_retry')}</button>
          <button className={styles.primaryBtn} onClick={() => navigate(-1)}>{t('common_cancel')}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <Header showBack onBack={() => navigate(-1)} title={t('pdf_title')} />
      <div className="page-content--no-nav" style={{ flex: 1, overflowY: 'auto' }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => addImages(e.target.files)}
        />

        {images.length === 0 ? (
          <div className={styles.dropZone} onClick={() => inputRef.current?.click()}>
            <ImagePlus size={40} color="var(--color-text-tertiary)" />
            <p className={styles.dropTitle}>{t('pdf_add_images')}</p>
            <p className={styles.dropSub}>{t('pdf_add_images_subtitle')}</p>
          </div>
        ) : (
          <>
            <div className={styles.gridHeader}>
              <span className={styles.gridLabel}>{t('pdf_pages_in_order')}</span>
              <button className={styles.addMoreBtn} onClick={() => inputRef.current?.click()}>
                + {t('pdf_add_more')}
              </button>
            </div>
            <div className={styles.grid}>
              {previews.map((src, i) => (
                <div key={i} className={styles.thumb}>
                  <img src={src} alt={`page ${i+1}`} className={styles.thumbImg} />
                  <span className={styles.pageNum}>{i + 1}</span>
                  <button className={styles.removeBtn} onClick={() => removeImage(i)}><X size={12} /></button>
                  <div className={styles.moveRow}>
                    <button className={styles.moveBtn} onClick={() => moveLeft(i)} disabled={i === 0}><ChevronLeft size={14} /></button>
                    <button className={styles.moveBtn} onClick={() => moveRight(i)} disabled={i === images.length - 1}><ChevronRight size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.footer}>
              <ActionCard
                label={t('pdf_convert_button').replace('%d', String(images.length))}
                variant="primary"
                onPress={convert}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
