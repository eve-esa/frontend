import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
} from "@fortawesome/free-solid-svg-icons";
import { Dialog, DialogContent, DialogTitle } from "./Dialog";
import { AuthenticatedImage } from "./AuthenticatedImage";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

type ImageLightboxProps = {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

type Transform = { zoom: number; x: number; y: number };

const INITIAL_TRANSFORM: Transform = { zoom: MIN_ZOOM, x: 0, y: 0 };

/**
 * Full-size preview of an image, reusing the shared Radix Dialog wrapper.
 * Supports mouse-wheel / button / double-click zoom (1x-4x) and drag-to-pan
 * when zoomed in.
 */
export const ImageLightbox = ({
  src,
  alt,
  open,
  onOpenChange,
}: ImageLightboxProps) => {
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);
  const [isDragging, setIsDragging] = useState(false);
  // Held in state (not just a ref) because Radix mounts the dialog content a
  // commit after `open` flips true; the wheel-listener effect must re-run once
  // the viewport element actually exists.
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  // Pointer position of the drag start, in image-offset coordinates.
  const dragOriginRef = useRef({ x: 0, y: 0 });

  const isZoomed = transform.zoom > MIN_ZOOM;

  // Soft clamp: the pan offset can never push the image fully out of the
  // viewport (translate happens before scale, so limits are in layout pixels).
  const clampTransform = useCallback(
    (next: Transform): Transform => {
      if (!viewportEl || next.zoom <= MIN_ZOOM)
        return { ...next, x: 0, y: 0 };
      const maxX = (viewportEl.clientWidth * (next.zoom - 1)) / 2;
      const maxY = (viewportEl.clientHeight * (next.zoom - 1)) / 2;
      return {
        ...next,
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [viewportEl],
  );

  const zoomBy = useCallback(
    (delta: number) => {
      setTransform((prev) => {
        const zoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, prev.zoom + delta),
        );
        return clampTransform({ ...prev, zoom });
      });
    },
    [clampTransform],
  );

  // Reset zoom/pan whenever the dialog closes or the image changes.
  useEffect(() => {
    setTransform(INITIAL_TRANSFORM);
    setIsDragging(false);
  }, [open, src]);

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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!isZoomed) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some pointer sequences (stylus/trackpad edge cases) can reference an
      // already-released pointerId; dragging still works without the capture.
    }
    dragOriginRef.current = {
      x: event.clientX - transform.x,
      y: event.clientY - transform.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const origin = dragOriginRef.current;
    setTransform((prev) =>
      clampTransform({
        ...prev,
        x: event.clientX - origin.x,
        y: event.clientY - origin.y,
      }),
    );
  };

  const endDrag = () => setIsDragging(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="image-lightbox"
        className="w-fit max-w-[92vw] sm:max-w-[92vw] border-0 bg-transparent p-2 shadow-none"
      >
        <DialogTitle className="sr-only">{alt || "Image preview"}</DialogTitle>
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
              prev.zoom > MIN_ZOOM ? INITIAL_TRANSFORM : { zoom: 2, x: 0, y: 0 },
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
              src={src}
              alt={alt}
              className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
