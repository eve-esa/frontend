import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { useCreateCollection } from "@/services/useCreateCollection";
import { useForm } from "react-hook-form";
import { Input } from "../ui/Input";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Spinner } from "../ui/Spinner";

const CreateCollectionSchema = z.object({
  name: z.string().min(1, { message: "Collection name is required" }),
});

type CreateCollectionValidation = z.infer<typeof CreateCollectionSchema>;

type CreateCollectionDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CreateCollectionDialog = ({
  isOpen,
  onOpenChange,
}: CreateCollectionDialogProps) => {
  const onSuccess = () => {
    onOpenChange(false);
  };

  const {
    register,
    handleSubmit,
    formState: { isValid, errors },
  } = useForm<CreateCollectionValidation>({
    mode: "onChange",
    resolver: zodResolver(CreateCollectionSchema),
    defaultValues: {
      name: "",
    },
  });

  const { mutate: createCollection, isPending } =
    useCreateCollection(onSuccess);

  const onSubmit = (data: CreateCollectionValidation) => {
    createCollection(data.name);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Create a new collection to store your documents.
        </DialogDescription>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Input
              {...register("name")}
              placeholder="Enter collection name"
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid && !isPending) {
                  e.preventDefault();
                  handleSubmit(onSubmit)();
                }
              }}
            />
            {errors?.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              tabIndex={-1}
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isPending || !isValid}
              tabIndex={-1}
              variant="primary"
              size="md"
              type="submit"
              className="min-w-[100px]"
            >
              {isPending ? <Spinner size="xs" /> : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
