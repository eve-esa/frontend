import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faChevronLeft,
  faChevronRight,
  faCompress,
  faExpand,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
} from "@fortawesome/free-solid-svg-icons";
import { Dialog, DialogContent, DialogTitle } from "./Dialog";
import { AuthenticatedImage } from "./AuthenticatedImage";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import {
  INITIAL_TRANSFORM,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  clampTransform,
  zoomBy as zoomByTransform,
  zoomTo as zoomToTransform,
  type LightboxTransform,
} from "@/utilities/lightboxTransform";

export type LightboxImage = { src: string; alt?: string; title?: string };

type ImageLightboxProps = {
  images: LightboxImage[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Squared pointer distance, used to compare pinch spans without a sqrt on
// every pointermove.
const distanceSq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/**
 * Full-size preview of an image, reusing the shared Radix Dialog wrapper.
 * Accepts a list of images plus the index the user clicked, and renders a
 * single shared instance with prev/next navigation (hidden for a single
 * image). Supports mouse-wheel / button / double-click / pinch zoom (1x-4x),
 * drag-to-pan when zoomed in, keyboard navigation, and fullscreen.
 */
export const ImageLightbox = ({
  images,
  initialIndex = 0,
  open,
  onOpenChange,
}: ImageLightboxProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [transform, setTransform] = useState<LightboxTransform>(
    INITIAL_TRANSFORM,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Held in state (not just a ref) because Radix mounts the dialog content a
  // commit after `open` flips true; the wheel-listener effect must re-run once
  // the viewport element actually exists.
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const [fullscreenRootEl, setFullscreenRootEl] = useState<HTMLDivElement | null>(
    null,
  );
  // Pointer position of the drag start, in image-offset coordinates.
  const dragOriginRef = useRef({ x: 0, y: 0 });
  // Active pointers for best-effort pinch-zoom, keyed by pointerId.
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ distanceSq: number; zoom: number } | null>(
    null,
  );

  const hasMultiple = images.length > 1;
  const current = images[Math.min(currentIndex, images.length - 1)];
  const isZoomed = transform.zoom > MIN_ZOOM;

  const clamp = useCallback(
    (next: LightboxTransform): LightboxTransform => {
      if (!viewportEl) return { ...next, x: 0, y: 0 };
      return clampTransform(next, viewportEl.clientWidth, viewportEl.clientHeight);
    },
    [viewportEl],
  );

  const zoomBy = useCallback(
    (delta: number) => {
      setTransform((prev) => {
        if (!viewportEl) return prev;
        return zoomByTransform(
          prev,
          delta,
          viewportEl.clientWidth,
          viewportEl.clientHeight,
        );
      });
    },
    [viewportEl],
  );

  const zoomTo = useCallback(
    (zoom: number) => {
      setTransform((prev) => {
        if (!viewportEl) return prev;
        return zoomToTransform(
          prev,
          zoom,
          viewportEl.clientWidth,
          viewportEl.clientHeight,
        );
      });
    },
    [viewportEl],
  );

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  // Reset the index whenever the lightbox opens on a (possibly different)
  // image, and reset zoom/pan whenever it closes, opens, or the displayed
  // image changes (nav or reopen).
  useEffect(() => {
    if (open) setCurrentIndex(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    setTransform(INITIAL_TRANSFORM);
    setIsDragging(false);
  }, [open, current?.src]);

  // React registers wheel listeners as passive, which makes preventDefault a
  // no-op; attach a native non-passive listener so zooming never scrolls the
  // page behind the dialog.
  useEffect(() => {
    if (!viewportEl) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    };
    viewportEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewportEl.removeEventListener("wheel", handleWheel);
  }, [viewportEl, zoomBy]);

  // Keyboard navigation/zoom while the lightbox is open. Gated on `open`
  // (rather than attached unconditionally) so it never leaks a listener once
  // the dialog is closed; Escape is already handled by Radix Dialog.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          if (hasMultiple) {
            event.preventDefault();
            goPrev();
          }
          break;
        case "ArrowRight":
          if (hasMultiple) {
            event.preventDefault();
            goNext();
          }
          break;
        case "+":
        case "=":
          event.preventDefault();
          zoomBy(ZOOM_STEP);
          break;
        case "-":
          event.preventDefault();
          zoomBy(-ZOOM_STEP);
          break;
        case "0":
          event.preventDefault();
          setTransform(INITIAL_TRANSFORM);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, hasMultiple, goPrev, goNext, zoomBy]);

  // Track fullscreen state from the browser (also flips back on Escape,
  // which the browser handles itself for fullscreen).
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!fullscreenRootEl) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {
        // Some browsers (Safari on iOS) don't support the Fullscreen API;
        // no-op rather than surfacing an error to the user.
      });
    } else {
      fullscreenRootEl.requestFullscreen?.().catch(() => {
        // Same as above: graceful no-op where unsupported.
      });
    }
  }, [fullscreenRootEl]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some pointer sequences (stylus/trackpad edge cases) can reference an
      // already-released pointerId; dragging/pinch still work without capture.
    }
    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (activePointersRef.current.size === 2) {
      // A second finger landed: switch from drag to pinch-zoom.
      setIsDragging(false);
      const points = [...activePointersRef.current.values()];
      pinchStartRef.current = {
        distanceSq: distanceSq(points[0], points[1]),
        zoom: transform.zoom,
      };
      return;
    }

    if (!isZoomed) return;
    event.preventDefault();
    dragOriginRef.current = {
      x: event.clientX - transform.x,
      y: event.clientY - transform.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (activePointersRef.current.size === 2 && pinchStartRef.current) {
      event.preventDefault();
      const points = [...activePointersRef.current.values()];
      const ratio = Math.sqrt(
        distanceSq(points[0], points[1]) / (pinchStartRef.current.distanceSq || 1),
      );
      zoomTo(pinchStartRef.current.zoom * ratio);
      return;
    }

    if (!isDragging) return;
    const origin = dragOriginRef.current;
    setTransform((prev) =>
      clamp({
        ...prev,
        x: event.clientX - origin.x,
        y: event.clientY - origin.y,
      }),
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    setIsDragging(false);
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="image-lightbox"
        className="w-fit max-w-[92vw] sm:max-w-[92vw] border-0 bg-transparent p-2 shadow-none"
      >
        <DialogTitle className="sr-only">
          {current.alt || "Image preview"}
        </DialogTitle>
        {/* In fullscreen the wrapper is stretched to the whole screen, so it
            must center its content (otherwise the image sits top-left). */}
        <div
          ref={setFullscreenRootEl}
          className={cn(
            "relative",
            isFullscreen &&
              "flex h-full w-full items-center justify-center bg-natural-1000",
          )}
        >
          <div
            ref={setViewportEl}
            className={cn(
              "overflow-hidden rounded-lg touch-none select-none",
              isZoomed
                ? isDragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-zoom-in",
            )}
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              event.stopPropagation();
              setTransform((prev) =>
                prev.zoom > MIN_ZOOM
                  ? INITIAL_TRANSFORM
                  : { zoom: 2, x: 0, y: 0 },
              );
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDragStart={(event) => event.preventDefault()}
          >
            <div
              className={cn(
                "origin-center will-change-transform",
                !isDragging && "transition-transform duration-200 ease-out",
              )}
              style={{
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
              }}
            >
              <AuthenticatedImage
                src={current.src}
                alt={current.alt}
                className={cn(
                  "w-auto max-w-full rounded-lg object-contain",
                  isFullscreen ? "max-h-screen" : "max-h-[85vh]",
                )}
              />
            </div>
          </div>

          {hasMultiple && (
            <>
              <Button
                type="button"
                variant="icon"
                size="sm"
                data-testid="lightbox-prev"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation();
                  goPrev();
                }}
                className="absolute left-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 cursor-pointer p-0 text-natural-50"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="size-4" />
              </Button>
              <Button
                type="button"
                variant="icon"
                size="sm"
                data-testid="lightbox-next"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation();
                  goNext();
                }}
                className="absolute right-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 cursor-pointer p-0 text-natural-50"
              >
                <FontAwesomeIcon icon={faChevronRight} className="size-4" />
              </Button>
            </>
          )}

          <div
            className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-natural-1000/65 p-1 backdrop-blur-[2px]"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <Button
              type="button"
              variant="icon"
              size="sm"
              data-testid="lightbox-zoom-out"
              aria-label="Zoom out"
              disabled={transform.zoom <= MIN_ZOOM}
              onClick={() => zoomBy(-ZOOM_STEP)}
              className="h-8 w-8 p-0 cursor-pointer text-natural-50"
            >
              <FontAwesomeIcon icon={faMagnifyingGlassMinus} className="size-4" />
            </Button>
            <Button
              type="button"
              variant="icon"
              size="sm"
              data-testid="lightbox-zoom-in"
              aria-label="Zoom in"
              disabled={transform.zoom >= MAX_ZOOM}
              onClick={() => zoomBy(ZOOM_STEP)}
              className="h-8 w-8 p-0 cursor-pointer text-natural-50"
            >
              <FontAwesomeIcon icon={faMagnifyingGlassPlus} className="size-4" />
            </Button>
            <Button
              type="button"
              variant="icon"
              size="sm"
              data-testid="lightbox-reset"
              aria-label="Reset zoom"
              disabled={!isZoomed && transform.x === 0 && transform.y === 0}
              onClick={() => setTransform(INITIAL_TRANSFORM)}
              className="h-8 w-8 p-0 cursor-pointer text-natural-50"
            >
              <FontAwesomeIcon icon={faArrowsRotate} className="size-4" />
            </Button>
            <Button
              type="button"
              variant="icon"
              size="sm"
              data-testid="lightbox-fullscreen"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0 cursor-pointer text-natural-50"
            >
              <FontAwesomeIcon
                icon={isFullscreen ? faCompress : faExpand}
                className="size-4"
              />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
