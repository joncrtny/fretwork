import { useCallback, useEffect, useRef, useState } from "react";
import { store } from "../lib/store.ts";
import { track } from "../lib/analytics.ts";

/* The guided tour: a spotlight-and-card walkthrough of the neck and the nav.
   It drives the shell (opening the drawer, switching view, clearing panels) as
   it steps, so those setters come in as deps. Owns the step index, the measured
   spotlight rect and the focus-trap; App renders the overlay from what this
   returns. `loaded` gates the once-only offer, skipped when arriving on a share
   link (hadShareHash). */
export function useTour({ setDrawer, setMode, setOpenPanel, setGamify, loaded, hadShareHash }) {
  const [tour, setTour] = useState(-1);
  const [tourRect, setTourRect] = useState(null);
  const tourRef = useRef(-1);
  const tourCardRef = useRef(null);
  useEffect(() => {
    tourRef.current = tour;
  }, [tour]);

  const tourSteps = [
    {
      title: "Welcome to Fretwork",
      body: "A quick tour of the neck and the practice tools. About a minute, and you can skip any time.",
      target: null,
      before: () => setDrawer(false),
    },
    {
      title: "The menu",
      body: "Everything lives here, grouped into Learn, Practice, Tools and your Profile. Simple mode at the top keeps things focused while you find your feet; flip it off any time to unlock everything.",
      target: ".drawer",
      before: () => setDrawer(true),
    },
    {
      title: "The fretboard",
      body: "Every view shares this neck. Tap any note to hear it, or drag the capo along the top. It is fully keyboard operable too.",
      target: ".neckwrap",
      before: () => {
        setDrawer(false);
        setMode("chord");
        setOpenPanel(null);
      },
    },
    {
      title: "Pick anything",
      body: "Choose a root and a chord, scale or arpeggio with the same compact pickers. Tap the star to keep anything in your Bank.",
      target: ".pane .row.wrap",
      before: () => {
        setDrawer(false);
        setMode("chord");
      },
    },
    {
      title: "Share it",
      body: "The share button copies a link to exactly what you are looking at, so you can send a shape or a progression to anyone.",
      target: ".sharebtn",
      before: () => {
        setDrawer(false);
        setMode("chord");
      },
    },
    {
      title: "Practise",
      body: "Quiz yourself, drill chord changes, train your ear, and write or paste in melodies from tab. Your practice time builds a streak.",
      target: "[data-tour=practice]",
      before: () => setDrawer(true),
    },
    {
      title: "Tools",
      body: "A metronome with subdivisions, a real microphone tuner that listens to your guitar, and a chord finder that names the shapes you tap on the neck.",
      target: "[data-tour=tools]",
      before: () => setDrawer(true),
    },
    {
      title: "That is the tour",
      body: "Have a play. The About page has learning resources and a place to send feedback. Enjoy.",
      target: null,
      before: () => setDrawer(false),
    },
  ];

  const startTour = useCallback(() => {
    setTour(0);
    track("tour_start");
    setGamify((g) => (g.counters.tourTaken ? g : { ...g, counters: { ...g.counters, tourTaken: 1 } }));
  }, [setGamify]);

  const endTour = useCallback(() => {
    setTour(-1);
    setTourRect(null);
    store.set("fretboard:tourdone", "1").catch(() => {});
  }, []);

  /* keep the spotlight over the current step's target as the layout settles */
  useEffect(() => {
    if (tour < 0) return;
    const step = tourSteps[tour];
    if (step.before) step.before();
    let raf = 0;
    const measure = () => {
      if (!step.target) {
        setTourRect(null);
        return;
      }
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setTourRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      } else setTourRect(null);
    };
    const t = setTimeout(() => {
      measure();
      raf = requestAnimationFrame(measure);
    }, 320);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  /* offer the tour once, after first load. Branch on the resolved value, not on
     a rejection, so it works on every storage backend; skip it for share links. */
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    (async () => {
      let seen = false;
      try {
        const r = await store.get("fretboard:tourdone");
        seen = !!(r && r.value);
      } catch (e) {
        seen = false;
      }
      if (!cancelled && !seen && !hadShareHash) startTour();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /* tour as an operable modal: focus in, trap Tab, Escape closes */
  useEffect(() => {
    if (tour < 0) return;
    const t = setTimeout(() => {
      if (tourCardRef.current) tourCardRef.current.focus();
    }, 60);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        endTour();
        return;
      }
      if (e.key !== "Tab" || !tourCardRef.current) return;
      const f = tourCardRef.current.querySelectorAll("button");
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  return { tour, setTour, tourRect, tourRef, tourCardRef, tourSteps, startTour, endTour };
}
