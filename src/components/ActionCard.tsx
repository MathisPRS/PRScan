import React from 'react';
import { LucideIcon, ChevronRight, Loader } from 'lucide-react';
import styles from './ActionCard.module.css';

type Variant = 'primary' | 'outlined' | 'ghost';

interface ActionCardProps {
  label: string;
  icon?: LucideIcon;
  variant?: Variant;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  description?: string;
}

export function ActionCard({
  label, icon: Icon, variant = 'outlined',
  onPress, loading, disabled, description
}: ActionCardProps) {
  return (
    <button
      className={`${styles.card} ${styles[variant]} ${disabled || loading ? styles.disabled : ''}`}
      onClick={onPress}
      disabled={disabled || loading}
    >
      <div className={styles.left}>
        {loading ? (
          <Loader size={20} className={styles.spinner} color={variant === 'primary' ? '#fff' : 'var(--color-primary)'} />
        ) : Icon ? (
          <Icon size={20} color={variant === 'primary' ? '#fff' : 'var(--color-primary)'} strokeWidth={2} />
        ) : null}
        <div className={styles.textBlock}>
          <span className={styles.label}>{label}</span>
          {description && <span className={styles.desc}>{description}</span>}
        </div>
      </div>
      {variant !== 'primary' && (
        <ChevronRight size={18} color="var(--color-text-tertiary)" />
      )}
    </button>
  );
}
