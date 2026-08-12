# Fretwork state layer blueprint: Phases 3 to 5

Grounded in the cross-cutting identifier set (INPUT 1), the hook catalogue (INPUT 2) and the view-local counts (INPUT 3). Every hook in INPUT 2 is assigned a home below; nothing is left implicit.

## Summary

Six focused contexts plus one micro-context, in this provider nesting order (outermost first). Nesting is dependency-driven: a provider may only consume contexts above it.

```
<ToastProvider>            micro: imperative toasts, needed by everything below
  <SettingsProvider>       settings + instrument (tuning/midis/n/fretCount/capo)
    <AuthSyncProvider>     session, syncField/flushSync, keepalive
      <LibraryProvider>    bank, known, customProgs, melodies, chgRecords, ratings
        <ProgressProvider> gamify, practiceLog, practiceStats, celebrate
          <SelectionProvider>  what is on the neck (scale/chord/iv + carryKey)
            <PlaybackProvider> audio scheduler, stop, metronome
              <App/>       thin shell: mode, drawer, tour, bridge hooks, views
```

Key rule carried through everywhere: **the Fretboard is a dumb component**. The active view computes `marks`, `ghosts`, `onCell`, `flash`, labels and `effFlats` locally and passes them as props. That single decision dissolves most of the "shared with fretboard" rows in INPUT 1.

---

## Phase 3: the contexts

### 0. ToastContext (micro)

Exists only because provider-level callbacks (syncField failure, toggleKnown, saveToBank, cloud adopt) must be able to toast, so it sits outermost. Two values; `setToast` is stable so consumers of the setter never re-render.

| | |
|---|---|
| Owns | `toast`, `setToast` |
| Effects moved | 2570-2574 (auto-dismiss after 1.8s) |
| Consumers | shell (renders `<Toast/>`), prog, melody (INPUT 1), plus Library/AuthSync/useSync callbacks |

### 1. SettingsContext (settings, appearance, instrument)

| | |
|---|---|
| State | `settings`, `setSettings`, `capo`, `setCapo` |
| Derived | `midis` (from settings tuning), `n` (= midis.length), `fretCount`, `flatsFor` (1578-1581, reads only settings.noteNames) |
| Effects moved | 993-999 (debounced persist, gated on own hydrated flag), 1110-1112 (clamp capo when fretCount shrinks), its slice of 880-991 (hydrate `fretboard:settings` incl. sharps/flats migration) |
| Consumers | effectively all 14 settings-reading views plus shell; fretboard gets midis/fretCount/capo via props from the active view |

`capo` lives here, not in a view: INPUT 1 shows chord + strum + fretboard, share links and bank restore all write it, and every position/voicing memo reads it. It is instrument state like tuning.

### 2. AuthSyncContext (auth + sync plumbing)

| | |
|---|---|
| State | `authUser`, `progressSynced`, `recoveryMode` |
| Derived | `uname` (from authUser) |
| Callbacks | `syncField` (420-438), `flushSync` (441-450) |
| Refs owned | `authTokenRef`, `syncTimers`, `uidRef`, and a **keepalive registry** object (`{ gamify, gamifyMerged, gamifySyncOff }` slots) that ProgressProvider writes into |
| Effects moved | 397-413 (session + auth subscription; see sanctioned split below), 469-471 (uidRef mirror), 510-547 (pagehide keepalive flush, reading the registry) |
| Consumers | account, plog, shell (authUser, uname); LibraryProvider and ProgressProvider (syncField); useSync bridge (progressSynced, token) |

Sanctioned split: 397-413 today calls `setMode('account')` on PASSWORD_RECOVERY, but mode lives in the App shell below this provider. The provider sets `recoveryMode`; a two-line App effect navigates when it turns true. Same observable behaviour.

### 3. LibraryContext (persisted user things)

