/**
 * GET /api/eye-hospitals — eye-care facilities near a point, from OpenStreetMap.
 *
 *   ?lat=16.50&lng=80.64[&radius=25000]     search around a coordinate
 *   ?area=Vijayawada[&radius=25000]         resolve a place name first (Nominatim)
 *
 * SPEED. Inside India the answer comes from data/osm-india-health.json.gz, a snapshot of
 * every eye-care facility and named hospital in the country (build it with
 * `npm run data:facilities`). Scanning ~56k points in memory takes a few milliseconds;
 * the live public Overpass server it replaces took 30–60 s and sometimes refused us.
 * Outside India, or if the snapshot is missing, it falls back to a live Overpass query.
 *
 * The page asks once for the widest radius and filters 5/10/25 km itself, so changing
 * the filter never costs a request.
 *
 * Why a server route rather than calling OpenStreetMap from the browser: the browser
 * keeps talking only to this site, and Nominatim gets one identifiable client, as its
 * usage policy asks.
 *
 * What it can and cannot know: OpenStreetMap records that a place is an eye hospital or
 * an ophthalmology clinic. No map data records which ones treat diabetic retinopathy, so
 * the page says "eye care", not "DR treatment". Retinopathy is treated by
 * ophthalmologists, so this is the right place to send someone, but it is not a claim
 * about any one facility.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";

// Only the live fallback can be slow; the snapshot path answers in milliseconds.
export const maxDuration = 30;

const SNAPSHOT = join(process.cwd(), "data", "osm-india-health.json.gz");
// Public Overpass instances for the live fallback, tried in order.
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Generic and identifying, as the OSM usage policies ask. No personal details.
const USER_AGENT = "SIH26038-DR-Screening/0.1 (eye-care finder)";

const MIN_RADIUS = 1_000;
const MAX_RADIUS = 30_000;
const DEFAULT_RADIUS = 25_000;
const MAX_EYE = 150;
const MAX_GENERAL = 10;
// The snapshot covers India. A point inside this box is answered from it.
const INDIA_BOX = { minLat: 6, maxLat: 37.6, minLng: 68, maxLng: 97.5 };

// Names that mark a facility as eye care when it is not tagged with a speciality, which
// is most of them in India. Includes the large eye-hospital networks and Hindi/Telugu
// words for "eye" written in Latin script, as they appear on signboards.
const EYE_NAME = new RegExp(
  "eye|netra|nethra|nayan|drishti|drushti|retina|ophthalm|vision|lasik|cataract|glaucoma|" +
  "sankara|aravind|prasad eye|vasan|agarwal|maxivision|centre for sight|kanti|kanthi",
  "i",
);
const NOT_EYE = /dental|dentist|teeth|ortho|cardiac|heart|skin|derma|maternity|child|ent\b/i;
const STRONG_EYE = /eye|netra|nethra|ophthalm|retina|vision/i;

export type EyeFacility = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  distance_m: number;
  /** "eye": tagged or named as eye care. "general": a hospital, shown only as a fallback. */
  kind: "eye" | "general";
  address?: string;
  phone?: string;
  website?: string;
  opening_hours?: string;
};

type Tags = Record<string, string>;
type Place = Omit<EyeFacility, "distance_m">;

