import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomModel } from "@/types";

/**
 * Deleting a custom model removes its stored API key too, so the row's Delete
 * only opens a confirmation that names the model; the delete request leaves
 * from the confirmation. There is no DOM here: Radix dialogs are replaced by
 * wrappers that honour `open`, and Button is wrapped to keep its props so a
 * test can call onClick.
 */
const model: CustomModel = {
  id: "cm-1",
  display_name: "My GPT",
  provider_id: "openai",
  catalog_model_id: "gpt",
  provider_display_name: "OpenAI",
  model_display_name: "GPT",
  model_name: "gpt",
  has_api_key: true,
  created_at: "2026-11-12T00:00:00Z",
  updated_at: "2026-11-12T00:00:00Z",
};

const deleteMutate = vi.fn();
const buttons: Array<ComponentProps<"button">> = [];

vi.mock("@/services/useListModels", () => ({
  useListModels: () => ({ data: { providers: [], custom: [model] } }),
}));
vi.mock("@/services/useCustomModels", () => ({
  useCreateCustomModel: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateCustomModel: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteCustomModel: () => ({ mutate: deleteMutate, isPending: false }),
}));
vi.mock("@/components/ui/Dialog", () => {
  const Pass = ({ children, ...rest }: { children?: ReactNode; "data-testid"?: string }) => (
    <div data-testid={rest["data-testid"]}>{children}</div>
  );
  return {
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
  };
});
vi.mock("@/components/ui/Button", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/ui/Button")>();
  return {
    ...real,
    Button: (props: ComponentProps<typeof real.Button>) => {
      buttons.push(props);
      return real.Button(props);
    },
  };
});

const byTestId = (id: string) =>
  buttons.find((b) => (b as Record<string, unknown>)["data-testid"] === id);

beforeEach(() => {
  buttons.length = 0;
  deleteMutate.mockClear();
});

describe("CustomModelsDialog delete", () => {
  it("asks first: the row's Delete sends no request and the confirmation is closed", async () => {
    const { CustomModelsDialog } = await import("./CustomModelsDialog");
    const html = renderToStaticMarkup(
      <CustomModelsDialog isOpen={true} onOpenChange={vi.fn()} />,
    );
    expect(html).toContain('data-testid="custom-model-delete"');
    expect(html).toContain('aria-label="Delete My GPT"');
    expect(html).not.toContain('data-testid="custom-model-delete-confirm"');

    const rowDelete = byTestId("custom-model-delete");
    expect(rowDelete?.onClick).toBeTypeOf("function");
    rowDelete!.onClick!({} as never);
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("the confirmation names the model and deletes it only on confirm", async () => {
    const { DeleteCustomModelDialog } = await import("./DeleteCustomModelDialog");
    const onOpenChange = vi.fn();
    const html = renderToStaticMarkup(
      <DeleteCustomModelDialog model={model} onOpenChange={onOpenChange} />,
    );
    expect(html).toContain('data-testid="custom-model-delete-dialog"');
    expect(html).toContain("Delete My GPT?");
    expect(html).not.toContain('tabindex="-1"');

    byTestId("custom-model-delete-cancel")!.onClick!({} as never);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(deleteMutate).not.toHaveBeenCalled();

    byTestId("custom-model-delete-confirm")!.onClick!({} as never);
    expect(deleteMutate).toHaveBeenCalledWith("cm-1", expect.anything());
  });

  it("closes after a successful delete of the model it is open for", async () => {
    const { DeleteCustomModelDialog } = await import("./DeleteCustomModelDialog");
    const onOpenChange = vi.fn();
    renderToStaticMarkup(
      <DeleteCustomModelDialog model={model} onOpenChange={onOpenChange} />,
    );
    byTestId("custom-model-delete-confirm")!.onClick!({} as never);
    const options = deleteMutate.mock.calls[0][1] as { onSuccess: () => void };

    expect(onOpenChange).not.toHaveBeenCalled();
    options.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("names the model on each row's Edit button", async () => {
    const { CustomModelsDialog } = await import("./CustomModelsDialog");
    const html = renderToStaticMarkup(
      <CustomModelsDialog isOpen={true} onOpenChange={vi.fn()} />,
    );
    expect(html).toContain('aria-label="Edit My GPT"');
  });

  it("renders nothing without a model", async () => {
    const { DeleteCustomModelDialog } = await import("./DeleteCustomModelDialog");
    const html = renderToStaticMarkup(
      <DeleteCustomModelDialog model={null} onOpenChange={vi.fn()} />,
    );
    expect(html).toBe("");
  });
});
