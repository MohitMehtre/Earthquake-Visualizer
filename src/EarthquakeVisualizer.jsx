import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  CircleMarker,
  Popup,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Helper: format epoch ms → readable local date/time
const formatDateTime = (ms) => new Date(ms).toLocaleString();

// Helper: color scale by magnitude
function colorForMag(mag) {
  if (mag >= 6) return "#b10026"; // deep red
  if (mag >= 5) return "#e31a1c";
  if (mag >= 4) return "#fc4e2a";
  if (mag >= 3) return "#fd8d3c";
  if (mag >= 2) return "#feb24c";
  if (mag >= 1) return "#fed976";
  return "#ffffb2"; // pale
}

// Component to auto-fit bounds when quakes change
    function FitBounds({ quakes }) {
        const map = useMap();

        useEffect(() => {
            if (!quakes.length) return;

            const bounds = L.latLngBounds(
            quakes.map((q) => {
                const [lon, lat] = q.geometry.coordinates;
                return [lat, lon];
            })
            );

            map.fitBounds(bounds, { padding: [50, 50] }); // zoom + pan
        }, [quakes, map]);

        return null;
        }

// Helper: radius scale by magnitude (pixels)
function radiusForMag(mag) {
  if (mag == null || Number.isNaN(mag)) return 3;
  return Math.max(3, mag * 3.5);
}

