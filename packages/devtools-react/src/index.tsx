import { useEffect, useRef, useState, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { mount } from 'batchkit-devtools';

export interface BatchkitDevtoolsProps {
  buttonClassName?: string;
  buttonStyle?: CSSProperties;
  panelClassName?: string;
  panelStyle?: CSSProperties;
}

export function BatchkitDevtools({ 
  buttonClassName,
  buttonStyle,
  panelClassName,
  panelStyle,
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
      buttonClass: buttonClassName,
      buttonStyle: buttonStyle as Record<string, string>,
      panelClass: panelClassName,
      panelStyle: panelStyle as Record<string, string>,
    });
    
    return () => {
      dispose();
    };
  }, [mounted, buttonClassName, buttonStyle, panelClassName, panelStyle]);

  if (!mounted) return null;

  const portalContent = (
    <div
      ref={containerRef}
      data-batchkit-devtools
    />
  );

  if (typeof document === 'undefined') return null;

  return createPortal(portalContent, document.body);
}

export default BatchkitDevtools;

