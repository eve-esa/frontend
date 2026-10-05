import { beforeEach, describe, expect, it, vi } from "vitest";

// vitest runs without a DOM: the mutation options are used directly.
const mocks = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("./axios", () => ({ default: { post: vi.fn() } }));
vi.mock("./useTokenUsage", () => ({ invalidateTokenUsage: vi.fn() }));
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => new actual.QueryClient(),
    useMutation: (options: unknown) => options,
  };
});

type RetryOptions = { onError: (error: unknown) => void };

const loadOptions = async () => {
  const { useRetry } = await import("./useRetry");
  return useRetry({
    message_id: "m1",
    conversationId: "c1",
  }) as unknown as RetryOptions;
};

beforeEach(() => mocks.toastError.mockReset());

describe("useRetry onError", () => {
  it("shows the rate limit message instead of the credits or warm-up copy", async () => {
    const options = await loadOptions();
    options.onError({
      response: {
        status: 429,
        data: {
          detail: {
            code: "rate_limited",
            message: "Too many requests, retry in 30 s",
          },
        },
        headers: { "retry-after": "30" },
      },
    });
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Too many requests, retry in 30 s",
    );
  });

  it("keeps the warm-up copy for any other failure", async () => {
    const options = await loadOptions();
    options.onError({ response: { status: 500, data: {} } });
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Retry failed. The model may still be warming up.",
    );
  });
});
