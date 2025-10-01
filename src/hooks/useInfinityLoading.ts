import { type RefObject, useEffect, useMemo, useRef } from "react";
//Refs don’t get set for elements that weren't rendered - that's why we add more dependencies to observe
type Dependency = HTMLElement | null | boolean | string;

type InfinityLoadingParams = {
  fetchFunction: () => void;
  dependencies?: Dependency[];
};

const useInfinityLoading = ({
  fetchFunction,
  dependencies = [],
}: InfinityLoadingParams): [endRef: RefObject<HTMLDivElement | null>] => {
  const endRef = useRef<HTMLDivElement | null>(null);

  const intersectionObserver = useMemo(
    () =>
      new IntersectionObserver(
        (entries) => {
          const first = entries[0];
          if (first.isIntersecting) {
            fetchFunction();
          }
        },
        {
          threshold: 0,
          rootMargin: "0px 0px 100px 0px",
        }
      ),
    [...dependencies]
  );

  useEffect(() => {
    if (endRef.current) {
      intersectionObserver.observe(endRef.current);
    }
    return () => {
      if (endRef.current) {
        intersectionObserver.unobserve(endRef.current);
      }
    };
  }, [endRef.current, intersectionObserver]);
  return [endRef];
};

export default useInfinityLoading;
