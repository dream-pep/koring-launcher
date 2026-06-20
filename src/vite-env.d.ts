/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_START_POP: string;
  readonly VITE_START_POP_TITLE: string;
  readonly VITE_START_POP_INFO: string;
  readonly VITE_START_POP_BOUTTON: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
