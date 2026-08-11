import { test, expect } from "@playwright/test";

/* Refactor safety net for the app shell: nav drawer, header, metronome panel,
   About, FAQ and the logged-out Account view. Each test asserts real state
   changes in the DOM (URL and title moves, aria state, chip selection,
   readout text), never bare visibility. */

/* Treat the browser as a returning user in full (non-Simple) mode, exactly as
   smoke.spec.js does. This spec also seeds "fretboard:tourdone": without it the
   guided tour auto-starts after hydration and its modal scrim sits over the
   drawer and header, trapping Escape and stealing focus, which these shell
   tests exercise directly. The tour still starts on demand (About tests it). */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("fretboard:settings", JSON.stringify({ simple: false }));
      localStorage.setItem("fretboard:tourdone", "1");
    } catch (e) {}
  });
});

/* DOM clicks per house style: the fretboard SVG and transitions can intercept
   pointer hit-tests, so nav and picker clicks go through page.evaluate. */
const clickBurger = (page) => page.evaluate(() => document.querySelector(".burger")?.click());

const openDrawer = async (page) => {
  await clickBurger(page);
  await expect(page.locator(".drawer.open")).toBeVisible();
};

const clickDnav = (page, label) =>
  page.evaluate((l) => {
    [...document.querySelectorAll(".drawer .dnav")].find((b) => (b.textContent || "").trim().startsWith(l))?.click();
  }, label);

const clickCat = (page, label) =>
  page.evaluate((l) => {
    [...document.querySelectorAll(".drawer .dhead.dcat")].find((b) => (b.textContent || "").includes(l))?.click();
  }, label);

/* ---------------- Nav drawer ---------------- */

test.describe("nav drawer", () => {
  test("burger opens and closes the drawer", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    /* closed = no "open" class and inert; the collapsed drawer keeps a 1px
       border so Playwright's toBeHidden never applies to it */
    const drawer = page.locator(".drawer");
    await expect(drawer).not.toHaveClass(/open/);
    await expect(drawer).toHaveAttribute("inert", "");
    await expect(page.locator(".burger")).toHaveAttribute("aria-expanded", "false");

    await clickBurger(page);
    await expect(page.locator(".drawer.open")).toBeVisible();
    await expect(page.locator(".burger")).toHaveAttribute("aria-expanded", "true");
    expect(await page.evaluate(() => document.querySelector(".drawer").hasAttribute("inert"))).toBe(false);

    await clickBurger(page);
    await expect(drawer).not.toHaveClass(/open/);
    await expect(drawer).toHaveAttribute("inert", "");
    await expect(page.locator(".burger")).toHaveAttribute("aria-expanded", "false");
  });

  test("navigating via the drawer changes URL, title and the current item", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openDrawer(page);
    await clickDnav(page, "Scales");
    await expect(page).toHaveURL(/\/scales$/);
    await expect(page).toHaveTitle("Scales · Fretwork");
    await expect(page.locator('.drawer .dnav[aria-current="page"]')).toHaveText(/^Scales/);
    await expect(page.locator(".readout")).toContainText("notes");
    // desktop keeps the drawer open as a persistent sidebar
    await expect(page.locator(".drawer.open")).toBeVisible();
    await clickDnav(page, "Chords");
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle("Fretwork: Guitar Fretboard Trainer for Scales and Chords");
  });

  test("category accordions expand and collapse", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openDrawer(page);
    // Learn is open by default, Practice starts collapsed
    await expect(page.locator(".drawer .dnav", { hasText: "Scales" })).toBeVisible();
    const practiceHead = page.locator(".drawer .dhead.dcat", { hasText: "Practice" });
    await expect(practiceHead).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".drawer .dnav", { hasText: "Chord changes" })).toHaveCount(0);

    await clickCat(page, "Practice");
    await expect(practiceHead).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".drawer .dnav", { hasText: "Chord changes" })).toBeVisible();

    await clickCat(page, "Practice");
    await expect(practiceHead).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".drawer .dnav", { hasText: "Chord changes" })).toHaveCount(0);
  });

  test("Escape closes the drawer and returns focus to the burger", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await openDrawer(page);
    await page.keyboard.press("Escape");
    await expect(page.locator(".drawer")).not.toHaveClass(/open/);
    await expect(page.locator(".drawer")).toHaveAttribute("inert", "");
    await expect(page.locator(".burger")).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => document.activeElement?.classList.contains("burger"))).toBe(true);
  });

  test("opening the drawer reveals the active view's category", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await openDrawer(page);
    await expect(page.locator(".drawer .dhead.dcat", { hasText: "Profile" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator('.drawer .dnav[aria-current="page"]')).toHaveText(/^Settings/);
  });
});

