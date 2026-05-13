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

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BIBBASE_URL =
  "https://bibbase.org/zotero-group/ruasterry/2503580";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "publications.json");

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

function cleanText(t) {
  if (!t) return "";
  let s = t;
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
    .replace(/\\'([aeiouAEIOU])/g, (_, c) => ({a:"á",e:"é",i:"í",o:"ó",u:"ú",A:"Á",E:"É",I:"Í",O:"Ó",U:"Ú"}[c] || c));
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function parseAuthors(t) {
  if (!t) return [];
  return t
    .split(/\s+and\s+/)
    .map((a) => {
      const clean = cleanText(a);
      const parts = clean.split(",").map((x) => x.trim()).filter(Boolean);
      if (parts.length === 1) return parts[0];
      // "Last, First Middle" → "First Middle Last"
      const last = parts[0];
      const rest = parts.slice(1).join(", ");
      return `${rest} ${last}`.replace(/\s+/g, " ").trim();
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

// --- main ------------------------------------------------------------------

async function main() {
  console.log("Fetching BibBase (raw BibTeX)...");
  const src = await fetchSource();

  const entries = [];
  for (const e of parseBibtex(src)) {
    const f = e.fields;
    const title = cleanText(f.title);
    if (!title) continue;
    const year = parseInt(cleanText(f.year || ""), 10) || null;
    const authors = parseAuthors(f.author);
    const venue = venueFor(f);
    const type = typeFor(e.bibtype, f);
    entries.push({
      id: e.key,
      type,
      bibtype: e.bibtype,
      year,
      title,
      authors,
      venue,
      publisher: cleanText(f.publisher),
      doi: cleanText(f.doi),
      url: cleanText(f.url),
      abstract: cleanText(f.abstract),
      bibtex: e.raw,
    });
  }

  // Deduplicate by BibTeX key (in case BibBase still surfaces two records
  // with keys like "wahle_d3_2022" and "wahle_d3_2022-1"). Keep the entry
  // with the most-populated venue/doi/abstract.
  const byBase = new Map();
  for (const e of entries) {
    const base = e.id.replace(/-\d+$/, "");
    const prev = byBase.get(base);
    if (!prev) { byBase.set(base, e); continue; }
    const score = (x) => (x.venue ? 1 : 0) + (x.doi ? 1 : 0) + (x.abstract ? 1 : 0);
    if (score(e) > score(prev)) byBase.set(base, e);
  }
  const deduped = [...byBase.values()];

  // Newest first, then title.
  deduped.sort((a, b) =>
    (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title)
  );

  console.log(`Parsed ${entries.length} entries, ${deduped.length} after dedupe.`);

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(deduped, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT} (${deduped.length} entries).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
