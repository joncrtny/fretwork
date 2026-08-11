import { test, expect } from "@playwright/test";

/* Feature tests for the Learn views: Scales, Chords, Arpeggios, Intervals and
   Progressions. Each test drives a real control (picker, seg, chip, diagram)
   and asserts the state change it causes in the DOM: readout text, degree
   chips, selection classes, captions. Companion to smoke.spec.js. */

/* Treat the browser as a returning user in full (non-Simple) mode, matching
   smoke.spec.js: seeding "fretboard:settings" keeps advanced views reachable
   and the panes deterministic. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("fretboard:settings", JSON.stringify({ simple: false }));
      localStorage.setItem("fretboard:tourdone", "1"); // the auto-tour steals focus from a fresh profile
    } catch (e) {}
  });
});

/* Open the picker inside the Field whose label matches exactly (DOM click per
   house style: the fretboard SVG can intercept pointer hit-tests). */
async function openPicker(page, fieldLabel) {
  await page.evaluate((lb) => {
    const f = [...document.querySelectorAll(".field")].find((x) => (x.querySelector(".flabel")?.textContent || "").trim() === lb);
    f?.querySelector(".pickbtn")?.click();
  }, fieldLabel);
  await page.waitForSelector(".pickmenu");
}

/* Choose an option from the open pickmenu: exact name first (the text node
   before any sub label), then a substring fallback for matching on sub text. */
async function pickFromMenu(page, match) {
  await page.evaluate((m) => {
    const items = [...document.querySelectorAll(".pickmenu [role=option]")];
    const hit = items.find((b) => (b.firstChild?.textContent || "").trim() === m) || items.find((b) => (b.textContent || "").includes(m));
    hit?.click();
  }, match);
}

async function pick(page, fieldLabel, match) {
  await openPicker(page, fieldLabel);
  await pickFromMenu(page, match);
}

/* Click an option inside a Seg button group by its accessible name. */
async function segClick(page, ariaLabel, optionText) {
  await page.evaluate(
    ({ lb, txt }) => {
      const seg = document.querySelector(`.seg[aria-label="${lb}"]`);
      [...(seg ? seg.querySelectorAll("button") : [])].find((b) => b.textContent.trim() === txt)?.click();
    },
    { lb: ariaLabel, txt: optionText },
  );
}

/* Click a position chip by its exact text. */
async function chipClick(page, text) {
  await page.evaluate((t) => {
    [...document.querySelectorAll(".poschip")].find((b) => b.textContent.trim() === t)?.click();
  }, text);
}

/* ---- Scales ---- */

