"use client";
/**
 * Eye hospitals near you — a map (mapcn / MapLibre) beside a list.
 *
 * Data comes from this site's own /api/eye-hospitals route, which asks OpenStreetMap.
 * Nothing about a screening — no grade, no scan id — is involved: only the coordinate the
 * person chose to share, or the place name they typed.
 *
 * The map is never the only way to reach a facility. Every fact on a pin (name, distance)
 * is in the list as text too, with a Directions link that opens Google Maps.
 *
 * Public on purpose, like CareBridge: someone looking for an eye doctor should not have
 * to sign in first.
 */
import { Globe, Hospital, MapPin, Navigation, Phone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { Card } from "@/components/ui/card";
import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from "@/components/ui/map";
import type { EyeFacility } from "@/app/api/eye-hospitals/route";

type Center = { latitude: number; longitude: number };

type SearchResult = {
  ok: true;
  center: Center;
  area_label: string | null;
  radius_m: number;
  source: "snapshot" | "live";
  data_date: string | null;
  results: EyeFacility[];
  attribution: string;
};

const RADII = [5_000, 10_000, 25_000] as const;
// Always fetch the widest radius once; the 5/10/25 km filter is applied here, instantly.
const FETCH_RADIUS = RADII[RADII.length - 1];
// Below this many eye-care places in range, nearby general hospitals are shown too.
const FALLBACK_BELOW = 5;
// Geographic centre of India: what the map shows before anyone has searched.
const INDIA: Center = { latitude: 22.5, longitude: 79.0 };

const ERRORS: Record<string, string> = {
  area_not_found: "We couldn’t find that place. Check the spelling, or try the nearest city, district or PIN code.",
  bad_area: "Type a place name between 2 and 120 characters.",
  bad_coordinates: "Your location could not be read. Try typing your city instead.",
  geocoder_unavailable: "We couldn’t look up that place just now. Try the nearest city, district or PIN code, or use your location.",
  map_data_unavailable: "The hospital map service is busy. Try again in a minute.",
  denied: "Location permission was refused. Type your city or area instead.",
  unsupported: "This browser cannot share a location. Type your city or area instead.",
  network: "Could not reach the server. Check your connection and try again.",
};

function formatDistance(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

function directionsUrl(f: EyeFacility, from: Center | null) {
  const p = new URLSearchParams({
    api: "1",
    destination: `${f.latitude},${f.longitude}`,
    travelmode: "driving",
  });
  if (from) p.set("origin", `${from.latitude},${from.longitude}`);
  return `https://www.google.com/maps/dir/?${p}`;
}

/** Frames the search centre and every result whenever a new search lands, and pans to a
 *  facility chosen from the list. Lives inside <Map> so it can reach the instance. */
function MapFraming({
  center, facilities, selected,
}: { center: Center | null; facilities: EyeFacility[]; selected: EyeFacility | null }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || !center) return;
    if (facilities.length === 0) {
      map.flyTo({ center: [center.longitude, center.latitude], zoom: 12, duration: 800 });
      return;
    }
    const lngs = [center.longitude, ...facilities.map((f) => f.longitude)];
    const lats = [center.latitude, ...facilities.map((f) => f.latitude)];
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 48, maxZoom: 15, duration: 800 },
    );
  }, [map, isLoaded, center, facilities]);

  useEffect(() => {
    if (!map || !isLoaded || !selected) return;
    map.easeTo({ center: [selected.longitude, selected.latitude], duration: 500 });
  }, [map, isLoaded, selected]);

  return null;
}

