import { Skeleton } from "@/components/ui/Skeleton";

export const MessageSkeleton = () => {
  return Array.from({ length: 3 }).map((_, index) => (
    <div
      key={index}
      className="bg-natural-900 rounded-tl-[20px] rounded-br-[20px] mx-auto pb-8 pt-0 relative mt-4 md:mt-8"
    >
      {/* REQUEST SECTION */}
      <div className="py-8 border-b border-primary-50 z-10">
        <Skeleton className="w-[60%] h-[26px]" />
      </div>
      <div className="pt-8">
        {/* ANSWER SECTION */}

        <div className="flex flex-col  gap-2 text-natural-600">
          <Skeleton className="w-full h-2 max-w-[98%]" />
          <Skeleton className="w-full h-2 max-w-[100%]" />
          <Skeleton className="w-full h-2 max-w-[97%]" />
          <Skeleton className="w-full max-w-[87%] h-2" />
          <Skeleton className="w-full max-w-[40%] h-2" />
        </div>
      </div>
    </div>
  ));
};
