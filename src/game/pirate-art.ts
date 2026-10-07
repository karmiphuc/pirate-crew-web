/** Original raster sprites. Integer pixels only; four bounded shared atlases. */
export const PIRATE_FRAMES = {
  idle: ["idle-0", "idle-1", "idle-2"],
  walk: ["walk-0", "walk-1", "walk-2"],
  blink: ["blink-0", "blink-1", "blink-2"],
} as const;
export const PIRATE_VARIANTS = PIRATE_FRAMES.idle.length;
export function pirateVariant(pirate: { id: number; role: string }): number {
  return pirate.role === "captain" ? 0 : (pirate.id + 1) % PIRATE_VARIANTS;
}
export function paintPirate(
  ctx: CanvasRenderingContext2D,
  role: number,
  walking: boolean,
  variant = 0,
  blinking = false,
) {
  const ink = "#293b43",
    gold = "#e2bc73",
    ivory = "#f5e7bd";
  const skin = ["#efbd91", "#dca57a", "#b9815c"][variant];
  const shade = ["#cf946e", "#bc815d", "#956244"][variant];
  const blush = variant === 2 ? "#ca8b72" : "#e49b89";
  const coat = [
    "#547889",
    "#c97868",
    "#7da4a3",
    ["#efdfa9", "#9eae83", "#d5b18a"][variant],
  ][role];
  const clothShade = ["#3b596a", "#98564e", "#567c80", "#a58b63"][role];
  const hair = variant === 0 ? "#a56443" : "#65503f";
  const pixel = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  ctx.save();
  ctx.translate(0, walking ? 1 : 0);
  // Short, planted feet and a soft coat silhouette balance a large expressive head.
  const step = walking ? 1 : 0;
  pixel(ink, 11 - step, 32, 5, 6);
  pixel(ink, 18 + step, 32, 5, 6);
  pixel("#617079", 12 - step, 33, 3, 2);
  pixel("#617079", 19 + step, 33, 3, 2);
  pixel("#806346", 10 - step, 36, 6, 2);
  pixel("#806346", 18 + step, 36, 6, 2);
  pixel(gold, 12 - step, 35, 2);
  pixel(gold, 20 + step, 35, 2);
  pixel(ink, 12, 24, 10, 9);
  pixel(ink, 10, 26, 14, 6);
  pixel(coat, 12, 25, 10, 6);
  pixel(coat, 11, 27, 12, 4);
  pixel(clothShade, 12, 31, 10);
  pixel(ink, 8, 27, 3, 5);
  pixel(coat, 9, 27, 3, 3);
  pixel(skin, 9, 30, 3, 2);
  pixel(ink, 23, 27, 3, 5);
  pixel(coat, 22, 27, 3, 3);
  pixel(skin, 23, 30, 3, 2);
  pixel(ivory, 16, 25, 3, 5);
  if (role === 0) {
    pixel(gold, 13, 25, 1, 6);
    pixel(gold, 21, 25, 1, 6);
    pixel(gold, 20, 27);
    pixel(gold, 20, 29);
  } else if (role === 2 || (role === 3 && variant === 1)) {
    pixel(clothShade, 13, 25, 2, 5);
    pixel(clothShade, 20, 25, 2, 5);
  }
  pixel(role === 1 ? "#ac6258" : "#6a938c", 11, 30, 12, 2);
  pixel(gold, 16, 30, 3, 2);
  // Stepped cheeks and jaw: round in silhouette, still strictly whole raster pixels.
  pixel(ink, 11, 9, 10, 1);
  pixel(ink, 9, 10, 14, 2);
  pixel(ink, 8, 13, 16, 8);
  pixel(ink, 9, 12, 14, 10);
  pixel(ink, 11, 22, 10, 2);
  pixel(ink, 13, 24, 6, 1);
  pixel(skin, 11, 10, 10, 2);
  pixel(skin, 10, 12, 12, 9);
  pixel(skin, 9, 14, 14, 6);
  pixel(skin, 12, 21, 8, 2);
  pixel(skin, 14, 23, 4, 2);
  pixel(shade, 9, 17, 1, 4);
  pixel(shade, 12, 22, 8);
  pixel(skin, 7, 16, 2, 4);
  pixel(shade, 7, 18, 1, 2);
  // Open eyes, tiny glints, rosy cheeks and a small smile replace the stiff side profile.
  if (blinking) {
    pixel(ink, 12, 17, 3);
    pixel(ink, 19, 17, 3);
  } else {
    pixel(ink, 12, 15, 3, 3);
    pixel(ink, 19, 15, 3, 3);
    pixel(ink, 13, 18, 2);
    pixel(ink, 19, 18, 2);
    pixel(ivory, 13, 15);
    pixel(ivory, 20, 15);
  }
  pixel(blush, 10, 19, 3);
  pixel(blush, 20, 19, 2);
  pixel(shade, 16, 18);
  pixel(shade, 15, 20);
  pixel(shade, 18, 20);
  pixel(ink, 16, 21, 2);
  pixel(gold, 7, 19, 1, 2);
  if (role === 0) {
    // A broad little tricorn and tiny feather keep the captain recognisable without a stern face.
    pixel(ink, 8, 5, 5, 4);
    pixel(ink, 14, 3, 6, 6);
    pixel(ink, 21, 5, 5, 4);
    pixel(ink, 5, 9, 23, 3);
    pixel(coat, 9, 6, 4, 3);
    pixel(coat, 15, 4, 4, 5);
    pixel(coat, 21, 6, 4, 3);
    pixel(gold, 6, 10, 21);
    pixel(ivory, 16, 6, 2, 2);
    pixel(ink, 17, 7);
    pixel("#d68b76", 26, 5, 2, 4);
    pixel("#d68b76", 27, 3, 2, 3);
    pixel(hair, 12, 22, 3);
    pixel(hair, 18, 22, 3);
    pixel(hair, 14, 23, 5);
  } else if (role === 1) {
    pixel(ink, 11, 7, 10, 4);
    pixel(coat, 11, 8, 10, 3);
    pixel(coat, 8, 10, 16, 3);
    pixel(gold, 10, 10, 12);
    pixel(coat, 6, 11, 3, 4);
    pixel(coat, 5, 14, 2, 3);
    pixel(ink, 18, 15, 4, 4);
    pixel(ink, 21, 14, 2);
    pixel(hair, 13, 23, 7);
  } else if (role === 2) {
    pixel(ink, 11, 7, 10, 4);
    pixel(coat, 11, 8, 10, 3);
    pixel(clothShade, 8, 10, 16, 3);
    pixel(ivory, 9, 10, 14);
    pixel(coat, 23, 11, 3, 3);
    pixel(coat, 25, 13, 2, 3);
  } else if (variant === 0) {
    pixel(ink, 11, 7, 10, 3);
    pixel(hair, 11, 8, 10, 3);
    pixel(hair, 9, 10, 4, 4);
    pixel(hair, 8, 13, 2, 6);
    pixel(hair, 8, 20, 3, 4);
    pixel(hair, 7, 23, 3, 3);
    pixel(gold, 11, 10, 11);
    pixel(skin, 14, 11, 7, 2);
  } else {
    pixel(ink, 11, 7, 10, 4);
    pixel(hair, 11, 8, 10, 3);
    pixel(hair, 9, 9, 3, 3);
    pixel(hair, 20, 9, 3, 3);
    const scarf = variant === 1 ? "#a8b68a" : "#83a6b2";
    pixel(scarf, 9, 11, 15, 2);
    pixel(scarf, 7, 12, 3, 3);
    pixel(scarf, 6, 14, 2, 3);
  }
  if (role === 2) {
    pixel(ink, 25, 28, 6, 3);
    pixel("#b8c9bc", 26, 28, 4);
    pixel("#806346", 25, 31, 2, 2);
  } else {
    pixel(ink, 26, 27, 2, 4);
    pixel(ink, 27, 24, 2, 4);
    pixel(ink, 28, 22, 2, 3);
    pixel("#b8c9bc", 27, 28, 1, 3);
    pixel(ivory, 28, 25, 1, 3);
    pixel(ivory, 29, 22, 1, 3);
    pixel(gold, 24, 31, 6);
    pixel("#806346", 26, 32, 2, 2);
  }
  ctx.restore();
}
