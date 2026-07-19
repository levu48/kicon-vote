import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { completePopup } from './auth';

// The popup sign-in window lands here. Finish the OIDC handshake (this posts the
// result back to the opener and closes the popup) — no React app needed in the
// popup. Kept out of App so the popup never mounts the full UI or its effects.
if (window.location.pathname === '/auth/popup-callback') {
  completePopup().catch((e) => {
    document.body.textContent = `Sign-in failed: ${e instanceof Error ? e.message : String(e)}`;
  });
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
