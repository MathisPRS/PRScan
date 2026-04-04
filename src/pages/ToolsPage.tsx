import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanText, Images, FilePlus, FileDown, FileSearch, PenLine } from 'lucide-react';
import { Header } from '../components';
import { useTranslation } from '../i18n';
import styles from './ToolsPage.module.css';

interface Tool {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  action: () => void;
  soon?: boolean;
}

export function ToolsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scanInputRef = useRef<HTMLInputElement>(null);

  const handleScanClick = () => {
    // Trigger native camera directly in the tap handler (required by iOS)
    scanInputRef.current?.click();
  };

  const handleScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    navigate('/scan', { state: { file } });
  };

  const tools: Tool[] = [
    { icon: <ScanText size={24} />, titleKey: 'tools_scan',       descKey: 'tools_scan_desc',       action: handleScanClick },
    { icon: <Images size={24} />,   titleKey: 'tools_img_to_pdf', descKey: 'tools_img_to_pdf_desc', action: () => navigate('/picture-to-pdf') },
    { icon: <FilePlus size={24} />,titleKey: 'tools_merge',      descKey: 'tools_merge_desc',      action: () => {}, soon: true },
    { icon: <FileDown size={24} />, titleKey: 'tools_compress',   descKey: 'tools_compress_desc',   action: () => {}, soon: true },
    { icon: <FileSearch size={24} />,titleKey: 'tools_ocr',       descKey: 'tools_ocr_desc',        action: () => {}, soon: true },
    { icon: <PenLine size={24} />,  titleKey: 'tools_sign',       descKey: 'tools_sign_desc',       action: () => {}, soon: true },
  ];

  return (
    <div className="page">
      {/* Hidden input — triggered directly in handleScanClick (iOS requires same-frame tap) */}
      <input
        ref={scanInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleScanFile}
      />
      <Header />
      <div className="page-content">
        <div className={styles.header}>
          <h1 className={styles.title}>{t('tools_title')}</h1>
          <p className={styles.subtitle}>{t('tools_subtitle')}</p>
        </div>
        <div className={styles.grid}>
          {tools.map((tool, i) => (
            <button
              key={i}
              className={`${styles.card} ${tool.soon ? styles.soon : ''}`}
              onClick={tool.action}
              disabled={tool.soon}
            >
              <div className={styles.cardIcon}>{tool.icon}</div>
              <span className={styles.cardTitle}>{t(tool.titleKey as any)}</span>
              <span className={styles.cardDesc}>{t(tool.descKey as any)}</span>
              {tool.soon && <span className={styles.badge}>Soon</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
