import { render } from 'solid-js/web';
import { Panel, type PanelProps } from './components/Panel';
import { initRegistry } from './core/registry';

export interface MountOptions {
  position?: 'right' | 'bottom' | 'left';
  defaultOpen?: boolean;
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

  initRegistry();

  const props: PanelProps = {
    position: options?.position,
    defaultOpen: options?.defaultOpen,
    buttonStyle: options?.buttonStyle,
    buttonClass: options?.buttonClass,
    panelStyle: options?.panelStyle,
    panelClass: options?.panelClass,
  };

  const dispose = render(() => Panel(props), container);

  return dispose;
}
