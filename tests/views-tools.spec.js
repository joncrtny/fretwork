import { test, expect } from "@playwright/test";

/* Feature tests for the tool views: Chord finder, Tuner (UI only, no mic),
   Bank, Practice log and Settings. Same refactor-safety intent as
   smoke.spec.js, but every test asserts a real state change in the DOM
   (readout text, chips, counters, classes), not mere visibility. */

/* Treat the browser as a returning user in full (non-Simple) mode, exactly as
   smoke.spec.js does, so every view is reachable and deterministic. Also mark
   the guided tour as seen: without "fretboard:tourdone" the tour auto-starts,
   steals keyboard focus mid-test and instantly earns the Tourist badge, which
   would put a fresh profile at 100 points / level 2. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("fretboard:settings", JSON.stringify({ simple: false }));
      localStorage.setItem("fretboard:tourdone", "1");
    } catch (e) {}
  });
});

/* ---- Chord finder ---- */

test("finder: keyboard-selecting open E, B and G names the chord Em", async ({ page }) => {
  await page.goto("/chord-finder", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".pane .degrees")).toContainText("No notes selected yet.");
  // the neck is keyboard operable: cursor starts on the top row (high E with
  // default high-on-top order) at fret 0; Enter toggles the position
  await page.locator("svg.fretboard").focus();
  await page.keyboard.press("Enter"); // open high E -> E
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter"); // open B -> B
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter"); // open G -> G
  await expect(page.locator(".degrees .chip")).toHaveText(["E", "B", "G"]);
  await expect(page.locator(".flabel", { hasText: "This chord is" })).toBeVisible();
  await expect(page.locator(".finderhits button", { hasText: "Em" })).toBeVisible();
  await expect(page.locator(".readout")).toContainText("Chord finder · Em");
});

test("finder: a semitone pair has no exact match but offers partial candidates", async ({ page }) => {
  await page.goto("/chord-finder", { waitUntil: "domcontentloaded" });
  await page.locator("svg.fretboard").focus();
  await page.keyboard.press("Enter"); // open high E -> E
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter"); // fret 1 on the same string -> F
  await expect(page.locator(".degrees .chip")).toHaveText(["E", "F"]);
  await expect(page.locator(".readout")).toContainText("Chord finder · no exact match");
  await expect(page.locator(".flabel", { hasText: "Could be part of" })).toBeVisible();
  expect(await page.locator(".finderhits button").count()).toBeGreaterThan(0);
});

test("finder: Clear empties the selection and disables itself", async ({ page }) => {
  await page.goto("/chord-finder", { waitUntil: "domcontentloaded" });
  const clear = page.locator(".pane button.danger", { hasText: "Clear" });
  await expect(clear).toBeDisabled();
  await page.locator("svg.fretboard").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".degrees .chip")).toHaveCount(1);
  await expect(page.locator(".pane")).toContainText("Add at least two notes to name a chord.");
  await expect(clear).toBeEnabled();
  await page.evaluate(() => {
    [...document.querySelectorAll(".pane button")].find((b) => b.textContent.trim() === "Clear")?.click();
  });
  await expect(page.locator(".pane .degrees")).toContainText("No notes selected yet.");
  await expect(clear).toBeDisabled();
});

test("finder: tapping an exact hit opens that chord in the Chords view", async ({ page }) => {
  await page.goto("/chord-finder", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".pane .degrees")).toContainText("No notes selected yet.");
  await page.locator("svg.fretboard").focus();
  for (const key of ["Enter", "ArrowDown", "Enter", "ArrowDown", "Enter"]) await page.keyboard.press(key);
  await expect(page.locator(".degrees .chip")).toHaveText(["E", "B", "G"]);
  await expect(page.locator(".finderhits button", { hasText: "Em" })).toBeVisible();
  await page.evaluate(() => {
    [...document.querySelectorAll(".finderhits button")].find((b) => b.textContent.trim() === "Em")?.click();
  });
  // mode switches to chord (the home view keeps the full SEO title)
  await expect(page).toHaveTitle("Fretwork: Guitar Fretboard Trainer for Scales and Chords");
  await expect(page).toHaveURL("/");
  await expect(page.locator(".readout")).toContainText("Em ·");
  await expect(page.locator(".readout")).toContainText("voicings");
});

/* ---- Tuner (UI only, never the microphone) ---- */

