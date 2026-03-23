export interface ScannedFile {
  id: string;
  name: string;
  path: string;
  size: number; // bytes
  createdAt: Date;
  modifiedAt: Date;
  type: 'pdf' | 'image' | 'other';
  pageCount?: number;
  thumbnail?: string;
}

export interface StorageInfo {
  total: number; // bytes
  used: number; // bytes
  available: number; // bytes
  percentAvailable: number;
}

export type CloudProvider = 'google_drive' | 'onedrive' | 'icloud' | 'local';

export interface CloudAccount {
  provider: CloudProvider;
  email?: string;
  connected: boolean;
  accessToken?: string;
  refreshToken?: string;
}

export type RootStackParamList = {
  Main: undefined;
  FileManager: undefined;
  FilePreview: { file: ScannedFile };
  ScanDocument: undefined;
  PictureToPdf: undefined;
  RenameFile: { file: ScannedFile };
};

export type BottomTabParamList = {
  Files: undefined;
  Scan: undefined;
  Tools: undefined;
  Settings: undefined;
};

export type SortOption = 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc' | 'size_asc' | 'size_desc';