// ------------------------------------------------------------------ shared helpers
function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function addressOf(t: Tags) {
  if (t["addr:full"]) return t["addr:full"];
  const parts = [
    [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" "),
    t["addr:suburb"],
    t["addr:city"] || t["addr:district"],
    t["addr:postcode"],
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function isEye(t: Tags) {
  const spec = `${t["healthcare:speciality"] ?? ""} ${t["healthcare"] ?? ""}`.toLowerCase();
  if (/ophthalm|optometr|eye/.test(spec)) return true;
  const name = `${t.name ?? ""} ${t["name:en"] ?? ""}`;
  // Network names ("Sankara", "Vasan") are shared with their dental and other wings.
  if (NOT_EYE.test(name) && !STRONG_EYE.test(name)) return false;
  return EYE_NAME.test(name);
}

function toPlace(id: string, lat: number, lng: number, t: Tags): Place | null {
  const name = t["name:en"] || t.name;
  if (!name) return null;
  const eye = isEye(t);
  // Only hospitals are a useful fallback; a general clinic or GP is not.
  if (!eye && t.amenity !== "hospital" && t.healthcare !== "hospital") return null;
  return {
    id,
    name,
    latitude: lat,
    longitude: lng,
    kind: eye ? "eye" : "general",
    address: addressOf(t),
    phone: t.phone || t["contact:phone"],
    website: t.website || t["contact:website"],
    opening_hours: t.opening_hours,
  };
}

// ------------------------------------------------------------------ snapshot (fast)
type GazEntry = { lat: number; lng: number; n: number; confident: boolean; label: string };
type Snapshot = { generated: string; places: Place[]; gazetteer: Map<string, GazEntry> };

// Address tags whose values are place names (or PIN codes) people type.
const GAZ_KEYS = ["addr:city", "addr:town", "addr:village", "addr:suburb", "addr:district",
  "addr:postcode"];

function normPlace(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

/** Offline place finder: every place name / PIN code in the facility addresses, at the
 *  median position of the facilities that carry it. A name whose facilities are spread
 *  across the country (two towns, one name) is marked not confident, so the online
 *  geocoder gets the first say for it. */
function buildGazetteer(facilities: [string, number, number, Tags][]) {
  const pts = new Map<string, { lat: number[]; lng: number[]; label: string }>();
  for (const [, lat, lng, tags] of facilities) {
    for (const k of GAZ_KEYS) {
      const raw = (tags[k] ?? "").trim();
      const key = raw && normPlace(raw);
      if (!key || key.length < 2) continue;
      let e = pts.get(key);
      if (!e) pts.set(key, (e = { lat: [], lng: [], label: raw }));
      e.lat.push(lat);
      e.lng.push(lng);
    }
  }
  const gaz = new Map<string, GazEntry>();
  pts.forEach((e, key) => {
    const lat = median(e.lat), lng = median(e.lng);
    let near = 0;
    for (let i = 0; i < e.lat.length; i++) {
      if (haversine(lat, lng, e.lat[i], e.lng[i]) <= 40_000) near++;
    }
    gaz.set(key, { lat, lng, n: e.lat.length, confident: near / e.lat.length >= 0.6,
      label: `${e.label.replace(/\b([a-z])/g, (c) => c.toUpperCase())}, India` });
  });
  return gaz;
}

/** The ways a typed place can be matched: the whole thing, its first comma part, and
 *  that part without "district"/"city"/"town". */
function placeCandidates(area: string) {
  const out = new Set<string>();
  const whole = normPlace(area);
  const first = normPlace(area.split(",")[0]);
  for (const c of [whole, first]) {
    if (!c) continue;
    out.add(c);
    out.add(c.replace(/\b(district|dist|city|town|mandal|tehsil|taluk|india)\b/g, "")
      .replace(/\s+/g, " ").trim());
  }
  return [...out].filter((c) => c.length >= 2);
}

function lookupGazetteer(snapshot: Snapshot | null, area: string, onlyConfident: boolean) {
  if (!snapshot) return null;
  for (const c of placeCandidates(area)) {
    const e = snapshot.gazetteer.get(c);
    if (e && (e.confident || !onlyConfident)) return e;
  }
  return null;
}
let snapshotPromise: Promise<Snapshot | null> | null = null;

/** Loaded and classified once per server process, then kept in memory. */
function loadSnapshot() {
  snapshotPromise ??= readFile(SNAPSHOT)
    .then((gz) => {
      const raw = JSON.parse(gunzipSync(gz).toString("utf8")) as {
        generated: string;
        facilities: [string, number, number, Tags][];
      };
      const places: Place[] = [];
      for (const [id, lat, lng, tags] of raw.facilities) {
        const p = toPlace(id, lat, lng, tags);
        if (p) places.push(p);
      }
      return { generated: raw.generated, places, gazetteer: buildGazetteer(raw.facilities) };
    })
    .catch(() => null); // No snapshot: every search uses the live fallback.
  return snapshotPromise;
}

function searchSnapshot(places: Place[], lat: number, lng: number, radius: number) {
  // Cheap box test first; the exact distance only for points that pass it.
  const dLat = radius / 111_000;
  const dLng = radius / (111_000 * Math.cos((lat * Math.PI) / 180));
  const hits: EyeFacility[] = [];
  for (const p of places) {
    if (Math.abs(p.latitude - lat) > dLat || Math.abs(p.longitude - lng) > dLng) continue;
    const d = haversine(lat, lng, p.latitude, p.longitude);
    if (d <= radius) hits.push({ ...p, distance_m: d });
  }
  return hits;
}

// ------------------------------------------------------------------ live (slow)
async function searchLive(lat: number, lng: number, radius: number) {
  const around = `(around:${radius},${lat},${lng})`;
  const query = `[out:json][timeout:18];(
    nwr["amenity"~"^(hospital|clinic|doctors)$"]${around};
    nwr["healthcare"]${around};
  );out center tags;`;
  // One budget for ALL attempts, so a dead mirror cannot stack timeouts. 20 s total, at
  // most 12 s per mirror: a person waiting on a map should get an answer or a clear
  // "try again" quickly, not a minute of spinner (this path only runs outside India).
  const deadline = Date.now() + 20_000;
  let lastError: unknown;
  for (const endpoint of OVERPASS) {
    const remaining = deadline - Date.now();
    if (remaining < 2_000) break;
    try {
      const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(Math.min(remaining, 12_000)),
      });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const body = (await res.json()) as {
        elements?: { type: string; id: number; lat?: number; lon?: number;
          center?: { lat: number; lon: number }; tags?: Tags }[];
      };
      const hits: EyeFacility[] = [];
      for (const el of body.elements ?? []) {
        const pLat = el.lat ?? el.center?.lat;
        const pLng = el.lon ?? el.center?.lon;
        if (pLat === undefined || pLng === undefined) continue;
        const p = toPlace(`${el.type}/${el.id}`, pLat, pLng, el.tags ?? {});
        if (p) hits.push({ ...p, distance_m: haversine(lat, lng, pLat, pLng) });
      }
      return hits;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("overpass unavailable");
}

// ------------------------------------------------------------------ geocoding
/** Nominatim allows about one request per second and sheds load when busy, so one slow
 *  or refused answer gets a single, spaced retry before the search is called failed. */
async function geocodeWithRetry(area: string) {
  try {
    return await geocode(area);
  } catch {
    await new Promise((r) => setTimeout(r, 1_200));
    return await geocode(area);
  }
}

async function geocode(area: string) {
  const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(area)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    // Place names do not move: a week of caching makes a repeat city search instant.
    next: { revalidate: 604_800 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const hits = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!hits.length) return null;
  return { lat: Number(hits[0].lat), lng: Number(hits[0].lon), label: hits[0].display_name };
}

function fail(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status });
}

/** Removes the building-outline/point duplicates OSM often has for one hospital. */
function dedupe(list: EyeFacility[]) {
  const seen = new Set<string>();
  return list.filter((f) => {
    const key = `${f.name.toLowerCase()}|${f.latitude.toFixed(3)}|${f.longitude.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const radiusRaw = Number(q.get("radius") ?? DEFAULT_RADIUS);
  const radius = Math.min(
    MAX_RADIUS,
    Math.max(MIN_RADIUS, Number.isFinite(radiusRaw) ? radiusRaw : DEFAULT_RADIUS),
  );

  // Start loading the snapshot now so it overlaps with geocoding on a cold start.
  const snapshotReady = loadSnapshot();

  let lat: number;
  let lng: number;
  let areaLabel: string | null = null;

  const area = q.get("area")?.trim();
  if (area) {
    if (area.length < 2 || area.length > 120) return fail("bad_area", 422);
    // 1. Offline, instant: place names and PIN codes from the snapshot's addresses.
    // 2. Online Nominatim (with one retry) for anything the snapshot does not know.
    // 3. An ambiguous offline match beats failing outright if Nominatim is down.
    const snap = await snapshotReady;
    const local = lookupGazetteer(snap, area, true);
    if (local) {
      ({ lat, lng } = local);
      areaLabel = local.label;
    } else {
      let hit: Awaited<ReturnType<typeof geocode>> = null;
      let unavailable = false;
      try {
        hit = await geocodeWithRetry(area);
      } catch {
        unavailable = true;
      }
      const fallback = hit ? null : lookupGazetteer(snap, area, false);
      if (hit) {
        ({ lat, lng } = hit);
        areaLabel = hit.label;
      } else if (fallback) {
        ({ lat, lng } = fallback);
        areaLabel = fallback.label;
      } else {
        return unavailable ? fail("geocoder_unavailable", 502) : fail("area_not_found", 404);
      }
    }
  } else {
    lat = Number(q.get("lat"));
    lng = Number(q.get("lng"));
    if (!q.get("lat") || !q.get("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return fail("bad_coordinates", 422);
    }
  }
  // Round to ~100 m: enough for "near me", and nearby searches share a cache entry.
  lat = Math.round(lat * 1000) / 1000;
  lng = Math.round(lng * 1000) / 1000;

  const snapshot = await snapshotReady;
  const inIndia = lat >= INDIA_BOX.minLat && lat <= INDIA_BOX.maxLat &&
    lng >= INDIA_BOX.minLng && lng <= INDIA_BOX.maxLng;

  let hits: EyeFacility[];
  let source: "snapshot" | "live";
  if (snapshot && inIndia) {
    hits = searchSnapshot(snapshot.places, lat, lng, radius);
    source = "snapshot";
  } else {
    try {
      hits = await searchLive(lat, lng, radius);
      source = "live";
    } catch {
      return fail("map_data_unavailable", 502);
    }
  }

  const byDistance = (a: EyeFacility, b: EyeFacility) => a.distance_m - b.distance_m;
  const all = dedupe(hits.sort(byDistance));
  const eye = all.filter((f) => f.kind === "eye").slice(0, MAX_EYE);
  // The nearest few hospitals ride along so the page can fall back to them, without a
  // second request, wherever eye care is scarce inside the radius the reader picks.
  const general = all.filter((f) => f.kind === "general").slice(0, MAX_GENERAL);

  return NextResponse.json(
    {
      ok: true,
      center: { latitude: lat, longitude: lng },
      area_label: areaLabel,
      radius_m: radius,
      source,
      data_date: source === "snapshot" ? snapshot?.generated ?? null : null,
      results: [...eye, ...general],
      attribution: "© OpenStreetMap contributors",
    },
    // Same query, same answer for an hour: the browser can reuse it without asking.
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
