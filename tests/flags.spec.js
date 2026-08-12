import { test, expect } from "@playwright/test";

/* Phase 8 feature flags. The first real flag, "simple-default", gates whether a
   brand-new visitor starts in Simple mode. These tests drive it end to end
   through the real Settings first-run path, the header toggle and the Simple
   route gate, plus the dev flags panel.

   First run is the absence of "fretboard:settings", so unlike the smoke suite we
   do NOT seed settings here. We seed only tourdone so the auto-tour cannot steal
   focus from a fresh profile. Each Playwright test gets a fresh context, so
   localStorage (overrides, the panel switch) never leaks between tests. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("fretboard:tourdone", "1");
    } catch (e) {}
  });
});

test("first-run visitor starts in Simple mode (flag defaults on)", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".chassis")).toBeVisible();
  await expect(page.locator(".simpletoggle")).toHaveAttribute("aria-checked", "true", { timeout: 5000 });
});

test("?ff_simple-default=off starts a first-run visitor in full mode", async ({ page }) => {
  await page.goto("/?ff_simple-default=off", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".chassis")).toBeVisible();
  await expect(page.locator(".simpletoggle")).toHaveAttribute("aria-checked", "false", { timeout: 5000 });
});

test("Simple default hides Intervals: a direct visit redirects to home", async ({ page }) => {
  await page.goto("/intervals", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".chassis")).toBeVisible();
  // Simple mode sends a hidden view back to Chords, so the title is never Intervals.
  await expect(page).not.toHaveTitle("Intervals · Fretwork", { timeout: 5000 });
});

test("flag off makes Intervals reachable for a first-run visitor", async ({ page }) => {
  await page.goto("/intervals?ff_simple-default=off", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".chassis")).toBeVisible();
  await expect(page).toHaveTitle("Intervals · Fretwork", { timeout: 5000 });
  await expect(page.locator(".readout")).not.toBeEmpty();
});

test("the dev flags panel is hidden by default", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".chassis")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Feature flags" })).toHaveCount(0);
});

test("?flags reveals the dev flags panel with the flag listed", async ({ page }) => {
  await page.goto("/settings?flags", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".chassis")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Feature flags" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("simple-default", { exact: false })).toBeVisible();
  // the flag toggle carries an accessible name (Field cannot borrow it here,
  // because the Field wraps the Seg plus a conditional Reset button)
  await expect(page.getByRole("group", { name: "simple-default" })).toBeVisible();
});

test("a bare ?ff_ param reads as on, not an empty falsy value", async ({ page }) => {
  // ?ff_simple-default (no =) must keep Simple mode on for a first-run visitor,
  // matching how a bare ?flags enables the panel. The old bug forced it off.
  await page.goto("/?ff_simple-default", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".chassis")).toBeVisible();
  await expect(page.locator(".simpletoggle")).toHaveAttribute("aria-checked", "true", { timeout: 5000 });
});

test("a URL-forced flag is shown read-only, with no dead controls", async ({ page }) => {
  await page.goto("/settings?flags&ff_simple-default=off", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".chassis")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Feature flags" })).toBeVisible({ timeout: 5000 });
  // read-only note instead of a toggle that localStorage could not move
  await expect(page.getByText(/forced by a \?ff_ link/)).toBeVisible();
  await expect(page.getByRole("group", { name: "simple-default" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Reset simple-default/ })).toHaveCount(0);
});