| | |
|---|---|
| State | `bank`, `known`, `customProgs`, `melodies`, `chgRecords`, `routineRatings` |
| Callbacks | `saveBank` (1005-1012), `saveKnown` (1014-1017), `toggleKnown` (1018-1026), `saveToBank` (1028-1039), `saveCustomProgs` (1231-1238), `saveMelodies` (1240-1247), plus a new thin `saveChgRecords` (the persist+sync half of 2352-2374; the drill logic stays in ChangesView) |
| Effects moved | its slice of 880-991 (hydrate bank/known/routineratings/customprogs/melodies/changes) |
| Consumers | scale, chord, prog, arp, bank, routine, melody, changes, shell (bank/known/melodies counts in nav) |
| Depends on | AuthSync (`syncField`), Toast |

`customProgs`, `chgRecords` and `routineRatings` are not in INPUT 1's cross-view set, but they are persisted and cloud-synced (hydration 880-991, adopt 551-612), so they belong to the persistence seam, consumed mostly by one view each. `shareBankItem` (1041-1061) and `openBankItem` (1069-1103) are Bank-view callbacks, not context members; openBankItem writes SelectionContext + Settings.setCapo + the pendingRestore slot, then navigates.

### 4. ProgressContext (gamification + practice stats)

| | |
|---|---|
| State | `gamify`, `setGamify`, `celebrate`, `practiceLog`, `setPracticeLog`, `gamifyMerged` |
| Derived | `practiceStats` (1283-1313), `gStats` (1317-1339), `gPoints` (1350), `gLevel` (1351) |
| Refs/API | `lastActiveRef` exposed as `markActive()`; `savePracticeLog` ref (1250-1255) |
| Effects moved | 301-305 (celebrate dismiss), 308-310 (persist gamify), 459-461 (merge-flag reset on user change), 466-468 and 472-474 (become writes into AuthSync's keepalive registry), 475-486 (debounced cloud push), 491-507 (merge on sign-in), 1342-1348 (record best streak), 1356-1400 (badge baseline/ack + celebrate), its slice of 880-991 (hydrate practicelog + gamify with max-merge) |
| Consumers | plog, settings (setGamify), shell (practiceStats streak, celebrate popup); EarView (earAnswer), ChangesView (saveChangeScore), PlaybackProvider (metronome ticks + markActive), useTour |
| Depends on | AuthSync (authUser, syncField, progressSynced, registry), Toast |

The practice ticker (1261-1280) does **not** live here because it needs `mode`; it becomes the App-mounted `usePracticeTicker` hook (Phase 5) consuming this context.

### 5. SelectionContext (what is on the neck)

Not in the agreed four but forced by the data: scale material is shared scale+quiz, chord material is shared chord+prog+quiz+strum+finder, intervals are shared interval+quiz, and carryKey ties scale/chord/arp roots. This is the one genuinely musical shared state.

| | |
|---|---|
| State | `scaleRoot`, `scaleId`, `chordRoot`, `chordId`, `ivRoot`, `ivOn`, `carryKey`, and the chord-shape choice `chordArea`, `voiceIdx` (shared because Strum must strum the exact shape picked in Chord) |
| Setters | `setScaleRoot`, `setScaleId`, `setChordRoot`, `setChordId`, `setIvRoot`, `toggleIv` (175-182), carry-aware root setters |
| Refs/API | `pendingRestoreRef` + `posNonce`: generalisation of today's restorePosRef/restoreVoiceRef. Writers (openBankItem, share intake, gotoSegment) stash view-local payloads (arp root/id/dir, prog root/id/builder, melody steps/bars/name, scalePos, voicing key); each view consumes its slice once on mount/effect, exactly like 1134-1142 and 1193-1204 do today |
| Effects moved | none beyond toggleIv; the reset effects that read this state move into view hooks (below) |
| Consumers | scale, chord, arp, interval, quiz, strum, prog, finder, routine, bank |

Deliberately **not** here (view-local, restored via pendingRestore): `arpRoot/arpId/arpDir`, `progRoot/progId/builder`, `melSteps` and friends. INPUT 1 confirms none of them are read by a second view; only share links and bank restore write them.

### 6. PlaybackContext (audio + metronome)

Owns the scheduler and every piece of "is something sounding" state, because `stopPlayback` must reset all of it regardless of which view scheduled it.

| | |
|---|---|
| State | `playing` (scale/arp degree highlight), `progPlaying`, `melPlayIdx`, `strumOn`, `strumStep`, `metroOn`, `beat` |
| Callbacks | `playNote` (1584-1590, consumes Settings.sound + Progress.markActive), `stopPlayback` (1908-1918) |
| Refs owned | `playTimers`, `strumLoopRef`, `melLoopRef` (exposed to view schedulers) |
| Effects moved | 2238-2278 (metronome scheduler, via useMetronome), 2281-2288 (metronome gamify ticks, calls Progress.setGamify), 2576 (unmount stop), and the shared-deps half of 2577-2579 |
| Consumers | scale, arp, chord, prog, strum, melody, ear, tuner (playNote), shell (metronome panel) |
| Depends on | Settings, Progress, Selection |

Sanctioned split of 2577-2579 (stop playback on view/selection change): the `mode` dep becomes an App effect, the shared deps (scaleId/Root, chordId/Root, capo) become a PlaybackProvider effect consuming Selection/Settings, and each playing view adds a local stop effect for its own deps (progId/progRoot, arpRoot/arpId/arpDir, melSteps). stopPlayback is idempotent, so firing from three effects instead of one is observationally identical.

The per-view schedulers do not move into the context; they move into their views in Phase 4 on top of these primitives: playScale (2021-2046) to ScaleView, playArpeggio (2113-2157) to ArpView, strumVoicing (1892-1901) to ChordView, strumChord/scheduleStrumCycle/playStrum (1921-1982) to StrumView, playProgression (2048-2067) to ProgView, melody scheduling (2069-2111) to MelodyView, earPlay (2168-2182) to EarView.

---

## Shared-looking identifiers that are really derived per view

These appear cross-cutting in INPUT 1 but must NOT go into any context.

| Identifier | Why it looks shared | What to do instead |
|---|---|---|
| `effFlats` (1531-1575) | One memo switches on `mode` over every view's key material | Lift `keyPrefersFlats` logic into a pure `effFlatsFor(noteNames, keyMaterial)` in theory.js. Each view memoises its own value from Settings.noteNames + its local/Selection key and passes it to Fretboard/pickers as a prop. The 12-view fan-out disappears |
| `marks` (1609-1744) | Master memo per mode, consumed by fretboard | Split per view; each view computes its marks and passes `<Fretboard marks={...}>` |
| `readout` (2582-2654) | Per-mode header string rendered by the shell | Header slot: App holds `readout` state; each view publishes its line via a `useHeaderReadout(text)` effect while mounted |
| `onCell` (1806-1876) | One tap handler branching per mode | Each view passes its own onCell prop to Fretboard (quiz scoring to QuizView, melody record to MelodyView, finder toggle to FinderView, default play-note elsewhere) |
| `scaleLabel`, `chordLabel`, `arpLabel` | Only paired with "fretboard" | Derived in their view (root + def name), passed as a Fretboard prop |
| `quiz` state | Paired only with "fretboard" | QuizView-local; quiz overlay data reaches Fretboard via props. Lifetime stats (`saveStats` 1001-1003 and the stats slice of 880-991) hydrate/persist inside QuizView |
| `activeVoicing` | chord + strum + fretboard | Half state, half derived: the **choice** (`chordArea`, `voiceIdx`) is shared state in Selection; the **computation** (vopt 1175-1178, voicings 1180-1183, chordAreas 1186, shownVoicings 1188-1191, resets 1193-1204 and 1206-1208) becomes the shared hook `useChordVoicings` used by whichever of ChordView/StrumView is mounted. Only one mounts at a time, so the old `mode` gate falls away naturally |
| `midis`, `n`, `fretCount` | Read everywhere | Not independent state: derived on SettingsContext |
| `mode` reads inside views | 14 views "read" mode | Almost all are `mode ===` guards that die once each view renders only when active. Only setMode survives, as an `onNavigate` prop to prog, about, faq, finder |
| `positionsFor` (1593-1607), `rowToString` (1113), `flatsFor` (1578-1581) | Callbacks closing over context | Pure-lift: parameterise (midis, n, fretCount, capo, settings bits) and move to theory.js / fretboard.jsx; flatsFor may stay as a Settings-derived callback if preferred |

---

## Phase 5: the hooks

Providers use their own hooks internally; cross-context orchestration mounts once in the thin App shell (inside all providers, so it can consume everything).

| Hook (file in hooks/) | Mounted in | Line ranges | Consumes |
|---|---|---|---|
| `useAuth` | AuthSyncProvider | 397-413, 420-438, 441-450, 469-471, 510-547 | Toast |
| `useSync` | App shell | 551-612 (adopt-or-seed on sign-in) | AuthSync, Library, Progress, Toast |
| `useGamify` | ProgressProvider | 301-305, 308-310, 459-461, 466-474, 475-486, 491-507, 1342-1400, 1317-1339, 1350, 1351 | AuthSync |
| `usePractice` | memos in ProgressProvider (1283-1313); `usePracticeTicker(mode)` in App (1261-1280, absorbs modeRef 130-132) | Progress | |
| `useMetronome` | PlaybackProvider | 2238-2278, 2281-2288 | Settings, Progress |
| `useRouting` | App shell | 2536-2546, 2553-2568, 390-395 | App mode state |
| `useAnalytics` | App shell | 334-353, 2527-2533 | App mode state |
| `useShareLink` | App shell | 2381-2417, 2420-2429 (out), 2432-2521 (intake) | Selection, Settings, pendingRestore, App mode; plus a **share payload registry**: each shareable view publishes its view-local payload (melSteps, builder, ...) via `useSharePayload(getter)` while mounted, since the header share button lives in the shell |
| `useTour` | App shell | 315-317, 2905-2909, 2910-2914, 2916-2945, 2949-2966, 2969-2999 | Progress.setGamify, App drawer/openPanel/mode |
| `useChordVoicings` | ChordView + StrumView | 1175-1208 | Selection, Settings |
| `useScalePositions` / `useArpPositions` | ScaleView / ArpView | 1122-1142 / 1145-1164 | Selection/local, Settings, pendingRestore |
| `useTuner` | TunerView | 796-805, 807-858, 861-865 (mode-release becomes unmount cleanup) | Settings |
| `useFlash` | any view with tap feedback | 1886-1890 | local |

Remaining shell-owned effects (stay in App/shell components, not hooks): 141-143 (Simple-mode kickback, consumes Settings + mode), 144-149 and 3008-3017 (drawer), 868-877 (font inject). 361-385 (FAQ JSON-LD) moves into FAQView: mount-inject, unmount-remove, identical behaviour.

**Sanctioned non-pure-moves** (the only four, each trivially verifiable): (1) hydration 880-991 splits into per-provider slices each with its own hydrated flag, App derives the combined `loaded` for useSync/useShareLink/useTour gates; (2) the recovery navigation split out of 397-413; (3) the three-way split of 2577-2579; (4) quiz stats hydrating on QuizView mount instead of app boot (storage is the source of truth either way).

---

## Phase 4: view extraction order

Ordered by local-state count from INPUT 3 weighted by coupling. Each step lands green before the next.

| # | View | Locals | Rationale |
|---|---|---|---|
| 1 | About, FAQ | ~0 | Props only (onNavigate, setOpenPanel, startTour); FAQ takes the JSON-LD effect. Proves the pattern |
| 2 | Settings view | ~0 | Pure Settings + Progress.setGamify consumer |
| 3 | Practice log | 3 | AuthSync + Progress reads only |
| 4 | Interval | 1 | First fretboard view: establishes per-view marks/effFlats/readout with the smallest surface |
| 5 | Finder | 3 | finderInfo memo, own onCell, navigates via Selection setters + onNavigate |
| 6 | Quiz | 4 | Selection reads, own stats/newRound cluster (1755-1804, 1878-1884), own onCell slice |
| 7 | Tuner | 9 | Higher locals but fully isolated; whole mic cluster moves as useTuner |
| 8 | Account | 22 | Many locals but all self-contained form state; only consumes AuthSync |
| 9 | Ear | 6 | Playback-lite + Progress; leave-view resets become unmount cleanup |
| 10 | Routine | 4 | known/ratings from Library; gotoSegment (2688-2703) writes Selection + pendingRestore + navigates |
| 11 | Bank | 4 | Exercises openBankItem against pendingRestore before the big views depend on it |
| 12 | Scale | 6 | First playing view: useScalePositions, playScale, marks slice |
| 13 | Arp | 12 | Mirrors Scale exactly (positions, playArpeggio, carryKey) |
| 14 | Chord | 11 | Builds useChordVoicings + ghosts (1746-1752) + strumVoicing |
| 15 | Strum | 7 | Reuses useChordVoicings and Playback loop refs; small once 14 lands |
| 16 | Changes | 14 | Isolated drill (timers 2324-2350, chgVoicings 2300-2307, saveChangeScore via Library.saveChgRecords) |
| 17 | Prog | 20 | progDef pipeline (1212-1229, 1415-1466), builder, playProgression |
| 18 | Melody | 24 | Largest and last: scheduler, tab import, transpose, share intake slice |

The shell's 27 locals (drawer, tour, mode, openCats, panels) remain in App and its shell/ components; fretboard's 8 become props.

## Consumption map sanity check

Every INPUT 1 identifier now has exactly one home: Settings (settings, setSettings, midis, n, fretCount, capo), Selection (scaleRoot/Id + setters, chordRoot/Id + setters, ivRoot/ivOn/setIvRoot/toggleIv, carryKey), Library (bank, known, saveToBank, toggleKnown, melodies), Progress (setGamify, practiceStats), AuthSync (authUser, uname), Playback (playing, stopPlayback, playNote), Toast (setToast), App shell props (setMode, setOpenPanel, startTour), derived-per-view (effFlats, scaleLabel, chordLabel, arpLabel, quiz, activeVoicing via useChordVoicings). No context exceeds one seam, and no identifier needs two contexts.
---

## App findings surfaced while writing the test net (fix after the refactor, not during)

- **Tourist badge self-awards**: the guided tour auto-starts for any profile
  without `fretboard:tourdone`, which immediately sets `tourTaken=1`, so a brand
  new user earns the Tourist badge and 100 points before doing anything. The
  badge should be earned on finishing (or meaningfully starting) the tour.
- **Pluralisation**: the saved-melodies list reads "1 notes" for one note.
- **Chord changes**: stopping a run mid-way discards it with no score entry;
  only a completed countdown asks for the score. Possibly intended; worth a
  deliberate decision.
- **Readout case**: `.readout` uppercases via CSS; tests must read textContent,
  not innerText (documented in views-learn.spec.js).

---

## Phase 4 in practice (discovered during execution)

The fretboard slot (state/FretboardContext.jsx) and the header-readout slot are
BOTH needed, and they gate which views can move when:

- A view can move as soon as everything its neck AND its readout depend on is
  reachable from a context. Interval moved with only the fretboard slot because
  its readout reads ivRoot/ivOn from SelectionContext.
- Scale, Arp, Chord are the same: their readout reads scaleRoot/chordRoot/
  arpRoot (Selection), so they can move on the fretboard slot alone. Their neck
  marks use view-local scalePos/arpPos/arpDir, which move into the view.
- Finder, Quiz, Melody, Changes, Prog have readouts that depend on view-LOCAL
  state (finderInfo, quiz, melKeyHint, chg, builder). They need the
  header-readout slot (a useHeaderReadout(text) publish, identical pattern to
  usePublishFretboard) before they can move, or their readout breaks.

Recommended remaining order: Scale, Arp, Chord (fretboard slot only) -> add the
readout slot -> Finder, Quiz, Melody, Changes, Prog -> Bank, Routine, Ear,
Strum. neckPositions (fretboard.jsx) is the shared marks helper for all of them.

Gotcha banked: Fretboard reads `ghosts` as a Set (ghosts.has), never an array.
