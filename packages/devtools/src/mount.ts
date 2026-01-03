import { render } from 'solid-js/web';
import { Panel, type PanelProps } from './components/Panel';
import { getRegistry } from './core/registry';

export interface MountOptions {
  buttonStyle?: Record<string, string>;
  buttonClass?: string;
  panelStyle?: Record<string, string>;
  panelClass?: string;
}

export function mount(
  container: HTMLElement,
  options?: MountOptions,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  getRegistry();

  const props: PanelProps = {
    buttonStyle: options?.buttonStyle,
    buttonClass: options?.buttonClass,
    panelStyle: options?.panelStyle,
    panelClass: options?.panelClass,
  };

  const dispose = render(() => Panel(props), container);

  return dispose;
}
