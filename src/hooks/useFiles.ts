import { useState, useEffect, useCallback } from 'react';
import { fileService } from '../services/fileService';
import { ScannedFile, SortOption } from '../types';

interface UseFilesOptions {
  query?: string;
  sortBy?: SortOption;
}

export function useFiles({ query = '', sortBy = 'date_desc' }: UseFilesOptions = {}) {
  const [allFiles, setAllFiles] = useState<ScannedFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const files = await fileService.listFiles();
      setAllFiles(files);
    } catch (e) {
      console.error('useFiles error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = allFiles.filter(f =>
    !query || f.name.toLowerCase().includes(query.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name_asc':  return a.name.localeCompare(b.name);
      case 'name_desc': return b.name.localeCompare(a.name);
      case 'date_asc':  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'date_desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'size_asc':  return a.size - b.size;
      case 'size_desc': return b.size - a.size;
      default: return 0;
    }
  });

  return { files: sorted, loading, refresh };
}
