import type { Lens, Predicate } from "../scenario/types.ts";
import type { LiveSurvey, SurveyedPage } from "./live-survey.ts";

/**
 * What the app can actually show: surveyed page text plus UI-looking strings from source.
 * Explore criteria must quote it, because a drafter that guesses ("No invoices found")
 * sends Magpi after text that does not exist and pays for two runs that cannot pass.
 */
export interface AppText {
  pages: SurveyedPage[];
  strings: string[];
}

const LITERAL = /(["'`])((?:(?!\1)[^\\\n]|\\.){3,160})\1/g;
const JSX_TEXT = />\s*([^<>{}\n][^<>{}]{2,160}?)\s*</g;

/** Capitalised human text: excludes class lists, paths, identifiers, and code. */
export function isUiString(text: string): boolean {
  if (!/^[\p{Lu}0-9]/u.test(text) || !/\p{Ll}/u.test(text)) return false;
  if (/^[A-Z][a-z]+$/.test(text)) return true; // one word: "Invoices"
  if (/^[A-Z][A-Za-z0-9]*$/.test(text)) return false; // PascalCase identifier
  return !(text.includes("${") || /=>|&&|\|\||\(\)|^https?:|^\//.test(text));
}

export function uiStrings(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(LITERAL)) if (isUiString(match[2].trim())) found.add(match[2].trim());
  for (const match of source.matchAll(JSX_TEXT)) if (isUiString(match[1].trim())) found.add(match[1].trim());
  return [...found];
}

const norm = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();

export function pageTexts(page: SurveyedPage): string[] {
  return [page.title, ...page.headings, ...page.buttons, ...page.fields, ...page.links.map((l) => l.name)].filter(Boolean);
}

/** Case-insensitive substring match, like Playwright's getByText and Magpi's text_visible. */
export function knownText(appText: AppText): (text: string) => boolean {
  const corpus = [...appText.pages.flatMap(pageTexts), ...appText.strings].map(norm);
  return (text) => {
    const wanted = norm(text);
    return corpus.some((known) => known.includes(wanted));
  };
}

export function groundingErrors(criteria: Predicate[], isKnown: (text: string) => boolean): string[] {
  const errors: string[] = [];
  const visit = (p: Predicate, where: string) => {
    const text = p.kind === "text_visible" || p.kind === "text_absent" || p.kind === "title_includes" ? p.text
      : (p.kind === "control_exists" || p.kind === "control_absent") && p.name ? p.name : undefined;
    if (text && !isKnown(text)) errors.push(`${where}: "${text}" does not appear anywhere in the app's pages or UI strings; quote exact text from the lists given`);
    if (p.kind === "all") p.of.forEach((child, i) => visit(child, `${where}.of[${i}]`));
  };
  criteria.forEach((p, i) => visit(p, `criteria[${i}]`));
  return errors;
}

/**
 * Splits off `text_absent` of start-page text. It only proves the start page went away,
 * and layout text survives navigation ("← All legal documents" on every legal page), so
 * it fails correct runs. Models write it to satisfy "false on the start page", so code
 * drops it rather than rejecting the draft.
 */
export function withoutStartTextAbsent(criteria: Predicate[], start: SurveyedPage | undefined): { kept: Predicate[]; dropped: Predicate[] } {
  if (!start) return { kept: criteria, dropped: [] };
  const onStart = knownText({ pages: [start], strings: [] });
  const isStartAbsent = (p: Predicate) => p.kind === "text_absent" && onStart(p.text);
  return { kept: criteria.filter((p) => !isStartAbsent(p)), dropped: criteria.filter(isStartAbsent) };
}

/** Same-origin pages the start page links to, as the survey saw them. */
export function linkedPages(survey: LiveSurvey, startPath: string, max = 8): SurveyedPage[] {
  const start = survey.pages.find((p) => p.route === startPath.split("?")[0]);
  if (!start) return [];
  const routes = new Set<string>();
  for (const link of start.links) {
    try {
      const url = new URL(link.href);
      if (url.origin === new URL(survey.baseURL).origin && url.pathname !== start.route) routes.add(url.pathname);
    } catch {
      // not a URL
    }
  }
  return survey.pages.filter((p) => !p.error && routes.has(p.route)).slice(0, max);
}

const LENS_WORDS: Record<Lens, string[]> = {
  happy: ["created", "success", "ready", "saved", "done"],
  "invalid-input": ["must", "invalid", "required", "error", "enter", "valid"],
  "empty-or-error": ["no", "not", "found", "missing", "empty", "invalid", "error", "yet"],
  "alternate-entry": [],
  deep: ["copy", "share", "edit", "cancel", "view"],
};

/** Source strings that share words with the path and lens, best first. */
export function relatedStrings(strings: string[], context: string, lens: Lens, max = 40): string[] {
  const words = new Set([...context.toLowerCase().split(/[^a-z]+/), ...LENS_WORDS[lens]].filter((w) => w.length >= 2));
  return strings
    .map((s) => ({ s, score: s.toLowerCase().split(/[^a-z]+/).filter((w) => words.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.s.length - b.s.length)
    .slice(0, max)
    .map((x) => x.s);
}
