/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OIDC issuer. Dev: http://localhost:3000  Prod: https://auth.kicon.com */
  readonly VITE_OIDC_AUTHORITY: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
