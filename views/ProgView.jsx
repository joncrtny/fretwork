import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { CHORDS, PROGRESSIONS, SIMPLE_PROGS, ROMAN, MINOR_STARTS, nameOf, keyPrefersFlats, simpleList } from "../theory.ts";
import { track } from "../lib/analytics.ts";
import { pluck } from "../audio.ts";
import { findVoicings } from "../voicings.js";
import { ChordDiagram } from "../fretboard.jsx";
import { Field } from "../components/Field.jsx";
import { Seg } from "../components/Seg.jsx";
import { KeyPicker } from "../components/KeyPicker.jsx";
import { CatPicker } from "../components/CatPicker.jsx";
import { useSettings } from "../state/SettingsContext.tsx";
import { useSelection } from "../state/SelectionContext.tsx";
import { usePlayback } from "../state/PlaybackContext.jsx";
import { useLibrary } from "../state/LibraryContext.jsx";
import { useToast } from "../state/ToastContext.tsx";
import { usePublishFretboard } from "../state/FretboardContext.tsx";
import { usePublishReadout } from "../state/ReadoutContext.tsx";

const EMPTY = new Set();

/* Progressions: play through common chord progressions in any key, seeing each
   shape as the sequence moves, plus a custom builder (by chord name or Roman
   numeral, with song sections). The key/progression/builder selection lives in
   Selection so share links and Bank can restore it; the playback cursor and the
   builder's key-quality toggle are local. Publishes the neck (the active shape)
   and the readout. `onNavigate` opens the current chord in the Chords view. */
