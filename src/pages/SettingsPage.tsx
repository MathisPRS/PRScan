import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components';
import { useTranslation } from '../i18n';
import type { Language } from '../i18n';
import {
  googleDriveConnect, googleDriveDisconnect, googleDriveStatus,
  oneDriveConnect, oneDriveDisconnect, oneDriveStatus,
  iCloudStatus,
  isFileSystemAccessSupported, pickArchiveFolder,
  getArchiveFolderName, clearArchiveFolder,
} from '../services/cloudService';
import type { CloudProviderState } from '../services/cloudService';
import styles from './SettingsPage.module.css';

// ─── Persistence helpers ─────────────────────────────────────────────────────
const LS_HQ      = 'prscan_high_quality';
const LS_AUTOSAVE = 'prscan_auto_save';

function readBool(key: string, defaultVal: boolean): boolean {
  const v = localStorage.getItem(key);
  return v === null ? defaultVal : v === 'true';
}

// ─── Component ───────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { t, setLanguage, currentLanguage } = useTranslation();

  // Persisted scan preferences
  const [highQuality, setHighQualityState] = useState(() => readBool(LS_HQ, true));
  const [autoSave,    setAutoSaveState]    = useState(() => readBool(LS_AUTOSAVE, true));

  const setHighQuality = (v: boolean) => { localStorage.setItem(LS_HQ, String(v)); setHighQualityState(v); };
  const setAutoSave    = (v: boolean) => { localStorage.setItem(LS_AUTOSAVE, String(v)); setAutoSaveState(v); };

  // Cloud provider states
  const [googleState,   setGoogleState]   = useState<CloudProviderState>(googleDriveStatus);
  const [onedriveState, setOnedriveState] = useState<CloudProviderState>(oneDriveStatus);
  const icloudState                       = iCloudStatus();

  // Archive folder
  const [archiveFolder, setArchiveFolder] = useState<string | null>(getArchiveFolderName);
  const fsSupported = isFileSystemAccessSupported();

  // Loading / error states per provider
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error,   setError]   = useState<Record<string, string>>({});

  const setProviderLoading = (key: string, val: boolean) =>
    setLoading(prev => ({ ...prev, [key]: val }));
  const setProviderError = (key: string, msg: string) =>
    setError(prev => ({ ...prev, [key]: msg }));
  const clearError = (key: string) =>
    setError(prev => ({ ...prev, [key]: '' }));

  // ── Google Drive ──────────────────────────────────────────────────────────
  const handleGoogleConnect = useCallback(async () => {
    clearError('google');
    setProviderLoading('google', true);
    try {
      await googleDriveConnect();
      setGoogleState(googleDriveStatus());
    } catch (e: any) {
      setProviderError('google', e.message ?? 'Unknown error');
    } finally {
      setProviderLoading('google', false);
    }
  }, []);

  const handleGoogleDisconnect = useCallback(() => {
    googleDriveDisconnect();
    setGoogleState(googleDriveStatus());
    clearError('google');
  }, []);

  // ── OneDrive ──────────────────────────────────────────────────────────────
  const handleOnedriveConnect = useCallback(async () => {
    clearError('onedrive');
    setProviderLoading('onedrive', true);
    try {
      await oneDriveConnect();
      setOnedriveState(oneDriveStatus());
    } catch (e: any) {
      setProviderError('onedrive', e.message ?? 'Unknown error');
    } finally {
      setProviderLoading('onedrive', false);
    }
  }, []);

  const handleOnedriveDisconnect = useCallback(() => {
    oneDriveDisconnect();
    setOnedriveState(oneDriveStatus());
    clearError('onedrive');
  }, []);

  // ── Archive folder ────────────────────────────────────────────────────────
  const handlePickFolder = useCallback(async () => {
    clearError('archive');
    try {
      const name = await pickArchiveFolder();
      setArchiveFolder(name);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setProviderError('archive', e.message ?? 'Unknown error');
      }
    }
  }, []);

  const handleClearFolder = useCallback(() => {
    clearArchiveFolder();
    setArchiveFolder(null);
    clearError('archive');
  }, []);

  return (
    <div className="page">
      <Header />
      <div className="page-content">
        <div className={styles.pageTitleWrap}>
          <h1 className={styles.pageTitle}>{t('settings_title')}</h1>
        </div>

        {/* ── Cloud Storage ───────────────────────────────────────────── */}
        <Section label={t('settings_section_cloud')}>
          {/* Google Drive */}
          <CloudRow
            name="Google Drive"
            state={googleState}
            loading={!!loading['google']}
            error={error['google']}
            onConnect={handleGoogleConnect}
            onDisconnect={handleGoogleDisconnect}
            t={t}
          />
          {/* OneDrive */}
          <CloudRow
            name="OneDrive"
            state={onedriveState}
            loading={!!loading['onedrive']}
            error={error['onedrive']}
            onConnect={handleOnedriveConnect}
            onDisconnect={handleOnedriveDisconnect}
            t={t}
          />
          {/* iCloud */}
          <div className={styles.row}>
            <div>
              <p className={styles.rowTitle}>iCloud Drive</p>
              <p className={styles.rowSub}>{t('settings_cloud_icloud_info')}</p>
            </div>
            <span className={styles.unavailableBadge}>N/A</span>
          </div>
        </Section>

        {/* ── Local Archive Folder ────────────────────────────────────── */}
        <Section label={t('settings_section_archive')}>
          <div className={styles.archiveRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {archiveFolder
                ? <p className={styles.rowTitle} style={{ wordBreak: 'break-all' }}>{archiveFolder}</p>
                : <p className={styles.rowSub}>{t('settings_archive_none')}</p>
              }
              {!fsSupported && (
                <p className={styles.hintText}>{t('settings_archive_hint')}</p>
              )}
              {error['archive'] && (
                <p className={styles.errorText}>{error['archive']}</p>
              )}
            </div>
            <div className={styles.archiveBtns}>
              {fsSupported && (
                <button className={styles.connectBtn} onClick={handlePickFolder}>
                  {archiveFolder ? t('settings_archive_change') : t('settings_archive_pick')}
                </button>
              )}
              {archiveFolder && (
                <button className={styles.disconnectBtn} onClick={handleClearFolder}>
                  {t('settings_archive_clear')}
                </button>
              )}
            </div>
          </div>
          {fsSupported && (
            <p className={styles.sectionHint}>{t('settings_archive_hint')}</p>
          )}
        </Section>

        {/* ── Scan Preferences ────────────────────────────────────────── */}
        <Section label={t('settings_section_scan')}>
          <ToggleRow
            title={t('settings_high_quality')}
            subtitle={t('settings_high_quality_subtitle')}
            value={highQuality}
            onChange={setHighQuality}
          />
          <ToggleRow
            title={t('settings_auto_save')}
            subtitle={t('settings_auto_save_subtitle')}
            value={autoSave}
            onChange={setAutoSave}
          />
        </Section>

        {/* ── Language ────────────────────────────────────────────────── */}
        <Section label={t('settings_section_language')}>
          <div className={styles.langRow}>
            {(['en', 'fr'] as Language[]).map(lang => (
              <button
                key={lang}
                className={`${styles.langBtn} ${currentLanguage === lang ? styles.langActive : ''}`}
                onClick={() => setLanguage(lang)}
              >
                {lang === 'en' ? t('settings_language_en') : t('settings_language_fr')}
              </button>
            ))}
          </div>
        </Section>

        {/* ── About ───────────────────────────────────────────────────── */}
        <Section label={t('settings_section_about')}>
          <div className={styles.row}>
            <p className={styles.rowTitle}>{t('settings_version')}</p>
            <p className={styles.rowMeta}>1.0.0</p>
          </div>
          <div className={styles.row}>
            <p className={styles.rowTitle}>{t('settings_build')}</p>
            <p className={styles.rowMeta}>PWA</p>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── CloudRow ─────────────────────────────────────────────────────────────────
interface CloudRowProps {
  name: string;
  state: CloudProviderState;
  loading: boolean;
  error?: string;
  onConnect: () => void;
  onDisconnect: () => void;
  t: (key: any) => string;
}

function CloudRow({ name, state, loading, error, onConnect, onDisconnect, t }: CloudRowProps) {
  const connected = state.status === 'connected';
  return (
    <div>
      <div className={styles.row}>
        <div>
          <p className={styles.rowTitle}>{name}</p>
          <p className={`${styles.rowSub} ${connected ? styles.rowSubConnected : ''}`}>
            {connected ? t('settings_cloud_connected') : t('settings_cloud_not_connected')}
          </p>
        </div>
        {loading
          ? <span className={styles.spinner} />
          : connected
            ? <button className={styles.disconnectBtn} onClick={onDisconnect}>{t('settings_cloud_disconnect')}</button>
            : <button className={styles.connectBtn}    onClick={onConnect}>{t('settings_cloud_connect')}</button>
        }
      </div>
      {error && <p className={styles.errorText} style={{ padding: '0 20px 12px' }}>{error}</p>}
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <p style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '1px',
        textTransform: 'uppercase', color: 'var(--color-text-secondary)',
        padding: '16px 20px 8px',
      }}>{label}</p>
      <div style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── ToggleRow ────────────────────────────────────────────────────────────────
function ToggleRow({
  title, subtitle, value, onChange,
}: {
  title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px', borderBottom: '1px solid var(--color-border)',
    }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{subtitle}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 48, height: 28, borderRadius: 14, flexShrink: 0,
          background: value ? 'var(--color-primary)' : 'var(--color-neutral-300)',
          position: 'relative', transition: 'background 0.2s',
        }}
        aria-checked={value}
        role="switch"
      >
        <span style={{
          position: 'absolute', top: 2, left: value ? 22 : 2,
          width: 24, height: 24, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}
