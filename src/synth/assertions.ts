import type { Page } from "@playwright/test";
import type { Predicate } from "../scenario/types.ts";
import type { Target } from "./types.ts";

export class UnsupportedAssertion extends Error {}

const q = (value: string) => JSON.stringify(value);

export function escapeRegexSource(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function regexLiteral(text: string): string {
  return `new RegExp(${q(escapeRegexSource(text))})`;
}

export function locatorCode(target: Target): string {
  switch (target.by) {
    case "role":
      return `page.getByRole(${q(target.role)}, { name: ${q(target.name)}${target.exact === false ? "" : ", exact: true"} })`;
    case "label":
      return `page.getByLabel(${q(target.text)}${target.exact === false ? "" : ", { exact: true }"})`;
    case "placeholder":
      return `page.getByPlaceholder(${q(target.text)})`;
    case "text":
      return `page.getByText(${q(target.text)}${target.exact ? ", { exact: true }" : ""})`;
    case "testId":
      return `page.getByTestId(${q(target.id)})`;
  }
}

/** Predicate → Playwright `expect` lines (test-synthesis.md "Predicate → assertion"). */
export function assertionCode(p: Predicate): string[] {
  switch (p.kind) {
    case "url_includes":
      return [`await expect(page).toHaveURL(${regexLiteral(p.text)});`];
    case "title_includes":
      return [`await expect(page).toHaveTitle(${regexLiteral(p.text)});`];
    case "text_visible":
      return [`await expect(page.getByText(${q(p.text)}).first()).toBeVisible();`];
    case "text_absent":
      return [`await expect(page.getByText(${q(p.text)})).toHaveCount(0);`];
    case "control_exists":
      return [`await expect(${controlLocator(p)}.first()).toBeVisible();`];
    case "control_absent":
      return [`await expect(${controlLocator(p)}).toHaveCount(0);`];
    case "value_equals":
      return [`await expect(page.getByLabel(${q(p.name)})).toHaveValue(${q(p.text)});`];
    case "value_includes":
      return [`await expect(page.getByLabel(${q(p.name)})).toHaveValue(${regexLiteral(p.text)});`];
    case "no_console_error":
      return [`expect(consoleErrors).toEqual([]);`];
    case "dialog_open":
      return [p.open ? `await expect(page.getByRole("dialog")).toBeVisible();` : `await expect(page.getByRole("dialog")).toHaveCount(0);`];
    case "all":
      return p.of.flatMap(assertionCode);
    default:
      throw new UnsupportedAssertion(`${p.kind} is not supported by the M1 emitter`);
  }
}

function controlLocator(p: { role?: string; name?: string }): string {
  if (p.role) return `page.getByRole(${q(ariaRoleFor(p.role))}${p.name ? `, { name: ${q(p.name)} }` : ""})`;
  return `page.getByText(${q(p.name ?? "")})`;
}

/** Criteria may carry Magpi snapshot roles ("a", "submit"); map them like the trajectory reader. */
export function ariaRoleFor(role: string): string {
  const map: Record<string, string> = { a: "link", submit: "button", reset: "button", text: "textbox", email: "textbox", search: "searchbox", tel: "textbox", url: "textbox", "select-one": "combobox", "select-multiple": "listbox" };
  return map[role] ?? role;
}

export function usesConsole(predicates: Predicate[]): boolean {
  return predicates.some((p) => p.kind === "no_console_error" || ((p.kind === "all") && usesConsole(p.of)));
}

/**
 * Evaluates a predicate against a live page with the same mapping the emitter uses, so
 * the trivial-truth check (MT-4.2) and replay agree. Short timeouts: this is a snapshot.
 */
export async function evaluateOnPage(page: Page, p: Predicate, consoleErrors: string[] = []): Promise<boolean> {
  const visible = async (locator: ReturnType<Page["getByText"]>) => {
    try {
      await locator.first().waitFor({ state: "visible", timeout: 1500 });
      return true;
    } catch {
      return false;
    }
  };
  switch (p.kind) {
    case "url_includes":
      return page.url().includes(p.text);
    case "title_includes":
      return (await page.title()).includes(p.text);
    case "text_visible":
      return visible(page.getByText(p.text));
    case "text_absent":
      return (await page.getByText(p.text).count()) === 0;
    case "control_exists":
      return visible(p.role ? page.getByRole(ariaRoleFor(p.role) as never, p.name ? { name: p.name } : {}) : page.getByText(p.name ?? ""));
    case "control_absent":
      return (await (p.role ? page.getByRole(ariaRoleFor(p.role) as never, p.name ? { name: p.name } : {}) : page.getByText(p.name ?? "")).count()) === 0;
    case "value_equals":
    case "value_includes": {
      const field = page.getByLabel(p.name);
      if ((await field.count()) === 0) return false;
      const value = await field.first().inputValue().catch(() => "");
      return p.kind === "value_equals" ? value === p.text : value.includes(p.text);
    }
    case "no_console_error":
      return consoleErrors.length === 0;
    case "dialog_open":
      return ((await page.getByRole("dialog").count()) > 0) === p.open;
    case "all":
      for (const child of p.of) if (!(await evaluateOnPage(page, child, consoleErrors))) return false;
      return true;
    case "any":
      for (const child of p.of) if (await evaluateOnPage(page, child, consoleErrors)) return true;
      return false;
    case "not":
      return !(await evaluateOnPage(page, p.of, consoleErrors));
    default:
      return false;
  }
}
