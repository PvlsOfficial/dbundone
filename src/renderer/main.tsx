import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { electronCompat } from './lib/tauriApi';
import { AuthProvider } from './contexts/AuthContext';

// Expose the Tauri API bridge as window.electron for backward compatibility
// This lets all existing components work without modification
(window as any).electron = electronCompat;

// Disable the default browser/webview context menu so only our custom menus appear
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

console.log('main.tsx is executing (Tauri)');
console.log('Root element:', document.getElementById('root'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// Dismiss splash screen once React has rendered
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('splash');
    const root = document.getElementById('root');
    if (splash) {
      splash.classList.add('fade-out');
      // Remove from DOM after transition completes
      setTimeout(() => splash.remove(), 700);
    }
    if (root) {
      root.classList.add('ready');
    }
  });
});

console.log('React render called');
