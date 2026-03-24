import React from 'react';
import { HardDrive, Cloud, X } from 'lucide-react';
import { CloudProvider } from '../types';
import { useTranslation } from '../i18n';
import styles from './CloudUploadModal.module.css';

interface CloudUploadModalProps {
  visible: boolean;
  fileName: string;
  onClose: () => void;
  onSelect: (provider: CloudProvider) => void;
}

const providers: { id: CloudProvider; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'local',        label: 'cloud_local',        icon: <HardDrive size={22} />, color: '#2E7D32' },
  { id: 'google_drive', label: 'cloud_google_drive',  icon: <Cloud size={22} />,     color: '#1A73E8' },
  { id: 'onedrive',     label: 'cloud_onedrive',      icon: <Cloud size={22} />,     color: '#0078D4' },
  { id: 'icloud',       label: 'cloud_icloud',        icon: <Cloud size={22} />,     color: '#555' },
];

export function CloudUploadModal({ visible, fileName, onClose, onSelect }: CloudUploadModalProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.titleRow}>
          <span className={styles.title}>{t('cloud_save_to')}</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>
        <p className={styles.fileName}>{fileName}</p>
        <div className={styles.list}>
          {providers.map(p => (
            <button key={p.id} className={styles.providerBtn} onClick={() => onSelect(p.id)}>
              <span className={styles.providerIcon} style={{ color: p.color }}>{p.icon}</span>
              <span className={styles.providerLabel}>{t(p.label as any)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
