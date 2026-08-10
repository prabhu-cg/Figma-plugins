import React from "react";
import { PRODUCT_TAGLINE } from "@shared/constants/brand";
import { Logo } from "./Logo";

const LOGO_SIZE: Record<"sm" | "md" | "lg", number> = { sm: 16, md: 22, lg: 28 };

export function Wordmark({ withTagline = false, size = "md" }: { withTagline?: boolean; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`dslog-wordmark dslog-wordmark--${size}`}>
      <Logo size={LOGO_SIZE[size]} />
      <div className="dslog-wordmark__body">
        <span className="dslog-wordmark__text">
          <span className="dslog-wordmark__ds">DS</span>
          <span className="dslog-wordmark__log">Log</span>
        </span>
        {withTagline && <span className="dslog-wordmark__tagline">{PRODUCT_TAGLINE}</span>}
      </div>
    </div>
  );
}