export default function EarthquakeVisualizer() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(true); // default dark mode
  const [timeRange, setTimeRange] = useState("day"); // "day" | "week" | "month"

  useEffect(() => {
    if (darkMode) {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
    } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
    }
    }, [darkMode]);


  // UI state
  const [minMag, setMinMag] = useState(0);
  const [searchText, setSearchText] = useState(""); // filter by place text

  const getFeedUrl = (range) => {
    switch (range) {
      case "week":
        return "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
      case "month":
        return "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";
      default:
        return "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
    }
  };

  // Fetch USGS data
  const fetchQuakes = useCallback(async (range = timeRange) => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(getFeedUrl(range));
      if (!res.ok) throw new Error(`Network error: ${res.status}`);
      const data = await res.json();
      const feats = Array.isArray(data.features) ? data.features : [];
      setFeatures(feats);
    } catch (err) {
      setError(err?.message || "Failed to load earthquakes.");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchQuakes();
    const id = setInterval(fetchQuakes, 5 * 60 * 1000); // refresh every 5m
    return () => clearInterval(id);
  }, [fetchQuakes]);

  // Derived filtered list
  const filtered = useMemo(() => {
    return features.filter((f) => {
      const mag = f?.properties?.mag ?? 0;
      const place = (f?.properties?.place || "").toLowerCase();
      const matchesMag = mag >= minMag;
      const matchesText = searchText.trim()
        ? place.includes(searchText.trim().toLowerCase())
        : true;
      return matchesMag && matchesText;
    });
  }, [features, minMag, searchText]);

  const center = [20, 0]; // near Atlantic for world overview
  const zoom = 2;

  return (
    <div className={darkMode ? "dark flex flex-col h-[100dvh]" : "flex flex-col h-[100dvh]"}>
      {/* Header */}
      <header className="sticky top-0 z-10 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-4 md:gap-3">
            
            {/* Top Row: Title + Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <span className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {/* 🌍 Earthquake Visualizer */}
                🌐 Earthquake Visualizer
                </span>
                <span className="text-xs md:text-sm text-gray-500">
                Earthquakes · Last 1 {timeRange}
                </span>
            </div>

            <button
                onClick={() => setDarkMode(!darkMode)}
                className="cursor-pointer px-3 py-2 rounded-xl text-sm font-medium 
                        bg-gray-800 text-white hover:bg-gray-700 
                        dark:bg-gray-200 dark:text-black dark:hover:bg-gray-300 transition"
            >
                {darkMode ? "☀️ Light" : "🌑 Dark"}
            </button>
            </div>

            {/* Bottom Row: Filters */}
            <div className="flex flex-wrap items-center gap-3 md:justify-between">
            
            {/* Magnitude slider */}
            <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Min Mag: {minMag.toFixed(1)}
                </label>
                <input
                type="range"
                min={0}
                max={7}
                step={0.1}
                value={minMag}
                onChange={(e) => setMinMag(parseFloat(e.target.value))}
                className="cursor-pointer w-40 accent-indigo-600 dark:accent-indigo-400"
                />
            </div>

            {/* Search box */}
            <input
                type="text"
                placeholder="Filter by place (e.g., Japan)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="px-3 py-2 rounded-xl border 
                        bg-white dark:bg-gray-800 
                        dark:border-gray-600 dark:text-gray-200 
                        text-sm w-full sm:w-56"
            />

            {/* Right-side controls */}
            <div className="flex items-center gap-3">
                <button
                onClick={fetchQuakes}
                className="cursor-pointer px-3 py-2 rounded-xl bg-indigo-600 text-white 
                            text-sm shadow hover:bg-indigo-500 transition"
                >
                Refresh
                </button>

                <select
                value={timeRange}
                onChange={(e) => {
                    const value = e.target.value;
                    setTimeRange(value);
                    fetchQuakes(value); // 🚀 start fetch instantly
                }}
                className="cursor-pointer px-3 py-2 rounded-xl border 
                            bg-white dark:bg-gray-800 
                            dark:border-gray-600 dark:text-gray-200 text-sm"
                >
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                </select>
            </div>
            </div>
        </div>
        </header>


      {/* Status Bar */}
      <div className="dark:bg-gray-800 flex items-center">

      <div className="max-w-6xl mx-auto px-4 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400 flex items-center gap-3">
        {loading ? (
            <span className="animate-pulse">Loading latest earthquakes…</span>
        ) : error ? (
            <span className="text-red-600">{error}</span>
        ) : (
            <>
            <span>
              Showing {filtered.length} of {features.length} events
            </span>
            <span className="hidden md:inline">•</span>
            <span className="truncate">Data: USGS feed</span>
          </>
        )}
      </div>
        </div>

      {/* Map */}
      <div className="relative flex-1">
        <MapContainer center={center} zoom={zoom} minZoom={2} maxBounds={[[-90, -180], [90, 180]]} maxBoundsViscosity={1.0} className="h-full w-full" zoomControl={true}>
          <TileLayer
            url={
              darkMode
                ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            worldCopyJump = {false}
          />
          <ZoomControl position="bottomright" />

          {filtered.map((f) => {
            const id = f.id;
            const [lon, lat, depth] = f.geometry.coordinates;
            const props = f.properties;
            const mag = props?.mag ?? 0;
            const fill = colorForMag(mag);
            const radius = radiusForMag(mag);

            if (lat == null || lon == null) return null;

            return (
              <CircleMarker
                key={id}
                center={[lat, lon]}
                radius={radius}
                pathOptions={{ color: fill, fillColor: fill, fillOpacity: 0.75, weight: 1 }}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-medium">
                      Mag {mag?.toFixed?.(1) ?? mag} — {props?.place || "Unknown location"}
                    </div>
                    <div className="text-xs font-bold text-gray-600 dark:text-gray-900">
                      {formatDateTime(props?.time)}
                    </div>
                    <div className="text-xs">Depth: {depth?.toFixed?.(1)} km</div>
                    {props?.url && (
                      <a
                        className="inline-block mt-1 text-xs underline"
                        href={props.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on USGS →
                      </a>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur rounded-2xl shadow p-6 text-center pointer-events-auto">
              <div className="text-lg font-medium mb-1 text-gray-900 dark:text-gray-100">
                No earthquakes match your filters
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Try lowering the minimum magnitude or clearing the search.
              </div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-2xl shadow p-6 text-center max-w-sm">
              <div className="text-lg font-semibold text-red-600">We couldn't load the feed</div>
              <div className="text-sm text-gray-700 dark:text-gray-300 mt-1">{error}</div>
              <button
                onClick={fetchQuakes}
                className="mt-3 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm shadow hover:bg-indigo-500 transition"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <footer className="w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-gray-700 dark:text-gray-300 flex flex-wrap items-center gap-4">
          <span className="font-medium">Legend</span>
          {[
            { label: ">=6.0", color: "#b10026" },
            { label: "5.0–5.9", color: "#e31a1c" },
            { label: "4.0–4.9", color: "#fc4e2a" },
            { label: "3.0–3.9", color: "#fd8d3c" },
            { label: "2.0–2.9", color: "#feb24c" },
            { label: "1.0–1.9", color: "#fed976" },
            { label: "<1.0", color: "#ffffb2" },
          ].map((i) => (
            <span key={i.label} className="inline-flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-full border"
                style={{ background: i.color, borderColor: "rgba(0,0,0,0.25)" }}
              />
              {i.label}
            </span>
          ))}

          <span className="ml-auto text-gray-500 dark:text-gray-400">
            Tiles © OpenStreetMap / Carto · Data © USGS
          </span>
        </div>
      </footer>
    </div>
  );
}
