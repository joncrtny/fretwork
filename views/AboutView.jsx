import { CHANGELOG } from "../data/changelog.js";
import { RESOURCES } from "../data/resources.js";
import { track } from "../lib/analytics.ts";
import { DonateButton, SHOW_DONATE } from "../components/DonateButton.jsx";
import { FeedbackForm } from "../components/FeedbackForm.jsx";

/* The About page: what Fretwork is, the changelog, data and accessibility
   notes, recommended learning resources, the feedback form and the donate
   section. `onNavigate(mode)` is the only way out; `startTour` kicks off the
   shell-owned guided tour after navigating to the chord view. */
export function AboutView({ onNavigate, onStartTour }) {
  return (
    <div className="pane about">
      <section className="aboutblock">
        <h2 className="abouthead">About Fretwork</h2>
        <p className="note">
          Fretwork is a free, interactive guitar fretboard for learning the neck: scales, chords with fingerings, intervals, progressions,
          and practice drills with a metronome. It works offline and you can install it on your home screen.
        </p>
        <p className="note freeline">Fretwork is, and always will be, free and without ads.</p>
      </section>

      <section className="aboutblock">
        <h2 className="abouthead">New to guitar, or to Fretwork?</h2>
        <p className="note">
          The FAQ is a plain-language guide to chords, scales, intervals, rhythm and reading the fretboard, alongside how each tool in
          Fretwork works. It is written for beginners.
        </p>
        <button className="btn" onClick={() => onNavigate("faq")}>
          Open the FAQ
        </button>
      </section>

      <section className="aboutblock">
        <h2 className="abouthead">What's new</h2>
        {CHANGELOG.map((rel) => (
          <div key={rel.date} className="release">
            <h3 className="releasedate">{rel.date}</h3>
            <ul className="releaselist">
              {rel.items.map((it) => (
                <li key={it} className="note">
                  {it}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="aboutblock">
        <h2 className="abouthead">Your data</h2>
        <p className="note">
          Fretwork uses Google Analytics, Vercel Analytics and Amplitude to understand how the app is used and improve it. There is no
          session recording. Feedback sent from this page is stored so it can be acted on. No account or personal details are required to
          use the app.
        </p>
      </section>

      <section className="aboutblock">
        <h2 className="abouthead">Good places to learn</h2>
        <p className="note">
          These are the resources most often recommended across the guitar-learning world. Fretwork sits alongside them as your reference
          and practice companion.
        </p>
        <ul className="resources">
          {RESOURCES.map((r) => (
            <li key={r.name}>
              <a href={r.url} target="_blank" rel="noopener noreferrer" onClick={() => track("resource_click", { site: r.name })}>
                {r.name}
              </a>
              <span>{r.blurb}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="aboutblock">
        <h2 className="abouthead">New here?</h2>
        <p className="note">Take a quick guided tour of the neck and the practice tools.</p>
        <button className="btn" onClick={onStartTour}>
          Take the tour
        </button>
      </section>

      <section className="aboutblock">
        <h2 className="abouthead">Accessibility</h2>
        <p className="note">
          Music should be for everyone, and Fretwork aims to be usable by everyone. What works today: the whole app can be driven from a
          keyboard alone, including moving around the fretboard with the arrow keys; menus and dialogs manage focus properly and close with
          Escape; controls carry screen-reader labels and important changes are announced; and Settings offers high contrast, reduced
          animation and zoom, alongside the system reduced-motion preference, which is always respected.
        </p>
        <p className="note">
          Known gaps: some audio feedback has no visual equivalent yet, and the app has not had a formal WCAG audit. Chord shapes are
          described string by string to screen readers. If something gets in your way, please say so in the form below, and it will be
          treated as a bug.
        </p>
      </section>

      <section className="aboutblock">
        <h2 className="abouthead">Suggest a feature</h2>
        <FeedbackForm />
      </section>

      {SHOW_DONATE && (
        <section className="aboutblock">
          <h2 className="abouthead">Support Fretwork</h2>
          <p className="note">
            This web app is a personal project created by Jonathan Courtney. Donate £2 to help with hosting costs if you enjoy it.
          </p>
          <DonateButton />
        </section>
      )}
    </div>
  );
}
