import React, { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from './router';
import { loadLanguage } from './i18n';
import './styles/globals.css';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadLanguage().finally(() => setReady(true));
  }, []);

  if (!ready) return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F4F5F7'
    }}>
      <div style={{
        width: 36, height: 36, border: '3px solid #E8EAED',
        borderTopColor: '#E53935', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite'
      }} />
    </div>
  );

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
