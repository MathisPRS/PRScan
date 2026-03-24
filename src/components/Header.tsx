import React from 'react';
import { ScanSearch, ArrowLeft, User } from 'lucide-react';
import styles from './Header.module.css';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showAvatar?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function Header({ title, subtitle, showBack, showAvatar, onBack, rightAction }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showBack ? (
          <button className={styles.backBtn} onClick={onBack} aria-label="Back">
            <ArrowLeft size={22} color="var(--color-text-primary)" />
          </button>
        ) : (
          <div className={styles.logo}>
            <ScanSearch size={22} color="var(--color-primary)" strokeWidth={2.5} />
            <span className={styles.logoText}>PRScan</span>
          </div>
        )}
      </div>
      {title && (
        <div className={styles.center}>
          <span className={styles.title}>{title}</span>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
        </div>
      )}
      <div className={styles.right}>
        {rightAction}
        {showAvatar && (
          <div className={styles.avatar}>
            <User size={18} color="var(--color-text-secondary)" />
          </div>
        )}
      </div>
    </header>
  );
}
