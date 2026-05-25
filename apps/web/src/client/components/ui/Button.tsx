import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger";

interface BaseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> {
  icon?: ReactNode;
  variant?: ButtonVariant;
}

type ButtonProps =
  | (BaseButtonProps & { iconOnly: true; "aria-label": string; title?: string })
  | (BaseButtonProps & { iconOnly: true; "aria-label"?: string; title: string })
  | (BaseButtonProps & { iconOnly?: false; "aria-label"?: string; title?: string });

export function Button({
  children,
  className = "",
  icon,
  iconOnly = false,
  variant = "secondary",
  "aria-label": ariaLabel,
  title,
  ...props
}: ButtonProps) {
  const accessibleLabel = ariaLabel || (iconOnly ? title || (typeof children === "string" ? children : undefined) : undefined);
  const classNames = [
    "button",
    `button-${variant}`,
    iconOnly ? "button-icon-only" : "",
    className
  ].filter(Boolean).join(" ");

  return (
    <button aria-label={accessibleLabel} className={classNames} title={title || (iconOnly ? accessibleLabel : undefined)} type="button" {...props}>
      {icon ? <span className="button-icon" aria-hidden="true">{icon}</span> : null}
      {iconOnly ? null : <span>{children}</span>}
    </button>
  );
}
