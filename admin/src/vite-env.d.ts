/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OIDC issuer. Dev: http://localhost:3000  Prod: https://auth.kicon.com */
  readonly VITE_OIDC_AUTHORITY: string;
  /** Base URL of api.kicon.com (dev: http://localhost:3100). No trailing slash. */
  readonly VITE_API_BASE: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
