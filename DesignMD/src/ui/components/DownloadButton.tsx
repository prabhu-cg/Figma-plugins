interface DownloadButtonProps {
  onClick: () => void;
  fileCount: number;
}

export function DownloadButton({ onClick, fileCount }: DownloadButtonProps) {
  return (
    <button className="dmd-btn dmd-btn-primary dmd-btn-full" onClick={onClick}>
      Download {fileCount} file{fileCount === 1 ? '' : 's'}
    </button>
  );
}
