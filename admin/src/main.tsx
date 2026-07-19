import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// The admin surface is never embedded, so there is no popup-callback path here
// (unlike the consumer surface) — only the top-level redirect flow in App.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