export default function HospitalsPage() {
  const [radius, setRadius] = useState<number>(10_000);
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState<null | "locating" | "searching">(null);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResult | null>(null);
  const [youAreHere, setYouAreHere] = useState<Center | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Answers already fetched this visit, by query. Searching the same place twice is free.
  const cache = useRef<Record<string, SearchResult>>({});
  // Only the newest search may land: an older, slower one is cancelled, not raced.
  const inflight = useRef<AbortController | null>(null);

  const search = useCallback(async (params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...params, radius: String(FETCH_RADIUS) }).toString();
    setError(null);
    setSelectedId(null);
    const hit = cache.current[qs];
    if (hit) {
      setData(hit);
      setBusy(null);
      return;
    }
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setBusy("searching");
    try {
      const res = await fetch(`/api/eye-hospitals?${qs}`, { signal: ctrl.signal });
      const body = await res.json();
      if (ctrl.signal.aborted) return;
      if (!body.ok) {
        // A failed search must not leave the previous place's hospitals on screen:
        // that reads as "the search did nothing".
        setData(null);
        setError(ERRORS[body.code] ?? ERRORS.network);
        return;
      }
      cache.current[qs] = body as SearchResult;
      setData(body as SearchResult);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setData(null);
      setError(ERRORS.network);
    } finally {
      if (inflight.current === ctrl) {
        inflight.current = null;
        setBusy(null);
      }
    }
  }, []);

  const useMyLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(ERRORS.unsupported);
      return;
    }
    setBusy("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setYouAreHere(here);
        void search({ lat: String(here.latitude), lng: String(here.longitude) });
      },
      () => {
        setBusy(null);
        setError(ERRORS.denied);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    );
  }, [search]);

  const searchArea = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = area.trim();
    if (q.length < 2) {
      setError(ERRORS.bad_area);
      return;
    }
    setYouAreHere(null);
    void search({ area: q });
  }, [area, search]);

  // The radius filter, applied locally: changing 5/10/25 km never waits on the network.
  const { facilities, eyeCount } = useMemo(() => {
    const inRange = (data?.results ?? []).filter((f) => f.distance_m <= radius);
    const eye = inRange.filter((f) => f.kind === "eye");
    const general = eye.length < FALLBACK_BELOW
      ? inRange.filter((f) => f.kind === "general").slice(0, 10 - eye.length)
      : [];
    return { facilities: [...eye, ...general], eyeCount: eye.length };
  }, [data, radius]);
  const selected = facilities.find((f) => f.id === selectedId) ?? null;
  const center = data?.center ?? null;
  const origin = youAreHere ?? center;
  const fromLabel = data?.area_label ? `from ${data.area_label.split(",")[0]}` : "from you";

  return (
    <Shell>
      <section className="cb-pagehero">
        <div className="eyebrow"><span aria-hidden="true"><Hospital className="ico" size={16} strokeWidth={1.75} /></span> Eye care near you</div>
        <h2>Find an eye hospital for a retinopathy check</h2>
        <p className="cb-lede muted" style={{ maxWidth: "68ch" }}>
          Diabetic retinopathy is diagnosed and treated by eye specialists (ophthalmologists).
          Share your location or type your city to see eye hospitals and clinics nearby, with
          directions.
        </p>

        <div className="hosp-search">
          <button
            type="button"
            className="primary hosp-locate"
            onClick={useMyLocation}
            disabled={busy !== null}
          >
            {busy === "locating" ? "Finding your location…" : <><MapPin className="ico" size={16} strokeWidth={1.75} /> Use my location</>}
          </button>

          <span className="hosp-or" aria-hidden="true">or</span>

          <form onSubmit={searchArea} className="hosp-form">
            <label htmlFor="hosp-area" className="sr-only">City or area</label>
            <input
              id="hosp-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="City, district or PIN code, e.g. Vijayawada"
              maxLength={120}
              className="txt hosp-input"
            />
            <button type="submit" className="ghost" disabled={busy !== null}>Search</button>
          </form>

          <label className="hosp-radius">
            Within
            <select
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="txt"
            >
              {RADII.map((r) => <option key={r} value={r}>{r / 1000} km</option>)}
            </select>
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm" style={{ color: "var(--crimson)" }}>{error}</p>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="h-[320px] overflow-hidden p-0 sm:h-[460px]">
          <Map
            center={[(center ?? INDIA).longitude, (center ?? INDIA).latitude]}
            zoom={center ? 12 : 4}
            loading={busy === "searching"}
          >
            <MapControls showLocate showFullscreen onLocate={(c) => {
              setYouAreHere({ latitude: c.latitude, longitude: c.longitude });
              void search({ lat: String(c.latitude), lng: String(c.longitude) });
            }} />
            <MapFraming center={center} facilities={facilities} selected={selected} />

            {center && (
              <MapMarker longitude={center.longitude} latitude={center.latitude}>
                <MarkerContent>
                  <div className="size-4 rounded-full border-2 border-white bg-[var(--ink)] shadow-lg ring-4 ring-[var(--accent)]/30" />
                </MarkerContent>
                <MarkerTooltip>{youAreHere ? "Your location" : "Search centre"}</MarkerTooltip>
              </MapMarker>
            )}

            {facilities.map((f, i) => {
              const on = f.id === selectedId;
              return (
                <MapMarker
                  key={f.id}
                  longitude={f.longitude}
                  latitude={f.latitude}
                  onClick={() => setSelectedId(f.id)}
                >
                  <MarkerContent>
                    <div
                      className="flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg transition-transform"
                      style={{
                        background: f.kind === "eye" ? "var(--crimson)" : "var(--muted)",
                        transform: on ? "scale(1.3)" : undefined,
                        zIndex: on ? 10 : undefined,
                      }}
                    >
                      {i + 1}
                    </div>
                  </MarkerContent>
                  <MarkerTooltip>
                    <div className="rounded-md bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)] shadow">
                      <strong>{f.name}</strong> · {formatDistance(f.distance_m)}
                    </div>
                  </MarkerTooltip>
                </MapMarker>
              );
            })}
          </Map>
        </Card>

        <div className="max-h-none overflow-visible lg:max-h-[460px] lg:overflow-y-auto">
          {!data && !busy && (
            <div className="hosp-empty">
              <span className="hosp-empty-icon" aria-hidden="true"><MapPin size={22} strokeWidth={1.75} /></span>
              <strong>Find eye care near you</strong>
              <p>Use your location or type a city to see eye hospitals and clinics nearby, with distance and directions.</p>
            </div>
          )}
          {data && (
            <p className="mb-3 text-sm text-[var(--muted)]">
              {eyeCount > 0
                ? `${eyeCount} eye-care ${eyeCount === 1 ? "facility" : "facilities"} within ${radius / 1000} km ${fromLabel}.`
                : `No eye-specific facilities are mapped within ${radius / 1000} km ${fromLabel}.`}
              {facilities.some((f) => f.kind === "general") &&
                " Nearby general hospitals (grey) are also shown — many have an eye department; call to check."}
            </p>
          )}
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {facilities.map((f, i) => {
              const on = f.id === selectedId;
              return (
                <li key={f.id}>
                  <div
                    className="card"
                    style={{
                      padding: "12px 14px",
                      borderColor: on ? "var(--crimson)" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedId(f.id)}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: f.kind === "eye" ? "var(--crimson)" : "var(--muted)" }}
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setSelectedId(f.id)}
                          aria-pressed={on}
                          className="text-left font-semibold text-[var(--ink)]"
                          style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer" }}
                        >
                          {f.name}
                        </button>
                        <div className="text-sm text-[var(--muted)]">
                          {formatDistance(f.distance_m)} {fromLabel}
                          {f.kind === "eye" ? " · Eye care" : " · General hospital"}
                        </div>
                        {f.address && <div className="text-sm text-[var(--ink-2)]">{f.address}</div>}
                        {f.opening_hours && (
                          <div className="text-xs text-[var(--muted)]">Hours: {f.opening_hours}</div>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-3 text-sm">
                          <a href={directionsUrl(f, origin)} target="_blank" rel="noopener noreferrer">
                            <Navigation className="ico" size={16} strokeWidth={1.75} /> Directions
                          </a>
                          {f.phone && <a href={`tel:${f.phone.split(/[;,]/)[0].trim()}`}><Phone className="ico" size={16} strokeWidth={1.75} /> Call</a>}
                          {f.website && (
                            <a href={f.website} target="_blank" rel="noopener noreferrer"><Globe className="ico" size={16} strokeWidth={1.75} /> Website</a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <p className="cb-note">
        Facility data © OpenStreetMap contributors
        {data?.data_date ? ` (snapshot of ${data.data_date})` : ""}. Listings are not an endorsement, and map
        data does not record which centres treat diabetic retinopathy specifically — please
        call ahead. Screening triage aid. Not a diagnostic device.
      </p>
    </Shell>
  );
}
