import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type StatusTone = "neutral" | "waiting" | "success" | "warning" | "error";

interface StatusBannerProps {
  children: ReactNode;
  tone?: StatusTone;
}

export function StatusBanner({ children, tone = "neutral" }: StatusBannerProps) {
  const icon = tone === "success"
    ? <CheckCircle2 size={17} />
    : tone === "error"
      ? <AlertCircle size={17} />
      : tone === "waiting"
        ? <Loader2 className="spin" size={17} />
        : null;

  return (
    <div className={`status-banner status-${tone}`} role={tone === "error" ? "alert" : "status"}>
      {icon ? <span className="status-icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </div>
  );
}
