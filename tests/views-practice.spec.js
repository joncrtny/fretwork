import { test, expect } from "@playwright/test";

/* Feature tests for the practice views: Chord changes, Practice routine,
   Strumming, Melodies, Fretboard Quiz and Ear training. Every test asserts
   real behaviour (state changes visible in the DOM), not just visibility.
   Same house style as smoke.spec.js: seeded settings, domcontentloaded,
   DOM clicks via page.evaluate, auto-waiting expect(). No audio assertions. */

/* Treat the browser as a returning user in full (non-Simple) mode, exactly as
   the smoke suite does, so every view is reachable and deterministic. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("fretboard:settings", JSON.stringify({ simple: false }));
      localStorage.setItem("fretboard:tourdone", "1"); // the auto-tour steals focus from a fresh profile
    } catch (e) {}
  });
});

/* DOM click by selector and exact (trimmed) text. Waits for the element first
   so the click never races the render, then clicks in the page: the fretboard
   SVG can intercept pointer hit-tests, so page.evaluate is the house style. */
async function domClick(page, selector, text = null) {
  await page.waitForFunction(
    ([sel, txt]) => [...document.querySelectorAll(sel)].some((e) => txt == null || (e.textContent || "").trim() === txt),
    [selector, text],
  );
  await page.evaluate(
    ([sel, txt]) => {
      const el = [...document.querySelectorAll(sel)].find((e) => txt == null || (e.textContent || "").trim() === txt);
      el.click();
    },
    [selector, text],
  );
}

/* Set a React controlled input with the native value setter plus an input
   event (per CLAUDE.md), for inputs without ids: the quiz range slider and
   the chord-changes score entry. */
async function setInputValue(page, selector, value) {
  await page.waitForFunction((sel) => !!document.querySelector(sel), selector);
  await page.evaluate(
    ([sel, v]) => {
      const el = document.querySelector(sel);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [selector, value],
  );
}

/* ============================== Chord changes ============================== */

test.describe("Chord changes", () => {
  test("length picker drives the countdown clock readout", async ({ page }) => {
    await page.goto("/chord-changes", { waitUntil: "domcontentloaded" });
    const clock = page.locator('[role="timer"]');
    await expect(clock).toHaveText("1:00"); // default 60s
    await domClick(page, '.seg[aria-label="Length"] button', "0:30");
    await expect(clock).toHaveText("0:30");
    await domClick(page, '.seg[aria-label="Length"] button', "Free");
    await expect(clock).toHaveText("∞");
  });

  test("chord slots can be added and removed", async ({ page }) => {
    await page.goto("/chord-changes", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".chgnames")).toHaveText("A · D");
    await expect(page.locator(".chgslot")).toHaveCount(2);
    // with only two chords, removal is blocked
    await expect(page.locator('button[aria-label="Remove A"]')).toBeDisabled();
    await domClick(page, ".chgslots button.wide", "+ Add a chord");
    await expect(page.locator(".chgslot")).toHaveCount(3);
    await expect(page.locator(".chgnames")).toHaveText("A · D · G");
    await expect(page.locator('button[aria-label="Remove A"]')).toBeEnabled();
    await domClick(page, 'button[aria-label="Remove G"]');
    await expect(page.locator(".chgslot")).toHaveCount(2);
    await expect(page.locator(".chgnames")).toHaveText("A · D");
  });

  test("free run starts and stops without a countdown", async ({ page }) => {
    await page.goto("/chord-changes", { waitUntil: "domcontentloaded" });
    await domClick(page, '.seg[aria-label="Length"] button', "Free");
    await domClick(page, "button.transport", "Start");
    await expect(page.locator('[role="timer"]')).toHaveText("Free");
    await expect(page.locator(".pane .note").first()).toContainText("at your own pace");
    await domClick(page, "button.transport.on", "Stop");
    await expect(page.locator('[role="timer"]')).toHaveText("∞");
    await expect(page.locator("button.transport")).toHaveText("Start");
  });

  test("a 30s run counts down, asks for the score and records it", async ({ page }) => {
    /* the shortest run the UI offers is 30 seconds, so this test genuinely
       waits for the clock: it is the only path to the "done" phase */
    test.setTimeout(60_000);
    await page.goto("/chord-changes", { waitUntil: "domcontentloaded" });
    await domClick(page, '.seg[aria-label="Length"] button', "0:30");
    await domClick(page, "button.transport", "Start");
    const clock = page.locator('[role="timer"]');
    await expect(clock).toHaveText(/0:2\d/); // it is actually ticking
    await expect(clock).toHaveText("Time!", { timeout: 35_000 });
    const entry = 'input[aria-label="How many changes did you get?"]';
    await expect(page.locator(entry)).toBeVisible();
    await setInputValue(page, entry, "12");
    await domClick(page, ".chgentry .btn", "Save");
    await expect(page.locator(".toast")).toHaveText("New best · 12 changes");
    await expect(page.locator(".chgbest")).toContainText("best 12");
    await expect(page.locator(".chgbest")).toContainText("last 12");
    await expect(page.locator(".chgbest")).toContainText("tries 1");
    await expect(page.locator("button.transport")).toHaveText("Start"); // back to idle
  });
});

