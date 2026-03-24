import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Wrench, FolderOpen, Settings, LucideIcon } from 'lucide-react';
import { useTranslation } from '../i18n';
import styles from './BottomTabLayout.module.css';

interface Tab {
  path: string;
  icon: LucideIcon;
  labelKey: string;
}

const TABS: Tab[] = [
  { path: '/',         icon: Wrench,     labelKey: 'tools_title'    },
  { path: '/files',    icon: FolderOpen, labelKey: 'files_title'    },
  { path: '/settings', icon: Settings,   labelKey: 'settings_title' },
];

export function BottomTabLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Outlet />
      </div>
      <nav className={styles.nav}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = pathname === tab.path;
          return (
            <button
              key={tab.path}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => navigate(tab.path)}
            >
              <Icon
                size={22}
                color={isActive ? 'var(--color-primary)' : 'var(--color-text-tertiary)'}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`${styles.tabLabel} ${isActive ? styles.tabLabelActive : ''}`}>
                {t(tab.labelKey as any)}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
