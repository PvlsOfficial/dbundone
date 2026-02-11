import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { electronCompat } from './lib/tauriApi';

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
    <App />
  </React.StrictMode>
);

console.log('React render called');