export function ProgView({ onNavigate }) {
  const { settings, midis, n, fretCount, capo } = useSettings();
  const { progRoot, setProgRoot, progId, setProgId, builder, setBuilder, setChordRoot, setChordId } = useSelection();
  const { playNote, stopPlayback, progPlaying, setProgPlaying, playTimers } = usePlayback();
  const { customProgs, saveCustomProgs, bank, saveToBank } = useLibrary();
  const { setToast } = useToast();

  const [progIdx, setProgIdx] = useState(0);
  const [builderKeyQual, setBuilderKeyQual] = useState("major"); // major/minor, for the "add by chord name" picker

  const progDef = useMemo(() => {
    const preset = PROGRESSIONS.find((p) => p.id === progId);
    if (preset) return preset;
    const saved = customProgs.find((p) => p.id === progId);
    if (saved) return saved;
    if (progId === "custom") {
      const minorish = MINOR_STARTS.has(builder.bars[0]);
      return {
        id: "custom",
        name: builder.name.trim() || "Custom",
        note: "Build your own",
        tonality: minorish ? "minor" : "major",
        bars: builder.bars,
        sections: builder.sections,
      };
    }
    return PROGRESSIONS[0];
  }, [progId, customProgs, builder]);

  const flats =
    settings.noteNames === "sharps"
      ? false
      : settings.noteNames === "flats"
        ? true
        : keyPrefersFlats(progRoot, progDef.tonality === "minor" ? [3] : [4]);

  const progChords = useMemo(
    () =>
      progDef.bars.map((rn) => {
        const entry = ROMAN[rn] || [0, "maj"];
        const def = CHORDS.find((c) => c.id === entry[1]) || CHORDS[0];
        return { roman: rn, rootPc: (progRoot + entry[0]) % 12, chordId: entry[1], def };
      }),
    [progDef, progRoot],
  );

  const progVoicings = useMemo(() => {
    const cache = new Map();
    return progChords.map((c) => {
      const key = `${c.rootPc}:${c.chordId}`;
      if (!cache.has(key)) {
        const v = findVoicings(c.rootPc, c.def.iv, midis, fretCount, capo, { span: 4, inversions: false, barres: true });
        cache.set(key, v[0] || null);
      }
      return cache.get(key);
    });
  }, [progChords, midis, fretCount, capo]);

  useEffect(() => {
    setProgIdx(0);
  }, [progId, progRoot]);

  const activeProg = progChords[Math.min(progIdx, progChords.length - 1)] || null;
  const activeProgVoicing = progVoicings[Math.min(progIdx, progVoicings.length - 1)] || null;

  /* collapse runs of identical bars, so a 12-bar blues reads as three charts
     with bar counts rather than twelve repeats */
  const progGroups = useMemo(() => {
    const sections = progDef.sections || {};
    const out = [];
    progChords.forEach((c, i) => {
      const last = out[out.length - 1];
      const sec = sections[i];
      if (last && !sec && progChords[last.start].roman === c.roman) last.count += 1;
      else out.push({ start: i, count: 1, section: sec || null });
    });
    return out;
  }, [progChords, progDef]);

  /* split the collapsed groups into named song sections */
  const songBlocks = useMemo(() => {
    const blocks = [];
    progGroups.forEach((g) => {
      if (g.section || blocks.length === 0) blocks.push({ name: g.section || null, groups: [g] });
      else blocks[blocks.length - 1].groups.push(g);
    });
    return blocks;
  }, [progGroups]);
  const hasSections = progGroups.some((g) => g.section);

  const marks = useMemo(() => {
    const map = new Map();
    if (activeProg && activeProgVoicing) {
      for (let s = 0; s < n; s++) {
        const f = activeProgVoicing.frets[s];
        if (f === null) continue;
        const pc = (midis[s] + f) % 12;
        map.set(`${s}:${f}`, {
          pc,
          semis: (pc - activeProg.rootPc + 24) % 12,
          tone: "chord",
          state: "on",
          finger: activeProgVoicing.fingering[s] == null ? null : activeProgVoicing.fingering[s],
        });
      }
    }
    return map;
  }, [activeProg, activeProgVoicing, midis, n]);

  const barre = useMemo(
    () =>
      activeProgVoicing && activeProgVoicing.barreFret != null
        ? { fret: activeProgVoicing.barreFret, from: activeProgVoicing.barreFrom, to: activeProgVoicing.barreTo }
        : null,
    [activeProgVoicing],
  );

  const onCell = useCallback(
    (s, f, midi) => {
      if (capo > 0 && f > 0 && f < capo) return;
      playNote(midi);
    },
    [capo, playNote],
  );

  usePublishFretboard(
    useMemo(
      () => ({
        marks,
        onCell,
        flats,
        labelMode: "finger",
        colourMode: settings.colourMode,
        barre,
        ghosts: EMPTY,
        quizActive: false,
        quizRange: undefined,
      }),
      [marks, onCell, flats, settings.colourMode, barre],
    ),
  );

  usePublishReadout(`${nameOf(progRoot, flats)} · ${progDef.name} · ${progDef.bars.length} bars`);

  const playProgression = useCallback(() => {
    stopPlayback();
    if (!progChords.length) return;
    setProgPlaying(true);
    const barSec = (60 / settings.bpm) * settings.beats;
    playTimers.current.push(setTimeout(() => setProgPlaying(false), progChords.length * barSec * 1000));
    progChords.forEach((c, i) => {
      const v = progVoicings[i];
      if (v) {
        let j = 0;
        for (let st = 0; st < n; st++) {
          const f = v.frets[st];
          if (f === null) continue;
          playNote(midis[st] + f, i * barSec + j * 0.028);
          j++;
        }
      }
      playTimers.current.push(setTimeout(() => setProgIdx(i), i * barSec * 1000));
    });
  }, [stopPlayback, settings.bpm, settings.beats, progChords, progVoicings, midis, n, playNote, playTimers, setProgPlaying]);

  const renderProgDiagram = (g) => {
    const i = g.start;
    const c = progChords[i];
    if (!progVoicings[i]) return null;
    return (
      <ChordDiagram
        key={i}
        voicing={progVoicings[i]}
        lefty={settings.leftHanded}
        midis={midis}
        rootPc={c.rootPc}
        capo={capo}
        flats={flats}
        showDegrees={false}
        selected={progIdx >= i && progIdx < i + g.count}
        title={`${nameOf(c.rootPc, flats)}${c.def.suffix}`}
        caption={g.count > 1 ? `${c.roman} · ${g.count} bars` : c.roman}
        onSelect={() => {
          setProgIdx(i);
          const v = progVoicings[i];
          if (v && settings.sound) {
            let j = 0;
            for (let st = 0; st < n; st++) {
              const f = v.frets[st];
              if (f === null) continue;
              pluck(midis[st] + f, j * 0.03);
              j++;
            }
          }
        }}
      />
    );
  };

  const progSig = `prog:${progRoot}:${progId}:${progDef.bars.join(",")}`;

  return (
    <div className="pane">
      <p className="panelead">Play through common chord progressions in any key, seeing every chord shape as the sequence moves along.</p>
      {progVoicings.some(Boolean) ? (
        hasSections ? (
          <div className="songsheet">
            {songBlocks.map((blk, bi) => (
              <div className="songsec" key={bi}>
                {blk.name && <p className="secname">{blk.name}</p>}
                <div className="voicings">{blk.groups.map(renderProgDiagram)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="voicings">{progGroups.map(renderProgDiagram)}</div>
        )
      ) : (
        <p className="empty">No playable shapes for this progression in the current tuning.</p>
      )}

      <div className="row wrap actions">
        <button
          className={`btn primary ${progPlaying ? "live" : ""}`}
          onClick={progPlaying ? stopPlayback : playProgression}
          disabled={!progChords.length}
        >
          {progPlaying ? "Stop" : "Preview"}
        </button>
        <span className="actspacer" aria-hidden="true" />
        <button
          className="btn ghost iconbtn"
          onClick={() =>
            saveToBank({
              id: `b${Date.now()}`,
              sig: progSig,
              kind: "prog",
              root: progRoot,
              progId,
              bars: progDef.bars,
              sections: progDef.sections,
              name: progDef.name,
              label: `${nameOf(progRoot, flats)} · ${progDef.name}`,
            })
          }
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill={bank.some((b) => b.sig === progSig) ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3.2l2.6 5.7 6.2.6-4.7 4.2 1.4 6.1L12 16.8 6.5 19.8l1.4-6.1L3.2 9.5l6.2-.6z" />
          </svg>
          Save to Bank
        </button>
        <button
          className="btn ghost iconbtn"
          onClick={() => {
            const c = progChords[progIdx];
            if (!c) return;
            setChordRoot(c.rootPc);
            setChordId(c.chordId);
            onNavigate("chord");
          }}
        >
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 3h7v7M13 3L7 9M6 13H3V3" />
          </svg>
          Open in chords
        </button>
      </div>

      <div className="row wrap">
        <Field label="Key">
          <KeyPicker value={progRoot} onChange={setProgRoot} flats={flats} />
        </Field>
        <Field label="Progression">
          <CatPicker
            value={progId}
            onChange={setProgId}
            label="Progression"
            groups={[
              ...["major", "minor"].map((t) => ({
                label: t === "major" ? "Major keys" : "Minor keys",
                items: simpleList(PROGRESSIONS, SIMPLE_PROGS, settings.simple, progId)
                  .filter((x) => x.tonality === t)
                  .map((x) => ({ id: x.id, name: x.name, sub: x.note })),
              })),
              ...(customProgs.length
                ? [
                    {
                      label: "Your progressions",
                      items: customProgs.map((x) => ({ id: x.id, name: x.name, sub: `${x.bars.length} bars` })),
                    },
                  ]
                : []),
              { label: "Build", items: [{ id: "custom", name: "Custom progression", sub: "Choose your own chords, bar by bar" }] },
            ]}
          />
        </Field>
      </div>

      {progId === "custom" && (
        <div className="builderbox">
          <Field label={`Bars · ${builder.bars.length}`}>
            <div className="barstrip">
              {builder.bars.length === 0 && (
                <span className="note">Tap chords below to add bars. The same chord can repeat as many times as the song needs.</span>
              )}
              {builder.bars.map((b, i) => (
                <Fragment key={i}>
                  {builder.sections && builder.sections[i] && (
                    <button
                      className="secchip"
                      onClick={() =>
                        setBuilder((bl) => {
                          const sc = { ...bl.sections };
                          delete sc[i];
                          return { ...bl, sections: sc };
                        })
                      }
                      data-tip="Remove this section marker"
                    >
                      {builder.sections[i]}
                    </button>
                  )}
                  <button
                    className="barchip"
                    onClick={() =>
                      setBuilder((bl) => {
                        const sections = {};
                        Object.entries(bl.sections || {}).forEach(([k, v]) => {
                          const idx = +k;
                          if (idx < i) sections[idx] = v;
                          else if (idx > i) sections[idx - 1] = v;
                        });
                        return { ...bl, bars: bl.bars.filter((_, j) => j !== i), sections };
                      })
                    }
                    aria-label={`Remove bar ${i + 1}, ${b}`}
                  >
                    {b}
                    <span aria-hidden="true">{"×"}</span>
                  </button>
                </Fragment>
              ))}
            </div>
          </Field>
          <Field label="Song sections (optional)">
            <div className="posrow">
              {["Intro", "Verse", "Chorus", "Bridge", "Solo", "Outro"].map((sec) => (
                <button
                  key={sec}
                  className="poschip"
                  onClick={() => setBuilder((bl) => ({ ...bl, sections: { ...bl.sections, [bl.bars.length]: sec } }))}
                  data-tip={`Start a ${sec} section at the next bar`}
                >
                  + {sec}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Add chords by name in this key">
            <Seg
              small
              ariaLabel="Key type for the chord names"
              options={[
                { v: "major", l: "Major key" },
                { v: "minor", l: "Minor key" },
              ]}
              value={builderKeyQual}
              onChange={setBuilderKeyQual}
            />
            <p className="note keyhint">
              These are the chords that belong to {nameOf(progRoot, keyPrefersFlats(progRoot, builderKeyQual === "minor" ? [3] : [4]))}{" "}
              {builderKeyQual}. Tap one to add it.
            </p>
            <div className="romangrid">
              {(builderKeyQual === "minor" ? ["i", "ii°", "III", "iv", "v", "VI", "VII"] : ["I", "ii", "iii", "IV", "V", "vi", "vii°"]).map(
                (rn) => {
                  const [off, q] = ROMAN[rn];
                  const cd = CHORDS.find((c) => c.id === q);
                  const nmFlats = keyPrefersFlats(progRoot, builderKeyQual === "minor" ? [3] : [4]);
                  const nm = nameOf((progRoot + off) % 12, nmFlats) + (cd ? cd.suffix : "");
                  return (
                    <button
                      key={rn}
                      className="key chordkey"
                      data-tip={`${rn} in the key of ${nameOf(progRoot, nmFlats)} ${builderKeyQual}`}
                      onClick={() => setBuilder((bl) => ({ ...bl, bars: [...bl.bars, rn] }))}
                    >
                      {nm}
                    </button>
                  );
                },
              )}
            </div>
          </Field>
          <Field label="Or add by Roman numeral (advanced)">
            <div className="romangrid">
              {Object.keys(ROMAN).map((rn) => (
                <button key={rn} className="key" onClick={() => setBuilder((bl) => ({ ...bl, bars: [...bl.bars, rn] }))}>
                  {rn}
                </button>
              ))}
            </div>
          </Field>
          <div className="row wrap">
            <Field id="progname" label="Name">
              <input
                id="progname"
                type="text"
                value={builder.name}
                maxLength={40}
                placeholder="My song"
                onChange={(e) => setBuilder((bl) => ({ ...bl, name: e.target.value }))}
              />
            </Field>
            <button
              className="btn primary"
              disabled={!builder.bars.length || !builder.name.trim()}
              onClick={() => {
                const def = {
                  id: `c${Date.now()}`,
                  name: builder.name.trim(),
                  note: "Custom",
                  tonality: MINOR_STARTS.has(builder.bars[0]) ? "minor" : "major",
                  bars: builder.bars,
                  sections: builder.sections,
                };
                saveCustomProgs([...customProgs, def]);
                setProgId(def.id);
                setBuilder({ bars: [], name: "", sections: {} });
                track("custom_prog_save", { bars: def.bars.length });
                setToast("Progression saved");
              }}
            >
              Save progression
            </button>
            <button
              className="btn ghost"
              disabled={!builder.bars.length}
              onClick={() => setBuilder((bl) => ({ ...bl, bars: [], sections: {} }))}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {customProgs.some((p) => p.id === progId) && (
        <div className="row">
          <button
            className="btn ghost danger"
            onClick={() => {
              saveCustomProgs(customProgs.filter((p) => p.id !== progId));
              setProgId("p1564");
              setToast("Progression deleted");
            }}
          >
            Delete this progression
          </button>
        </div>
      )}

      <p className="note">Preview follows the metronome tempo, one bar per chord.</p>
    </div>
  );
}