/* ---------------- Header ---------------- */

test.describe("header", () => {
  test("brand, home title and per-view readout", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".brand h1")).toHaveText("Fretwork");
    await expect(page).toHaveTitle("Fretwork: Guitar Fretboard Trainer for Scales and Chords");
    await expect(page.locator(".readout")).toContainText("voicings");
    await openDrawer(page);
    await clickDnav(page, "About");
    await expect(page.locator(".readout")).toContainText("About");
    await expect(page).toHaveTitle("About · Fretwork");
  });

  test("share button appears only on shareable views", async ({ page }) => {
    await page.goto("/scales", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".sharebtn")).toBeVisible();
    await openDrawer(page);
    await clickDnav(page, "FAQ");
    await expect(page).toHaveTitle("FAQ · Fretwork");
    await expect(page.locator(".sharebtn")).toHaveCount(0);
  });

  test("burger label and tooltip flip with drawer state", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const burger = page.locator(".burger");
    await expect(burger).toHaveAttribute("aria-label", "Open menu");
    await expect(burger).toHaveAttribute("data-tip", "Menu");
    await clickBurger(page);
    await expect(burger).toHaveAttribute("aria-label", "Close menu");
    await expect(burger).toHaveAttribute("data-tip", "Close menu");
  });
});

/* ---------------- Metronome panel ---------------- */

const METRO = 'section[aria-label="Metronome"]';

const openMetro = async (page) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await openDrawer(page);
  await clickCat(page, "Tools");
  await clickDnav(page, "Metronome");
  await expect(page.locator(METRO)).toBeVisible();
};

