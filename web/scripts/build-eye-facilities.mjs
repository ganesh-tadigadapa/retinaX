#!/usr/bin/env node
/**
 * Builds web/data/osm-india-health.json.gz — every eye-care facility and every named
 * hospital in India, from OpenStreetMap — so /api/eye-hospitals can answer from memory
 * in milliseconds instead of waiting 30–60 s on the shared public Overpass server.
 *
 *   npm run data:facilities                  download fresh (about 5 minutes)
 *   EYE_JSON=a.json HOSP_JSON=b.json npm run data:facilities
 *                                            rebuild from Overpass JSON already on disk
 *
 * Re-run it every month or two; facilities change slowly. The file holds raw tags only:
 * deciding what counts as eye care stays in app/api/eye-hospitals/route.ts, so there is
 * one definition of it, not two.
 *
 * Data © OpenStreetMap contributors, ODbL. Attribution is shown on the page.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "osm-india-health.json.gz");
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];
const UA = "SIH26038-DR-Screening/0.1 (eye-care finder data build)";
const EYE_NAME =
  "eye|netra|nethra|nayan|drishti|drushti|retina|ophthalm|vision|lasik|cataract|glaucoma|" +
  "sankara|aravind|prasad eye|vasan|agarwal|maxivision|centre for sight|kanti|kanthi";
const INDIA = 'area["ISO3166-1"="IN"][admin_level=2]->.in;';

const EYE_QUERY = `[out:json][timeout:300];${INDIA}(
  nwr["healthcare:speciality"~"ophthalm|optometr|eye",i](area.in);
  nwr["healthcare"="optometrist"](area.in);
  nwr["amenity"~"^(hospital|clinic|doctors)$"]["name"~"${EYE_NAME}",i](area.in);
  nwr["healthcare"~"^(hospital|clinic|doctor|centre)$"]["name"~"${EYE_NAME}",i](area.in);
);out center tags;`;
const HOSPITAL_QUERY = `[out:json][timeout:300];${INDIA}nwr["amenity"="hospital"]["name"](area.in);out center tags;`;

// Only what the route reads. Everything else is dropped to keep the file small.
const KEEP = [
  "name", "name:en", "amenity", "healthcare", "healthcare:speciality",
  "addr:full", "addr:housenumber", "addr:street", "addr:suburb", "addr:city",
  "addr:district", "addr:postcode", "phone", "contact:phone", "website",
  "contact:website", "opening_hours",
];

async function overpass(query, label) {
  for (const url of ENDPOINTS) {
    try {
      process.stdout.write(`  ${label}: ${url} … `);
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(400_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      console.log(`${body.elements.length} elements`);
      return body.elements;
    } catch (e) {
      console.log(`failed (${e.message})`);
    }
  }
  throw new Error(`${label}: every Overpass endpoint failed. Try again later.`);
}

const load = (path) => JSON.parse(readFileSync(path, "utf8")).elements;

console.log("Building the India eye-care / hospital dataset from OpenStreetMap");
const eye = process.env.EYE_JSON ? load(process.env.EYE_JSON) : await overpass(EYE_QUERY, "eye care");
const hosp = process.env.HOSP_JSON ? load(process.env.HOSP_JSON) : await overpass(HOSPITAL_QUERY, "hospitals");

const byId = new Map();
for (const el of [...eye, ...hosp]) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  const tags = el.tags ?? {};
  if (lat === undefined || lon === undefined || !(tags.name || tags["name:en"])) continue;
  const kept = {};
  for (const k of KEEP) if (tags[k]) kept[k] = tags[k];
  // 5 decimal places is about 1 m: plenty for a pin, and it trims the file.
  byId.set(`${el.type}/${el.id}`, [`${el.type[0]}${el.id}`, +lat.toFixed(5), +lon.toFixed(5), kept]);
}

const payload = {
  generated: new Date().toISOString().slice(0, 10),
  source: "OpenStreetMap contributors (ODbL), via Overpass API",
  facilities: [...byId.values()],
};
mkdirSync(dirname(OUT), { recursive: true });
const gz = gzipSync(JSON.stringify(payload), { level: 9 });
writeFileSync(OUT, gz);
console.log(`Wrote ${payload.facilities.length} facilities → ${OUT} (${(gz.length / 1e6).toFixed(2)} MB)`);
