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
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 6h16M4 12h16M4 18h10"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="square"
        />
        <circle cx="19" cy="18" r="2.5" fill="currentColor" />
      </svg>
    </button>
  );
};
