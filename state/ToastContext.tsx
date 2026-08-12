import { createContext, useContext, useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";

/* Imperative toasts. Outermost provider: callbacks in every other provider
   (sync failures, save confirmations) must be able to toast. */
interface ToastValue {
  toast: string;
  setToast: Dispatch<SetStateAction<string>>;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState("");
  /* auto-dismiss */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);
  return <ToastContext.Provider value={{ toast, setToast }}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastValue {
  const v = useContext(ToastContext);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}
