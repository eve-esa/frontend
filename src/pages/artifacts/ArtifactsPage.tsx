import { useState } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { useGetMyImages } from "@/services/useGetMyImages";
import { useDeleteImage } from "@/services/useDeleteImage";
import { ArtifactCard } from "./ArtifactCard";
import { cn } from "@/lib/utils";
import type { ImageAsset } from "@/types";

// Only "Images" exists today; the tab scaffold is here so future asset kinds
// (uploaded files, model-generated outputs) can slot in without a rewrite.
const TABS = [{ id: "images", label: "Images", enabled: true }] as const;
type TabId = (typeof TABS)[number]["id"];

const assetUrl = (asset: ImageAsset): string =>
  asset.url ?? `/images/${asset.id}`;

export const ArtifactsPage = () => {
  const [activeTab, setActiveTab] = useState<TabId>("images");
  const [lightboxAsset, setLightboxAsset] = useState<ImageAsset | null>(null);

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useGetMyImages();

  const { mutate: deleteImage, isPending: isDeleting, variables: deletingId } =
    useDeleteImage();

  const images = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="flex h-full w-full flex-col bg-natural-900">
      <div className="flex-none">
        <ChatHeader />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
          <header className="flex flex-col gap-4">
            <h1 className="text-2xl text-natural-50 3xl:text-4xl">Artifacts</h1>
            <div className="flex gap-2 border-b border-primary-500">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  disabled={!tab.enabled}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-3 py-2 text-sm transition-colors",
                    activeTab === tab.id
                      ? "border-b-2 border-success-200 text-natural-50"
                      : "text-natural-300 hover:text-natural-50",
                    !tab.enabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          {isLoading ? (
            <div
              data-testid="artifacts-grid"
              className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              {[...Array(10)].map((_, index) => (
                <Skeleton key={index} className="aspect-square w-full" />
              ))}
            </div>
          ) : isError ? (
            <p className="text-danger-400">
              Could not load your images. Please try again.
            </p>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <p className="text-natural-200">No images yet</p>
              <p className="text-sm text-natural-300">
                Images you attach to a conversation will show up here.
              </p>
            </div>
          ) : (
            <>
              <div
                data-testid="artifacts-grid"
                className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              >
                {images.map((asset) => (
                  <ArtifactCard
                    key={asset.id}
                    asset={asset}
                    onOpen={() => setLightboxAsset(asset)}
                    onDelete={() => deleteImage(asset.id)}
                    isDeleting={isDeleting && deletingId === asset.id}
                  />
                ))}
              </div>

              {hasNextPage && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? "Loading…" : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lightboxAsset && (
        <ImageLightbox
          src={assetUrl(lightboxAsset)}
          alt={lightboxAsset.filename}
          open={Boolean(lightboxAsset)}
          onOpenChange={(open) => !open && setLightboxAsset(null)}
        />
      )}
    </div>
  );
};

ArtifactsPage.displayName = "ArtifactsPage";