test.describe("metronome panel", () => {
  test("opens from the nav and closes on a second click", async ({ page }) => {
    await openMetro(page);
    const navBtn = page.locator(".drawer .dnav", { hasText: "Metronome" });
    await expect(navBtn).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`${METRO} .transport`)).toHaveText("Start");
    await expect(page.locator(`${METRO} .bpmval`)).toHaveText("90 bpm");
    await expect(page.locator(`${METRO} .beats .bdot`)).toHaveCount(4);
    await clickDnav(page, "Metronome");
    await expect(page.locator(METRO)).toHaveCount(0);
    await expect(navBtn).toHaveAttribute("aria-expanded", "false");
  });

  test("bpm steppers change the tempo readout", async ({ page }) => {
    await openMetro(page);
    const step = (label) =>
      page.evaluate(({ sel, l }) => document.querySelector(sel).querySelector(`button[aria-label="${l}"]`)?.click(), {
        sel: METRO,
        l: label,
      });
    await step("Slower by five beats per minute");
    await expect(page.locator(`${METRO} .bpmval`)).toHaveText("85 bpm");
    await step("Faster by five beats per minute");
    await step("Faster by five beats per minute");
    await expect(page.locator(`${METRO} .bpmval`)).toHaveText("95 bpm");
    expect(await page.evaluate((sel) => document.querySelector(`${sel} input[type="range"]`).value, METRO)).toBe("95");
  });

  test("time signature changes the beat dots", async ({ page }) => {
    await openMetro(page);
    await page.selectOption(`${METRO} select[aria-label="Time signature"]`, "3");
    await expect(page.locator(`${METRO} .beats .bdot`)).toHaveCount(3);
    await page.selectOption(`${METRO} select[aria-label="Time signature"]`, "6");
    await expect(page.locator(`${METRO} .beats .bdot`)).toHaveCount(6);
  });

  test("click sound and accent chips select", async ({ page }) => {
    await openMetro(page);
    const chip = (label) =>
      page.evaluate(
        ({ sel, l }) => [...document.querySelector(sel).querySelectorAll(".seg button")].find((b) => b.textContent.trim() === l)?.click(),
        { sel: METRO, l: label },
      );
    await expect(page.locator(`${METRO} .seg button`, { hasText: "Click" })).toHaveAttribute("aria-pressed", "true");
    await chip("Beep");
    await expect(page.locator(`${METRO} .seg button`, { hasText: "Beep" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(`${METRO} .seg button`, { hasText: "Click" })).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(`${METRO} .seg button`, { hasText: "Downbeat" })).toHaveAttribute("aria-pressed", "true");
    await chip("Even");
    await expect(page.locator(`${METRO} .seg button`, { hasText: "Even" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(`${METRO} .seg button`, { hasText: "Downbeat" })).toHaveAttribute("aria-pressed", "false");
  });

  test("start and stop toggle the transport and the nav badge", async ({ page }) => {
    await openMetro(page);
    const transport = page.locator(`${METRO} .transport`);
    const badge = page.locator(".drawer .dnav", { hasText: "Metronome" }).locator(".badge");
    await expect(transport).toHaveAttribute("aria-pressed", "false");
    await expect(badge).toHaveCount(0);
    await page.evaluate((sel) => document.querySelector(`${sel} .transport`)?.click(), METRO);
    await expect(transport).toHaveText("Stop");
    await expect(transport).toHaveAttribute("aria-pressed", "true");
    await expect(badge).toHaveText("90");
    await page.evaluate((sel) => document.querySelector(`${sel} .transport`)?.click(), METRO);
    await expect(transport).toHaveText("Start");
    await expect(transport).toHaveAttribute("aria-pressed", "false");
    await expect(badge).toHaveCount(0);
  });
});

/* ---------------- About ---------------- */

test.describe("about", () => {
  test("What's new lists dated releases", async ({ page }) => {
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".abouthead", { hasText: "What's new" })).toBeVisible();
    await expect(page.locator(".release").first()).toBeVisible();
    await expect(page.locator(".release .releasedate").first()).toContainText(/20\d\d/);
    expect(await page.locator(".release").first().locator(".releaselist li").count()).toBeGreaterThan(0);
  });

  test("Open the FAQ button navigates to the FAQ", async ({ page }) => {
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      [...document.querySelectorAll(".pane.about .btn")].find((b) => b.textContent.trim() === "Open the FAQ")?.click();
    });
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page).toHaveTitle("FAQ · Fretwork");
    await expect(page.locator(".faq-pane details.faqitem").first()).toBeVisible();
  });

  test("Take the tour starts the guided tour on the fretboard view", async ({ page }) => {
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      [...document.querySelectorAll(".pane.about .btn")].find((b) => b.textContent.trim() === "Take the tour")?.click();
    });
    await expect(page.locator('.tour[role="dialog"]')).toBeVisible();
    await expect(page.locator(".tourtitle")).toHaveText("Welcome to Fretwork");
    await expect(page.locator(".tourstep")).toHaveText("Step 1 of 8");
    await expect(page).toHaveURL(/\/$/);
    // step 2 spotlights the menu, so the drawer opens
    await page.evaluate(() => {
      [...document.querySelectorAll(".tourbtns button")].find((b) => b.textContent.trim() === "Next")?.click();
    });
    await expect(page.locator(".tourtitle")).toHaveText("The menu");
    await expect(page.locator(".drawer.open")).toBeVisible();
    await page.evaluate(() => {
      [...document.querySelectorAll(".tourbtns button")].find((b) => b.textContent.trim() === "Skip")?.click();
    });
    await expect(page.locator(".tour")).toHaveCount(0);
  });

  test("feedback form enables Send only once a message is typed", async ({ page }) => {
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    const send = page.locator(".feedback button[type='submit']");
    await expect(send).toHaveText("Send feedback");
    await expect(send).toBeDisabled();
    await page.fill('.feedback textarea[aria-label="Suggestion or feedback"]', "A test note, not sent");
    await expect(send).toBeEnabled();
  });
});

