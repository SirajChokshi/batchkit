import { Component, JSX } from 'solid-js';

interface ToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
  style?: JSX.CSSProperties;
  class?: string;
}

const baseButtonStyle: JSX.CSSProperties = {
  position: 'fixed',
  bottom: '16px',
  right: '16px',
  width: '40px',
  height: '40px',
  border: '1px solid #44403c',
  background: '#1c1917',
  color: '#a8a29e',
  cursor: 'pointer',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '99999',
  'font-family': 'ui-monospace, monospace',
};

const openButtonStyle: JSX.CSSProperties = {
  ...baseButtonStyle,
  background: '#292524',
  color: '#f5f5f4',
  'border-color': '#57534e',
};

export const ToggleButton: Component<ToggleButtonProps> = (props) => {
  const buttonStyle = () => ({
    ...(props.isOpen ? openButtonStyle : baseButtonStyle),
    ...props.style,
  });

  return (
    <button
      class={props.class}
      style={buttonStyle()}
      onClick={props.onClick}
      title={props.isOpen ? 'Close BatchKit DevTools' : 'Open BatchKit DevTools'}
      aria-label={props.isOpen ? 'Close BatchKit DevTools' : 'Open BatchKit DevTools'}
    >
      {props.isOpen ? "[×]" : "[=]"}
    </button>
  );
};
