/** Original Image Gen character art, adapted once to bounded, hard-edge pixel atlases. */
export const PIRATE_WIDTH = 40;
export const PIRATE_HEIGHT = 56;
export const PIRATE_VARIANTS = 3;
export const PIRATE_FRAMES = {
  idle: ["idle-0", "idle-1", "idle-2"],
  walk: ["walk-0", "walk-1", "walk-2"],
  blink: ["blink-0", "blink-1", "blink-2"],
  ready: ["ready-0", "ready-1", "ready-2"],
  attack: ["attack-0", "attack-1", "attack-2"],
} as const;
export type PirateFrame = keyof typeof PIRATE_FRAMES;
const NAMED_VARIANTS: Readonly<Record<string, number>> = {
  "Molly Flint": 0,
  "Red Anne": 0,
  "Old Salt": 1,
  "Pegleg Pete": 2,
  Bonny: 0,
};
export function pirateVariant(pirate: {
  id: number;
  role: string;
  name?: string;
}): number {
  return pirate.role === "captain"
    ? 0
    : ((pirate.name ? NAMED_VARIANTS[pirate.name] : undefined) ??
        (pirate.id + 1) % PIRATE_VARIANTS);
}
export function characterIndex(role: number, variant: number): number {
  return role === 0 ? 0 : role === 1 ? 5 : role === 2 ? 4 : variant + 1;
}
export const HAND_ANCHORS = [
  [32, 38],
  [32, 38],
  [30, 38],
  [29, 38],
  [33, 38],
  [31, 38],
] as const;
export function pirateCharacter(pirate: {
  id: number;
  role: string;
  side?: string;
  name?: string;
}): number {
  return pirate.side === "enemy"
    ? 5
    : pirate.role === "captain"
      ? 0
      : pirate.role === "gunner"
        ? 4
        : pirateVariant(pirate) + 1;
}
const CROPS = [
  [18, 64, 338, 622],
  [372, 124, 340, 563],
  [746, 128, 305, 562],
  [1110, 121, 286, 566],
  [1449, 131, 362, 558],
  [1813, 131, 324, 557],
] as const;
const PALETTE = [
  "#192333",
  "#303346",
  "#454353",
  "#304560",
  "#456981",
  "#7392a4",
  "#8d6438",
  "#c79346",
  "#e9bf68",
  "#8d563e",
  "#bf7b53",
  "#eaa276",
  "#ffd1a1",
  "#ffe1b0",
  "#e5af79",
  "#f8c58e",
  "#ffe2b2",
  "#b7aa84",
  "#e5d5a4",
  "#fff0c8",
  "#513b32",
  "#815035",
  "#b76533",
  "#d98447",
  "#e7a264",
  "#743345",
  "#a44849",
  "#ce6654",
  "#ee9273",
  "#445340",
  "#74825b",
  "#a3aa69",
  "#305761",
  "#507e88",
  "#87afb1",
  "#3e424b",
  "#5c6060",
  "#3c2e2c",
].map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]);
/** Six local canvases exist only during shared-atlas creation, then become unreachable. */
export function prepareCharacters(
  image: CanvasImageSource,
): HTMLCanvasElement[] {
  return CROPS.map(([sx, sy, sw, sh], index) => {
    const canvas = document.createElement("canvas");
    canvas.width = PIRATE_WIDTH;
    canvas.height = PIRATE_HEIGHT;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    const height = index === 0 ? 52 : 50,
      width = Math.round((sw * height) / sh),
      left = Math.floor((PIRATE_WIDTH - width) / 2);
    ctx.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      left,
      PIRATE_HEIGHT - 2 - height,
      width,
      height,
    );
    const raster = ctx.getImageData(0, 0, PIRATE_WIDTH, PIRATE_HEIGHT),
      data = raster.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 160) {
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
        continue;
      }
      let best = PALETTE[0],
        distance = Infinity;
      for (const color of PALETTE) {
        const dr = data[i] - color[0],
          dg = data[i + 1] - color[1],
          db = data[i + 2] - color[2],
          d = dr * dr + dg * dg + db * db;
        if (d < distance) {
          best = color;
          distance = d;
        }
      }
      data[i] = best[0];
      data[i + 1] = best[1];
      data[i + 2] = best[2];
      data[i + 3] = 255;
    }
    ctx.putImageData(raster, 0, 0);
    return canvas;
  });
}
// Eye marks and costume tones are specific to the six original designs.
const EYES = [
  [24, 28, 19],
  [25, 29, 18],
  [23, 27, 17],
  [22, 27, 17],
  [21, 26, 16],
  [24, null, 16],
] as const;
const CHEEKS = [
  [26, 21],
  [27, 21],
  [25, 20],
  [25, 20],
  [24, 18],
  [26, 19],
] as const;
const SKIN = ["#f8c58e", "#f8c58e", "#f8c58e", "#bf7b53", "#f8c58e", "#f8c58e"];
const SLEEVES = [
  "#304560",
  "#e5d5a4",
  "#e5d5a4",
  "#e5d5a4",
  "#e5d5a4",
  "#e5d5a4",
];
export function paintPirate(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  character: number,
  frame: PirateFrame,
) {
  const walking = frame === "walk";
  ctx.drawImage(source, 0, walking ? 1 : 0);
  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  if (walking) {
    // Lift the forward boot, retaining the shared foot baseline and frame bounds.
    ctx.clearRect(21, 46, 16, 10);
    ctx.drawImage(source, 21, 45, 16, 10, 22, 44, 16, 10);
  } else if (frame === "blink") {
    const [left, right, y] = EYES[character],
      [cx, cy] = CHEEKS[character];
    const color = source.getContext("2d")!.getImageData(cx, cy, 1, 1).data;
    const skin = `rgb(${color[0]},${color[1]},${color[2]})`;
    for (const x of [left, right])
      if (x !== null) {
        px(skin, x, y, 2, 3);
        px("#303346", x, y + 1, 2);
      }
  } else if (frame === "ready" || frame === "attack") {
    const [handX] = HAND_ANCHORS[character];
    ctx.clearRect(handX - 1, 35, PIRATE_WIDTH - handX + 1, 8);
    if (frame === "ready") {
      px("#192333", 28, 33, 5, 8);
      px(SLEEVES[character], 29, 34, 3, 6);
      px("#192333", 31, 32, 5, 5);
      px(SKIN[character], 32, 33, 3, 3);
    } else {
      px("#192333", 28, 34, 9, 5);
      px(SLEEVES[character], 29, 35, 6, 3);
      px("#192333", 35, 34, 5, 5);
      px(SKIN[character], 36, 35, 3, 3);
    }
  }
}
