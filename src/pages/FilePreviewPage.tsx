import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Share2, Upload } from 'lucide-react';
import { Header, CloudUploadModal } from '../components';
import { fileService } from '../services/fileService';
import { ScannedFile, CloudProvider } from '../types';
import { useTranslation } from '../i18n';
import { formatFileSize } from '../utils/format';
import styles from './FilePreviewPage.module.css';

export function FilePreviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const file: ScannedFile = state?.file;

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCloud, setShowCloud] = useState(false);

  useEffect(() => {
    if (!file) return;
    fileService.getFileBlob(file).then(blob => {
      setBlobUrl(URL.createObjectURL(blob));
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [file?.id]);

  if (!file) { navigate('/'); return null; }

  const handleCloudSelect = (provider: CloudProvider) => {
    fileService.uploadToCloud(file, provider).catch(console.error);
    setShowCloud(false);
  };

  return (
    <div className="page">
      <Header
        showBack
        onBack={() => navigate(-1)}
        title={file.name}
        subtitle={formatFileSize(file.size)}
        rightAction={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.iconBtn} onClick={() => fileService.shareFile(file)} aria-label="Share">
              <Share2 size={20} color="var(--color-text-secondary)" />
            </button>
            <button className={styles.iconBtn} onClick={() => setShowCloud(true)} aria-label="Upload">
              <Upload size={20} color="var(--color-text-secondary)" />
            </button>
          </div>
        }
      />
      <div className={`${styles.preview} page-content--no-nav`}>
        {loading ? (
          <div className={styles.center}><div className={styles.spinner} /></div>
        ) : blobUrl ? (
          file.type === 'pdf' ? (
            <object
              data={`${blobUrl}#view=FitV&toolbar=0`}
              type="application/pdf"
              className={styles.pdfEmbed}
              aria-label={file.name}
            >
              {/* Fallback for browsers that don't render PDF inline (e.g. iOS Safari) */}
              <div className={styles.unsupported}>
                <p className={styles.unsupTitle}>{t('preview_unsupported_title')}</p>
                <p className={styles.unsupSub}>{t('preview_unsupported_subtitle')}</p>
                <button className={styles.openBtn} onClick={() => fileService.shareFile(file)}>
                  {t('preview_open_with')}
                </button>
              </div>
            </object>
          ) : (
            <img src={blobUrl} alt={file.name} className={styles.image} />
          )
        ) : (
          <div className={styles.unsupported}>
            <p className={styles.unsupTitle}>{t('preview_unsupported_title')}</p>
            <p className={styles.unsupSub}>{t('preview_unsupported_subtitle')}</p>
            <button className={styles.openBtn} onClick={() => fileService.shareFile(file)}>
              {t('preview_open_with')}
            </button>
          </div>
        )}
      </div>
      <CloudUploadModal
        visible={showCloud}
        fileName={file.name}
        onClose={() => setShowCloud(false)}
        onSelect={handleCloudSelect}
      />
    </div>
  );
}
