import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Search, X } from 'lucide-react';
import { Header, FileListItem, StorageBar, CloudUploadModal } from '../components';
import { useFiles } from '../hooks/useFiles';
import { useStorage } from '../hooks/useStorage';
import { useTranslation } from '../i18n';
import { fileService } from '../services/fileService';
import { ScannedFile, CloudProvider, SortOption } from '../types';
import styles from './FileManagerPage.module.css';

const SORT_OPTIONS: { value: SortOption; labelKey: string }[] = [
  { value: 'date_desc', labelKey: 'files_sort_date_desc' },
  { value: 'date_asc',  labelKey: 'files_sort_date_asc' },
  { value: 'name_asc',  labelKey: 'files_sort_name_asc' },
  { value: 'name_desc', labelKey: 'files_sort_name_desc' },
  { value: 'size_desc', labelKey: 'files_sort_size_desc' },
  { value: 'size_asc',  labelKey: 'files_sort_size_asc' },
];

export function FileManagerPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [showSort, setShowSort] = useState(false);
  const { files, loading, refresh } = useFiles({ query, sortBy });
  const { storageInfo } = useStorage();
  const [uploadTarget, setUploadTarget] = useState<ScannedFile | null>(null);
  const [renameFile, setRenameFile] = useState<ScannedFile | null>(null);
  const [renameName, setRenameName] = useState('');

  const handleDelete = (file: ScannedFile) => fileService.deleteFile(file).then(refresh);
  const handleShare  = (file: ScannedFile) => fileService.shareFile(file);
  const handleRename = (file: ScannedFile) => {
    setRenameFile(file);
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
    setRenameName(file.name.replace(ext, ''));
  };
  const confirmRename = async () => {
    if (renameFile && renameName.trim()) {
      await fileService.renameFile(renameFile, renameName.trim());
      await refresh();
    }
    setRenameFile(null);
  };

  return (
    <div className="page">
      <Header showAvatar />

      <div className="page-content">
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>{t('files_title')}</h1>
          <div className={styles.sortWrap}>
            <button className={styles.sortBtn} onClick={() => setShowSort(v => !v)}>
              <ArrowUpDown size={16} />
              <span>{t(SORT_OPTIONS.find(o => o.value === sortBy)?.labelKey as any)}</span>
            </button>
            {showSort && (
              <div className={styles.sortMenu}>
                {SORT_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    className={`${styles.sortOption} ${sortBy === o.value ? styles.sortActive : ''}`}
                    onClick={() => { setSortBy(o.value); setShowSort(false); }}
                  >
                    {t(o.labelKey as any)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {storageInfo && (
          <StorageBar usedBytes={storageInfo.used} totalBytes={storageInfo.total} />
        )}

        <div className={styles.searchRow}>
          <Search size={16} color="var(--color-text-tertiary)" />
          <input
            className={styles.searchInput}
            placeholder={t('files_search_placeholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')}><X size={16} color="var(--color-text-tertiary)" /></button>
          )}
        </div>

        <div className={styles.list}>
          {loading ? (
            <div className={styles.center}><div className={styles.spinner} /></div>
          ) : files.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {query ? t('files_no_results_title') : t('files_empty_title')}
              </p>
              <p className={styles.emptySub}>
                {query
                  ? t('files_no_results_subtitle').replace('%s', query)
                  : t('files_empty_subtitle')}
              </p>
            </div>
          ) : (
            <>
              {files.map(file => (
                <FileListItem
                  key={file.id}
                  file={file}
                  onPress={f => navigate('/preview', { state: { file: f } })}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onShare={handleShare}
                  onUpload={f => setUploadTarget(f)}
                />
              ))}
              <p className={styles.endLabel}>{t('files_end_of_history')}</p>
            </>
          )}
        </div>
      </div>

      <CloudUploadModal
        visible={!!uploadTarget}
        fileName={uploadTarget?.name ?? ''}
        onClose={() => setUploadTarget(null)}
        onSelect={p => { if (uploadTarget) fileService.uploadToCloud(uploadTarget, p); setUploadTarget(null); }}
      />

      {renameFile && (
        <div className={styles.renameOverlay} onClick={() => setRenameFile(null)}>
          <div className={styles.renameModal} onClick={e => e.stopPropagation()}>
            <h3>{t('files_rename_title')}</h3>
            <p>{t('files_rename_message')}</p>
            <input
              className={styles.renameInput}
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmRename()}
              autoFocus
            />
            <div className={styles.renameBtns}>
              <button className={styles.cancelBtn} onClick={() => setRenameFile(null)}>{t('common_cancel')}</button>
              <button className={styles.saveBtn} onClick={confirmRename}>{t('common_save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
