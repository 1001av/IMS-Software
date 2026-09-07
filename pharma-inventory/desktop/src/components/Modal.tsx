import { ReactNode, useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClass?: string;
}

/** Smooth, modern SaaS modal with backdrop blur and refined typography. */
export function Modal({ title, onClose, children, widthClass = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity"
      onClick={onClose}
    >
      <div
        className={`bg-white border border-line rounded-2xl shadow-2xl p-6 w-full ${widthClass} max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-line/60">
          <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center text-subink hover:text-ink hover:bg-slate-100 transition-colors cursor-pointer"
            onClick={onClose}
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
