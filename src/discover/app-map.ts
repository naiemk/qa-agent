import type { ModelClient } from "../model/index.ts";
import { LENSES, type Lens } from "../scenario/types.ts";
import type { QaBrief } from "./brief.ts";
import type { LiveSurvey } from "./live-survey.ts";
import type { StaticScan } from "./static-scan.ts";

export interface CriticalPath {
  id: string;
  area: string;
  title: string;
  startPath: string;
  why: string;
  priority: 1 | 2 | 3;
  needsFixture: string[];
  lenses: Lens[];
  sourceFiles: string[];
  fromBrief: boolean;
}

export interface AppMap {
  schemaVersion: 1;
  generatedAt: string;
  areas: { id: string; title: string; routes: string[]; summary: string; sourceFiles: string[] }[];
  criticalPaths: CriticalPath[];
  unexplored: string[];
}

const FIXTURE_HINTS: [RegExp, string][] = [
  [/webauthn|passkey/i, "webauthn"],
  [/otp|verify[-_ ]?email|magic[-_ ]?link/i, "email-otp"],
  [/fund|faucet|deposit|withdraw/i, "funding"],
  [/wallet/i, "wallet"],
  [/admin/i, "admin-key"],
];

interface ModelMap {
  areas: { id: string; title: string; routes: string[]; summary: string }[];
  criticalPaths: { id: string; area: string; title: string; startPath: string; why: string; priority: number; needsFixture?: string[]; lenses?: string[]; fromBrief?: boolean }[];
}

/** Routes the map may start from: scanned routes plus pages the survey reached. */
export function knownRoutes(scan: StaticScan, survey: LiveSurvey): string[] {
  const routes = new Set(scan.routes.map((r) => r.path).filter((p) => p.startsWith("/")));
  for (const page of survey.pages) {
    if (page.error) continue;
    routes.add(page.route);
    try {
      routes.add(new URL(page.finalURL).pathname);
    } catch {
      // unreachable page
    }
  }
  return [...routes].sort();
}

