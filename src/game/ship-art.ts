import { LIMITS, Ship, Station, Tile } from "../sim/model";
import { intact } from "../sim/navigation";

/** Static, presentation-only architecture. Never retained by a scene or saved. */
export interface CabinSpan {
  x: number;
  width: number;
  roofY: number;
  floorY: number;
}
export function cabinSpans(
  tiles: readonly Tile[],
  blueprint = false,
): CabinSpan[] {
  const solid = new Uint8Array(LIMITS.width * LIMITS.height);
  for (const t of tiles)
    if (t.kind === "hull" && (blueprint || intact(t)))
      solid[t.y * LIMITS.width + t.x] = 1;
  const rooms: CabinSpan[] = [];
  for (let y = 1; y < LIMITS.height - 3; y++) {
    let run: CabinSpan | undefined;
    for (let x = 0; x <= LIMITS.width; x++) {
      let floor = -1;
      if (x < LIMITS.width && solid[y * LIMITS.width + x]) {
        for (let below = y + 1; below < LIMITS.height; below++)
          if (solid[below * LIMITS.width + x]) {
            if (below - y >= 3) floor = below;
            break;
          }
      }
      if (floor >= 0 && run?.floorY === floor) run.width++;
      else {
        if (run && run.width >= 2) rooms.push(run);
        run = floor < 0 ? undefined : { x, width: 1, roofY: y, floorY: floor };
      }
    }
  }
  return rooms;
}

/** One existing Graphics object supplies integer rectangles. No image/cache/view owner. */
export interface PixelSurface {
  rect(x: number, y: number, w: number, h: number, color: number): void;
}
const WARM = {
  ink: 0x302f35,
  dark: 0x4a3531,
  shade: 0x705043,
  wood: 0x9b6a45,
  light: 0xbf8c58,
  sun: 0xe4b979,
  wall: 0xc69355,
  wallShade: 0xa97848,
  trim: 0x775043,
  paint: 0x8f4840,
  glass: 0x5d9696,
  glassLight: 0xa3c1b2,
};
const HOSTILE = {
  ...WARM,
  dark: 0x303c40,
  shade: 0x495358,
  wood: 0x73654f,
  light: 0xa28a63,
  wall: 0xa48b66,
  wallShade: 0x85724f,
  trim: 0x46595a,
  paint: 0x365f62,
};

