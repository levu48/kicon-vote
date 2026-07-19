import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server runs on :8084 to match the `vote` client's registered dev redirect
// URI at the IdP (http://localhost:8084/auth/callback). Do not change the port
// without also updating the client registration in the auth.kicon.com repo.
export default defineConfig({
  plugins: [react()],
  server: { port: 8084, strictPort: true },
  preview: { port: 8084, strictPort: true },
});