/* ============================= Practice routine ============================ */

/* two known chords seeded through the same localStorage store the app reads */
const KNOWN = [
  { sig: "k-chord:9:maj", kind: "chord", root: 9, id: "maj", label: "A" },
  { sig: "k-chord:2:maj", kind: "chord", root: 2, id: "maj", label: "D" },
];
const seedKnown = (page) =>
  page.addInitScript((known) => {
    try {
      localStorage.setItem("fretboard:known", JSON.stringify(known));
    } catch (e) {}
  }, KNOWN);

test.describe("Practice routine", () => {
  test("empty state: nothing marked as known yet", async ({ page }) => {
    await page.goto("/practice-routine", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".readout")).toHaveText("Practice routine · 0 known");
    await expect(page.locator(".pane .empty")).toContainText("Nothing marked yet");
    await expect(page.locator(".pane .btn.primary")).toHaveCount(0); // no Build and start
  });

  test("known items appear and the length picker reshapes the summary", async ({ page }) => {
    await seedKnown(page);
    await page.goto("/practice-routine", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".readout")).toHaveText("Practice routine · 2 known");
    await expect(page.locator(".knownitem")).toHaveCount(2);
    await expect(page.locator(".pane")).toContainText("You know 2 things. Your 10 minute routine");
    await domClick(page, '.seg[aria-label="Routine length"] button', "5 min");
    await expect(page.locator(".pane")).toContainText("Your 5 minute routine");
  });

  test("forgetting an item updates the list and the readout", async ({ page }) => {
    await seedKnown(page);
    await page.goto("/practice-routine", { waitUntil: "domcontentloaded" });
    await domClick(page, 'button[aria-label="Forget A"]');
    await expect(page.locator(".knownitem")).toHaveCount(1);
    await expect(page.locator(".pane")).toContainText("You know 1 thing.");
    await expect(page.locator(".readout")).toHaveText("Practice routine · 1 known");
  });

  test("build and start runs the routine HUD through to the rating", async ({ page }) => {
    await seedKnown(page);
    await page.goto("/practice-routine", { waitUntil: "domcontentloaded" });
    await domClick(page, ".pane .btn.primary", "Build and start");
    const hud = page.locator(".routinehud");
    await expect(hud).toBeVisible();
    // two known chords plus one stretch item = three steps
    await expect(hud.locator(".rhud-main b")).toHaveText("A");
    await expect(hud.locator(".rhud-main span")).toHaveText("Step 1 of 3");
    await expect(hud.locator(".rhud-time")).toHaveText(/\d:\d\d/);
    await domClick(page, ".routinehud .btn", "Next");
    await expect(hud.locator(".rhud-main b")).toHaveText("D");
    await expect(hud.locator(".rhud-main span")).toHaveText("Step 2 of 3");
    await domClick(page, ".routinehud .btn", "Next");
    await expect(hud.locator(".rhud-main span")).toHaveText("Stretch · something new");
    await domClick(page, ".routinehud .btn", "Finish");
    const dialog = page.locator('.celebrate[role="dialog"]');
    await expect(dialog).toBeVisible();
    await domClick(page, 'button[aria-label="Solid, 3 stars"]');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".toast")).toHaveText("Great session!");
  });
});

/* ================================ Strumming ================================ */

