import { createContext, useContext, useEffect, useState } from "react";

/* Imperative toasts. Outermost provider: callbacks in every other provider
   (sync failures, save confirmations) must be able to toast. */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState("");
  /* auto-dismiss */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);
  return <ToastContext.Provider value={{ toast, setToast }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const v = useContext(ToastContext);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}
