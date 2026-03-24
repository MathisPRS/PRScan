import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { BottomTabLayout } from '../components/BottomTabLayout';
import { ToolsPage }        from '../pages/ToolsPage';
import { FileManagerPage }  from '../pages/FileManagerPage';
import { SettingsPage }     from '../pages/SettingsPage';
import { ScanPage }         from '../pages/ScanPage';
import { FilePreviewPage }  from '../pages/FilePreviewPage';
import { PictureToPdfPage } from '../pages/PictureToPdfPage';

export function AppRouter() {
  return (
    <Routes>
      <Route element={<BottomTabLayout />}>
        <Route path="/"         element={<ToolsPage />} />
        <Route path="/files"    element={<FileManagerPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route element={<BottomTabLayout />}>
        <Route path="/scan" element={<ScanPage />} />
      </Route>
      <Route path="/preview"        element={<FilePreviewPage />} />
      <Route path="/picture-to-pdf" element={<PictureToPdfPage />} />
    </Routes>
  );
}
