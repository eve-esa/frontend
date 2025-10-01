import React, { createContext, useContext, type ReactNode } from "react";

interface TourContextType {
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

interface TourProviderProps {
  children: ReactNode;
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
}

export const TourProvider: React.FC<TourProviderProps> = ({
  children,
  isRunning,
  currentStep,
  totalSteps,
}) => {
  return (
    <TourContext.Provider
      value={{
        isRunning,
        currentStep,
        totalSteps,
      }}
    >
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
};
