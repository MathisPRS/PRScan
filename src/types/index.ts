export interface ScannedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  type: 'pdf' | 'image' | 'other';
  pageCount?: number;
  thumbnail?: string;
  /** Full text extracted by Tesseract OCR after scan */
  ocrText?: string;
}

export interface StorageInfo {
  total: number;
  used: number;
  available: number;
  percentAvailable: number;
}

export type CloudProvider = 'google_drive' | 'onedrive' | 'icloud' | 'local';

export interface CloudAccount {
  provider: CloudProvider;
  email?: string;
  connected: boolean;
}

export type SortOption =
  | 'name_asc' | 'name_desc'
  | 'date_asc' | 'date_desc'
  | 'size_asc' | 'size_desc';
