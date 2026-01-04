/// <reference types="astro/client" />

import type { DevtoolsRegistry } from 'batchkit-devtools';

declare global {
  interface Window {
    __BATCHKIT_DEVTOOLS__?: DevtoolsRegistry;
  }
}
