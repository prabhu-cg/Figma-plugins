interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div className="dmd-error-banner" role="alert">
      <span>{message}</span>
      <button className="dmd-btn-icon" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
