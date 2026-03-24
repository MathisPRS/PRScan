import { useState, useEffect } from 'react';
import { fileService } from '../services/fileService';
import { StorageInfo } from '../types';

export function useStorage() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  useEffect(() => {
    fileService.getStorageInfo().then(setStorageInfo).catch(console.error);
  }, []);

  return { storageInfo };
}
