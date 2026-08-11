import { test, expect } from "@playwright/test";

/* Refactor safety net. Every view must still load at its real route, mount the
   app shell, show the correct per-view title, put real content on the page, and
   throw no uncaught errors. Plus targeted feature checks. Keyed off VIEW_META. */

/* Treat the browser as a returning user in full (non-Simple) mode. First run is
   detected by the absence of "fretboard:settings" and forces Simple mode, which
   hides advanced views (Progressions, etc.) and would redirect them to Chords.
   Seeding settings keeps every view reachable and the tests deterministic. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("fretboard:settings", JSON.stringify({ simple: false }));
    } catch (e) {}
  });
});

const ROUTES = [
  { path: "/", name: "Chords (home)", title: null },
  { path: "/scales", name: "Scales", title: "Scales" },
  { path: "/arpeggios", name: "Arpeggios", title: "Arpeggios" },
  { path: "/intervals", name: "Intervals", title: "Intervals" },
  { path: "/progressions", name: "Progressions", title: "Progressions" },
  { path: "/chord-changes", name: "Chord changes", title: "Chord changes" },
  { path: "/practice-routine", name: "Practice routine", title: "Practice routine" },
  { path: "/strumming", name: "Strumming", title: "Strumming" },
  { path: "/melodies", name: "Melodies", title: "Melodies" },
  { path: "/quiz", name: "Fretboard Quiz", title: "Fretboard Quiz" },
  { path: "/ear-training", name: "Ear training", title: "Ear training" },
  { path: "/chord-finder", name: "Chord finder", title: "Chord finder" },
  { path: "/tuner", name: "Tuner", title: "Tuner" },
  { path: "/bank", name: "Bank", title: "Bank" },
  { path: "/about", name: "About", title: "About" },
  { path: "/faq", name: "FAQ", title: "FAQ" },
  { path: "/account", name: "Account", title: "Account" },
  { path: "/settings", name: "Settings", title: "Settings" },
  { path: "/practice-log", name: "Practice log", title: "Practice log" },
];

for (const r of ROUTES) {
  test(`view loads: ${r.name} (${r.path})`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(r.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".chassis")).toBeVisible();
    await expect(page.locator(".readout")).not.toBeEmpty();
    // the correct view actually loaded (not redirected): document.title is set
    // per view as "<Title> · Fretwork" (home keeps the full SEO title)
    if (r.title) await expect(page).toHaveTitle(`${r.title} · Fretwork`);
    const rootText = (await page.locator("#root").innerText()).trim();
    expect(rootText.length).toBeGreaterThan(20);
    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("home renders the fretboard", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".neckwrap")).toBeVisible();
});

test("stylesheet is applied (index.css actually loads)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const style = await page.evaluate(() => {
    const app = document.querySelector(".app");
    if (!app) return null;
    const cs = getComputedStyle(app);
    return { paper: cs.getPropertyValue("--paper").trim(), font: cs.fontFamily };
  });
  expect(style, "no .app element").not.toBeNull();
  expect(style.paper, "--paper token missing -> stylesheet not applied").toBeTruthy();
  expect(style.font).toContain("IBM Plex");
});

test("FAQ renders questions and injects FAQPage schema", async ({ page }) => {
  await page.goto("/faq", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".faq-pane details.faqitem").first()).toBeVisible();
  expect(await page.locator(".faq-pane details.faqitem").count()).toBeGreaterThan(20);
  await expect(page.locator("#faq-jsonld")).toHaveCount(1);
});

test("tuner shows its plain-language intro", async ({ page }) => {
  await page.goto("/tuner", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".tunerbox")).toContainText("Play a string and Fretwork shows");
});

test("custom progression: adding chords by name adds the right degrees", async ({ page }) => {
  await page.goto("/progressions", { waitUntil: "domcontentloaded" });
  // open the Progression picker (DOM click per house style), wait for the menu,
  // then choose Custom
  await page.evaluate(() => {
    const f = [...document.querySelectorAll(".field")].find((x) => /Progression/.test(x.querySelector(".flabel")?.textContent || ""));
    f?.querySelector(".pickbtn, button")?.click();
  });
  await page.waitForSelector(".pickmenu");
  await page.evaluate(() => {
    [...document.querySelectorAll(".pickmenu button")].find((b) => /custom progression/i.test(b.textContent || ""))?.click();
  });
  await expect(page.locator(".chordkey").first()).toBeVisible();
  // in C major, tap C, G, Am, F -> degrees I, V, vi, IV
  await page.evaluate(() => {
    const tap = (n) => [...document.querySelectorAll(".chordkey")].find((b) => b.textContent.trim() === n)?.click();
    ["C", "G", "Am", "F"].forEach(tap);
  });
  await expect(page.locator(".field", { hasText: "Bars" }).first()).toContainText("Bars · 4");
});
