/** Horizontal movement/targets turn crew. Climbing never forces a right-facing reset. */
export function facingLeft(
  previous: boolean,
  horizontalDelta: number,
  targetDelta?: number,
) {
  if (Math.abs(horizontalDelta) > 0.001) return horizontalDelta < 0;
  if (targetDelta !== undefined && Math.abs(targetDelta) > 0.001)
    return targetDelta < 0;
  return previous;
}