test("scales: changing key updates the readout and degree chips", async ({ page }) => {
  await page.goto("/scales", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C Major (Ionian) · 7 notes");
  await pick(page, "Key", "A");
  await expect(page.locator(".readout")).toHaveText("A Major (Ionian) · 7 notes");
  // the degree chips respell from the new root: the R chip now reads A
  await expect(page.locator(".pane .degrees .chip").first()).toContainText("A");
});

test("scales: picking a scale changes the readout and the note count", async ({ page }) => {
  await page.goto("/scales", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C Major (Ionian) · 7 notes");
  await pick(page, "Scale", "Major pentatonic");
  await expect(page.locator(".readout")).toHaveText("C Major pentatonic · 5 notes");
  await expect(page.locator(".pane .degrees .chip")).toHaveCount(5);
});

test("scales: a position chip selects and reveals its fret range", async ({ page }) => {
  await page.goto("/scales", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C Major (Ionian) · 7 notes");
  const posOne = page.locator(".posrow .poschip").filter({ hasText: /^1$/ });
  await expect(posOne).not.toHaveClass(/\bon\b/);
  await chipClick(page, "1");
  await expect(posOne).toHaveClass(/\bon\b/);
  await expect(page.locator(".poshint")).toHaveText(/^Frets \d+ to \d+$/);
  await chipClick(page, "Whole neck");
  await expect(page.locator(".poshint")).toHaveCount(0);
});

test("scales: Neck shows switches the dot labels to degrees", async ({ page }) => {
  await page.goto("/scales", { waitUntil: "domcontentloaded" });
  const seg = page.locator('.seg[aria-label="Neck shows"]');
  await expect(seg.locator("button").filter({ hasText: /^Notes$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".dotlabel").filter({ hasText: /^R$/ })).toHaveCount(0);
  await segClick(page, "Neck shows", "Degrees");
  await expect(seg.locator("button").filter({ hasText: /^Degrees$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(seg.locator("button").filter({ hasText: /^Notes$/ })).toHaveAttribute("aria-pressed", "false");
  // the neck itself now labels root notes with R
  await expect(page.locator(".dotlabel").filter({ hasText: /^R$/ }).first()).toBeVisible();
});

/* ---- Chords (home) ---- */

test("chords: the readout voicing count matches the diagrams on show", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText(/^C · \d+ voicings$/);
  // textContent, not innerText: .readout renders text-transform uppercase
  const readout = await page.locator(".readout").textContent();
  const count = Number(readout.match(/(\d+) voicings/)[1]);
  expect(count).toBeGreaterThan(0);
  await expect(page.locator(".voicings .voicing")).toHaveCount(count);
});

test("chords: changing the root updates the readout and diagrams", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText(/^C · \d+ voicings$/);
  await pick(page, "Root", "E");
  await expect(page.locator(".readout")).toHaveText(/^E · \d+ voicings$/);
  await expect(page.locator(".voicings .voicing").first()).toBeVisible();
});

test("chords: picking a chord type updates the readout suffix", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText(/^C · \d+ voicings$/);
  await pick(page, "Chord", "Minor");
  await expect(page.locator(".readout")).toHaveText(/^Cm · \d+ voicings$/);
});

test("chords: tapping another diagram moves the selection", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const diagrams = page.locator(".voicings .voicing");
  await expect(diagrams.first()).toHaveAttribute("aria-pressed", "true");
  await expect(diagrams.nth(1)).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => {
    document.querySelectorAll(".voicings .voicing")[1]?.click();
  });
  await expect(diagrams.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(diagrams.first()).toHaveAttribute("aria-pressed", "false");
});

/* ---- Arpeggios ---- */

test("arpeggios: changing the root updates the readout and chips", async ({ page }) => {
  await page.goto("/arpeggios", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C arpeggio · 3 tones");
  await pick(page, "Root", "G");
  await expect(page.locator(".readout")).toHaveText("G arpeggio · 3 tones");
  await expect(page.locator(".pane .degrees .chip").first()).toContainText("G");
});

test("arpeggios: picking a type changes the tone count", async ({ page }) => {
  await page.goto("/arpeggios", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C arpeggio · 3 tones");
  await pick(page, "Arpeggio", "Dominant 7th");
  await expect(page.locator(".readout")).toHaveText("C7 arpeggio · 4 tones");
  await expect(page.locator(".pane .degrees .chip")).toHaveCount(4);
});

test("arpeggios: the direction seg moves its selection", async ({ page }) => {
  await page.goto("/arpeggios", { waitUntil: "domcontentloaded" });
  const seg = page.locator('.seg[aria-label="Arpeggio direction"]');
  await expect(seg.locator("button").filter({ hasText: /^Up$/ })).toHaveAttribute("aria-pressed", "true");
  await segClick(page, "Arpeggio direction", "Down");
  await expect(seg.locator("button").filter({ hasText: /^Down$/ })).toHaveAttribute("aria-pressed", "true");
  await expect(seg.locator("button").filter({ hasText: /^Up$/ })).toHaveAttribute("aria-pressed", "false");
});

test("arpeggios: a position chip selects and reveals its fret range", async ({ page }) => {
  await page.goto("/arpeggios", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C arpeggio · 3 tones");
  await chipClick(page, "1");
  await expect(page.locator(".posrow .poschip").filter({ hasText: /^1$/ })).toHaveClass(/\bon\b/);
  await expect(page.locator(".poshint")).toHaveText(/^Frets \d+ to \d+$/);
});

/* ---- Intervals ---- */

test("intervals: toggling an interval on extends the readout and chips", async ({ page }) => {
  await page.goto("/intervals", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C root · R 3 5");
  await expect(page.locator(".pane .degrees .chip")).toHaveCount(3);
  await page.evaluate(() => {
    [...document.querySelectorAll(".ivgrid .iv")].find((b) => b.querySelector("b")?.textContent === "♭7")?.click();
  });
  await expect(page.locator(".readout")).toHaveText("C root · R 3 5 ♭7");
  await expect(page.locator(".pane .degrees .chip")).toHaveCount(4);
  await expect(page.locator(".ivgrid .iv").filter({ hasText: "♭7" })).toHaveAttribute("aria-pressed", "true");
});

test("intervals: toggling an interval off shrinks the selection", async ({ page }) => {
  await page.goto("/intervals", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C root · R 3 5");
  await page.evaluate(() => {
    [...document.querySelectorAll(".ivgrid .iv")].find((b) => b.querySelector("b")?.textContent === "3")?.click();
  });
  await expect(page.locator(".readout")).toHaveText("C root · R 5");
  await expect(page.locator(".pane .degrees .chip")).toHaveCount(2);
});

test("intervals: the All twelve preset lights every degree", async ({ page }) => {
  await page.goto("/intervals", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C root · R 3 5");
  await page.evaluate(() => {
    [...document.querySelectorAll(".pane .btn")].find((b) => b.textContent.trim() === "All twelve")?.click();
  });
  await expect(page.locator(".readout")).toHaveText("C root · R ♭2 2 ♭3 3 4 ♭5 5 ♭6 6 ♭7 7");
  await expect(page.locator(".pane .degrees .chip")).toHaveCount(12);
  await expect(page.locator(".pane .btn").filter({ hasText: /^All twelve$/ })).toHaveAttribute("aria-pressed", "true");
});

test("intervals: changing the root respells the readout and chips", async ({ page }) => {
  await page.goto("/intervals", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText("C root · R 3 5");
  await pick(page, "Root", "D");
  await expect(page.locator(".readout")).toHaveText("D root · R 3 5");
  await expect(page.locator(".pane .degrees .chip").first()).toContainText("D");
});

/* ---- Progressions ---- */

test("progressions: the default preset renders one diagram per bar with roman captions", async ({ page }) => {
  await page.goto("/progressions", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText(/^C · .+ · 4 bars$/);
  await expect(page.locator(".voicings .voicing")).toHaveCount(4);
  await expect(page.locator(".voicings .voicing .vtitle em")).toHaveText(["I", "V", "vi", "IV"]);
});

test("progressions: picking the 12-bar blues renders grouped bars", async ({ page }) => {
  await page.goto("/progressions", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText(/^C · .+ · 4 bars$/);
  await pick(page, "Progression", "12-bar blues");
  await expect(page.locator(".readout")).toHaveText(/^C · 12-bar blues · 12 bars$/);
  // consecutive identical bars collapse into one captioned diagram
  await expect(page.locator(".voicings .voicing .vtitle em")).toHaveText([
    "I7 · 4 bars",
    "IV7 · 2 bars",
    "I7 · 2 bars",
    "V7",
    "IV7",
    "I7",
    "V7",
  ]);
});

test("progressions: changing key retitles every chord diagram", async ({ page }) => {
  await page.goto("/progressions", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText(/^C · .+ · 4 bars$/);
  await pick(page, "Key", "G");
  await expect(page.locator(".readout")).toHaveText(/^G · .+ · 4 bars$/);
  // I V vi IV in G: the first diagram is titled G, the vi bar is Em
  await expect(page.locator(".voicings .voicing .vtitle").first()).toContainText("G");
  await expect(page.locator(".voicings .voicing .vtitle").nth(2)).toContainText("Em");
});

test("progressions: a minor preset swaps the bars and captions", async ({ page }) => {
  await page.goto("/progressions", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".readout")).toHaveText(/^C · .+ · 4 bars$/);
  await pick(page, "Progression", "Andalusian");
  await expect(page.locator(".readout")).toHaveText(/^C · .+ · 4 bars$/);
  await expect(page.locator(".voicings .voicing .vtitle em")).toHaveText(["i", "VII", "VI", "V"]);
  // minor i in C spells the first diagram Cm
  await expect(page.locator(".voicings .voicing .vtitle").first()).toContainText("Cm");
});
