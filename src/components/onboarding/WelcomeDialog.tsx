import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";

type WelcomeDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export const WelcomeDialog = ({ isOpen, onOpenChange }: WelcomeDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to the pilot program of EVE!</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Meet EVE, your intelligent companion for exploring Earth Observation
          and Earth Sciences. EVE helps you uncover insights, connect knowledge
          and ask questions in natural language, much like talking to a domain
          expert.
          <br />
          <br />
          With its Retrieval-Augmented Generation (RAG) system, EVE combines
          reasoning with access to trusted sources such as ESA&rsquo;s own
          portals, high-quality datasets and recent peer-reviewed research, so
          answers stay relevant and current.
          <br />
          <br />
          You will have early access to the newest features, and you are invited
          to share your experience through surveys, interviews and workshops.
          Your participation will directly shape the future of EVE, and the next
          generation of AI for Earth.
        </DialogDescription>
        <div className="flex gap-2 justify-end">
          <Button
            tabIndex={-1}
            variant="primary"
            size="md"
            type="submit"
            className="min-w-[100px]"
            onClick={() => onOpenChange(false)}
          >
            Let's go!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
