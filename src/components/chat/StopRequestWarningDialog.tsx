import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";

type StopRequestWarningDialogProps = {
  isModalOpen: boolean;
  conversationId?: string;
  onOpenChange: () => void;
  handleConfirm: () => void;
};

export const StopRequestWarningDialog = ({
  isModalOpen,

  onOpenChange,
  handleConfirm,
}: StopRequestWarningDialogProps) => {
  const onLeaveChatClick = () => {
    handleConfirm();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onOpenChange}>
      <DialogContent className="md:!max-w-[400px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Request in Progress</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          You have a request still pending. Are you sure you want to leave?
        </DialogDescription>
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="md"
            onClick={onOpenChange}
            tabIndex={-1}
          >
            Stay
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={onLeaveChatClick}
            tabIndex={-1}
          >
            Leave
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
