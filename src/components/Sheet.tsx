import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBackHandler, useFocusScope } from "../lib/focus";

/** Bottom sheet / dialog used for menus on mobile and modal choices on TV. Back, scrim tap and Escape close it. */
export function Sheet({ title, onClose, children, className, rootClassName }: { title?: string; onClose: () => void; children: ReactNode; className?: string; rootClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusScope(ref);
  useBackHandler(() => { onClose(); });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className={`sheet-root ${rootClassName ?? ""}`} role="presentation">
      <div className="sheet-scrim" onClick={onClose} />
      <div ref={ref} className={`sheet ${className ?? ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <span className="sheet-grip" aria-hidden="true" />
        {title && <h2 className="sheet-title">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}

export function SheetItem({ icon, label, onClick, danger }: { icon?: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`sheet-item ${danger ? "is-danger" : ""}`} onClick={onClick} data-hover-focus>
      {icon}<span>{label}</span>
    </button>
  );
}