test.describe("Strumming", () => {
  test("pattern picker swaps the arrows in the strum bar", async ({ page }) => {
    await page.goto("/strumming", { waitUntil: "domcontentloaded" });
    const arrows = () => page.evaluate(() => [...document.querySelectorAll(".strumbar .strumarrow")].map((e) => e.textContent).join(""));
    // default pattern is D DU UDU
    await expect(page.locator('.pane button[aria-pressed="true"]', { hasText: "D DU UDU" })).toBeVisible();
    await expect.poll(arrows).toBe("↓↓↑↑↓↑");
    await domClick(page, ".pane .btn", "All eighths");
    await expect(page.locator('.pane button[aria-pressed="true"]', { hasText: "All eighths" })).toBeVisible();
    await expect.poll(arrows).toBe("↓↑↓↑↓↑↓↑");
  });

  test("tempo buttons step the bpm readout", async ({ page }) => {
    await page.goto("/strumming", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".barcount")).toHaveText("90"); // default bpm
    await domClick(page, 'button[aria-label="Faster"]');
    await expect(page.locator(".barcount")).toHaveText("95");
    await domClick(page, 'button[aria-label="Slower"]');
    await expect(page.locator(".barcount")).toHaveText("90");
  });

  test("metronome click toggle flips its state", async ({ page }) => {
    await page.goto("/strumming", { waitUntil: "domcontentloaded" });
    const toggle = page.locator(".pane .btn", { hasText: "Click:" });
    await expect(toggle).toHaveText("Click: off");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await domClick(page, ".pane .btn", "Click: off");
    await expect(toggle).toHaveText("Click: on");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  test("root picker changes the chord in the readout", async ({ page }) => {
    await page.goto("/strumming", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".readout")).toHaveText("Strumming · C");
    await domClick(page, ".pane .picker .pickbtn"); // the Root key picker
    await page.waitForSelector(".pickmenu");
    await domClick(page, '.pickmenu button[role="option"]', "E");
    await expect(page.locator(".readout")).toHaveText("Strumming · E");
  });

  test("play flips to stop and back (state only, no audio assertions)", async ({ page }) => {
    await page.goto("/strumming", { waitUntil: "domcontentloaded" });
    const play = page.locator(".pane .actions .btn.primary").first();
    await expect(play).toHaveText("Play");
    await expect(play).toBeEnabled(); // a C major voicing exists
    await domClick(page, ".pane .actions .btn.primary", "Play");
    await expect(play).toHaveText("Stop");
    await domClick(page, ".pane .actions .btn.primary", "Stop");
    await expect(play).toHaveText("Play");
  });
});

/* ================================ Melodies ================================= */

