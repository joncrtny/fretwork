import { Seg } from "./Seg.tsx";
import { Field } from "./Field.tsx";
import { ALL_FLAGS } from "../flags.ts";
import { useFlags } from "../state/FlagsContext.tsx";
import { flagsPanelEnabled, urlForcedKeys } from "../lib/flags.ts";

/* Dev-only feature flags panel, the client-side equivalent of a flags explorer.
   Hidden unless ?flags has been used on this device (see flagsPanelEnabled).
   Overrides are device-local; the reset button drops back to the flag's own
   default. A flag forced by a ?ff_<key>= URL param wins over the local layer, so
   it is shown read-only rather than with controls that could not move it.
   Rendered inside Settings. */
export function FlagsPanel() {
  const { get, overrides, setOverride } = useFlags();
  if (!flagsPanelEnabled()) return null;

  const forced = urlForcedKeys();

  return (
    <>
      <h3 className="sheetsec">Feature flags</h3>
      <div className="toggles">
        {ALL_FLAGS.map((f) => {
          const overridden = Object.prototype.hasOwnProperty.call(overrides, f.key);
          if (forced.has(f.key)) {
            return (
              <Field key={f.key} label={f.key} tip={f.description}>
                <span className="note">{String(get(f))}, forced by a ?ff_ link</span>
              </Field>
            );
          }
          return (
            <Field key={f.key} label={f.key} tip={f.description}>
              <Seg
                small
                ariaLabel={f.key}
                options={f.options.map((o) => ({ v: o.value, l: o.label }))}
                value={get(f)}
                onChange={(v) => setOverride(f.key, v)}
              />
              {overridden && (
                <button type="button" className="ghost" onClick={() => setOverride(f.key, null)} aria-label={`Reset ${f.key} to its default`}>
                  Reset
                </button>
              )}
            </Field>
          );
        })}
      </div>
      <p className="note">Local overrides, stored on this device only. Add ?flags to any URL to reveal this panel; append ?ff_&lt;key&gt;=on/off to force a flag for one link.</p>
    </>
  );
}
