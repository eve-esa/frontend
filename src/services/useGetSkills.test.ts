import { afterEach, describe, expect, it, vi } from "vitest";
import api from "./axios";
import { getSkills } from "./useGetSkills";

vi.mock("./axios", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { data: [], meta: {} } })),
  },
}));

describe("getSkills", () => {
  afterEach(() => vi.mocked(api.get).mockClear());

  it("reads GET /skills with limit and page", async () => {
    await getSkills({ limit: 20, page: "1" });

    expect(api.get).toHaveBeenCalledWith("/skills?limit=20&page=1");
  });

  it("defaults limit and page the same way as the MCP server list", async () => {
    await getSkills({});

    expect(api.get).toHaveBeenCalledWith("/skills?limit=20&page=1");
  });
});
