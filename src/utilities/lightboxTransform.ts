/**
 * Pure zoom/pan math for ImageLightbox, extracted so it can be unit-tested
 * without mounting the component (viewport dimensions are passed in
 * explicitly instead of read from a DOM ref).
 */

export type LightboxTransform = { zoom: number; x: number; y: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.5;

export const INITIAL_TRANSFORM: LightboxTransform = {
  zoom: MIN_ZOOM,
  x: 0,
  y: 0,
};

/**
 * Soft clamp: the pan offset can never push the image fully out of the
 * viewport (translate happens before scale, so limits are in layout pixels),
 * and panning resets to center once zoomed back out to 1x.
 */
export const clampTransform = (
  next: LightboxTransform,
  viewportWidth: number,
  viewportHeight: number,
): LightboxTransform => {
  if (next.zoom <= MIN_ZOOM) return { ...next, x: 0, y: 0 };
  const maxX = (viewportWidth * (next.zoom - 1)) / 2;
  const maxY = (viewportHeight * (next.zoom - 1)) / 2;
  return {
    ...next,
    x: Math.min(maxX, Math.max(-maxX, next.x)),
    y: Math.min(maxY, Math.max(-maxY, next.y)),
  };
};

/** Applies a zoom delta (clamped to [MIN_ZOOM, MAX_ZOOM]) and re-clamps pan. */
export const zoomBy = (
  prev: LightboxTransform,
  delta: number,
  viewportWidth: number,
  viewportHeight: number,
): LightboxTransform => {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom + delta));
  return clampTransform({ ...prev, zoom }, viewportWidth, viewportHeight);
};

/** Sets an absolute zoom level (clamped) and re-clamps pan, used by pinch. */
export const zoomTo = (
  prev: LightboxTransform,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
): LightboxTransform => {
  const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  return clampTransform({ ...prev, zoom: clampedZoom }, viewportWidth, viewportHeight);
};
