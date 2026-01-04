import * as Devtools from './BatchkitDevtools';

export type { BatchkitDevtoolsProps } from './BatchkitDevtools';

export const BatchkitDevtools: typeof Devtools.BatchkitDevtools =
  process.env.NODE_ENV !== 'development'
    ? function () {
        return null;
      }
    : Devtools.BatchkitDevtools;

export default BatchkitDevtools;
