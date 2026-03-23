import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { ScannedFile, CloudProvider } from '../types';
import { getFileType, sanitizeFileName } from '../utils/format';

if (!FileSystem.documentDirectory) {
  throw new Error('FileSystem.documentDirectory is null — cannot initialise storage.');
}
const DOCS_DIR: string = FileSystem.documentDirectory + 'prscan/';

// Ensure the storage directory exists
async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOCS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOCS_DIR, { intermediates: true });
  }
}

// List all files from the PRScan directory
async function listFiles(): Promise<ScannedFile[]> {
  await ensureDir();
  try {
    const entries = await FileSystem.readDirectoryAsync(DOCS_DIR);
    const files: ScannedFile[] = [];

    for (const entry of entries) {
      const path = DOCS_DIR + entry;
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && !info.isDirectory) {
        files.push({
          id: path,
          name: entry,
          path,
          size: (info as any).size ?? 0,
          createdAt: new Date((info as any).modificationTime ? (info as any).modificationTime * 1000 : Date.now()),
          modifiedAt: new Date((info as any).modificationTime ? (info as any).modificationTime * 1000 : Date.now()),
          type: getFileType(entry),
        });
      }
    }

    return files;
  } catch {
    return [];
  }
}

// Save a file from a source URI into the PRScan directory
async function saveFile(sourceUri: string, fileName: string): Promise<ScannedFile> {
  await ensureDir();
  const destPath = DOCS_DIR + fileName;
  await FileSystem.copyAsync({ from: sourceUri, to: destPath });
  const info = await FileSystem.getInfoAsync(destPath);
  return {
    id: destPath,
    name: fileName,
    path: destPath,
    size: (info as any).size ?? 0,
    createdAt: new Date(),
    modifiedAt: new Date(),
    type: getFileType(fileName),
  };
}

// Rename a file
async function renameFile(file: ScannedFile, newName: string): Promise<ScannedFile> {
  const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
  const cleanName = sanitizeFileName(newName) + ext;
  const newPath = DOCS_DIR + cleanName;

  await FileSystem.moveAsync({ from: file.path, to: newPath });
  return { ...file, name: cleanName, path: newPath, id: newPath };
}

// Delete a file
async function deleteFile(file: ScannedFile): Promise<void> {
  await FileSystem.deleteAsync(file.path, { idempotent: true });
}

// Share a file using the native share sheet
async function shareFile(file: ScannedFile): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Sharing not available', 'This device does not support sharing.');
    return;
  }

  const mimeType =
    file.type === 'pdf'
      ? 'application/pdf'
      : file.type === 'image'
      ? 'image/jpeg'
      : 'application/octet-stream';

  await Sharing.shareAsync(file.path, {
    mimeType,
    dialogTitle: `Share ${file.name}`,
  });
}

// Upload a file to cloud provider
async function uploadToCloud(file: ScannedFile, provider: CloudProvider): Promise<void> {
  switch (provider) {
    case 'local':
      Alert.alert('Saved', `"${file.name}" is already saved locally.`);
      break;
    case 'google_drive':
      Alert.alert(
        'Google Drive',
        'Connect your Google Drive account in Settings to upload files.',
        [{ text: 'OK' }],
      );
      break;
    case 'onedrive':
      Alert.alert(
        'OneDrive',
        'Connect your OneDrive account in Settings to upload files.',
        [{ text: 'OK' }],
      );
      break;
    case 'icloud':
      Alert.alert(
        'iCloud',
        'Connect your iCloud account in Settings to upload files.',
        [{ text: 'OK' }],
      );
      break;
  }
}

// Get storage info
async function getStorageInfo(): Promise<{ total: number; free: number; used: number }> {
  try {
    const free = await FileSystem.getFreeDiskStorageAsync();
    const total = await FileSystem.getTotalDiskCapacityAsync();
    const used = total - free;
    return { total, free, used };
  } catch {
    return { total: 0, free: 0, used: 0 };
  }
}

export const fileService = {
  listFiles,
  saveFile,
  renameFile,
  deleteFile,
  shareFile,
  uploadToCloud,
  getStorageInfo,
  DOCS_DIR,
};
