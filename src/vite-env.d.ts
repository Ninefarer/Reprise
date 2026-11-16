interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_REPRISE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_PUSH_WORKER_URL?: string;
  readonly VITE_PUSH_SHARED_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
