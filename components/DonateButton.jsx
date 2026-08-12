import { useState, useEffect, useRef } from "react";
import { track } from "../lib/analytics.ts";

/* PayPal hosted donate button, injected only when About is open. If the SDK
   cannot load or render (offline, blocked scripts), fall back to a plain link. */
export const DONATE_URL = "https://www.paypal.com/donate/?hosted_button_id=YTQGVLV25V94A";

/* hidden until there is an audience worth asking; flip to true to bring the
   Support section back */
export const SHOW_DONATE = false;

export function DonateButton() {
  const boxRef = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      if (!cancelled) setFailed(true);
    };
    const render = () => {
      if (cancelled || !boxRef.current) return;
      const D = window.PayPal && window.PayPal.Donation;
      if (!D) return fail();
      try {
        boxRef.current.innerHTML = "";
        /* the donate SDK resolves a selector string, not a DOM node; it also
           copies the id onto its injected img, so the container id must differ */
        D.Button({
          env: "production",
          hosted_button_id: "YTQGVLV25V94A",
          image: {
            src: "https://www.paypalobjects.com/en_GB/i/btn/btn_donate_LG.gif",
            alt: "Donate with PayPal button",
            title: "PayPal - The safer, easier way to pay online!",
          },
        }).render("#donate-box");
        track("donate_shown");
      } catch (e) {
        fail();
      }
    };
    if (window.PayPal) {
      render();
      return () => {
        cancelled = true;
      };
    }
    let s = document.getElementById("paypal-donate-sdk");
    if (!s) {
      s = document.createElement("script");
      s.id = "paypal-donate-sdk";
      s.src = "https://www.paypalobjects.com/donate/sdk/donate-sdk.js";
      s.charset = "UTF-8";
      document.head.appendChild(s);
    }
    s.addEventListener("load", render);
    s.addEventListener("error", fail);
    const slow = setTimeout(() => {
      if (!window.PayPal) fail();
    }, 6000);
    return () => {
      cancelled = true;
      clearTimeout(slow);
      s.removeEventListener("load", render);
      s.removeEventListener("error", fail);
    };
  }, []);
  if (failed)
    return (
      <p className="note">
        <a className="donatelink" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
          Donate with PayPal
        </a>
      </p>
    );
  return <div id="donate-box" className="donatebox" ref={boxRef} />;
}