/* ---------------- FAQ ---------------- */

test.describe("faq", () => {
  test("tapping a question reveals its answer", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });
    const item = page.locator("details.faqitem", { hasText: "What is Fretwork?" });
    await expect(item).not.toHaveAttribute("open", "");
    await item.locator("summary").evaluate((el) => el.click());
    await expect(item).toHaveAttribute("open", "");
    await expect(item.locator("p.note")).toContainText("free, interactive guitar fretboard");
  });

  test("table of contents chips match the sections and jump to them", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });
    const chips = await page.locator(".faqtoc .jumpchip").count();
    expect(chips).toBeGreaterThan(5);
    await expect(page.locator('section[id^="faq-"]')).toHaveCount(chips);
    await page.evaluate(() => {
      [...document.querySelectorAll(".faqtoc .jumpchip")].find((b) => /Rhythm/.test(b.textContent || ""))?.click();
    });
    await expect(page.locator("#faq-rhythm .abouthead")).toBeInViewport();
  });

  test("an answer's jump button opens the related view", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });
    const item = page.locator("details.faqitem", { hasText: "Where do I start?" });
    await item.locator("summary").evaluate((el) => el.click());
    await expect(item.locator(".faqjump")).toHaveText("Open Chords");
    await item.locator(".faqjump").evaluate((el) => el.click());
    await expect(page).toHaveURL(/\/$/);
    await expect(page).toHaveTitle("Fretwork: Guitar Fretboard Trainer for Scales and Chords");
    await expect(page.locator(".readout")).toContainText("voicings");
  });

  test("FAQPage JSON-LD exists only while the FAQ is showing", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#faq-jsonld")).toHaveCount(1);
    await page.evaluate(() => {
      [...document.querySelectorAll(".faq-pane .btn")].find((b) => b.textContent.trim() === "Go to About")?.click();
    });
    await expect(page).toHaveTitle("About · Fretwork");
    await expect(page.locator("#faq-jsonld")).toHaveCount(0);
  });
});

/* ---------------- Account (logged out) ---------------- */

test.describe("account, logged out", () => {
  test("shows the create-account form by default", async ({ page }) => {
    await page.goto("/account", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Account · Fretwork");
    await expect(page.locator(".readout")).toContainText("Create an account");
    await expect(page.locator(".abouthead", { hasText: "Create an account" })).toBeVisible();
    await expect(page.locator(".warnbox")).toContainText("cannot be recovered");
    await expect(page.locator('label[for="auth-name"]')).toContainText("Choose a username");
    const submit = page.locator('.authform button[type="submit"]');
    await expect(submit).toHaveText("Create account");
    await expect(submit).toBeDisabled();
  });

  test("switching to Sign in swaps the form", async ({ page }) => {
    await page.goto("/account", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      const seg = document.querySelector('.seg[aria-label="Sign in or create account"]');
      [...(seg?.querySelectorAll("button") || [])].find((b) => b.textContent.trim() === "Sign in")?.click();
    });
    await expect(page.locator(".abouthead", { hasText: "Sign in" })).toBeVisible();
    await expect(page.locator(".warnbox")).toHaveCount(0);
    await expect(page.locator('label[for="auth-name"]')).toContainText("Username (or linked email)");
    await expect(page.locator(".authform button", { hasText: "Forgot password" })).toBeVisible();
    await expect(page.locator('.authform button[type="submit"]')).toHaveText("Sign in");
  });

  test("filling username and password enables the submit", async ({ page }) => {
    await page.goto("/account", { waitUntil: "domcontentloaded" });
    const submit = page.locator('.authform button[type="submit"]');
    await expect(submit).toBeDisabled();
    await page.fill("#auth-name", "shelltestuser");
    await page.fill("#auth-pass", "not-a-real-password");
    await expect(submit).toBeEnabled();
    await page.fill("#auth-pass", "");
    await expect(submit).toBeDisabled();
  });
});
