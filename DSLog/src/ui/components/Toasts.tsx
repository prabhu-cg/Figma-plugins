import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";

export function Toasts() {
  const { toasts, dismissToast } = useProjectState();
  if (toasts.length === 0) return null;

  return (
    <div className="dslog-toasts">
      {toasts.map((toast) => (
        <div key={toast.id} className={`dslog-toast dslog-toast--${toast.kind}`} onClick={() => dismissToast(toast.id)}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
