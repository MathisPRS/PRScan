import { useState, useEffect } from 'react';
import { fileService } from '../services/fileService';
import { StorageInfo } from '../types';

export function useStorage() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { total, free, used } = await fileService.getStorageInfo();
        setStorageInfo({
          total,
          used,
          available: free,
          percentAvailable: total > 0 ? Math.round((free / total) * 100) : 0,
        });
      } catch {
        // Storage info not critical — silently fail
      }
    };
    load();
  }, []);

  return { storageInfo };
}
