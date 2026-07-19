import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Admin dev server runs on :8085 (consumer is :8084) so both surfaces can run at
// once locally. The port must match the `vote-admin` client's registered dev
// redirect URI at the IdP (http://localhost:8085/auth/callback) — do not change
// it without updating the client registration in the auth.kicon.com repo.
//
// The admin surface must NEVER be framed (it is the highest-privilege origin).
// These headers enforce that at the dev/preview layer; prod sets the same at the
// CDN/host for admin.vote.kicon.com. The consumer surface deliberately does NOT
// carry these — it is the embeddable one.
const noFraming = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
};

export default defineConfig({
  plugins: [react()],
  server: { port: 8085, strictPort: true, headers: noFraming },
  preview: { port: 8085, strictPort: true, headers: noFraming },
});