test("tuner: idle state shows the mic prompt and six standard strings", async ({ page }) => {
  await page.goto("/tuner", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".tunerbox .btn.primary", { hasText: "Start listening" })).toBeVisible();
  await expect(page.locator(".tunelive")).toHaveCount(0); // not listening yet
  await expect(page.locator(".readout")).toContainText("Tuner · Standard");
  await expect(page.locator(".stringrow")).toHaveCount(6);
  // string 1 (low) is E in standard tuning
  await expect(page.locator('select[aria-label="Note for string 1"]')).toHaveValue("4");
});

test("tuner: choosing a preset retunes the string rows", async ({ page }) => {
  await page.goto("/tuner", { waitUntil: "domcontentloaded" });
  await page.selectOption('select[aria-label="Tuning"]', "dropd");
  await expect(page.locator(".readout")).toContainText("Tuner · Drop D");
  // low string drops from E to D
  await expect(page.locator('select[aria-label="Note for string 1"]')).toHaveValue("2");
  // the other strings keep standard pitches
  await expect(page.locator('select[aria-label="Note for string 2"]')).toHaveValue("9");
});

test("tuner: adding and removing a low string flips the tuning to Custom", async ({ page }) => {
  await page.goto("/tuner", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".stringrow")).toHaveCount(6);
  await page.evaluate(() => {
    [...document.querySelectorAll(".stringbtns button")].find((b) => b.textContent.trim() === "Add low string")?.click();
  });
  await expect(page.locator(".stringrow")).toHaveCount(7);
  await expect(page.locator('select[aria-label="Tuning"]')).toHaveValue("custom");
  await expect(page.locator(".readout")).toContainText("Tuner · Custom");
  // the new low string sits a fourth below low E, so B
  await expect(page.locator('select[aria-label="Note for string 1"]')).toHaveValue("11");
  await page.evaluate(() => {
    [...document.querySelectorAll(".stringbtns button")].find((b) => b.textContent.trim() === "Remove low string")?.click();
  });
  await expect(page.locator(".stringrow")).toHaveCount(6);
});

test("tuner: capo calculator updates its advice when the target key changes", async ({ page }) => {
  await page.goto("/tuner", { waitUntil: "domcontentloaded" });
  // defaults: G shapes, key of A -> capo 2
  await expect(page.locator(".capocalc")).toContainText("Play G shapes with a capo at fret 2 to hear A.");
  await page.evaluate(() => {
    const f = [...document.querySelectorAll(".capocalc .field")].find((x) =>
      /Key you want to hear/.test(x.querySelector(".flabel")?.textContent || ""),
    );
    f?.querySelector(".pickbtn, button")?.click();
  });
  await page.waitForSelector(".pickmenu");
  await page.evaluate(() => {
    [...document.querySelectorAll(".pickmenu button")].find((b) => (b.textContent || "").trim() === "B")?.click();
  });
  await expect(page.locator(".capocalc")).toContainText("Play G shapes with a capo at fret 4 to hear B.");
});

/* ---- Bank ---- */

test("bank: empty state explains itself and the readout counts zero", async ({ page }) => {
  await page.goto("/bank", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".pane")).toContainText("Nothing saved yet.");
  await expect(page.locator(".bankitem")).toHaveCount(0);
  await expect(page.locator(".readout")).toContainText("Bank · 0 saved");
});

test("bank: starring a scale saves it, badges the nav and lists it in the Bank", async ({ page }) => {
  await page.goto("/scales", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".pane .starsave")).toBeVisible();
  await page.evaluate(() => document.querySelector(".pane .starsave")?.click());
  await expect(page.locator(".toast")).toContainText("Saved to Bank");
  await expect(page.locator(".pane .starsave")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".dbank .badge")).toHaveText("1");
  // move to the Bank inside the SPA (DOM click, the neck overlaps nav hit-tests)
  await page.evaluate(() => document.querySelector(".dbank .dnav")?.click());
  await expect(page.locator(".readout")).toContainText("Bank · 1 saved");
  await expect(page.locator(".banksec .abouthead", { hasText: "Scales" })).toBeVisible();
  await expect(page.locator(".bankitem")).toHaveCount(1);
  await expect(page.locator(".bankitem .bankmeta b")).toHaveText("C Major (Ionian)");
});