test.describe("Melodies", () => {
  test("a keyboard tap on the neck drops a note onto the timeline", async ({ page }) => {
    await page.goto("/melodies", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".flabel", { hasText: "Timeline" })).toHaveText("Timeline · 0 notes");
    // the neck is keyboard operable: Enter answers the cell under the cursor
    await page.locator("svg.fretboard").press("Enter"); // open string, fret 0: an E
    await expect(page.locator(".flabel", { hasText: "Timeline" })).toHaveText("Timeline · 1 note");
    await expect(page.locator(".tslot.filled .tslotname")).toHaveText("E");
    // the cursor advanced to the next slot
    await expect(page.locator('.tslot[aria-current="true"]')).toHaveAttribute("aria-label", /^Slot 2,/);
    await expect(page.locator(".readout")).toHaveText("Melody · 1 note");
  });

  test("add rest and back move the cursor along the timeline", async ({ page }) => {
    await page.goto("/melodies", { waitUntil: "domcontentloaded" });
    await expect(page.locator('.tslot[aria-current="true"]')).toHaveAttribute("aria-label", /^Slot 1,/);
    const back = page.locator(".pane .btn", { hasText: "Back" });
    await expect(back).toBeDisabled();
    await domClick(page, ".pane .btn", "Add rest");
    await expect(page.locator('.tslot[aria-current="true"]')).toHaveAttribute("aria-label", /^Slot 2,/);
    await expect(back).toBeEnabled();
    await domClick(page, ".pane .btn", "Back");
    await expect(page.locator('.tslot[aria-current="true"]')).toHaveAttribute("aria-label", /^Slot 1,/);
    await expect(back).toBeDisabled();
  });

  test("bars can be added and removed, resizing the grid", async ({ page }) => {
    await page.goto("/melodies", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".tslot")).toHaveCount(16); // 2 bars of 8 slots
    await expect(page.locator(".barctl .barcount")).toHaveText("2");
    await domClick(page, 'button[aria-label="Add a bar"]');
    await expect(page.locator(".tslot")).toHaveCount(24);
    await expect(page.locator(".barctl .barcount")).toHaveText("3");
    await domClick(page, 'button[aria-label="Remove a bar"]');
    await expect(page.locator(".tslot")).toHaveCount(16);
    await expect(page.locator(".barctl .barcount")).toHaveText("2");
  });

  test("clear wipes the timeline and disables playback", async ({ page }) => {
    await page.goto("/melodies", { waitUntil: "domcontentloaded" });
    // settle on the rendered empty timeline before typing, or the press can race hydration
    await expect(page.locator(".flabel", { hasText: "Timeline" })).toHaveText("Timeline · 0 notes");
    await page.locator("svg.fretboard").press("Enter");
    await expect(page.locator(".flabel", { hasText: "Timeline" })).toHaveText("Timeline · 1 note");
    const play = page.locator(".pane .actions .btn.primary");
    await expect(play).toBeEnabled();
    await domClick(page, ".pane .btn.ghost.danger", "Clear");
    await expect(page.locator(".flabel", { hasText: "Timeline" })).toHaveText("Timeline · 0 notes");
    await expect(play).toBeDisabled();
  });

  test("a melody can be saved and deleted", async ({ page }) => {
    await page.goto("/melodies", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".flabel", { hasText: "Timeline" })).toHaveText("Timeline · 0 notes");
    await page.locator("svg.fretboard").press("Enter");
    const save = page.locator(".pane .btn", { hasText: "Save melody" });
    await expect(save).toBeDisabled(); // no name yet
    await page.fill("#melname", "Test riff");
    await expect(save).toBeEnabled();
    await domClick(page, ".pane .btn", "Save melody");
    await expect(page.locator(".toast")).toHaveText("Melody saved");
    await expect(page.locator(".melitem b")).toHaveText("Test riff");
    await expect(page.locator(".melitem em")).toHaveText("1 notes");
    await domClick(page, 'button[aria-label="Delete Test riff"]');
    await expect(page.locator(".melitem")).toHaveCount(0);
  });

  test("pasting a tab imports notes onto the timeline", async ({ page }) => {
    await page.goto("/melodies", { waitUntil: "domcontentloaded" });
    await domClick(page, ".pane .btn.ghost", "Paste a tab");
    await expect(page.locator("#tabpaste")).toBeVisible();
    await page.fill("#tabpaste", "e|--0--3--0--|\nB|--1-----1--|\nG|--0-----0--|\nD|--2-----2--|\nA|--3--3--3--|\nE|-----------|");
    await domClick(page, ".pane .btn.primary", "Import");
    await expect(page.locator(".toast")).toHaveText(/Imported \d+ notes/);
    await expect(page.locator(".flabel", { hasText: "Timeline" })).toHaveText(/Timeline · [1-9]\d* notes/);
    await expect(page.locator("#tabpaste")).toHaveCount(0); // the paste box closes
  });
});

/* ============================== Fretboard Quiz ============================= */

test.describe("Fretboard Quiz", () => {
  test("difficulty slider changes the hidden count and its readout", async ({ page }) => {
    await page.goto("/quiz", { waitUntil: "domcontentloaded" });
    const label = page.locator(".flabel", { hasText: "Difficulty" });
    await expect(label).toHaveText(/Difficulty · \d+ of \d+ hidden/);
    await expect(page.locator(".pane output")).toHaveText("Steady"); // default 0.35
    await setInputValue(page, 'input[aria-label="Quiz difficulty"]', "1");
    await expect(page.locator(".pane output")).toHaveText("Blank neck");
    await expect(label).toHaveText(/Difficulty · (\d+) of \1 hidden/); // everything hidden
    await setInputValue(page, 'input[aria-label="Quiz difficulty"]', "0");
    await expect(page.locator(".pane output")).toHaveText("Easy");
    await expect(label).toHaveText(/Difficulty · 1 of \d+ hidden/); // just one hidden
  });

  test("source toggle swaps the picker fields", async ({ page }) => {
    await page.goto("/quiz", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".flabel", { hasText: "Scale" })).toBeVisible();
    await expect(page.locator(".flabel", { hasText: "Key" })).toBeVisible();
    await domClick(page, '.seg[aria-label="Test me on"] button', "A chord");
    await expect(page.locator(".flabel", { hasText: "Chord" })).toBeVisible();
    await expect(page.locator(".flabel", { hasText: "Root" })).toBeVisible();
    await expect(page.locator(".flabel", { hasText: "Scale" })).toHaveCount(0);
    await domClick(page, '.seg[aria-label="Test me on"] button', "Intervals");
    await expect(page.locator(".flabel", { hasText: "Intervals to find" })).toBeVisible();
  });

  test("fret range thumbs narrow the quiz window", async ({ page }) => {
    await page.goto("/quiz", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".flabel", { hasText: "Frets" })).toHaveText("Frets 0 to 12");
    await page.locator('.drthumb[aria-label="Highest fret"]').press("ArrowLeft");
    await expect(page.locator(".flabel", { hasText: "Frets" })).toHaveText("Frets 0 to 11");
    await page.locator('.drthumb[aria-label="Lowest fret"]').press("ArrowRight");
    await expect(page.locator(".flabel", { hasText: "Frets" })).toHaveText("Frets 1 to 11");
  });

  test("answering on the neck scores the round and reset clears it", async ({ page }) => {
    await page.goto("/quiz", { waitUntil: "domcontentloaded" });
    const scores = () =>
      page.evaluate(() => {
        const b = [...document.querySelectorAll(".scoreboard .score b")];
        return { correct: +b[0].textContent, wrong: +b[1].textContent };
      });
    await expect.poll(async () => (await scores()).correct + (await scores()).wrong).toBe(0);
    // Enter answers the cell under the keyboard cursor; right or wrong, it scores
    await page.locator("svg.fretboard").press("Enter");
    await expect.poll(async () => (await scores()).correct + (await scores()).wrong).toBe(1);
    await domClick(page, ".pane .btn.ghost.danger", "Reset score");
    await expect.poll(async () => (await scores()).correct + (await scores()).wrong).toBe(0);
  });
});

