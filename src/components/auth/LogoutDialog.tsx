import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { useLogout } from "@/services/useLogout";
import { Spinner } from "@/components/ui/Spinner";

type LogoutDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export const LogoutDialog = ({ isOpen, onOpenChange }: LogoutDialogProps) => {
  const onSuccess = () => {
    onOpenChange(false);
  };
  const { mutate: logout, isPending } = useLogout(onSuccess);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="md:!max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Logout</DialogTitle>
        </DialogHeader>
        <DialogDescription>Are you sure you want to logout?</DialogDescription>
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="md"
            onClick={() => onOpenChange(false)}
            tabIndex={-1}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            onClick={() => logout()}
            tabIndex={-1}
          >
            {isPending ? (
              <span className="min-w-[40px] flex items-center justify-center">
                <Spinner size="xs" />
              </span>
            ) : (
              "Logout"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
