import React from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dslog-empty">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
