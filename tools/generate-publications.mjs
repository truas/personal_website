#!/usr/bin/env node
// Regenerate data/publications.json from the BibBase Zotero feed.
// Usage: node tools/generate-publications.mjs
//
// Source: https://bibbase.org/zotero-group/ruasterry/2503580
//
// We fetch BibBase's raw-BibTeX URL (NOT the /show?...&jsonp=1 endpoint).
// The JSONP endpoint is served through an aggressive server-side cache that
// can lag the underlying Zotero group by hours and even mis-deduplicate
// records. The raw BibTeX URL bypasses that cache and reflects whatever is
// currently in Zotero. We parse the BibTeX ourselves into the schema
// {id, type, bibtype, year, title, authors[], venue, publisher, doi, url,
//  abstract, bibtex}.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BIBBASE_URL =
  "https://bibbase.org/zotero-group/ruasterry/2503580";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "publications.json");
const NOTES = resolve(__dirname, "..", "data", "pub-notes.json");
const OVERRIDES = resolve(__dirname, "..", "data", "pub-overrides.bib");

async function fetchSource() {
  // Append a timestamp so any HTTP / CDN cache in front of BibBase has to
  // re-validate. The direct BibTeX URL doesn't go through the same cache
  // as /show?jsonp=1, but belt-and-braces.
  const url = `${BIBBASE_URL}?_=${Date.now()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "ruas-site-generator",
      "Accept": "application/x-bibtex, text/plain;q=0.9, */*;q=0.5",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`BibBase fetch ${res.status}`);
  return res.text();
}

// --- BibTeX parser ---------------------------------------------------------
// Hand-rolled, intentionally minimal. Handles balanced braces, quoted strings,
// multi-line values, and skips @comment / @string / @preamble blocks.

function* parseBibtex(s) {
  let i = 0;
  while (i < s.length) {
    // advance to next @
    while (i < s.length && s[i] !== "@") i++;
    if (i >= s.length) break;

    // entry type
    const atOpen = i + 1;
    let p = atOpen;
    while (p < s.length && /[A-Za-z]/.test(s[p])) p++;
    const bibtype = s.slice(atOpen, p).toLowerCase();
    // require a { immediately (skip whitespace)
    while (p < s.length && /\s/.test(s[p])) p++;
    if (s[p] !== "{") { i = atOpen; continue; }

    // skip meta blocks
    if (bibtype === "comment" || bibtype === "string" || bibtype === "preamble") {
      let d = 1; p++;
      while (d > 0 && p < s.length) {
        if (s[p] === "{") d++;
        else if (s[p] === "}") d--;
        p++;
      }
      i = p;
      continue;
    }

    // entry body — find matching close brace
    const bodyStart = p + 1;
    let d = 1, end = bodyStart;
    while (d > 0 && end < s.length) {
      if (s[end] === "{") d++;
      else if (s[end] === "}") d--;
      if (d === 0) break;
      end++;
    }
    const body = s.slice(bodyStart, end);
    const commaIdx = body.indexOf(",");
    if (commaIdx < 0) { i = end + 1; continue; }
    const key = body.slice(0, commaIdx).trim();
    const fields = parseFields(body.slice(commaIdx + 1));
    yield { bibtype, key, fields, raw: s.slice(atOpen - 1, end + 1) };
    i = end + 1;
  }
}

function parseFields(s) {
  const fields = {};
  let i = 0;
  while (i < s.length) {
    // skip whitespace and commas
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;
    // field name
    const nameStart = i;
    while (i < s.length && /[A-Za-z_]/.test(s[i])) i++;
    if (i === nameStart) break;
    const name = s.slice(nameStart, i).toLowerCase();
    // = and whitespace
    while (i < s.length && /[\s=]/.test(s[i])) i++;
    if (i >= s.length) break;
    // value
    let value = "";
    if (s[i] === "{") {
      let depth = 1, vstart = ++i;
      while (depth > 0 && i < s.length) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") depth--;
        if (depth === 0) break;
        i++;
      }
      value = s.slice(vstart, i);
      i++; // skip }
    } else if (s[i] === '"') {
      const vstart = ++i;
      while (i < s.length && s[i] !== '"') i++;
      value = s.slice(vstart, i);
      i++; // skip "
    } else {
      const vstart = i;
      while (i < s.length && !/[\s,]/.test(s[i])) i++;
      value = s.slice(vstart, i);
    }
    fields[name] = value;
  }
  return fields;
}

// --- value cleanup ---------------------------------------------------------

// Inline math as ACL Anthology abstracts write it ($\kappa = 0.71$,
// $26.1 \to 52.2$): map the commands that show up to Unicode and drop the
// dollars. Only spans with a command or an operator count as math, so a
// plain "$5" is left alone.
const MATH = {
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ", "\\epsilon": "ε",
  "\\theta": "θ", "\\kappa": "κ", "\\lambda": "λ", "\\mu": "μ", "\\rho": "ρ",
  "\\sigma": "σ", "\\tau": "τ", "\\to": "→", "\\rightarrow": "→", "\\times": "×",
  "\\pm": "±", "\\leq": "≤", "\\geq": "≥", "\\approx": "≈", "\\sim": "~",
};
function mathToText(m) {
  if (!/\\[A-Za-z]|[=<>^_]/.test(m)) return `$${m}$`;
  return m
    .replace(/\\[A-Za-z]+/g, (cmd) => MATH[cmd] ?? cmd)
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(t) {
  if (!t) return "";
  let s = t.replace(/(^|[^\\])\$([^$]+?)\$/g, (_, pre, m) => pre + mathToText(m));
  // strip the LaTeX brace-protection used by Zotero's exporter ({Foo}). Do
  // it twice to handle one level of nesting.
  for (let i = 0; i < 2; i++) {
    s = s.replace(/\{([^{}\\]*)\}/g, "$1");
  }
  // common LaTeX escapes
  s = s
    .replace(/\\&/g, "&")
    .replace(/\\%/g, "%")
    .replace(/\\#/g, "#")
    .replace(/\\_/g, "_")
    .replace(/\\\$/g, "$")
    .replace(/\\textendash\{?\}?/g, "–")
    .replace(/\\textemdash\{?\}?/g, "—")
    .replace(/\\textquoteleft/g, "‘")
    .replace(/\\textquoteright/g, "’")
    .replace(/\\textquotedblleft/g, "“")
    .replace(/\\textquotedblright/g, "”")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/~/g, " ")
    // unicode escape like \"a → ä
    .replace(/\\"([aeiouAEIOU])/g, (_, c) => ({a:"ä",e:"ë",i:"ï",o:"ö",u:"ü",A:"Ä",E:"Ë",I:"Ï",O:"Ö",U:"Ü"}[c] || c))
    .replace(/\\'([aeiouAEIOU])/g, (_, c) => ({a:"á",e:"é",i:"í",o:"ó",u:"ú",A:"Á",E:"É",I:"Í",O:"Ó",U:"Ú"}[c] || c))
    // TeX quotes: ``like this''
    .replace(/``/g, "“")
    .replace(/''/g, "”");
  // braces left around escapes, e.g. {\%} -> {%}
  s = s.replace(/\{([^{}\\]*)\}/g, "$1");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Terry publishes under several name forms ("Terry Ruas", "Terry Lima Ruas",
// "Terry L. Ruas"). Canonicalize any "Terry … Ruas" spelling to his preferred
// display name so author lists are consistent regardless of how each record
// spells it. Only the displayed authors[] is affected — each entry's raw
// BibTeX keeps its original spelling for accurate citations.
function canonAuthor(name) {
  return /^terry\b.*\bruas$/i.test(name) ? "Terry Ruas" : name;
}

function parseAuthors(t) {
  if (!t) return [];
  return t
    .split(/\s+and\s+/)
    .map((a) => {
      const clean = cleanText(a);
      const parts = clean.split(",").map((x) => x.trim()).filter(Boolean);
      let name;
      if (parts.length === 1) {
        name = parts[0];
      } else {
        // "Last, First Middle" → "First Middle Last"
        const last = parts[0];
        const rest = parts.slice(1).join(", ");
        name = `${rest} ${last}`.replace(/\s+/g, " ").trim();
      }
      return canonAuthor(name);
    })
    .filter(Boolean);
}

function typeFor(bibtype, fields) {
  const venueLower = (fields.journal || "").toLowerCase();
  const urlLower = (fields.url || "").toLowerCase();
  const noteLower = (fields.note || "").toLowerCase();
  const isArxiv =
    venueLower.includes("arxiv") ||
    urlLower.includes("arxiv.org") ||
    noteLower.includes("arxiv");
  switch (bibtype) {
    case "inproceedings":
    case "conference":
      return "Conference";
    case "article":
      return isArxiv ? "Preprint" : "Journal";
    case "misc":
    case "unpublished":
      return isArxiv ? "Preprint" : "Other";
    case "book":
      return "Book";
    case "incollection":
    case "inbook":
      return "Workshop";
    case "techreport":
      return "Report";
    case "phdthesis":
    case "mastersthesis":
      return "Thesis";
    default:
      return "Other";
  }
}

function venueFor(fields) {
  return (
    cleanText(fields.booktitle) ||
    cleanText(fields.journal) ||
    cleanText(fields.publisher) ||
    cleanText(fields.institution) ||
    cleanText(fields.school) ||
    ""
  );
}

// One parsed BibTeX record -> the site's entry schema.
function normalize(e) {
  const f = e.fields;
  return {
    id: e.key,
    type: typeFor(e.bibtype, f),
    bibtype: e.bibtype,
    year: parseInt(cleanText(f.year || ""), 10) || null,
    title: cleanText(f.title),
    authors: parseAuthors(f.author),
    venue: venueFor(f),
    publisher: cleanText(f.publisher),
    doi: cleanText(f.doi),
    url: cleanText(f.url),
    abstract: cleanText(f.abstract),
    bibtex: e.raw,
  };
}

// --- main ------------------------------------------------------------------

async function main() {
  console.log("Fetching BibBase (raw BibTeX)...");
  const src = await fetchSource();

  const entries = [];
  for (const e of parseBibtex(src)) {
    const entry = normalize(e);
    if (entry.title) entries.push(entry);
  }

  // The Zotero group is shared, so it can pick up papers Terry didn't write
  // (e.g. a reference someone saved there). Keep only entries with a Ruas
  // author -- the same rule the renderers use to bold his name -- and report
  // anything skipped so it can be cleaned up in Zotero.
  const isMine = (e) => e.authors.some((a) => /ruas$/i.test(a.trim()));
  const skipped = entries.filter((e) => !isMine(e));
  for (const e of skipped) {
    console.warn(`Skipped (no Ruas author): ${e.id} -- ${e.title}`);
  }

  // Deduplicate (in case BibBase surfaces one paper twice, with keys like
  // "wahle_d3_2022" and "wahle_d3_2022-1"). Records are duplicates only when
  // the base key AND the title match: Zotero builds keys from first author,
  // first title word and year, so two different papers can share a key
  // (e.g. two 2026 "yang_beyond" papers). Keep the most-populated record.
  const titleKey = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const baseOf = (id) => id.replace(/-\d+$/, "");
  const byBase = new Map();
  for (const e of entries.filter(isMine)) {
    const base = `${baseOf(e.id)}|${titleKey(e.title)}`;
    const prev = byBase.get(base);
    if (!prev) { byBase.set(base, e); continue; }
    const score = (x) => (x.venue ? 1 : 0) + (x.doi ? 1 : 0) + (x.abstract ? 1 : 0);
    if (score(e) > score(prev)) byBase.set(base, e);
  }
  const deduped = [...byBase.values()];

  // Distinct papers that share a key get distinct ids -- and matching keys in
  // their BibTeX -- so pub-notes.json and copied citations can't collide.
  // Ordered by title so the result is stable across refreshes: the
  // alphabetically-first title keeps the plain key, the rest get -1, -2, ...
  const byId = new Map();
  for (const e of deduped) {
    const id = baseOf(e.id);
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(e);
  }
  for (const [id, group] of byId) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.title.localeCompare(b.title));
    group.forEach((e, i) => {
      const next = i === 0 ? id : `${id}-${i}`;
      if (next !== e.id) {
        e.bibtex = e.bibtex.replace(`{${e.id},`, `{${next},`);
        e.id = next;
      }
    });
    console.log(`Shared key "${id}" -> ${group.map((e) => `${e.id} (${e.title.slice(0, 40)}...)`).join(", ")}`);
  }

  // Official BibTeX overrides, from data/pub-overrides.bib. When Zotero's
  // export is incomplete (ACL Anthology imports arrive without abstracts),
  // paste the publisher's record there. Each record is matched to a feed
  // entry by DOI, or by title; its non-empty fields win, its text becomes the
  // copyable BibTeX, and the entry keeps its Zotero id (so pub-notes.json
  // still applies). Missing file = no overrides.
  let overrideSrc = "";
  try {
    overrideSrc = await readFile(OVERRIDES, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  let overridden = 0;
  for (const rec of parseBibtex(overrideSrc)) {
    const o = normalize(rec);
    const doi = o.doi.toLowerCase();
    const target = deduped.find((e) =>
      (doi && e.doi.toLowerCase() === doi) || titleKey(e.title) === titleKey(o.title));
    if (!target) {
      console.warn(`pub-overrides.bib: no feed entry matches ${rec.key} (${o.title}); skipped.`);
      continue;
    }
    for (const [k, v] of Object.entries(o)) {
      if (k !== "id" && (Array.isArray(v) ? v.length : v)) target[k] = v;
    }
    overridden++;
  }
  if (overridden) console.log(`Applied ${overridden} BibTeX override(s) from pub-overrides.bib.`);

  // Newest first, then title.
  deduped.sort((a, b) =>
    (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title)
  );

  console.log(`Parsed ${entries.length} entries, ${skipped.length} skipped, ${deduped.length} after dedupe.`);

  // Merge manual annotations (e.g. "Accepted at <venue>") keyed by entry id,
  // from data/pub-notes.json. Zotero/BibBase has no field that reflects an
  // accepted-but-not-yet-published status, so these live in-repo and are
  // re-applied on every regeneration. Missing file = no annotations.
  let notes = {};
  try {
    notes = JSON.parse(await readFile(NOTES, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  let annotated = 0;
  for (const e of deduped) {
    if (notes[e.id]) { e.note = notes[e.id]; annotated++; }
  }
  if (annotated) console.log(`Applied ${annotated} manual note(s) from pub-notes.json.`);

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(deduped, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT} (${deduped.length} entries).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
