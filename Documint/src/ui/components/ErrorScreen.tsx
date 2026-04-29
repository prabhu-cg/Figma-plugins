import React from 'react';
import {
  centerColumnStyle,
  errorCircleStyle,
  errorMessageStyle,
  buttonStyle,
  buttonHoverStyle,
} from '../styles';

interface ErrorScreenProps {
  message: string;
  selectionCount: number;
  onRetry: () => void;
}

function getErrorGuidance(message: string): { title: string; solution: string } {
  if (message.includes('Design to Doc') || message.includes('getLocalFileExtensionSource')) {
    return {
      title: 'Library Component Issue',
      solution: 'Try selecting components from your own file instead of library components. Some design libraries may have compatibility issues.',
    };
  }
  if (message.includes('No active page')) {
    return {
      title: 'Page Error',
      solution: 'Make sure you have a page open in Figma and try again.',
    };
  }
  return {
    title: 'Documentation Generation Error',
    solution: 'Check your selection and try again.',
  };
}

export function ErrorScreen({ message, selectionCount, onRetry }: ErrorScreenProps) {
  const [isHovering, setIsHovering] = React.useState(false);
  const guidance = getErrorGuidance(message);

  return (
    <div style={{ ...centerColumnStyle, gap: 16, padding: '12px 16px' }}>
      <div style={errorCircleStyle}>✕</div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>
          {guidance.title}
        </div>
        <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5, marginBottom: 8 }}>
          {guidance.solution}
        </div>
        <div style={{ fontSize: 10, color: '#999', lineHeight: 1.4, backgroundColor: '#F5F5F5', padding: '8px 10px', borderRadius: 4, borderLeft: '3px solid #FF6B6B' }}>
          Technical: {message}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: '#999' }}>
        {selectionCount > 0 ? `${selectionCount} component${selectionCount !== 1 ? 's' : ''} still selected` : 'No components selected'}
      </div>

      <button
        onClick={onRetry}
        style={{
          ...buttonStyle,
          ...(isHovering ? buttonHoverStyle : {}),
          width: '100%',
          height: 38,
          fontSize: 13,
        }}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        Try Again
      </button>
    </div>
  );
}
