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
          By way of introduction to the programme, pilot participants will have
          early access to the advanced Mistral 3.1 24B model, fine-tuned for
          Earth Observation and Earth Sciences, and experience new features such
          as an intuitive chat interface and session memory. EVE's sophisticated
          Retrieval-Augmented Generation (RAG) system enhances the model's
          knowledge by searching and retrieving information from trusted
          sources—such as high-quality resources, ESA portal content, and the
          latest peer-reviewed research—so that your queries receive the most
          relevant and up-to-date answers.
          <br />
          <br />
          The pilot runs throughout October 2025. Participants are able to test
          EVE in freeform chat, provide feedback through quick surveys and
          integrated tools, and participate in interviews and in person (also
          available online) workshops. Your insights will be invaluable in
          shaping EVE's future.
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