test("bank: a saved item opens its view, and Remove empties the Bank", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "fretboard:bank",
        JSON.stringify([
          {
            id: "seed1",
            sig: "scale:9:minpent:all",
            kind: "scale",
            root: 9,
            scaleId: "minpent",
            pos: null,
            tun: "std",
            label: "A Minor pentatonic",
          },
        ]),
      );
    } catch (e) {}
  });
  await page.goto("/bank", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".bankitem .bankmeta b")).toHaveText("A Minor pentatonic");
  await page.evaluate(() => {
    [...document.querySelectorAll(".bankitem button")].find((b) => b.textContent.trim() === "Open")?.click();
  });
  // opening restores root, scale and view
  await expect(page).toHaveTitle("Scales · Fretwork");
  await expect(page.locator(".readout")).toContainText("A Minor pentatonic · 5 notes");
  // back to the Bank, then Remove
  await page.evaluate(() => document.querySelector(".dbank .dnav")?.click());
  await page.evaluate(() => document.querySelector('button[aria-label="Remove A Minor pentatonic"]')?.click());
  await expect(page.locator(".pane")).toContainText("Nothing saved yet.");
  await expect(page.locator(".readout")).toContainText("Bank · 0 saved");
  await expect(page.locator(".dbank .badge")).toHaveCount(0);
});

/* ---- Practice log ---- */

test("practice log: a fresh profile starts at level 1 with zero points", async ({ page }) => {
  await page.goto("/practice-log", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".levelnum b")).toHaveText("1");
  await expect(page.locator(".levelpts")).toContainText("0 points");
  await expect(page.locator(".levelnext")).toContainText("100 points to level 2");
});

test("practice log: every badge renders locked with its first threshold", async ({ page }) => {
  await page.goto("/practice-log", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".badge2")).toHaveCount(11);
  await expect(page.locator(".badge2.locked")).toHaveCount(11);
  await expect(page.locator(".badge2.earned")).toHaveCount(0);
  await expect(page.locator(".badge2", { hasText: "Daily habit" })).toContainText("Reach 3 day streak");
  await expect(page.locator(".badge2", { hasText: "In time" })).toContainText("Reach 5 min");
});

test("practice log: scoreboard, 14-day chart and empty-log note for a new user", async ({ page }) => {
  await page.goto("/practice-log", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toContainText("Practice log · 0 day streak");
  await expect(page.locator(".scoreboard .score")).toHaveCount(4);
  await expect(page.locator(".scoreboard .score").first()).toContainText("day streak");
  await expect(page.locator(".scoreboard .score b").first()).toHaveText("0");
  await expect(page.locator(".plogday")).toHaveCount(14);
  await expect(page.locator(".pane")).toContainText("No practice recorded yet.");
});

/* ---- Settings ---- */

test("settings: the Theme toggle flips the dark class on the app shell", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".app")).not.toHaveClass(/\bdark\b/);
  await page.evaluate(() => {
    [...document.querySelectorAll('.seg[aria-label="Theme"] button')].find((b) => b.textContent.trim() === "Dark")?.click();
  });
  await expect(page.locator(".app")).toHaveClass(/\bdark\b/);
  await expect(page.locator('.seg[aria-label="Theme"] button', { hasText: "Dark" })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    [...document.querySelectorAll('.seg[aria-label="Theme"] button')].find((b) => b.textContent.trim() === "Light")?.click();
  });
  await expect(page.locator(".app")).not.toHaveClass(/\bdark\b/);
});

test("settings: accessibility toggles add the hc and lowmotion classes", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".app")).not.toHaveClass(/\bhc\b/);
  await page.evaluate(() => {
    [...document.querySelectorAll('.seg[aria-label="High contrast"] button')].find((b) => b.textContent.trim() === "On")?.click();
  });
  await expect(page.locator(".app")).toHaveClass(/\bhc\b/);
  await page.evaluate(() => {
    [...document.querySelectorAll('.seg[aria-label="Animation"] button')].find((b) => b.textContent.trim() === "Reduced")?.click();
  });
  await expect(page.locator(".app")).toHaveClass(/\blowmotion\b/);
  await expect(page.locator(".app")).toHaveClass(/\bhc\b/); // both stay on together
});

test("settings: the fret and zoom sliders drive their readouts", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const fretsOut = page.locator('.field:has(input[aria-label="Frets shown"]) output');
  const zoomOut = page.locator('.field:has(input[aria-label="Fretboard zoom"]) output');
  await expect(fretsOut).toHaveText("22");
  await expect(zoomOut).toHaveText("1.0×");
  // React controlled inputs need the native value setter plus an input event
  await page.evaluate(() => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const frets = document.querySelector('input[aria-label="Frets shown"]');
    set.call(frets, "12");
    frets.dispatchEvent(new Event("input", { bubbles: true }));
    const zoom = document.querySelector('input[aria-label="Fretboard zoom"]');
    set.call(zoom, "1.5");
    zoom.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(fretsOut).toHaveText("12");
  await expect(zoomOut).toHaveText("1.5×");
});
