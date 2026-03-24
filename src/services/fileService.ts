import { openDB, IDBPDatabase } from 'idb';
import { ScannedFile, CloudProvider, StorageInfo } from '../types';
import { getFileType, sanitizeFileName } from '../utils/format';

const DB_NAME = 'prscan-db';
const DB_VERSION = 1;
const STORE = 'files';

interface FileEntry extends ScannedFile {
  data: ArrayBuffer;
}

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    },
  });
}

export async function listFiles(): Promise<ScannedFile[]> {
  const db = await getDB();
  const all = await db.getAll(STORE) as FileEntry[];
  return all.map(({ data: _data, ...rest }) => ({
    ...rest,
    createdAt: new Date(rest.createdAt),
    modifiedAt: new Date(rest.modifiedAt),
  }));
}

export async function saveFile(blob: Blob, fileName: string): Promise<ScannedFile> {
  const db = await getDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const data = await blob.arrayBuffer();
  const entry: FileEntry = {
    id,
    name: fileName,
    path: id,
    size: blob.size,
    createdAt: new Date(),
    modifiedAt: new Date(),
    type: getFileType(fileName),
    data,
  };
  await db.put(STORE, entry);
  const { data: _d, ...file } = entry;
  return file;
}

export async function getFileBlob(file: ScannedFile): Promise<Blob> {
  const db = await getDB();
  const entry = await db.get(STORE, file.id) as FileEntry;
  if (!entry) throw new Error(`File not found: ${file.id}`);
  const mimeType = file.type === 'pdf' ? 'application/pdf'
    : file.type === 'image' ? 'image/jpeg'
    : 'application/octet-stream';
  return new Blob([entry.data], { type: mimeType });
}

export async function renameFile(file: ScannedFile, newName: string): Promise<ScannedFile> {
  const db = await getDB();
  const entry = await db.get(STORE, file.id) as FileEntry;
  if (!entry) throw new Error(`File not found: ${file.id}`);
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const cleanName = sanitizeFileName(newName) + ext;
  const updated: FileEntry = { ...entry, name: cleanName, modifiedAt: new Date() };
  await db.put(STORE, updated);
  const { data: _d, ...result } = updated;
  return result;
}

export async function deleteFile(file: ScannedFile): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, file.id);
}

export async function shareFile(file: ScannedFile): Promise<void> {
  const blob = await getFileBlob(file);
  const webFile = new File([blob], file.name, { type: blob.type });
  if (navigator.canShare?.({ files: [webFile] })) {
    await navigator.share({ files: [webFile], title: file.name });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function uploadToCloud(_file: ScannedFile, provider: CloudProvider): Promise<void> {
  const names: Record<CloudProvider, string> = {
    google_drive: 'Google Drive',
    onedrive: 'OneDrive',
    icloud: 'iCloud Drive',
    local: 'Local',
  };
  alert(`${names[provider]} integration coming soon. Configure in Settings.`);
}

export async function getStorageInfo(): Promise<StorageInfo> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    const available = quota - usage;
    return {
      total: quota,
      used: usage,
      available,
      percentAvailable: quota > 0 ? Math.round((available / quota) * 100) : 100,
    };
  }
  return { total: 0, used: 0, available: 0, percentAvailable: 100 };
}

export const fileService = {
  listFiles,
  saveFile,
  getFileBlob,
  renameFile,
  deleteFile,
  shareFile,
  uploadToCloud,
  getStorageInfo,
};
