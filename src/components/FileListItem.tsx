import React, { useState, useRef, useEffect } from 'react';
import { FileText, Image, Ellipsis, Eye, Share2, Upload, Pencil, Trash2 } from 'lucide-react';
import { ScannedFile } from '../types';
import { formatFileSize, formatDate } from '../utils/format';
import { useTranslation } from '../i18n';
import styles from './FileListItem.module.css';

interface FileListItemProps {
  file: ScannedFile;
  onPress: (file: ScannedFile) => void;
  onRename: (file: ScannedFile) => void;
  onDelete: (file: ScannedFile) => void;
  onShare: (file: ScannedFile) => void;
  onUpload: (file: ScannedFile) => void;
}

export function FileListItem({ file, onPress, onRename, onDelete, onShare, onUpload }: FileListItemProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleDelete = () => {
    setMenuOpen(false);
    if (window.confirm(`${t('files_delete_confirm_title')}\n${t('files_delete_confirm_message').replace('%s', file.name)}`)) {
      onDelete(file);
    }
  };

  return (
    <div className={styles.item}>
      <button className={styles.main} onClick={() => onPress(file)}>
        <div className={styles.iconWrap}>
          {file.type === 'pdf'
            ? <FileText size={20} color="var(--color-primary)" />
            : <Image size={20} color="var(--color-tertiary)" />}
        </div>
        <div className={styles.info}>
          <span className={styles.name}>{file.name}</span>
          <span className={styles.meta}>
            {formatFileSize(file.size)} · {formatDate(new Date(file.createdAt))}
          </span>
        </div>
      </button>
      <div className={styles.menuWrap} ref={menuRef}>
        <button className={styles.moreBtn} onClick={() => setMenuOpen(v => !v)} aria-label="More">
          <Ellipsis size={18} color="var(--color-text-tertiary)" />
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onPress(file); }}>
              <Eye size={16} /><span>{t('common_preview')}</span>
            </button>
            <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onShare(file); }}>
              <Share2 size={16} /><span>{t('common_share')}</span>
            </button>
            <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onUpload(file); }}>
              <Upload size={16} /><span>{t('common_upload_cloud')}</span>
            </button>
            <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onRename(file); }}>
              <Pencil size={16} /><span>{t('common_rename')}</span>
            </button>
            <div className={styles.menuDivider} />
            <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleDelete}>
              <Trash2 size={16} /><span>{t('common_delete')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
