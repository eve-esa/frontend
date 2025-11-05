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
          Meet EVE, your intelligent companion for exploring the world of Earth
          Observation and Earth Sciences. Powered by the Mistral 3.1 24B model,
          fine-tuned specifically for ESA, EVE helps you uncover insights,
          connect knowledge, and ask questions in natural language — just like
          talking to a domain expert.
          <br />
          <br />
          With its advanced Retrieval-Augmented Generation (RAG) system, EVE
          combines cutting-edge reasoning with access to trusted sources such as
          ESA’s own portals, high-quality datasets, and the latest peer-reviewed
          research, ensuring your answers are both relevant and up to date.
          <br />
          <br />
          As part of this pilot phase running until the end of 2025, you’ll have
          early access to the platform’s newest features — an intuitive chat
          interface, session memory, and integrated feedback tools. You’ll also
          be invited to share your experience through quick surveys, interviews,
          and online or in-person workshops. Your participation will directly
          shape the future of EVE — and the next generation of AI for Earth.
          <br />
          <br />
          Your participation will directly shape the future of EVE — and the
          next generation of AI for Earth.
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
