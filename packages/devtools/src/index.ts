export { getRegistry, initRegistry, useStore } from './core/registry';
export type {
  BatcherInfo,
  BatchInfo,
  DevtoolsRegistry,
  DevtoolsStore,
  TraceEvent,
  TraceEventType,
} from './core/types';
export type { MountOptions } from './mount';

import { mount as _mount } from './mount';

export const mount: typeof _mount =
  process.env.NODE_ENV !== 'development' ? () => () => {} : _mount;