/* =============================== Ear training ============================== */

test.describe("Ear training", () => {
  test("mode toggle switches between identify and explore", async ({ page }) => {
    await page.goto("/ear-training", { waitUntil: "domcontentloaded" });
    const start = page.locator(".pane .btn.primary", { hasText: /Start|Play again/ });
    await expect(start).toHaveText("Start");
    await expect(page.locator(".earopt").first()).toBeDisabled(); // nothing to identify yet
    await domClick(page, '.seg[aria-label="Ear training mode"] button', "Choose and hear");
    await expect(start).toHaveCount(0);
    await expect(page.locator(".pane")).toContainText("Tap a sound to hear it from a random root.");
    await expect(page.locator(".earopt").first()).toBeEnabled(); // explore taps always play
  });

  test("sounds toggle swaps the answer pool", async ({ page }) => {
    await page.goto("/ear-training", { waitUntil: "domcontentloaded" });
    // common intervals by default
    await expect(page.locator(".earopt")).toHaveCount(5);
    await expect(page.locator(".earopts")).toContainText("Perfect 5th");
    await domClick(page, '.seg[aria-label="Interval or chord sounds"] button', "Chord types");
    await expect(page.locator(".earopt")).toHaveCount(2);
    await expect(page.locator(".earopts")).toContainText("Major");
    await expect(page.locator(".earopts")).toContainText("Minor");
  });

  test("difficulty toggle expands the pool to everything", async ({ page }) => {
    await page.goto("/ear-training", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".earopt")).toHaveCount(5);
    await domClick(page, '.seg[aria-label="Difficulty"] button', "Everything");
    await expect(page.locator(".earopt")).toHaveCount(12);
    await expect(page.locator(".earopts")).toContainText("Tritone");
  });

  test("start begins a round and answering scores it", async ({ page }) => {
    await page.goto("/ear-training", { waitUntil: "domcontentloaded" });
    const scores = () =>
      page.evaluate(() => {
        const b = [...document.querySelectorAll(".scoreboard .score b")];
        return +b[0].textContent + +b[1].textContent; // correct + wrong
      });
    await domClick(page, ".pane .btn.primary", "Start");
    await expect(page.locator(".pane .btn.primary", { hasText: "Play again" })).toBeVisible();
    await expect(page.locator('.pane p[role="status"]')).toHaveText("What did you hear?");
    await expect(page.locator(".earopt").first()).toBeEnabled();
    await domClick(page, ".earopt", "Major 2nd"); // right or wrong, it scores exactly once
    await expect.poll(scores).toBe(1);
    const reset = page.locator(".pane .btn.ghost.danger", { hasText: "Reset score" });
    await expect(reset).toBeEnabled();
    await domClick(page, ".pane .btn.ghost.danger", "Reset score");
    await expect.poll(scores).toBe(0);
    await expect(reset).toBeDisabled();
  });
});