export function routeMatches(startPath: string, routes: string[]): string | undefined {
  const pathOnly = startPath.split(/[?#]/)[0] || "/";
  if (routes.includes(pathOnly)) return pathOnly;
  return routes.find((route) => {
    if (route.endsWith("/*")) return pathOnly === route.slice(0, -2) || pathOnly.startsWith(route.slice(0, -1));
    if (route.includes(":")) return new RegExp(`^${route.replace(/:[^/]+/g, "[^/]+")}$`).test(pathOnly);
    return false;
  });
}

export function inferFixtures(text: string): string[] {
  return FIXTURE_HINTS.filter(([pattern]) => pattern.test(text)).map(([, name]) => name);
}

export function mapSummary(scan: StaticScan, survey: LiveSurvey, brief?: QaBrief): string {
  const pages = survey.pages.filter((p) => !p.error).map((p) => {
    const forms = p.forms.map((f) => `form[${f.fields.join(", ")} → ${f.submits.join("/")}]`).join(" ");
    return `${p.route} — "${p.title}" — h: ${p.headings.slice(0, 4).join(" | ")} — buttons: ${p.buttons.slice(0, 8).join(", ")} — fields: ${p.fields.slice(0, 8).join(", ")} ${forms}`.slice(0, 600);
  });
  const unsurveyed = scan.routes.filter((r) => !survey.pages.some((p) => p.route === r.path)).map((r) => r.path);
  const parts = [
    "## Pages (live survey)",
    ...pages,
    "",
    "## Routes in code not surveyed (params, wildcards, or nested)",
    unsurveyed.join(", ") || "-",
    "",
    "## Test helpers available in the repo",
    scan.helpers.map((h) => `${h.file}: ${h.exports.slice(0, 10).join(", ")}`).join("\n") || "-",
  ];
  if (brief) {
    parts.push("", `## QA brief: ${brief.product}`, brief.summary, "Areas:", ...brief.areas.map((a) => `- ${a.id}: ${a.title} (${a.routes.join(", ")})`), "Critical flows (proposed by the team):", ...brief.flows.map((f) => `- ${f.title} (${f.area}): ${f.why}`), "Off-limits:", ...brief.offLimits.map((o) => `- ${o}`));
  } else {
    parts.push("", "## Docs headings", ...scan.docs.slice(0, 10).map((d) => `${d.file}: ${d.headings.slice(0, 12).join(" | ")}`));
  }
  return parts.join("\n");
}

export async function buildAppMap(scan: StaticScan, survey: LiveSurvey, model: ModelClient, brief?: QaBrief): Promise<AppMap> {
  const routes = knownRoutes(scan, survey);
  const { value } = await model.completeJson<ModelMap>({
    purpose: "app-map",
    system:
      "You are a senior QA engineer mapping a web app. Group routes into product areas and pick the critical user paths to test. " +
      "Rank by user value and risk (money, identity, data loss). Prefer flows that end in a visible, checkable outcome. " +
      "A critical path starts on one of the listed routes; never invent routes. Mark needsFixture for flows that need passkeys/webauthn, " +
      "email OTP, funded wallets, admin keys, or background workers. Pick lenses from: " + LENSES.join(", ") + ".",
    user: `Known routes: ${routes.join(", ")}\n\n${mapSummary(scan, survey, brief)}`,
    schemaHint:
      '{"areas":[{"id":"commerce","title":"Commerce","routes":["/create"],"summary":"one sentence"}],' +
      '"criticalPaths":[{"id":"commerce.create-invoice","area":"commerce","title":"Create an invoice","startPath":"/create","why":"one sentence","priority":1,"needsFixture":[],"lenses":["happy","invalid-input"],"fromBrief":true}]}',
    validate: (v) => {
      const m = v as ModelMap;
      if (!m || !Array.isArray(m.areas) || !Array.isArray(m.criticalPaths)) return ["need areas[] and criticalPaths[]"];
      const errors: string[] = [];
      const areaIds = new Set(m.areas.map((a) => a.id));
      for (const [i, p] of m.criticalPaths.entries()) {
        if (!routeMatches(p.startPath ?? "", routes)) errors.push(`criticalPaths[${i}].startPath ${p.startPath} is not a known route`);
        if (!areaIds.has(p.area)) errors.push(`criticalPaths[${i}].area ${p.area} is not an area id`);
        if (!p.id || !p.title) errors.push(`criticalPaths[${i}] needs id and title`);
      }
      if (m.criticalPaths.length === 0) errors.push("pick at least one critical path");
      return errors;
    },
  });

  const sourcesFor = (route: string) => {
    const matched = routeMatches(route, scan.routes.map((r) => r.path));
    return scan.routes.find((r) => r.path === matched)?.sourceFiles ?? [];
  };
  const areas = value.areas.map((area) => ({
    id: area.id,
    title: area.title,
    summary: area.summary ?? "",
    routes: area.routes.filter((r) => routeMatches(r, routes)),
    sourceFiles: [...new Set(area.routes.flatMap(sourcesFor))].sort(),
  }));
  const criticalPaths: CriticalPath[] = value.criticalPaths.map((p) => {
    const inferred = inferFixtures(`${p.startPath} ${p.id} ${p.title}`);
    const lenses = (p.lenses ?? ["happy"]).filter((l): l is Lens => LENSES.includes(l as Lens));
    return {
      id: p.id,
      area: p.area,
      title: p.title,
      startPath: p.startPath,
      why: p.why ?? "",
      priority: ([1, 2, 3].includes(p.priority) ? p.priority : 2) as 1 | 2 | 3,
      // The model may add fixture needs but not remove inferred ones.
      needsFixture: [...new Set([...inferred, ...(p.needsFixture ?? [])])].filter((f) => f !== "wallet" || /wallet/i.test(p.startPath)),
      lenses: lenses.length ? lenses : ["happy"],
      sourceFiles: sourcesFor(p.startPath),
      fromBrief: Boolean(p.fromBrief),
    };
  });
  const covered = new Set(areas.flatMap((a) => a.routes));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    areas,
    criticalPaths: criticalPaths.sort((a, b) => a.priority - b.priority),
    unexplored: [...routes.filter((r) => !covered.has(r)), ...(brief?.flows ?? []).filter((f) => !criticalPaths.some((p) => p.title === f.title)).map((f) => `brief: ${f.title}`)],
  };
}
