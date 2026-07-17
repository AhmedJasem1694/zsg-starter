import React, { createContext, useContext, useState, useCallback } from "react";
import { AlertTriangle, X, AlertCircle } from "lucide-react";

export type ToastType = "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  showError: () => {},
  showWarning: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const showError = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const showWarning = useCallback((message: string) => showToast(message, "warning"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showError, showWarning }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const cfg = {
    error:   { border: "#FECACA", bg: "#FEF2F2", text: "#A32D2D", Icon: AlertTriangle },
    warning: { border: "#FDE68A", bg: "#FFFBEB", text: "#854F0B", Icon: AlertCircle },
    info:    { border: "#BFDBFE", bg: "#EFF6FF", text: "#185FA5", Icon: AlertCircle },
  }[toast.type];

  return (
    <div
      className="pointer-events-auto rounded-xl border px-4 py-3 flex items-start gap-3 shadow-sm"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      <cfg.Icon size={14} className="shrink-0 mt-0.5" style={{ color: cfg.text }} />
      <p className="text-xs leading-relaxed flex-1" style={{ color: cfg.text }}>{toast.message}</p>
      <button onClick={onDismiss} className="shrink-0" style={{ color: cfg.text + "80" }}>
        <X size={13} />
      </button>
    </div>
  );
}
