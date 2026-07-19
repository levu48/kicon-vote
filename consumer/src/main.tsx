import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { completePopup, completeLogoutPopup } from './auth';

// The popup sign-in window lands here. Finish the OIDC handshake (this posts the
// result back to the opener and closes the popup) — no React app needed in the
// popup. Kept out of App so the popup never mounts the full UI or its effects.
if (window.location.pathname === '/auth/popup-callback') {
  completePopup().catch((e) => {
    document.body.textContent = `Sign-in failed: ${e instanceof Error ? e.message : String(e)}`;
  });
} else if (window.location.pathname === '/auth/popup-logout-callback') {
  // The popup SIGN-OUT window lands here. Same idea as sign-in: finish the
  // RP-logout handshake (notifies the opener and closes the popup). Embedded
  // surfaces log out via this popup because they cannot navigate their own
  // iframe to the IdP end-session page (auth denies framing).
  completeLogoutPopup().catch((e) => {
    document.body.textContent = `Sign-out failed: ${e instanceof Error ? e.message : String(e)}`;
  });
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
