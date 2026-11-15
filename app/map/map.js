/**
 * SPILE map — creation, basemap, terrain, compass. Owned by Agent A.
 *
 * Screen 5 rule: the map and a compass, nothing else. This file adds no legend,
 * no counter, no panel, and it must stay that way.
 *
 *   SPILE.map.onLoad(fn)   run fn(map) once the style and terrain are in place
 *   SPILE.map.get()        the maplibregl.Map, or null before creation
 *   SPILE.map.cssLen(name, fallbackPx)   a :root CSS length variable, in pixels
 *
 * zones.js and camera.js extend SPILE.map with the rest.
 */
(() => {
  'use strict';
  const E = SPILE.EVENTS, bus = SPILE.bus;

  const BASE_STYLE = 'https://tiles.openfreemap.org/styles/dark';
  const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const DEM_ATTRIBUTION = 'Terrain: Mapzen / AWS · Tree cover © ESA WorldCover · Canopy height Meta / WRI';

  /** Terrain exaggeration: high enough to read the slopes above the lake. */
  const EXAGGERATION = 1.9;
  const BG = '#04070b';

  /** Where the intro starts. The map is created here so these tiles preload. */
  const START = { center: [8.5330, 45.9330], zoom: 12.0, pitch: 50, bearing: 38 };

  const FALLBACK_STYLE = {
    version: 8, name: 'spile-fallback', sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': BG } }],
  };

  let map = null, loaded = false, started = false;
  const waiting = [];

  /* ------------------------------------------------------------ basemap */

  const KEEP_LABELS = new Set(['place_village', 'place_town', 'place_city', 'place_city_large', 'water_name']);

  /** Recolour OpenFreeMap "dark" into a cooler, quieter base and drop the clutter. */
  function restyle(style) {
    const set = (layer, key, value) => { layer.paint = Object.assign({}, layer.paint, { [key]: value }); };
    style.layers.forEach(l => {
      const id = l.id;
      if (l.type === 'background') set(l, 'background-color', BG);
      else if (id === 'water') set(l, 'fill-color', '#08141f');
      else if (id === 'waterway') set(l, 'line-color', '#0b1c2b');
      else if (id === 'landcover_wood') { set(l, 'fill-color', '#0a1512'); if (l.paint) delete l.paint['fill-pattern']; }
      else if (id === 'landuse_park') set(l, 'fill-color', '#0a1411');
      else if (id === 'landuse_residential') set(l, 'fill-color', '#0d131b');
      else if (id === 'building') { set(l, 'fill-color', '#0e151e'); set(l, 'fill-outline-color', '#17212d'); }
      else if (/^boundary_/.test(id)) l.layout = Object.assign({}, l.layout, { visibility: 'none' });
      else if (l.type === 'line' && /^(highway|road|railway)/.test(id)) {
        set(l, 'line-color', /casing/.test(id) ? '#1b2632' : '#141d27');
      } else if (l.type === 'symbol') {
        if (KEEP_LABELS.has(id)) {
          set(l, 'text-color', 'rgba(170, 186, 204, 0.55)');
          set(l, 'text-halo-color', 'rgba(4, 7, 11, 0.9)');
          set(l, 'text-halo-width', 1.2);
          if (l.paint && 'icon-opacity' in l.paint) set(l, 'icon-opacity', 0);
        } else {
          l.layout = Object.assign({}, l.layout, { visibility: 'none' });
        }
      }
    });
    return style;
  }

  function loadStyle() {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    return fetch(BASE_STYLE, { signal: ctl.signal })
      .then(r => { if (!r.ok) throw new Error('style ' + r.status); return r.json(); })
      .then(restyle)
      .catch(err => { console.warn('[map] basemap unavailable, starting on black + hillshade:', err.message); return FALLBACK_STYLE; })
      .finally(() => clearTimeout(timer));
  }

  /* ----------------------------------------------------------- creation */

  function create(style) {
    map = new maplibregl.Map({
      container: 'map', style,
      center: START.center, zoom: START.zoom, pitch: START.pitch, bearing: START.bearing,
      minZoom: 10.5, maxZoom: 16.6, maxPitch: 76,
      attributionControl: false, antialias: true, fadeDuration: 250,
    });

    const attrib = new maplibregl.AttributionControl({ compact: true });
    map.addControl(attrib, 'bottom-left');
    const collapse = () => {
      const el = attrib._container;
      if (el) { el.classList.remove('maplibregl-compact-show'); el.removeAttribute('open'); }
    };

    map.on('error', e => console.warn('[map]', (e && e.error && e.error.message) || e));

    map.once('load', () => {
      const dem = { type: 'raster-dem', tiles: [DEM_TILES], encoding: 'terrarium', tileSize: 256, maxzoom: 13 };
      map.addSource('dem', Object.assign({ attribution: DEM_ATTRIBUTION }, dem));
      map.addSource('dem-shade', dem);

      const firstSymbol = (map.getStyle().layers.find(l => l.type === 'symbol') || {}).id;
      SPILE.map.firstSymbolId = firstSymbol;

      map.addLayer({
        id: 'sp-hillshade', type: 'hillshade', source: 'dem-shade',
        paint: {
          // Strong from afar, where it draws the valleys; softer up close, where a
          // fully lit slope would wash out under the zones.
          'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 12.2, 1, 14.2, 0.7],
          // Anchored to the map so the light does not swing during the orbit.
          'hillshade-illumination-anchor': 'map',
          'hillshade-illumination-direction': 300,
          'hillshade-shadow-color': '#000000',
          'hillshade-highlight-color': '#d5e6f7',
          'hillshade-accent-color': '#1a3047',
        },
      }, firstSymbol);

      map.setTerrain({ source: 'dem', exaggeration: EXAGGERATION });

      // Distance haze: far ridges fall into the dark, the near slope stays crisp.
      if (typeof map.setSky === 'function') {
        try {
          map.setSky({
            'sky-color': '#05090f', 'horizon-color': '#101d2c', 'fog-color': '#060a10',
            'sky-horizon-blend': 0.85, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.62,
            'atmosphere-blend': 0.5,
          });
        } catch (err) { console.info('[map] no sky in this MapLibre build'); }
      }

      map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.38, position: [1.25, 215, 38] });

      addContext();
      collapse();

      loaded = true;
      waiting.splice(0).forEach(run);

      // Ready means drawn, not just parsed: wait for the first idle frame.
      let announced = false;
      const announce = () => { if (!announced) { announced = true; bus.emit(E.MAP_READY, {}); } };
      map.once('idle', announce);
      setTimeout(announce, 7000);
    });

    wireCompass();
  }

  /** Municipal boundary and the HV lines: context drawn on the ground, very quiet. */
  function addContext() {
    const before = SPILE.map.firstSymbolId;
    const boundary = SPILE.data.getBoundary();
    if (boundary) {
      map.addSource('boundary', { type: 'geojson', data: boundary });
      map.addLayer({
        id: 'sp-boundary-glow', type: 'line', source: 'boundary',
        paint: { 'line-color': '#6fa8dc', 'line-width': 7, 'line-blur': 7, 'line-opacity': 0.13 },
      }, before);
      map.addLayer({
        id: 'sp-boundary', type: 'line', source: 'boundary',
        paint: { 'line-color': '#9cc3e6', 'line-width': 0.9, 'line-opacity': 0.36 },
      }, before);
    }

    const assets = SPILE.data.getAssets();
    if (assets) {
      const hv = { type: 'FeatureCollection', features: assets.features.filter(f => f.properties.cls === 'power_hv') };
      map.addSource('hv', { type: 'geojson', data: hv });
      map.addLayer({
        id: 'sp-hv-glow', type: 'line', source: 'hv',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#bfe0ff', 'line-width': 5, 'line-blur': 5, 'line-opacity': 0.16 },
      }, before);
      map.addLayer({
        id: 'sp-hv', type: 'line', source: 'hv',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#e3f1ff', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 15, 1.4], 'line-opacity': 0.6 },
      }, before);
    }
  }

  /* ------------------------------------------------------------ compass */

  function wireCompass() {
    const btn = document.getElementById('compass');
    const rose = document.getElementById('compass-rose');
    if (!btn || !rose) return;
    const turn = () => { rose.style.transform = 'rotate(' + (-map.getBearing()) + 'deg)'; };
    map.on('rotate', turn);
    map.on('load', turn);
    turn();
    btn.addEventListener('click', () => map.easeTo({ bearing: 0, duration: 900, essential: true }));
  }

  /* ---------------------------------------------------------------- api */

  function run(fn) { try { fn(map); } catch (err) { console.error('[map] onLoad', err); } }

  /** A length CSS variable on :root (px, vh, vw or %), resolved to pixels. */
  function cssLen(name, fallbackPx) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^(-?[\d.]+)(px|vh|vw|%)?$/.exec(raw);
    if (!m) return fallbackPx;
    const v = parseFloat(m[1]);
    if (m[2] === 'vh' || m[2] === '%') return v / 100 * window.innerHeight;
    if (m[2] === 'vw') return v / 100 * window.innerWidth;
    return v;
  }

  function init() {
    if (started) return;
    if (!window.maplibregl) { window.addEventListener('maplibre:ready', init, { once: true }); return; }
    if (!document.getElementById('map')) { document.addEventListener('DOMContentLoaded', init, { once: true }); return; }
    started = true;
    loadStyle().then(create).catch(err => console.error('[map] could not start', err));
  }

  SPILE.map = {
    START, EXAGGERATION,
    firstSymbolId: undefined,
    init,
    get: () => map,
    isLoaded: () => loaded,
    onLoad(fn) { if (loaded) run(fn); else waiting.push(fn); },
    cssLen,
  };

  // The map starts loading behind the login screen, so screen 4 is a short wait.
  init();
})();
