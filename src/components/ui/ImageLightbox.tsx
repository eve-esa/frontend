import { Dialog, DialogContent, DialogTitle } from "./Dialog";
import { AuthenticatedImage } from "./AuthenticatedImage";

type ImageLightboxProps = {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Full-size preview of an image, reusing the shared Radix Dialog wrapper. */
export const ImageLightbox = ({
  src,
  alt,
  open,
  onOpenChange,
}: ImageLightboxProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      data-testid="image-lightbox"
      className="w-fit max-w-[92vw] sm:max-w-[92vw] border-0 bg-transparent p-2 shadow-none"
    >
      <DialogTitle className="sr-only">{alt || "Image preview"}</DialogTitle>
      <AuthenticatedImage
        src={src}
        alt={alt}
        className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
      />
    </DialogContent>
  </Dialog>
);
