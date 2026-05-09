import type { ReactNode } from "react";

type QAtGuideAction = {
  label: string;
  onClick: () => void;
};

export type QAtGuideCardProps = {
  eyebrow?: string;
  title: string;
  body: string;
  imageSrc?: string;
  videoSrc?: string;
  primaryAction?: QAtGuideAction;
  secondaryAction?: QAtGuideAction;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
  children?: ReactNode;
};

export default function QAtGuideCard({
  eyebrow = "QAt says",
  title,
  body,
  imageSrc = "/qat/qat-peek.png",
  videoSrc,
  primaryAction,
  secondaryAction,
  onDismiss,
  className = "",
  compact = false,
  children,
}: QAtGuideCardProps) {
  const shellClassName = [
    "qat-guide-shell",
    compact ? "qat-guide-shell-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName}>
      <div className="qat-guide-peek-layer" aria-hidden="true">
        {videoSrc ? (
          <video
            className="qat-guide-media"
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img className="qat-guide-media" src={imageSrc} alt="" />
        )}
      </div>

      <section className="qat-guide-card" aria-label={title}>
        <div className="qat-guide-copy">
          <p className="qat-guide-eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p>{body}</p>

          {children ? <div className="qat-guide-extra">{children}</div> : null}

          {primaryAction || secondaryAction || onDismiss ? (
            <div className="qat-guide-actions">
              {primaryAction ? (
                <button
                  className="qat-guide-primary"
                  type="button"
                  onClick={primaryAction.onClick}
                >
                  {primaryAction.label}
                </button>
              ) : null}

              {secondaryAction ? (
                <button
                  className="qat-guide-secondary"
                  type="button"
                  onClick={secondaryAction.onClick}
                >
                  {secondaryAction.label}
                </button>
              ) : null}

              {onDismiss ? (
                <button
                  className="qat-guide-dismiss"
                  type="button"
                  onClick={onDismiss}
                  aria-label="Dismiss QAt guidance"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
