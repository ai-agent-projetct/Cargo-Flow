import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Apply the saved appearance before the first paint, so a dark theme does not
// flash light on every reload. Settings > Appearance writes this.
const savedTheme = localStorage.getItem('cargoflo.theme') || 'Light';
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.setAttribute(
  'data-theme',
  savedTheme === 'Dark' || (savedTheme === 'System' && prefersDark) ? 'dark' : 'light',
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
