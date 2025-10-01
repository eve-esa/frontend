import { useBlocker } from "react-router-dom";
import { useEffect, useState } from "react";

export const useNavigationBlocker = (when: boolean) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only block navigation when 'when' is true AND the destination is different from current location
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!when) return false;

    // Don't block if navigating to the same path (e.g., clicking current conversation)
    return currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state === "blocked") {
      setIsModalOpen(true);
    }
  }, [blocker]);

  const handleConfirm = () => {
    setIsModalOpen(false);
    if (blocker.proceed) {
      blocker.proceed();
    }
  };

  const handleCancel = () => {
    setIsModalOpen(false);
    if (blocker.reset) {
      blocker.reset();
    }
  };

  return {
    blocker,
    isModalOpen,
    handleConfirm,
    handleCancel,
  };
};
