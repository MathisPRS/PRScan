import React from 'react';
import { formatFileSize } from '../utils/format';
import styles from './StorageBar.module.css';

interface StorageBarProps {
  usedBytes: number;
  totalBytes: number;
}

export function StorageBar({ usedBytes, totalBytes }: StorageBarProps) {
  const pct = totalBytes > 0 ? Math.min((usedBytes / totalBytes) * 100, 100) : 0;
  const available = Math.max(0, 100 - Math.round(pct));
  const color = pct > 90 ? 'var(--color-error)' : pct > 70 ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <span className={styles.label}>STORAGE CAPACITY</span>
        <span className={styles.pct} style={{ color }}>{available}% AVAILABLE</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.detail}>
        {formatFileSize(usedBytes)} used of {formatFileSize(totalBytes)}
      </span>
    </div>
  );
}
