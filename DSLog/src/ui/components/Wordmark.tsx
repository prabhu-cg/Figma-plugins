import React from "react";
import { PRODUCT_TAGLINE } from "@shared/constants/brand";

export function Wordmark({ withTagline = false, size = "md" }: { withTagline?: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`dslog-wordmark dslog-wordmark--${size}`}>
      <span className="dslog-wordmark__text">
        <span className="dslog-wordmark__ds">DS</span>
        <span className="dslog-wordmark__log">Log</span>
      </span>
      {withTagline && <span className="dslog-wordmark__tagline">{PRODUCT_TAGLINE}</span>}
    </div>
  );
}
