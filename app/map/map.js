/**
 * SPILE map — creation, the terrain block, compass. Written by Agent A, rebuilt
 * as a closed light block by Agent B on Kurt's instruction after A stopped.
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

  /**
   * The map is a closed block around Verbania, not a window on the world: one
   * square of terrain standing on a plain backdrop, nothing drawn outside it and
   * no way to scroll away from it. (Kurt, 2026-11-15; rebuilt by Agent B.)
   */
  const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
  const DEM_ATTRIBUTION = 'Terrain: Mapzen / AWS · Tree cover © ESA WorldCover · Canopy height Meta / WRI · © OpenStreetMap';
  const OFM_TILES = 'https://tiles.openfreemap.org/planet';

  /** Terrain exaggeration: high enough to read the slopes above the lake. */
  const EXAGGERATION = 1.9;

  /** The block: a 14 km square centred on the municipality. [west, south, east, north] */
  const BLOCK_CENTER = [8.5260, 45.9373];
  const BLOCK_HALF_M = 7000;
  const BLOCK = (() => {
    const dLat = BLOCK_HALF_M / 111320, dLon = BLOCK_HALF_M / (111320 * Math.cos(BLOCK_CENTER[1] * Math.PI / 180));
    return [BLOCK_CENTER[0] - dLon, BLOCK_CENTER[1] - dLat, BLOCK_CENTER[0] + dLon, BLOCK_CENTER[1] + dLat];
  })();
  const GRID_N = 8;            // cells per side of the grid drawn on the block
  const RIM_M = 190;            // width of the uniform band along the edge, metres
  const PLINTH_ELEV = -140;    // metres given to everything outside the block: the slab it stands on

  /**
   * Misty grey-green backdrop, mossy block. The greens of the ground are olive and
   * muted so the risk green (#2fd47a) still reads as a signal on top of them.
   */
  const C = {
    backdrop: '#9ba198', sky: '#b4b8b0', ground: '#aebb8c', wood: '#788f45', water: '#a3b6b2',
    built: '#e4e9d6', grid: '#f4f8e6', ink: '#232b1c', edge: '#1a2014', rim: '#5f6d4c',
  };

  /** Where the intro starts: the whole block, flat, seen from above. */
  const START = { center: BLOCK_CENTER, zoom: 11.25, pitch: 0, bearing: 0 };

  const STYLE = {
    version: 8, name: 'spile-block', sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': C.backdrop } }],
  };

  let map = null, loaded = false, started = false;
  const waiting = [];

  /* ------------------------------------------------- terrain, cut square */

  const lon2x = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
  const lat2y = (lat, z) => {
    const r = lat * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
  };

  let flatTile = null;
  function canvas256() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    return c;
  }
  const toBuffer = c => new Promise(res => c.toBlob(b => res(b.arrayBuffer()), 'image/png'));
  const plinthRGB = (() => { const v = PLINTH_ELEV + 32768; return [Math.floor(v / 256), Math.floor(v % 256), 0]; })();

  function flat() {
    if (!flatTile) {
      const c = canvas256(), g = c.getContext('2d');
      g.fillStyle = 'rgb(' + plinthRGB.join(',') + ')'; g.fillRect(0, 0, 256, 256);
      flatTile = toBuffer(c);
    }
    return flatTile.then(b => b.slice(0));
  }

  /**
   * spdem://z/x/y — the AWS terrarium tile with every pixel outside the block set
   * to the plinth elevation. Tiles wholly outside are never fetched; a tile that
   * cannot be fetched comes back flat, so the map still starts offline.
   */
  function demProtocol(params, abort) {
    const m = /^spdem:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    if (!m) return Promise.reject(new Error('bad dem url'));
    const z = +m[1], x = +m[2], y = +m[3];
    const px0 = Math.round((lon2x(BLOCK[0], z) - x) * 256), px1 = Math.round((lon2x(BLOCK[2], z) - x) * 256);
    const py0 = Math.round((lat2y(BLOCK[3], z) - y) * 256), py1 = Math.round((lat2y(BLOCK[1], z) - y) * 256);
    if (px1 <= 0 || px0 >= 256 || py1 <= 0 || py0 >= 256) return flat().then(data => ({ data }));

    const url = DEM_TILES.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    return fetch(url, { signal: abort && abort.signal })
      .then(r => { if (!r.ok) throw new Error('dem ' + r.status); return r.blob(); })
      .then(blob => {
        if (px0 <= 0 && py0 <= 0 && px1 >= 256 && py1 >= 256) return blob.arrayBuffer();
        return createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }).then(bmp => {
          const c = canvas256(), g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(bmp, 0, 0);
          const img = g.getImageData(0, 0, 256, 256), d = img.data;
          for (let j = 0; j < 256; j++) {
            const rowOut = j < py0 || j >= py1;
            for (let i = 0; i < 256; i++) {
              if (rowOut || i < px0 || i >= px1) {
                const k = (j * 256 + i) * 4;
                d[k] = plinthRGB[0]; d[k + 1] = plinthRGB[1]; d[k + 2] = plinthRGB[2]; d[k + 3] = 255;
              }
            }
          }
          g.putImageData(img, 0, 0);
          return toBuffer(c);
        });
      })
      .then(data => ({ data }))
      .catch(err => { if (err && err.name === 'AbortError') throw err; return flat().then(data => ({ data })); });
  }

  /* ----------------------------------------------------------- creation */

  const ring = (w, s, e, n) => [[w, s], [e, s], [e, n], [w, n], [w, s]];
  const poly = rings => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: rings } });

  function gridLines() {
    const [w, s, e, n] = BLOCK, feats = [];
    for (let i = 0; i <= GRID_N; i++) {
      const lon = w + (e - w) * i / GRID_N, lat = s + (n - s) * i / GRID_N;
      const edge = i === 0 || i === GRID_N;
      // Dense vertices so the lines follow the terrain they are draped on.
      const v = [], hz = [];
      for (let k = 0; k <= 64; k++) { v.push([lon, s + (n - s) * k / 64]); hz.push([w + (e - w) * k / 64, lat]); }
      feats.push({ type: 'Feature', properties: { edge }, geometry: { type: 'LineString', coordinates: v } });
      feats.push({ type: 'Feature', properties: { edge }, geometry: { type: 'LineString', coordinates: hz } });
    }
    return { type: 'FeatureCollection', features: feats };
  }

  function create(style) {
    maplibregl.addProtocol('spdem', demProtocol);
    const [w, s, e, n] = BLOCK, padLon = (e - w) * 0.45, padLat = (n - s) * 0.45;

    map = new maplibregl.Map({
      container: 'map', style,
      center: START.center, zoom: START.zoom, pitch: START.pitch, bearing: START.bearing,
      minZoom: 10.6, maxZoom: 16.6, maxPitch: 72,
      // The camera target cannot leave the surroundings of the block.
      maxBounds: [[w - padLon, s - padLat], [e + padLon, n + padLat]],
      renderWorldCopies: false,
      attributionControl: false, antialias: true, fadeDuration: 250,
    });

    const attrib = new maplibregl.AttributionControl({ compact: true });
    map.addControl(attrib, 'bottom-right');
    const collapse = () => {
      const el = attrib._container;
      if (el) { el.classList.remove('maplibregl-compact-show'); el.removeAttribute('open'); }
    };

    map.getContainer().style.background = C.backdrop;
    map.once('idle', collapse);
    map.on('error', e => console.warn('[map]', (e && e.error && e.error.message) || e));

    map.once('load', () => {
      const dem = { type: 'raster-dem', tiles: ['spdem://{z}/{x}/{y}'], encoding: 'terrarium', tileSize: 256, maxzoom: 13 };
      map.addSource('dem', Object.assign({ attribution: DEM_ATTRIBUTION }, dem));
      map.addSource('dem-shade', dem);

      addGround();

      map.addLayer({
        id: 'sp-hillshade', type: 'hillshade', source: 'dem-shade',
        paint: {
          'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 12.2, 0.55, 14.2, 0.4],
          // Anchored to the map so the light does not swing during the orbit.
          'hillshade-illumination-anchor': 'map',
          'hillshade-illumination-direction': 300,
          'hillshade-shadow-color': '#2a371c',
          'hillshade-highlight-color': '#f1f7d4',
          'hillshade-accent-color': '#56692f',
        },
      });

      map.setTerrain({ source: 'dem', exaggeration: EXAGGERATION });

      // The horizon dissolves into the backdrop: there is no world beyond the block.
      if (typeof map.setSky === 'function') {
        try {
          map.setSky({
            'sky-color': C.sky, 'horizon-color': C.backdrop, 'fog-color': C.backdrop,
            'sky-horizon-blend': 1, 'horizon-fog-blend': 1, 'fog-ground-blend': 0.55,
            'atmosphere-blend': 0,
          });
        } catch (err) { console.info('[map] no sky in this MapLibre build'); }
      }

      map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.32, position: [1.25, 215, 38] });

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

  /** The surface of the block: ground, then lake, woods and buildings if the tiles answer. */
  function addGround() {
    const [w, s, e, n] = BLOCK;
    map.addSource('block', { type: 'geojson', data: poly([ring(w, s, e, n)]) });
    map.addLayer({ id: 'sp-ground', type: 'fill', source: 'block', paint: { 'fill-color': C.ground } });

    // Optional enrichment. If OpenFreeMap does not answer the block is plain relief.
    map.addSource('ofm', { type: 'vector', url: OFM_TILES });
    map.addLayer({ id: 'sp-wood', type: 'fill', source: 'ofm', 'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest']]], paint: { 'fill-color': C.wood, 'fill-opacity': 0.9 } });
    map.addLayer({ id: 'sp-water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': C.water } });
    map.addLayer({ id: 'sp-building', type: 'fill', source: 'ofm', 'source-layer': 'building', minzoom: 12.5,
      paint: { 'fill-color': C.built, 'fill-opacity': 0.75 } });
  }

  /**
   * Context drawn on the ground, very quiet: roads and rail, the municipal
   * boundary, the HV lines, the grid. Then the mask that hides everything outside
   * the block and the dark rim that reads as its sides.
   */
  function addContext() {
    const assets = SPILE.data.getAssets();
    const pick = re => ({ type: 'FeatureCollection', features: assets ? assets.features.filter(f => re.test(f.properties.cls || '')) : [] });
    const round = { 'line-cap': 'round', 'line-join': 'round' };

    map.addSource('ways', { type: 'geojson', data: pick(/^(road_|rail)/) });
    map.addLayer({ id: 'sp-ways', type: 'line', source: 'ways', layout: round,
      paint: { 'line-color': C.built, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 15, 2.2], 'line-opacity': 0.7 } });

    map.addSource('grid', { type: 'geojson', data: gridLines() });
    map.addLayer({ id: 'sp-grid', type: 'line', source: 'grid', filter: ['!', ['get', 'edge']],
      paint: { 'line-color': C.grid, 'line-width': 0.8, 'line-opacity': 0.4 } });

    const boundary = SPILE.data.getBoundary();
    if (boundary) {
      map.addSource('boundary', { type: 'geojson', data: boundary });
      map.addLayer({ id: 'sp-boundary', type: 'line', source: 'boundary',
        paint: { 'line-color': C.ink, 'line-width': 1.1, 'line-opacity': 0.45, 'line-dasharray': [3, 2] } });
    }

    map.addSource('hv', { type: 'geojson', data: pick(/^power_hv$/) });
    map.addLayer({ id: 'sp-hv', type: 'line', source: 'hv', layout: round,
      paint: { 'line-color': C.ink, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 15, 1.8], 'line-opacity': 0.8 } });

    const [w, s, e, n] = BLOCK;
    map.addSource('mask', { type: 'geojson', data: poly([ring(-170, -80, 170, 80), ring(w, s, e, n).reverse()]) });
    // A uniform band just inside the edge. The terrain mesh stretches whatever is
    // drawn there down the cut, so this band is also the colour of the slab's sides.
    const dLat = RIM_M / 111320, dLon = RIM_M / (111320 * Math.cos(BLOCK_CENTER[1] * Math.PI / 180));
    map.addSource('rim', { type: 'geojson', data: poly([ring(w, s, e, n), ring(w + dLon, s + dLat, e - dLon, n - dLat).reverse()]) });
    map.addLayer({ id: 'sp-rim', type: 'fill', source: 'rim', paint: { 'fill-color': C.rim, 'fill-antialias': false } });
    map.addLayer({ id: 'sp-mask', type: 'fill', source: 'mask', paint: { 'fill-color': C.backdrop, 'fill-antialias': false } });
    map.addLayer({ id: 'sp-edge', type: 'line', source: 'grid', filter: ['get', 'edge'],
      paint: { 'line-color': C.edge, 'line-width': ['interpolate', ['linear'], ['zoom'], 10.5, 2, 15, 5], 'line-opacity': 0.9 } });
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
    try { create(STYLE); } catch (err) { console.error('[map] could not start', err); }
  }

  SPILE.map = {
    START, EXAGGERATION, BLOCK, BLOCK_CENTER, COLORS: C,
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
