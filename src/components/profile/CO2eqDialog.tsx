import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { useState } from "react";
import { useGetUserMessageStats } from "@/services/useGetUserMessageStats";

type CO2eqDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CO2eqDialog = ({ isOpen, onOpenChange }: CO2eqDialogProps) => {
  const [shouldFetch, setShouldFetch] = useState(false);
  const { data, isFetching, refetch } = useGetUserMessageStats(shouldFetch);

  const onCalculate = async () => {
    if (!shouldFetch) setShouldFetch(true);
    await refetch();
  };

  const totalCharacters = data?.total_characters;
  // Assumptions:
  // - Roughly 4 characters per token
  // - ~3mg CO2 per token
  // - Convert mg to kg
  const CHARS_PER_TOKEN = 4;
  const CO2_PER_TOKEN_MG = 3;
  const MG_PER_KG = 1000000;

  const totalCO2eqKg =
    typeof totalCharacters === "number" && totalCharacters > 0
      ? (totalCharacters / CHARS_PER_TOKEN) * (CO2_PER_TOKEN_MG / MG_PER_KG)
      : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>calculate my CO2eq cost</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This is a pilot estimation based on your interaction stats.
        </DialogDescription>

        <div className="flex flex-col gap-4 mt-4">
          <div className="rounded-lg border border-primary-400 p-4 bg-primary-700/30">
            <div className="text-3xl font-semibold text-natural-50">{shouldFetch ? (isFetching ? "Calculating..." : `${totalCO2eqKg} Kg`) : "—"}</div>
          </div>

          {shouldFetch && !isFetching && data && (
            <div className="grid grid-cols-1 gap-3">
              <div className="flex justify-between border border-primary-400/40 bg-primary-800/20 p-3">
                <span className="text-natural-200">Messages</span>
                <span className="text-natural-50 font-medium">{data.message_count}</span>
              </div>
              <div className="flex justify-between border border-primary-400/40 bg-primary-800/20 p-3">
                <span className="text-natural-200">Input characters</span>
                <span className="text-natural-50 font-medium">{data.input_characters}</span>
              </div>
              <div className="flex justify-between border border-primary-400/40 bg-primary-800/20 p-3">
                <span className="text-natural-200">Output characters</span>
                <span className="text-natural-50 font-medium">{data.output_characters}</span>
              </div>
              <div className="flex justify-between border border-primary-400/40 bg-primary-800/20 p-3">
                <span className="text-natural-200">Total characters</span>
                <span className="text-natural-50 font-semibold">{data.total_characters}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button tabIndex={-1} variant="ghost" size="md" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button tabIndex={-1} size="md" onClick={onCalculate} disabled={isFetching}>
              {shouldFetch ? (isFetching ? "Calculating..." : "Recalculate") : "Calculate my CO2eq cost..."}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