export function drawPixelShip(
  surface: PixelSurface,
  ship: Ship,
  tiles: readonly Tile[],
  stations: readonly Station[],
  ox: number,
  oy: number,
  unit: number,
  blueprint = false,
) {
  const c = ship.id === 1 ? WARM : HOSTILE;
  const r = (x: number, y: number, w: number, h: number, color: number) => {
    if (w > 0 && h > 0)
      surface.rect(
        Math.round(x),
        Math.round(y),
        Math.round(w),
        Math.round(h),
        color,
      );
  };
  const line = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: number,
  ) => {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0),
      sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      r(x0, y0, 1, 1, color);
      if (x0 === x1 && y0 === y1) break;
      const twice = 2 * error;
      if (twice >= dy) {
        error += dy;
        x0 += sx;
      }
      if (twice <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  };
  const hull = tiles.filter((t) => t.kind === "hull");
  if (!hull.length) return;
  const cells = new Set(hull.map((t) => t.y * LIMITS.width + t.x));
  const has = (x: number, y: number) =>
    x >= 0 && x < LIMITS.width && cells.has(y * LIMITS.width + x);
  const rooms = cabinSpans(tiles, blueprint);
  const isRoof = (t: Tile) =>
    rooms.some(
      (room) =>
        t.y === room.roofY && t.x >= room.x && t.x < room.x + room.width,
    );
  const rows = new Uint8Array(LIMITS.height);
  for (const t of hull) rows[t.y]++;
  let deck = 1;
  for (let y = 2; y < LIMITS.height; y++) if (rows[y] > rows[deck]) deck = y;
  const widest = rows[deck];
  // Put the mast on the main upper deck, rather than sinking it into a wider hold.
  for (let y = 1; y < deck; y++)
    if (rows[y] >= widest * 0.75) {
      deck = y;
      break;
    }
  const deckTiles = hull.filter((t) => t.y === deck);
  const min = Math.min(...deckTiles.map((t) => t.x));
  const max = Math.max(...deckTiles.map((t) => t.x));
  const deckY = oy + deck * unit;
  const mastTile = deckTiles[Math.floor(deckTiles.length * 0.68)];
  const mast = ox + mastTile.x * unit + 8;
  const top = deckY - 256;
  const sailTop = top + 34,
    sailBottom = top + 158;
  const sailLeft = mast - 65,
    sailRight = mast + 65;
  // All contours and seams are stepped native pixels, including cloth and rigging.
  line(mast, top, ox + min * unit + 4, deckY, 0xa49473);
  line(mast, top, ox + (max + 1) * unit - 4, deckY, 0xa49473);
  r(mast - 4, top, 8, deckY - top, c.ink);
  r(mast - 2, top, 4, deckY - top, c.wood);
  r(mast - 2, top, 1, deckY - top, c.sun);
  for (let y = top + 12; y < deckY; y += 18) r(mast - 4, y, 8, 2, c.dark);
  for (let y = 0; y < 14; y += 2)
    r(mast + 4, top + 3 + y, 30 - Math.abs(7 - y) * 2, 2, c.paint);
  r(mast + 4, top + 4, 21, 1, c.sun);
  for (let y = sailTop; y < sailBottom; y += 2) {
    const bend =
      Math.round(
        Math.sin(((y - sailTop) / (sailBottom - sailTop)) * Math.PI) * 5,
      ) * 2;
    r(sailLeft + bend, y, sailRight - sailLeft - bend * 2, 2, c.ink);
    r(
      sailLeft + bend + 2,
      y,
      sailRight - sailLeft - bend * 2 - 4,
      2,
      ship.id === 1 ? 0xe4d0a0 : 0x3d5355,
    );
    r(sailRight - bend - 12, y, 8, 2, ship.id === 1 ? 0xc6ad80 : 0x2d4449);
  }
  for (let i = 1; i < 5; i++)
    r(
      sailLeft + i * 26,
      sailTop + 3,
      1,
      115,
      ship.id === 1 ? 0xcab58c : 0x5a7070,
    );
  r(sailLeft, sailTop - 4, 130, 4, c.dark);
  r(sailLeft, sailTop - 4, 130, 1, c.sun);
  for (let x = sailLeft + 5; x < sailRight - 5; x += 4) {
    r(x, sailTop - 1, 1, 4, c.wood);
    r(x, sailBottom - 2, 3, 2, ship.id === 1 ? 0xae926b : 0x2b4148);
  }
  // Original compact skull, authored as a 12 x 12 raster motif.
  const skull = [
    "000111111000",
    "001111111100",
    "011111111110",
    "111001100111",
    "111001100111",
    "011111111110",
    "001110011100",
    "000111111000",
    "000101101000",
    "010000000010",
    "001100001100",
    "000011110000",
  ];
  skull.forEach((row, y) =>
    [...row].forEach((bit, x) => {
      if (bit === "1")
        r(
          mast - 12 + x * 2,
          sailTop + 44 + y * 2,
          2,
          2,
          ship.id === 1 ? 0x756d59 : 0xd9c794,
        );
    }),
  );

  // The cutaway rear wall only fills columns with a surviving roof and floor.
  for (const room of rooms) {
    const x = ox + room.x * unit,
      y = oy + room.roofY * unit + 5;
    const w = room.width * unit,
      bottom = oy + room.floorY * unit;
    r(x, y, w, bottom - y, c.dark);
    r(x + 4, y + 3, w - 8, bottom - y - 3, c.wall);
    for (let px = x + 8; px < x + w - 4; px += 6) {
      r(px, y + 3, 1, bottom - y - 4, c.wallShade);
      r(px + 1, y + 4, 1, bottom - y - 6, c.light);
    }
    r(x + 4, bottom - 17, w - 8, 12, c.wallShade);
    r(x + 4, bottom - 18, w - 8, 2, c.trim);
    r(x, y, w, 7, c.trim);
    r(x + 4, y + 7, w - 8, 2, c.wallShade);
    r(x, y, 4, bottom - y, c.trim);
    r(x + w - 4, y, 4, bottom - y, c.trim);
    r(x + 1, y + 8, 1, bottom - y - 8, c.sun);
    r(x + w - 3, y + 8, 1, bottom - y - 8, c.light);
    const doorX = x + Math.floor(room.width / 2) * unit;
    r(doorX - 1, bottom - 34, 20, 34, c.ink);
    r(doorX + 1, bottom - 32, 16, 32, c.trim);
    r(doorX + 3, bottom - 29, 12, 12, c.dark);
    r(doorX + 3, bottom - 15, 12, 11, c.dark);
    r(doorX + 4, bottom - 28, 10, 1, c.light);
    r(doorX + 4, bottom - 14, 10, 1, c.light);
    r(doorX + 12, bottom - 17, 2, 2, c.sun);
    for (const wx of [x + 8, x + w - 24]) {
      if (Math.abs(wx - doorX) < 18) continue;
      r(wx, bottom - 35, 16, 20, c.ink);
      r(wx + 1, bottom - 34, 14, 18, c.sun);
      r(wx + 3, bottom - 32, 10, 14, c.glass);
      r(wx + 4, bottom - 31, 4, 5, c.glassLight);
      r(wx + 3, bottom - 26, 10, 2, c.trim);
      r(wx + 7, bottom - 32, 2, 14, c.trim);
      r(wx - 2, bottom - 15, 20, 3, c.trim);
      r(wx - 1, bottom - 15, 18, 1, c.sun);
    }
    r(x, bottom - 5, w, 5, c.trim);
    r(x + 4, bottom - 5, w - 8, 1, c.light);
  }

  for (const t of hull) {
    const x = ox + t.x * unit,
      y = oy + t.y * unit;
    const upper = !has(t.x, t.y - 1),
      lower = !has(t.x, t.y + 1);
    if (isRoof(t)) {
      r(x, y, unit, 6, c.dark);
      r(x, y, unit, 2, c.sun);
      r(x, y + 2, unit, 2, c.paint);
      r(x, y + 4, unit, 1, c.ink);
      // Carved rail panels are set behind actors, never treated as collision.
      r(x + 1, y - 14, 2, 14, c.trim);
      r(x + unit - 3, y - 14, 2, 14, c.trim);
      r(x, y - 14, unit, 2, c.sun);
      r(x + 3, y - 9, unit - 6, 1, c.light);
      r(x + 3, y - 5, unit - 6, 1, c.light);
      for (let px = 5; px < unit - 3; px += 4)
        r(x + px, y - 12, 1, 12, c.light);
      r(x + 2, y - 16, 2, 2, c.paint);
      continue;
    }
    const leftEdge = !has(t.x - 1, t.y),
      rightEdge = !has(t.x + 1, t.y);
    const hr = (
      px: number,
      py: number,
      w: number,
      h: number,
      color: number,
    ) => {
      if (!lower || (!leftEdge && !rightEdge)) {
        r(px, py, w, h, color);
        return;
      }
      for (let dy = 0; dy < h; dy++) {
        const row = py + dy - y;
        const bevel = lower ? Math.max(0, Math.floor((row - unit + 7) / 2)) : 0;
        const start = Math.max(px, x + (leftEdge ? bevel : 0));
        const end = Math.min(px + w, x + unit - (rightEdge ? bevel : 0));
        r(start, py + dy, end - start, 1, color);
      }
    };
    hr(x, y, unit, unit, t.y % 2 ? c.wood : c.shade);
    for (let row = 0; row < 3; row++) {
      hr(x, y + row * 6, unit, 1, c.dark);
      hr(x + (t.x % 2 ? 3 : 10), y + row * 6 + 1, 1, 5, c.dark);
      hr(x + ((t.x * 7 + row * 5) % 10) + 2, y + row * 6 + 2, 5, 1, c.light);
    }
    if (upper) {
      hr(x, y, unit, 3, c.sun);
      hr(x, y + 3, unit, 3, c.trim);
      hr(x, y + 6, unit, 2, c.ink);
      hr(x + 2, y + 4, 2, 1, c.sun);
    }
    if (!has(t.x - 1, t.y)) {
      hr(x, y + (upper ? 6 : 0), 3, unit - (upper ? 6 : 0), c.dark);
      hr(x + 3, y + 9, 1, unit - 9, c.light);
    }
    if (!has(t.x + 1, t.y)) hr(x + unit - 3, y + 6, 3, unit - 6, c.dark);
    if (lower) {
      hr(x, y + unit - 5, unit, 5, c.dark);
      hr(x + 2, y + unit - 5, unit - 4, 1, c.light);
      // Broken waterline glints do not bridge destroyed support cells.
      r(x + 2, y + unit + 2, unit - 5, 1, 0x98b9a9);
      r(x + 5, y + unit + 4, unit - 10, 1, 0x4e8988);
    }
    if (!upper && t.x % 3 === 1 && t.y === deck + 1) {
      hr(x + 3, y + 2, 12, 12, c.ink);
      hr(x + 4, y + 3, 10, 10, c.sun);
      hr(x + 6, y + 5, 6, 6, c.glass);
      hr(x + 6, y + 5, 3, 2, c.glassLight);
    }
  }
  for (const t of tiles)
    if (t.kind === "ladder") {
      const x = ox + t.x * unit,
        y = oy + t.y * unit;
      r(x + 2, y, 3, unit, c.dark);
      r(x + 13, y, 3, unit, c.dark);
      r(x + 2, y, 1, unit, c.sun);
      r(x + 13, y, 1, unit, c.sun);
      for (let dy = 2; dy < unit; dy += 6) {
        r(x + 3, y + dy, 12, 3, c.trim);
        r(x + 3, y + dy, 12, 1, c.sun);
      }
    }
  // Sparse stern/bow rails belong to the actual outermost standing deck cells.
  for (const tx of [min, min + 1, max - 1, max]) {
    if (
      !has(tx, deck) ||
      has(tx, deck - 1) ||
      rooms.some(
        (room) =>
          tx >= room.x && tx < room.x + room.width && room.floorY === deck,
      )
    )
      continue;
    const x = ox + tx * unit;
    r(x + 1, deckY - 12, 2, 12, c.trim);
    r(x + 1, deckY - 12, 2, 2, c.sun);
    r(x, deckY - 10, unit, 2, c.light);
    r(x, deckY - 5, unit, 1, c.trim);
  }
  for (const station of stations) {
    const x = ox + station.x * unit,
      y = oy + (station.y + 1) * unit;
    if (station.kind === "cannon") {
      r(x - 2, y - 18, 30, 9, c.ink);
      r(x - 2, y - 16, 29, 5, 0x40565b);
      r(x, y - 17, 26, 2, 0x8faaa4);
      r(x + 27, y - 19, 4, 11, 0x25343b);
      r(x + 28, y - 17, 2, 6, 0x172831);
      r(x, y - 9, 24, 5, c.wood);
      r(x, y - 9, 24, 1, c.sun);
      for (const wx of [x + 2, x + 19]) {
        r(wx, y - 6, 8, 6, c.ink);
        r(wx + 1, y - 7, 6, 8, c.ink);
        r(wx + 2, y - 5, 4, 4, c.light);
        r(wx + 3, y - 4, 2, 2, c.dark);
      }
    } else if (station.kind === "food") {
      r(x + 1, y - 21, 16, 21, c.dark);
      r(x - 1, y - 18, 20, 15, c.wood);
      r(x + 2, y - 19, 14, 18, c.light);
      for (let sx = x + 4; sx < x + 16; sx += 4) r(sx, y - 18, 1, 17, c.wood);
      r(x, y - 17, 18, 3, 0x46565a);
      r(x, y - 6, 18, 3, 0x46565a);
      r(x + 1, y - 17, 16, 1, 0x90a39b);
      r(x + 1, y - 6, 16, 1, 0x90a39b);
      r(x + 3, y - 21, 12, 3, c.sun);
    } else {
      r(x + 5, y - 22, 10, 6, c.dark);
      r(x + 7, y - 21, 6, 3, c.sun);
      r(x - 1, y - 17, 22, 17, c.dark);
      r(x, y - 16, 20, 14, 0xd6c49c);
      r(x + 2, y - 15, 2, 14, c.light);
      r(x + 16, y - 15, 2, 14, c.light);
      r(x + 8, y - 13, 4, 10, c.paint);
      r(x + 5, y - 10, 10, 4, c.paint);
      r(x, y - 2, 20, 2, c.trim);
    }
  }
}
