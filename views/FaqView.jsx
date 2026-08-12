import { useEffect } from "react";
import { FAQ_SECTIONS, FAQS } from "../data/faq.js";
import { VIEW_META } from "../lib/routing.ts";

/* The FAQ: a plain-language beginner's guide, grouped into themed sections,
   with a jump-to-section row and an "open the tool" link on answers that have
   a matching view. `onNavigate(mode)` is the only way out. */
export function FaqView({ onNavigate }) {
  /* Publish FAQPage structured data only while this view is mounted, so the
     markup is present exactly when its questions are in the DOM. Google
     requires FAQ structured data to match content visible on the page, and
     this is a single-page app, so tying the schema to the view keeps them
     honest and in step. Built from the same FAQS the view renders. The static
     WebApplication schema in index.html always applies. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const data = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    let el = document.getElementById("faq-jsonld");
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = "faq-jsonld";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
    return () => {
      const cur = document.getElementById("faq-jsonld");
      if (cur) cur.remove();
    };
  }, []);

  return (
    <div className="pane about faq-pane">
      <section className="aboutblock">
        <h2 className="abouthead">FAQ</h2>
        <p className="note">
          A plain-language guide for anyone learning guitar. It explains the words you will meet, such as chords, intervals, keys and time
          signatures, shows how to read a chord chart and the fretboard, and covers how each tool in Fretwork works. Tap a question to see
          the answer.
        </p>
        <div className="row wrap faqtoc" aria-label="Jump to a section">
          {FAQ_SECTIONS.map((s) => (
            <button
              key={s.id}
              className="jumpchip"
              onClick={() => {
                const el = document.getElementById(`faq-${s.id}`);
                if (el)
                  el.scrollIntoView({
                    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                    block: "start",
                  });
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      </section>

      {FAQ_SECTIONS.map((s) => (
        <section className="aboutblock" id={`faq-${s.id}`} key={s.id}>
          <h2 className="abouthead">{s.title}</h2>
          <div className="faq">
            {s.items.map((f) => (
              <details className="faqitem" key={f.q}>
                <summary>{f.q}</summary>
                <p className="note">{f.a}</p>
                {f.view && VIEW_META[f.view] && (
                  <button
                    className="jumpchip faqjump"
                    onClick={() => {
                      onNavigate(f.view);
                      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
                    }}
                  >
                    Open {VIEW_META[f.view].title}
                  </button>
                )}
              </details>
            ))}
          </div>
        </section>
      ))}

      <section className="aboutblock">
        <h2 className="abouthead">Still stuck?</h2>
        <p className="note">If your question is not answered here, suggest it from the About page and it will be treated as feedback.</p>
        <button className="btn" onClick={() => onNavigate("about")}>
          Go to About
        </button>
      </section>
    </div>
  );
}
