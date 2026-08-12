import { useCallback } from "react";
import { CHORDS, PROGRESSIONS } from "../theory.ts";
import { track } from "../lib/analytics.ts";
import { shareLinkFromParams } from "../lib/share.ts";
import { ChordDiagram } from "../fretboard.jsx";
import { useSettings } from "../state/SettingsContext.jsx";
import { useLibrary } from "../state/LibraryContext.jsx";
import { useToast } from "../state/ToastContext.jsx";

const GROUPS = [
  { kind: "chord", label: "Chords" },
  { kind: "scale", label: "Scales" },
  { kind: "arp", label: "Arpeggios" },
  { kind: "prog", label: "Progressions" },
];

/* The Bank: everything the player has starred, grouped by type. Presentational,
   so it keeps the shell's empty neck and its "Bank · N saved" readout; opening
   an item is shell navigation (it sets up Selection and restore state), so that
   stays in App and arrives as onOpen. Sharing is self-contained and lives here. */
export function BankView({ onOpen }) {
  const { settings, midis, flatsFor } = useSettings();
  const { bank, saveBank } = useLibrary();
  const { setToast } = useToast();

  const shareBankItem = useCallback(
    async (item) => {
      const p = {};
      if (item.kind === "chord") Object.assign(p, { m: "chord", r: item.root, id: item.chordId });
      else if (item.kind === "scale") Object.assign(p, { m: "scale", r: item.root, id: item.scaleId });
      else if (item.kind === "arp") Object.assign(p, { m: "arp", r: item.root, id: item.arpId });
      else if (item.kind === "prog") {
        Object.assign(p, { m: "prog", r: item.root, id: item.progId });
        const isPreset = PROGRESSIONS.some((x) => x.id === item.progId);
        if (!isPreset && item.bars) Object.assign(p, { bars: item.bars, nm: item.name || item.label, sec: item.sections });
      }
      if (item.capo) p.capo = item.capo;
      if (item.tun && item.tun !== "std" && item.tun !== "custom") p.tun = item.tun;
      const url = shareLinkFromParams(p);
      try {
        await navigator.clipboard.writeText(url);
        setToast("Link copied");
      } catch (e) {
        window.prompt("Copy this link", url);
      }
      track("bank_share", { kind: item.kind });
    },
    [setToast],
  );

  return (
    <div className="pane">
      {bank.length === 0 ? (
        <p className="note">
          Nothing saved yet. Tap the star on a chord, scale, arpeggio or progression to keep it here, grouped by type and ready to practise.
          You can share any saved item from here too.
        </p>
      ) : (
        GROUPS.map((group) => {
          const items = bank.filter((b) => (b.kind || "chord") === group.kind);
          if (!items.length) return null;
          return (
            <section className="banksec" key={group.kind}>
              <h2 className="abouthead">{group.label}</h2>
              <div className="banklist">
                {items.map((item) => (
                  <div className="bankitem" key={item.id}>
                    {item.kind === "chord" && item.voicing ? (
                      <ChordDiagram
                        voicing={item.voicing}
                        lefty={settings.leftHanded}
                        midis={item.midis || midis}
                        rootPc={item.root}
                        capo={item.capo || 0}
                        flats={flatsFor(item.root, (CHORDS.find((c) => c.id === item.chordId) || CHORDS[0]).iv)}
                        showDegrees={false}
                        selected={false}
                        onSelect={() => onOpen(item)}
                      />
                    ) : null}
                    <div className="bankmeta">
                      <b>{item.label}</b>
                      <div className="row wrap">
                        <button className="mini" onClick={() => onOpen(item)}>
                          Open
                        </button>
                        <button className="mini" onClick={() => shareBankItem(item)} aria-label={`Share ${item.label}`}>
                          Share
                        </button>
                        <button
                          className="mini"
                          onClick={() => saveBank(bank.filter((b) => b.id !== item.id))}
                          aria-label={`Remove ${item.label}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
