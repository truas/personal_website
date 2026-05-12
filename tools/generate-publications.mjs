#!/usr/bin/env node
// Regenerate data/publications.json from the BibBase Zotero feed.
// Usage: node tools/generate-publications.mjs
//
// Source: https://bibbase.org/zotero-group/ruasterry/2503580
// We hit BibBase's JSONP show endpoint, extract the embedded structured
// `data: [...]` array (already parsed by BibBase from the .bib), and the
// raw BibTeX <pre> blocks, then normalise into our own schema.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BIBBASE_URL =
  "https://bibbase.org/show?bib=https%3A%2F%2Fbibbase.org%2Fzotero-group%2Fruasterry%2F2503580&jsonp=1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "data", "publications.json");

async function fetchSource() {
  const res = await fetch(BIBBASE_URL, { headers: { "User-Agent": "ruas-site-generator" } });
  if (!res.ok) throw new Error(`Bibbase fetch ${res.status}`);
  return res.text();
}

// Pull the inner `data: [ ... ]` JSON-ish array out of the BibBase blob.
// The outer JSONP is `var bibbase_data = {"data": "<html string>"};` and the
// inner html string contains a literal `data: [ {...}, {...} ]` block.
function extractDataArray(src) {
  // Unwrap outer JSONP -> get the HTML payload.
  const m = src.match(/var bibbase_data = (\{[\s\S]*?\});\s*document\.write/);
  if (!m) throw new Error("Could not find bibbase_data wrapper");
  const wrapper = JSON.parse(m[1]);
  const html = wrapper.data;

  // Find the structured entry list.
  const i = html.indexOf("data: [");
  if (i < 0) throw new Error("Could not find inner `data:` array");
  let depth = 0, start = -1, end = -1;
  for (let k = i + "data: ".length; k < html.length; k++) {
    const c = html[k];
    if (c === "[") { if (depth === 0) start = k; depth++; }
    else if (c === "]") { depth--; if (depth === 0) { end = k + 1; break; } }
    else if (c === '"') { // skip strings
      k++;
      while (k < html.length && !(html[k] === '"' && html[k - 1] !== "\\")) k++;
    }
  }
  if (start < 0 || end < 0) throw new Error("Unbalanced array brackets");
  const slice = html.slice(start, end);
  return { entries: JSON.parse(slice), html };
}

// Pull every <pre>...</pre> block (those are the formatted BibTeX entries).
function extractBibtex(html) {
  const out = [];
  const re = /<pre[^>]*>([\s\S]*?)<\/pre>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    const trimmed = raw.trim();
    if (!trimmed.startsWith("@")) continue;
    const keyMatch = trimmed.match(/^@\w+\s*\{\s*([^,\s]+)\s*,/);
    if (!keyMatch) continue;
    out.push({ key: keyMatch[1], bibtex: trimmed });
  }
  return out;
}

function joinAuthor(a) {
  const first = (a.firstnames || []).join(" ").trim();
  const props = (a.propositions || []).join(" ").trim();
  const last = [props, (a.lastnames || []).join(" ")].filter(Boolean).join(" ").trim();
  return [first, last].filter(Boolean).join(" ");
}

// Map BibBase entry type → our normalised category.
function categorize(e) {
  const t = (e.bibtype || e.type || "").toLowerCase();
  const venue = (e.journal || e.booktitle || e.publisher || "").toLowerCase();
  if (t === "article" || t.includes("journal")) return "Journal";
  if (t === "inproceedings" || t === "conference" || t === "proceedings") return "Conference";
  if (t === "incollection" || t === "inbook" || t === "book" || t === "bookchapter") return "Book";
  if (t === "phdthesis" || t === "mastersthesis" || t === "thesis") return "Thesis";
  if (t === "techreport" || t === "report") return "Report";
  if (t === "workshop" || venue.includes("workshop")) return "Workshop";
  if (t === "misc") {
    if (venue.includes("arxiv") || venue.includes("preprint")) return "Preprint";
    return "Other";
  }
  return "Other";
}

function pickVenue(e) {
  return (
    e.journal ||
    e.booktitle ||
    e.series ||
    e["howpublished"] ||
    (e.bibtype === "misc" && e.publisher) ||
    e.publisher ||
    e.school ||
    e.institution ||
    ""
  );
}

function toYear(e) {
  const y = e.year || (e.date ? String(e.date).slice(0, 4) : "");
  const n = parseInt(y, 10);
  return Number.isFinite(n) ? n : null;
}

function normalize(entry, bibtex) {
  const id = entry["citation key"] || entry.bibbaseid || entry.key || entry.id;
  const authors = Array.isArray(entry.author) ? entry.author.map(joinAuthor) : [];
  const editors = Array.isArray(entry.editor) ? entry.editor.map(joinAuthor) : [];
  return {
    id,
    type: categorize(entry),
    bibtype: entry.bibtype || entry.type || "",
    year: toYear(entry),
    title: (entry.title || "").trim(),
    authors: authors.length ? authors : editors,
    venue: pickVenue(entry).toString().trim(),
    publisher: (entry.publisher || "").toString().trim(),
    doi: entry.doi || "",
    url: entry.url || (entry.doi ? `https://doi.org/${entry.doi}` : ""),
    abstract: (entry.abstract || "").trim(),
    bibtex: bibtex || "",
  };
}

async function main() {
  console.log("Fetching BibBase...");
  const src = await fetchSource();
  const { entries, html } = extractDataArray(src);
  console.log(`Found ${entries.length} entries.`);

  const bibs = extractBibtex(html);
  console.log(`Found ${bibs.length} BibTeX blocks.`);
  // BibBase renders structured entries and BibTeX <pre> blocks in matching order.
  // Pair them by index (verified by checking the title of the rendered HTML block).
  if (bibs.length !== entries.length) {
    console.warn(`Mismatch: ${entries.length} entries vs ${bibs.length} bibtex blocks. Pairing what we can.`);
  }
  const normalized = entries.map((e, i) => normalize(e, bibs[i]?.bibtex || ""));
  normalized.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(normalized, null, 2), "utf8");
  console.log(`Wrote ${OUT} (${normalized.length} entries).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
