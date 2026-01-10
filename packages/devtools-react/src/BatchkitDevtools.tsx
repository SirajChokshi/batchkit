import { useEffect, useRef, useState, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { mount } from 'batchkit-devtools';

export interface BatchkitDevtoolsProps {
  position?: 'right' | 'bottom' | 'left';
  defaultOpen?: boolean;
  buttonClassName?: string;
  buttonStyle?: CSSProperties;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  projectRoot?: string;
  editor?: 'vscode' | 'cursor' | 'webstorm' | 'idea';
}

export function BatchkitDevtools({
  position,
  defaultOpen,
  buttonClassName,
  buttonStyle,
  panelClassName,
  panelStyle,
  projectRoot,
  editor,
}: BatchkitDevtoolsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const dispose = mount(containerRef.current, {
      position,
      defaultOpen,
      buttonClass: buttonClassName,
      buttonStyle: buttonStyle as Record<string, string>,
      panelClass: panelClassName,
      panelStyle: panelStyle as Record<string, string>,
      projectRoot,
      editor,
    });

    return () => {
      dispose();
    };
  }, [
    mounted,
    position,
    defaultOpen,
    buttonClassName,
    buttonStyle,
    panelClassName,
    panelStyle,
    projectRoot,
    editor,
  ]);

  if (!mounted) return null;

  const portalContent = (
    <div ref={containerRef} data-batchkit-devtools />
  );

  if (typeof document === 'undefined') return null;

  return createPortal(portalContent, document.body);
}

