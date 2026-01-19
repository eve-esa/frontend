import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
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

  const totalCO2eqKgValue = data?.co2eq_kg ?? 0;
  const totalCO2eqKg = Intl.NumberFormat("en-US", {
    style: "decimal",
    maximumFractionDigits: 2,
  }).format(totalCO2eqKgValue);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calculate my CO2eq cost</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          This is a pilot estimation based on your interaction stats.
        </DialogDescription>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2 rounded-lg border border-primary-400 p-4 bg-primary-700/30">
            <div className="text-3xl font-semibold text-natural-50">
              {shouldFetch
                ? isFetching
                  ? "Calculating..."
                  : `${totalCO2eqKg} Kg`
                : "—"}
            </div>
            {shouldFetch && !isFetching && data && (
              <div className="text-lg font-semibold text-natural-50">
                {data.text}
              </div>
            )}
          </div>

          {shouldFetch && !isFetching && data && (
            <div className="grid grid-cols-1 gap-3">
              <div className="flex justify-between border border-primary-400/40 bg-primary-800/20 p-3">
                <span className="text-natural-200">Messages</span>
                <span className="text-natural-50 font-medium">
                  {Intl.NumberFormat("en-US").format(data.message_count)}
                </span>
              </div>
              <div className="flex justify-between border border-primary-400/40 bg-primary-800/20 p-3">
                <span className="text-natural-200">Input characters</span>
                <span className="text-natural-50 font-medium">
                  {Intl.NumberFormat("en-US").format(data.input_characters)}
                </span>
              </div>
              <div className="flex justify-between border border-primary-400/40 bg-primary-800/20 p-3">
                <span className="text-natural-200">Output characters</span>
                <span className="text-natural-50 font-medium">
                  {Intl.NumberFormat("en-US").format(data.output_characters)}
                </span>
              </div>
              <div className="flex justify-between border border-primary-400/40 bg-primary-800/20 p-3">
                <span className="text-natural-200">Total characters</span>
                <span className="text-natural-50 font-semibold">
                  {Intl.NumberFormat("en-US").format(data.total_characters)}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              tabIndex={-1}
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              tabIndex={-1}
              size="md"
              onClick={onCalculate}
              disabled={isFetching}
            >
              {shouldFetch
                ? isFetching
                  ? "Calculating..."
                  : "Recalculate"
                : "Calculate my CO2eq cost..."}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
