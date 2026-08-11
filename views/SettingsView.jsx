import { track } from "../lib/analytics.js";
import { Seg } from "../components/Seg.jsx";
import { Field } from "../components/Field.jsx";
import { useSettings } from "../state/SettingsContext.jsx";
import { useProgress } from "../state/ProgressContext.jsx";

/* Settings: fretboard display, chord-shape rules, appearance and accessibility
   preferences. A pure Settings consumer, plus one Progress write: the Simple
   toggle bumps the triedSimple gamify counter. */
export function SettingsView() {
  const { settings, setSettings } = useSettings();
  const { setGamify } = useProgress();

  return (
    <div className="pane">
      <div className="grid">
        <Field label="Frets" tip="How many frets the neck shows">
          <input
            type="range"
            min="7"
            max="27"
            value={settings.fretCount}
            aria-label="Frets shown"
            onChange={(e) => setSettings((s) => ({ ...s, fretCount: +e.target.value }))}
          />
          <output>{settings.fretCount}</output>
        </Field>
      </div>

      <div className="toggles">
        <Field label="Note names" tip="Auto spells notes from the current key, so C minor reads Eb rather than D sharp">
          <Seg
            small
            options={[
              { v: "auto", l: "Auto" },
              { v: "sharps", l: "Sharps" },
              { v: "flats", l: "Flats" },
            ]}
            value={settings.noteNames}
            onChange={(v) => setSettings((s) => ({ ...s, noteNames: v }))}
          />
        </Field>
        <Field label="Dot labels" tip="What the dots on the neck display by default">
          <Seg
            small
            options={[
              { v: "name", l: "Names" },
              { v: "degree", l: "Degrees" },
              { v: "none", l: "Blank" },
            ]}
            value={settings.labelMode}
            onChange={(v) => setSettings((s) => ({ ...s, labelMode: v }))}
          />
        </Field>
        <Field label="Colour" tip="Colour dots by their interval from the root, by root only, or keep them plain">
          <Seg
            small
            options={[
              { v: "root", l: "Root" },
              { v: "interval", l: "By interval" },
              { v: "mono", l: "Mono" },
            ]}
            value={settings.colourMode}
            onChange={(v) => setSettings((s) => ({ ...s, colourMode: v }))}
          />
        </Field>
        <Field label="String order" tip="High on top reads like tab; low on top matches looking down at a guitar">
          <Seg
            small
            options={[
              { v: true, l: "High on top" },
              { v: false, l: "Low on top" },
            ]}
            value={settings.highOnTop}
            onChange={(v) => setSettings((s) => ({ ...s, highOnTop: v }))}
          />
        </Field>
        <Field label="Handed" tip="Flips the neck for left-handed players">
          <Seg
            small
            options={[
              { v: false, l: "Right" },
              { v: true, l: "Left" },
            ]}
            value={settings.leftHanded}
            onChange={(v) => setSettings((s) => ({ ...s, leftHanded: v }))}
          />
        </Field>
        <Field label="Chord stretch" tip="The widest fret span a suggested chord shape may use">
          <Seg
            small
            options={[
              { v: 3, l: "3 frets" },
              { v: 4, l: "4" },
              { v: 5, l: "5" },
            ]}
            value={settings.span}
            onChange={(v) => setSettings((s2) => ({ ...s2, span: v }))}
          />
        </Field>
        <Field label="Inversions" tip="Allow shapes whose lowest note is not the root">
          <Seg
            small
            options={[
              { v: false, l: "Root bass" },
              { v: true, l: "Allow" },
            ]}
            value={settings.inversions}
            onChange={(v) => setSettings((s2) => ({ ...s2, inversions: v }))}
          />
        </Field>
        <Field label="Barres" tip="Allow shapes that lay one finger across several strings">
          <Seg
            small
            options={[
              { v: true, l: "Allow" },
              { v: false, l: "Avoid" },
            ]}
            value={settings.barres}
            onChange={(v) => setSettings((s2) => ({ ...s2, barres: v }))}
          />
        </Field>
        <Field label="Theme" tip="Light or dark appearance">
          <Seg
            small
            options={[
              { v: false, l: "Light" },
              { v: true, l: "Dark" },
            ]}
            value={settings.dark}
            onChange={(v) => {
              track("theme_set", { dark: v });
              setSettings((s2) => ({ ...s2, dark: v }));
            }}
          />
        </Field>
        <Field label="Options shown" tip="Simple keeps only the scales, chords and controls a beginner needs">
          <Seg
            small
            options={[
              { v: true, l: "Simple" },
              { v: false, l: "Everything" },
            ]}
            value={settings.simple}
            onChange={(v) => {
              track("simple_toggle", { on: v });
              setSettings((s2) => ({ ...s2, simple: v }));
              setGamify((g) => (g.counters.triedSimple ? g : { ...g, counters: { ...g.counters, triedSimple: 1 } }));
            }}
          />
        </Field>
        <Field label="Sound" tip="Note and click playback throughout the app">
          <Seg
            small
            options={[
              { v: true, l: "On" },
              { v: false, l: "Off" },
            ]}
            value={settings.sound}
            onChange={(v) => setSettings((s) => ({ ...s, sound: v }))}
          />
        </Field>
      </div>

      <h3 className="sheetsec">Accessibility</h3>
      <div className="toggles">
        <Field label="High contrast" tip="Stronger borders and darker labels for readability">
          <Seg
            small
            options={[
              { v: false, l: "Off" },
              { v: true, l: "On" },
            ]}
            value={settings.highContrast}
            onChange={(v) => {
              track("a11y_contrast", { on: v });
              setSettings((s) => ({ ...s, highContrast: v }));
            }}
          />
        </Field>
        <Field label="Animation" tip="Reduced switches off movement effects; the system preference is always respected">
          <Seg
            small
            options={[
              { v: false, l: "Full" },
              { v: true, l: "Reduced" },
            ]}
            value={settings.lowMotion}
            onChange={(v) => {
              track("a11y_motion", { reduced: v });
              setSettings((s) => ({ ...s, lowMotion: v }));
            }}
          />
        </Field>
        <Field label="Zoom" tip="Scales the whole fretboard up for larger targets">
          <input
            type="range"
            min="0.7"
            max="2.2"
            step="0.1"
            value={settings.zoom}
            aria-label="Fretboard zoom"
            onChange={(e) => setSettings((s) => ({ ...s, zoom: +e.target.value }))}
          />
          <output>{settings.zoom.toFixed(1)}×</output>
        </Field>
      </div>
      <p className="note">The system reduced-motion preference is always respected. These controls apply on top of it.</p>
    </div>
  );
}
