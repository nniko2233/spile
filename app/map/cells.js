/**
 * Zone polygons -> one terrain-following block per zone. Owned by Agent A;
 * changed by Agent B (Kurt, 2026-11-15): the cells of a zone touch and all have
 * the same height, so a zone reads as a single raised block whose height is its
 * risk, not as a field of separate bars.
 *
 * MapLibre lifts a fill-extrusion to the terrain height of the feature's centroid,
 * so one flat slab per zone floats on one side of a 30 degree slope and sinks on
 * the other. Cutting every zone into small square cells gives each cell its own
 * ground height: the extrusion follows the hillside in steps.
 *
 * SPILE.buildCells(zonesFC, {size, gap}) -> { fc, byZone }
 *   fc      FeatureCollection of square polygons, feature.id = running integer,
 *           properties { z: zone id, cls, h: height in metres }
 *   byZone  Map<zone id, feature id[]>  for feature-state updates per zone
 */
(() => {
  'use strict';

  const M_PER_DEG = 111320;

  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /** Even-odd over the outer ring and the holes. */
  function inPolygon(x, y, rings) {
    let inside = false;
    for (let r = 0; r < rings.length; r++) if (inRing(x, y, rings[r])) inside = !inside;
    return inside;
  }

  const clamp01 = v => Math.max(0, Math.min(1, v));

  /** Pillar height of a zone, metres. Red zones stand clearly above amber ones. */
  function zoneHeight(p) {
    if (p.cls === 'alto') return 7 + 16 * clamp01((p.score - 0.45) / 0.45);
    if (p.cls === 'medio') return 3 + 3 * clamp01((p.score - 0.20) / 0.25);
    return 2.5;
  }

  SPILE.buildCells = (zonesFC, opts = {}) => {
    const size = opts.size || 20;            // cell edge, metres
    const gap = opts.gap == null ? 0 : opts.gap;    // inset per side, share of the cell; 0 = cells touch

    const feats = zonesFC.features;
    const lat0 = feats.length ? feats.reduce((s, f) => s + f.properties.lat, 0) / feats.length : 45.94;
    const dLat = size / M_PER_DEG;
    const dLon = size / (M_PER_DEG * Math.cos(lat0 * Math.PI / 180));

    const out = [];
    const byZone = new Map();
    let nextId = 1;

    feats.forEach(f => {
      const p = f.properties;
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      const cells = new Map(); // "i:j" -> [i, j], on one grid shared by every zone

      polys.forEach(rings => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        rings[0].forEach(c => {
          if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0];
          if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1];
        });
        for (let i = Math.floor(x0 / dLon); i <= Math.floor(x1 / dLon); i++) {
          for (let j = Math.floor(y0 / dLat); j <= Math.floor(y1 / dLat); j++) {
            if (inPolygon((i + 0.5) * dLon, (j + 0.5) * dLat, rings)) cells.set(i + ':' + j, [i, j]);
          }
        }
      });

      // A zone thinner than one cell still gets a pillar, at its centroid.
      if (!cells.size) {
        const i = Math.floor(p.lon / dLon), j = Math.floor(p.lat / dLat);
        cells.set(i + ':' + j, [i, j]);
      }

      const H = zoneHeight(p);
      const ids = [];
      cells.forEach(([i, j]) => {
        // One height for the whole zone: its top runs parallel to the ground.
        const h = Math.round(H * 10) / 10;

        const ax = (i + gap) * dLon, bx = (i + 1 - gap) * dLon;
        const ay = (j + gap) * dLat, by = (j + 1 - gap) * dLat;
        const id = nextId++;
        ids.push(id);
        out.push({
          type: 'Feature', id,
          properties: { z: p.id, cls: p.cls, h },
          geometry: { type: 'Polygon', coordinates: [[[ax, ay], [bx, ay], [bx, by], [ax, by], [ax, ay]]] },
        });
      });
      byZone.set(p.id, ids);
    });

    return { fc: { type: 'FeatureCollection', features: out }, byZone };
  };
})();
