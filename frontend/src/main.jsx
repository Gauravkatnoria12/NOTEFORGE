import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Intercept global fetch to transparently prefix cross-origin backend URLs and include credentials cookies
const API_URL = import.meta.env.VITE_API_URL || '';
if (API_URL) {
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    let url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api')) {
      url = `${API_URL}${url}`;
    }
    const requestInit = { ...init };
    requestInit.credentials = 'include';
    if (typeof input === 'object' && input instanceof Request) {
      return originalFetch(new Request(url, { ...input, credentials: 'include' }), init);
    }
    return originalFetch(url, requestInit);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
