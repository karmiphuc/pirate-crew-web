import { expect, it } from "vitest";
import { facingLeft } from "../src/game/facing";

it("keeps the last facing through stops, vertical travel and interpolation noise", () => {
  for (const left of [true, false]) {
    expect(facingLeft(left, 0)).toBe(left);
    expect(facingLeft(left, 0.00001)).toBe(left);
    expect(facingLeft(left, 0, 0)).toBe(left);
  }
});

it("turns toward horizontal travel, then a living target when stationary", () => {
  expect(facingLeft(false, -0.2, 10)).toBe(true);
  expect(facingLeft(true, 0.2, -10)).toBe(false);
  expect(facingLeft(false, 0, -32)).toBe(true);
  expect(facingLeft(true, 0, 32)).toBe(false);
});
