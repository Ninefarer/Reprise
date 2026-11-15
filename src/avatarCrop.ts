export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

// Move the image with the pointer, converting display pixels to crop percentages.
export function panCrop(
  position: number,
  delta: number,
  imageSize: number,
  cropSize: number,
  displaySize: number,
) {
  const travel = imageSize - cropSize;
  return travel <= 0 || displaySize <= 0
    ? position
    : clamp(
        position - (delta * cropSize * 100) / (displaySize * travel),
        0,
        100,
      );
}
