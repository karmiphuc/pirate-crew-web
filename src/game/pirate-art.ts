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
  const ink = "#282c38",
    gold = "#ddb765",
    ivory = "#fff0c6";
  const skin = ["#f1bf8e", "#dca277", "#b9805e"][variant];
  const shade = ["#c88760", "#ad7052", "#87513e"][variant];
  const hair = ["#85513b", "#574238", "#443a37"][variant];
  const hairLight = ["#b57646", "#806044", "#76604a"][variant];
  const coat = [
    "#416a8a",
    "#b95352",
    "#458d87",
    ["#855969", "#819156", "#577b91"][variant],
  ][role];
  const coatLight = [
    "#7295ab",
    "#e1896b",
    "#78b9aa",
    ["#b7828c", "#b4bc7f", "#86b0bf"][variant],
  ][role];
  const coatShade = [
    "#30485f",
    "#803d45",
    "#326363",
    ["#513b50", "#566441", "#354f69"][variant],
  ][role];
  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  ctx.save();
  ctx.translate(0, walking ? 1 : 0);
  // A short asymmetric stride: one planted boot, one lifted heel, rather than a split-legged block.
  px(ink, 12, 32, 4, 6);
  px(ink, 18, 32, 4, walking ? 4 : 6);
  px("#66737a", 13, 32, 2, 3);
  px("#66737a", 19, 32, 2, 2);
  px(ink, 11, 36, 6, 3);
  px(ink, walking ? 20 : 18, walking ? 35 : 36, 5, 3);
  px("#77543c", 12, 36, 4, 2);
  px("#77543c", walking ? 21 : 19, walking ? 35 : 36, 3, 2);
  px(gold, 13, 36, 1);
  px(gold, walking ? 21 : 19, walking ? 35 : 36, 1);
  // Narrow coat, fitted shoulders, offset lapels and a small diagonal sash.
  px(ink, 13, 24, 7, 1);
  px(ink, 11, 25, 12, 6);
  px(ink, 12, 31, 10, 3);
  px(coat, 12, 25, 10, 7);
  px(coatShade, 12, 30, 2, 3);
  px(coatShade, 20, 27, 2, 6);
  px(coatLight, 12, 25, 2, 3);
  px(ivory, 16, 25, 3, 5);
  px("#d0b893", 17, 29, 2);
  px(ink, 9, 26, 3, 5);
  px(coat, 10, 26, 2, 3);
  px(coatLight, 10, 26);
  px(skin, 10, 29, 2, 2);
  px(shade, 10, 31, 2);
  px(ink, 22, 26, 4, 5);
  px(coat, 22, 27, 3, 2);
  px(coatLight, 23, 27, 2);
  px(skin, 23, 29, 3, 2);
  px(shade, 24, 31, 2);
  px(coatShade, 12, 31, 10);
  px(ink, 12, 32, 10);
  px(role === 1 ? "#655d64" : "#784b3b", 12, 30, 10);
  px(gold, 17, 30, 2, 2);
  px(ivory, 17, 30);
  if (role === 0) {
    px(gold, 14, 25, 1, 5);
    px(gold, 20, 26, 1, 4);
    px(coatShade, 19, 32, 3);
    px(ink, 10, 31, 3, 4);
    px(coat, 11, 31, 2, 3);
    px(gold, 11, 33);
    px(ink, 21, 31, 3, 4);
    px(coatShade, 21, 31, 2, 3);
    px(gold, 21, 33);
  } else {
    px(coatShade, 14, 25, 1, 2);
    px(coatShade, 20, 25, 1, 2);
  }
  if (role === 2) {
    // Rolled sleeves and a leather cross-body strap give the gunner a working silhouette.
    px(ivory, 10, 27, 2, 2);
    px(ivory, 23, 27, 2, 2);
    px("#77543c", 13, 25, 2);
    px("#77543c", 15, 26, 2);
    px("#77543c", 17, 27, 2);
    px("#77543c", 19, 28, 2);
    px(gold, 17, 27);
  } else if (role === 3 && variant === 0) {
    // Cream blouse under a plum waistcoat; gathered sleeve, open V neck and red neckerchief.
    px(ivory, 10, 26, 2, 3);
    px(ivory, 22, 26, 3, 3);
    px(coat, 13, 26, 2, 4);
    px(coatShade, 20, 26, 2, 4);
    px(ivory, 16, 25, 4, 2);
    px("#bc5d4d", 17, 25, 3);
    px("#bc5d4d", 18, 26, 2);
    px(coatLight, 14, 28);
    px(gold, 20, 29);
  } else if (role === 3 && variant === 1) {
    // Olive sleeveless vest and a cream collar.
    px(ivory, 10, 26, 2, 3);
    px(ivory, 23, 27, 2, 2);
    px(coatShade, 14, 26, 2, 4);
    px(coatShade, 20, 26, 2, 4);
    px(gold, 20, 27);
    px(gold, 20, 29);
  } else if (role === 3) {
    // Blue sailor stripes and brown suspenders keep this costume distinct from a vest.
    px(ivory, 12, 26, 10);
    px(ivory, 12, 28, 10);
    px(coatLight, 12, 27, 10);
    px("#77543c", 14, 25, 1, 5);
    px("#77543c", 20, 25, 1, 5);
    px(ivory, 10, 27, 2);
    px(ivory, 23, 27, 2);
  }
  // Compact three-quarter head: hair at the back, light on the nose, tiny eyes, tapered chin.
  px(ink, 13, 12, 8);
  px(ink, 11, 13, 12, 2);
  px(ink, 10, 15, 14, 6);
  px(ink, 11, 21, 12, 2);
  px(ink, 13, 23, 8);
  px(ink, 15, 24, 5);
  px(skin, 13, 14, 9, 8);
  px(skin, 12, 16, 11, 5);
  px(skin, 14, 22, 7);
  px(shade, 12, 19, 1, 3);
  px(shade, 14, 22, 3);
  px(skin, 16, 23, 3, 2);
  px(skin, 23, 18, 2, 2);
  px(ivory, 22, 18);
  px(shade, 23, 20);
  px(hair, 11, 14, 3, 4);
  px(hairLight, 12, 14, 2, 2);
  px(hair, 11, 18, 2, 3);
  px(skin, 10, 18, 2, 3);
  px(shade, 10, 20);
  px(gold, 10, 21);
  px(hair, 16, 16, 2);
  px(hair, 21, 16, 2);
  if (blinking) {
    px(ink, 16, 18, 2);
    px(ink, 21, 18, 2);
  } else {
    px(ink, 17, 17, 1, 2);
    px(ink, 22, 17, 1, 2);
  }
  px("#d28c75", 15, 20);
  px(shade, 21, 21);
  px(shade, 19, 22);
  if (role === 0) {
    // Curved stepped tricorn: raised middle, sloping brim ends, no castle-like towers.
    px(ink, 15, 7, 5);
    px(ink, 12, 8, 10);
    px(ink, 10, 9, 13);
    px(ink, 8, 10, 17);
    px(ink, 6, 11, 21);
    px(ink, 7, 12, 20);
    px(ink, 9, 13, 16);
    px(coatShade, 15, 8, 5);
    px(coat, 13, 9, 8, 2);
    px(coatLight, 15, 9, 4);
    px(coat, 8, 11, 17);
    px(gold, 8, 12, 17);
    px(gold, 6, 10, 2);
    px(gold, 25, 10, 2);
    px(ivory, 16, 10, 2);
    px(ink, 17, 10);
    px("#e59879", 25, 8, 2, 2);
    px("#e59879", 26, 6, 2, 2);
    px(ivory, 27, 5);
    px(ivory, 26, 7);
    px(hair, 15, 22, 2);
    px(hair, 19, 23, 2);
    px(hair, 17, 24, 3);
    px(hairLight, 18, 24);
  } else if (role === 1) {
    // Wrapped scarf with a stepped knot and loose tail; the patch stays independent of the eyes.
    px(ink, 13, 10, 9);
    px(ink, 11, 11, 13);
    px(coat, 13, 11, 9);
    px(coatLight, 14, 11, 5);
    px(coat, 11, 12, 13, 3);
    px(coatShade, 11, 14, 13);
    px(gold, 15, 12, 6);
    px(coat, 9, 13, 3, 3);
    px(coatShade, 8, 16, 2, 3);
    px(coat, 7, 18, 2);
    px(ink, 21, 17, 3, 3);
    px(ink, 19, 16, 2);
    px(hair, 16, 23, 5);
    px(hairLight, 17, 23, 2);
  } else if (role === 2) {
    px(ink, 13, 10, 8);
    px(ink, 11, 11, 12);
    px(coatLight, 13, 11, 8);
    px(coat, 11, 12, 12, 3);
    px(ivory, 11, 13, 12);
    px(coatShade, 10, 14, 14);
    px(coat, 23, 13, 2, 2);
    px(coatShade, 24, 15, 2, 2);
  } else if (variant === 0) {
    // Tousled fringe and a small ponytail, with a loose end instead of a square hair curtain.
    px(ink, 14, 10, 4);
    px(ink, 12, 11, 9);
    px(hair, 14, 11, 5);
    px(hair, 12, 12, 10, 3);
    px(hairLight, 14, 12, 4);
    px(hair, 11, 14, 3, 7);
    px(hair, 14, 14, 3, 2);
    px(hair, 18, 14, 3);
    px(ink, 9, 20, 2, 3);
    px(hair, 8, 22, 3, 3);
    px(hair, 7, 25, 3, 2);
    px(hairLight, 8, 23, 1, 2);
    px(gold, 10, 21);
    px(skin, 18, 15, 3);
  } else {
    px(ink, 15, 9, 4);
    px(ink, 12, 10, 10);
    px(hair, 15, 10, 4);
    px(hair, 12, 11, 10, 3);
    px(hairLight, 13, 11, 4);
    px(hair, 11, 13, 3, 3);
    px(hair, 20, 13, 2);
    const scarf = variant === 1 ? "#98ad70" : "#81b8b2";
    px(scarf, 11, 13, 13, 2);
    px(ivory, 14, 13, 6);
    px(coatShade, 11, 15, 3);
    px(scarf, 9, 14, 3, 3);
    px(scarf, 8, 17, 2, 2);
    px(scarf, 7, 19, 2);
  }
  ctx.restore();
}
