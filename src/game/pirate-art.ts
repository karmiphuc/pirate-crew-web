/** Original raster sprites. Integer pixels only; four bounded shared atlases. */
export const PIRATE_FRAMES = {
  idle: ["idle-0", "idle-1", "idle-2"],
  walk: ["walk-0", "walk-1", "walk-2"],
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
) {
  const ink = "#172c36",
    gold = "#d6ae64",
    ivory = "#eee2b3";
  const skin = ["#dfa674", "#c58c61", "#a66c4b"][variant];
  const shade = ["#b97952", "#9c6748", "#80513c"][variant];
  const coat = [
    "#36515e",
    "#a45245",
    "#597b84",
    ["#ddd1a3", "#738068", "#bd9669"][variant],
  ][role];
  const clothShade = ["#263e4b", "#743d38", "#3d596b", "#826f51"][role];
  const hair = variant === 0 ? "#874d38" : "#493a32";
  const pixel = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  // A compact silhouette, with the weight carried by boots rather than splayed toy legs.
  const step = walking ? 2 : 0;
  pixel(ink, 10 - step, 29, 5, 8);
  pixel(ink, 16 + step, 29, 5, 8);
  pixel("#46545b", 11 - step, 30, 3, 4);
  pixel("#344650", 17 + step, 30, 3, 4);
  pixel(ink, 9 - step, 36, 6, 2);
  pixel(ink, 16 + step, 36, 7, 2);
  pixel("#66503d", 10 - step, 35, 4, 2);
  pixel("#66503d", 17 + step, 35, 4, 2);
  pixel(gold, 11 - step, 34, 2);
  pixel(gold, 18 + step, 34, 2);
  // Shoulder, elbows and hems are stepped deliberately on the source grid.
  pixel(ink, 10, 21, 11, 10);
  pixel(ink, 8, 23, 3, 6);
  pixel(ink, 20, 22, 3, 7);
  pixel(ink, 22, 25, 3, 5);
  pixel(coat, 11, 22, 9, 7);
  pixel(coat, 9, 24, 2, 3);
  pixel(coat, 20, 23, 2, 4);
  pixel(clothShade, 10, 28, 11, 2);
  pixel(clothShade, 19, 23, 1, 5);
  pixel(skin, 8, 27, 3, 3);
  pixel(shade, 8, 29, 3);
  pixel(skin, 22, 27, 3, 3);
  pixel(shade, 24, 27, 1, 3);
  if (role === 0) {
    pixel(gold, 11, 22, 1, 7);
    pixel(gold, 19, 22, 1, 7);
    pixel(ivory, 14, 22, 3, 4);
    pixel(gold, 18, 24);
    pixel(gold, 18, 27);
  } else {
    pixel(ivory, 14, 22, 3, 5);
    if (role === 2 || (role === 3 && variant === 1)) {
      pixel(clothShade, 11, 22, 2, 5);
      pixel(clothShade, 18, 22, 2, 5);
    }
  }
  pixel(role === 1 ? "#7b3f38" : "#456b69", 10, 28, 11, 2);
  pixel(gold, 15, 28, 3, 2);
  // Three-quarter face. One-pixel features leave quiet areas instead of rounded outlines.
  pixel(ink, 10, 11, 11, 9);
  pixel(ink, 12, 20, 7, 2);
  pixel(skin, 11, 12, 9, 7);
  pixel(skin, 13, 19, 5, 2);
  pixel(shade, 11, 15, 2, 4);
  pixel(shade, 13, 19, 5);
  pixel(skin, 20, 15, 2, 2);
  pixel(ivory, 17, 13, 2);
  pixel(ink, 15, 14, 1, 2);
  pixel(ink, 19, 14, 1, 2);
  pixel(shade, 18, 16);
  pixel(ink, 17, 18, 2);
  pixel(gold, 10, 17, 1, 2);
  if (role === 0) {
    // Broad tricorn brim, brass trim, tiny feather and a short beard.
    pixel(ink, 9, 5, 4, 3);
    pixel(ink, 15, 4, 5, 4);
    pixel(ink, 20, 6, 3, 3);
    pixel(ink, 7, 8, 17, 3);
    pixel(coat, 10, 6, 3, 2);
    pixel(coat, 16, 5, 3, 3);
    pixel(coat, 20, 7, 2);
    pixel(gold, 8, 9, 15);
    pixel(ink, 9, 10, 13, 2);
    pixel(ivory, 16, 6, 2);
    pixel(ivory, 17, 7);
    pixel("#a45245", 23, 5, 2, 3);
    pixel("#a45245", 24, 4, 2, 2);
    pixel(hair, 12, 18, 3, 3);
    pixel(hair, 14, 20, 5, 2);
    pixel(hair, 18, 19, 2, 2);
  } else if (role === 1) {
    pixel(ink, 10, 7, 9, 4);
    pixel(coat, 10, 8, 9, 3);
    pixel(coat, 8, 10, 14, 2);
    pixel(coat, 7, 11, 3, 4);
    pixel(coat, 6, 14, 2, 3);
    pixel(gold, 11, 9, 7);
    pixel(ink, 18, 14, 3, 2);
    pixel(hair, 13, 19, 7, 2);
    pixel(hair, 15, 21, 4);
  } else if (role === 2) {
    pixel(ink, 11, 7, 9, 4);
    pixel(coat, 11, 8, 8, 3);
    pixel(clothShade, 9, 10, 13, 2);
    pixel(ivory, 10, 10, 11);
    pixel(coat, 21, 11, 3, 3);
    pixel(coat, 23, 13, 2, 3);
    pixel(hair, 14, 19, 4);
  } else if (variant === 0) {
    pixel(ink, 11, 7, 8, 5);
    pixel(hair, 11, 8, 8, 4);
    pixel(hair, 10, 11, 3, 7);
    pixel(hair, 9, 17, 3, 5);
    pixel(hair, 8, 21, 3, 3);
    pixel(gold, 11, 10, 9);
    pixel(skin, 14, 11, 6, 2);
  } else {
    pixel(ink, 11, 7, 8, 5);
    pixel(hair, 11, 8, 8, 3);
    pixel(hair, 9, 10, 3, 3);
    pixel(hair, 19, 9, 3, 3);
    const scarf = variant === 1 ? "#7b8f72" : "#537884";
    pixel(scarf, 10, 11, 12, 2);
    pixel(scarf, 8, 12, 3, 3);
    pixel(scarf, 7, 14, 2, 3);
  }
  if (role === 2) {
    pixel(ink, 24, 24, 7, 3);
    pixel("#9cb1ac", 25, 24, 5);
    pixel("#66503d", 25, 27, 2, 3);
    pixel(ink, 30, 24, 2, 2);
  } else {
    // Cutlass follows a pixel staircase, with a bright edge and a dark back.
    pixel(ink, 25, 23, 2, 6);
    pixel(ink, 26, 20, 2, 4);
    pixel(ink, 27, 17, 2, 4);
    pixel(ink, 28, 15, 2, 3);
    pixel("#9cb1ac", 26, 24, 1, 3);
    pixel("#9cb1ac", 27, 21, 1, 3);
    pixel(ivory, 28, 18, 1, 3);
    pixel(ivory, 29, 15, 1, 3);
    pixel(gold, 23, 28, 6);
    pixel("#66503d", 25, 29, 2, 2);
  }
}
