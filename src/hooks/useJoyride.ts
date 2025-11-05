import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { STATUS, ACTIONS, type CallBackProps } from "react-joyride";
import {
  LOCAL_STORAGE_TOUR_COMPLETED,
  LOCAL_STORAGE_WELCOME_DIALOG_VIEWED,
} from "@/utilities/localStorage";
import { routes } from "@/utilities/routes";
import { useIsMobile } from "@/hooks/useIsMobile";

export const useJoyride = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const tourCompleted = localStorage.getItem(LOCAL_STORAGE_TOUR_COMPLETED);
  const isOnboardingPage = location.pathname === routes.ONBOARDING.path;

  // Auto-start the tour after a short delay (non-onboarding)
  useEffect(() => {
    if (isOnboardingPage) return;

    const timer = setTimeout(() => {
      if (!tourCompleted && !isMobile) {
        setStepIndex(0);
        setRun(true);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [tourCompleted, isMobile, isOnboardingPage]);

  // On onboarding page: wait until welcome dialog is closed before starting
  useEffect(() => {
    if (!isOnboardingPage || isMobile) return;

    let poller: number | null = null;

    const startIfReady = () => {
      const viewed = localStorage.getItem(LOCAL_STORAGE_WELCOME_DIALOG_VIEWED);
      if (viewed) {
        setStepIndex(0);
        setRun(true);
        if (poller) {
          clearInterval(poller);
          poller = null;
        }
        return true;
      }
      return false;
    };

    // Try immediately, then poll until the dialog is closed
    if (!startIfReady()) {
      poller = window.setInterval(() => {
        startIfReady();
      }, 200);
    }

    return () => {
      if (poller) clearInterval(poller);
    };
  }, [isOnboardingPage, isMobile]);

  // Stop tour when leaving onboarding page
  useEffect(() => {
    if (!isOnboardingPage && run) {
      setRun(false);
      setStepIndex(0);
    }
  }, [isOnboardingPage, run]);

  // Prevent scrolling during tour
  useEffect(() => {
    if (run) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [run]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { action, index, status, type } = data;

    if (type === "step:after") {
      const nextStepIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      setStepIndex(nextStepIndex);
    } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(LOCAL_STORAGE_TOUR_COMPLETED, "true");
      navigate(routes.EMPTY_CHAT.path);
      setRun(false);
      setStepIndex(0);
    }
  };

  return {
    run,
    stepIndex,
    handleJoyrideCallback,
    isOnboardingPage,
  };
};
