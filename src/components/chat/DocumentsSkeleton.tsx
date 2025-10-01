import { Skeleton } from "@/components/ui/Skeleton";

export const DocumentsSkeleton = () => {
  return (
    <div className="flex items-start flex-col justify-between gap-4 py-2">
      <Skeleton className="h-5 w-[50%] mb-2" />
      <Skeleton className="h-5 w-[70%]" />
      <Skeleton className="h-3 w-[30%]" />
      <span className="border-b border-[1px] border-primary-50 w-full" />
    </div>
  );
};
