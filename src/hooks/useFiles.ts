import { useState, useEffect, useCallback } from 'react';
import { fileService } from '../services/fileService';
import { ScannedFile, SortOption } from '../types';

interface UseFilesOptions {
  query?: string;
  sortBy?: SortOption;
}

interface UseFilesResult {
  files: ScannedFile[];
  loading: boolean;
  refresh: () => void;
}

export function useFiles(options: UseFilesOptions = {}): UseFilesResult {
  const { query = '', sortBy = 'date_desc' } = options;
  const [allFiles, setAllFiles] = useState<ScannedFile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fileService.listFiles();
      setAllFiles(result);
    } catch (err) {
      console.error('useFiles error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Filter
  const filtered = query.trim()
    ? allFiles.filter((f) =>
        f.name.toLowerCase().includes(query.toLowerCase()),
      )
    : allFiles;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'name_desc':
        return b.name.localeCompare(a.name);
      case 'date_asc':
        return a.modifiedAt.getTime() - b.modifiedAt.getTime();
      case 'date_desc':
        return b.modifiedAt.getTime() - a.modifiedAt.getTime();
      case 'size_asc':
        return a.size - b.size;
      case 'size_desc':
        return b.size - a.size;
      default:
        return b.modifiedAt.getTime() - a.modifiedAt.getTime();
    }
  });

  return { files: sorted, loading, refresh: load };
}
