import { chromium, type Page } from "@playwright/test";

export interface SurveyedPage {
  route: string;
  source: "scan" | "live";
  finalURL: string;
  status: number | null;
  title: string;
  headings: string[];
  links: { name: string; href: string }[];
  forms: { fields: string[]; submits: string[] }[];
  buttons: string[];
  fields: string[];
  consoleErrors: string[];
  truncated: boolean;
  error?: string;
}

export interface LiveSurvey {
  schemaVersion: 1;
  baseURL: string;
  implementation: "playwright";
  pages: SurveyedPage[];
}

const LIMITS = { loadMs: 10_000, links: 200, forms: 20 };

export function surveyableRoutes(routes: string[]): string[] {
  return [...new Set(["/", ...routes.filter((route) => route.startsWith("/") && !route.includes(":") && !route.includes("*"))])];
}

/**
 * Visits each parameter-free route and records what it advertises. Never fills or
 * submits anything. Plain Playwright (decision in MT-3.2): zero tokens.
 */
export async function liveSurvey(baseURL: string, routes: string[], options: { locale?: string; followLinks?: boolean } = {}): Promise<LiveSurvey> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: options.locale ?? "en-US" });
  // tsx (esbuild keepNames) wraps the page.evaluate callback's inner functions in
  // `__name(...)`, a helper that exists in Node but not in the page.
  await context.addInitScript({ content: "globalThis.__name ??= (fn) => fn;" });
  const pages: SurveyedPage[] = [];
  const seen = new Set<string>();
  const queue: { route: string; source: "scan" | "live" }[] = surveyableRoutes(routes).map((route) => ({ route, source: "scan" }));
  try {
    for (let i = 0; i < queue.length; i++) {
      const { route, source } = queue[i];
      if (seen.has(route)) continue;
      seen.add(route);
      const page = await context.newPage();
      // Belt and braces: the survey must never submit, so block non-GET document requests.
      await page.route("**/*", (r) => (r.request().method() !== "GET" && r.request().resourceType() === "document" ? r.abort() : r.continue()));
      const surveyed = await surveyPage(page, baseURL, route, source);
      pages.push(surveyed);
      await page.close();
      if (options.followLinks !== false && source === "scan" && route === "/") {
        for (const link of surveyed.links) {
          const url = new URL(link.href, baseURL);
          if (url.origin !== new URL(baseURL).origin) continue;
          if (!seen.has(url.pathname) && !queue.some((q) => q.route === url.pathname)) queue.push({ route: url.pathname, source: "live" });
        }
      }
    }
  } finally {
    await browser.close();
  }
  return { schemaVersion: 1, baseURL, implementation: "playwright", pages };
}

async function surveyPage(page: Page, baseURL: string, route: string, source: "scan" | "live"): Promise<SurveyedPage> {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
  });
  const empty: SurveyedPage = { route, source, finalURL: "", status: null, title: "", headings: [], links: [], forms: [], buttons: [], fields: [], consoleErrors, truncated: false };
  try {
    const response = await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded", timeout: LIMITS.loadMs });
    await page.waitForLoadState("networkidle", { timeout: LIMITS.loadMs }).catch(() => undefined);
    const data = await page.evaluate((limits) => {
      const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      const visible = (el: Element) => {
        const box = (el as HTMLElement).getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      };
      const nameOf = (el: Element) => {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria.trim();
        const id = el.getAttribute("id");
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : el.closest("label");
        return text(label) || el.getAttribute("placeholder") || el.getAttribute("name") || text(el);
      };
      const headings = [...document.querySelectorAll("h1, h2")].filter(visible).map(text).filter(Boolean).slice(0, 30);
      const anchors = [...document.querySelectorAll("a[href]")].filter(visible);
      const links = anchors.slice(0, limits.links).map((a) => ({ name: nameOf(a).slice(0, 80), href: (a as HTMLAnchorElement).href }));
      const formEls = [...document.querySelectorAll("form")].slice(0, limits.forms);
      const forms = formEls.map((form) => ({
        fields: [...form.querySelectorAll("input:not([type=hidden]), textarea, select")].filter(visible).map(nameOf).filter(Boolean),
        submits: [...form.querySelectorAll("button, input[type=submit]")].filter(visible).map(nameOf).filter(Boolean),
      }));
      const buttons = [...new Set([...document.querySelectorAll("button, [role=button]")].filter(visible).map(nameOf).filter(Boolean))].slice(0, 60);
      const fields = [...new Set([...document.querySelectorAll("input:not([type=hidden]), textarea, select")].filter(visible).map(nameOf).filter(Boolean))].slice(0, 60);
      return { headings, links, forms, buttons, fields, truncated: anchors.length > limits.links || document.querySelectorAll("form").length > limits.forms };
    }, LIMITS);
    return { ...empty, ...data, finalURL: page.url(), status: response?.status() ?? null, title: await page.title() };
  } catch (error) {
    return { ...empty, finalURL: page.url(), error: (error as Error).message.split("\n")[0] };
  }
}
