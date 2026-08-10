import React from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "secondary", className = "", ...rest }: ButtonProps) {
  return <button type="button" className={`dslog-btn dslog-btn--${variant} ${className}`} {...rest} />;
}
