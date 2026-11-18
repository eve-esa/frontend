import { describe, expect, it } from "vitest";
import { buildFileTree } from "./fileTree";

const file = (path: string, size = 1) => ({ path, size, modified_at: null });

describe("buildFileTree", () => {
  it("nests paths into folders, folders first, each group by name", () => {
    const tree = buildFileTree([
      file("workspace_state", 2),
      file("workspace/b.txt", 3),
      file("workspace/out/a.png", 5),
      file("artifacts/x/pic.png", 7),
    ]);

    expect(tree.map((node) => node.name)).toEqual([
      "artifacts",
      "workspace",
      "workspace_state",
    ]);
    const workspace = tree[1];
    expect(workspace.path).toBe("workspace");
    expect(workspace.fileCount).toBe(2);
    expect(workspace.size).toBe(8);
    expect(workspace.children.map((node) => node.name)).toEqual(["out", "b.txt"]);
    expect(workspace.children[0].children[0].path).toBe("workspace/out/a.png");
    expect(tree[2].file?.size).toBe(2);
  });

  it("keeps a file and a folder that share a name apart", () => {
    const tree = buildFileTree([file("a"), file("a/b")]);
    expect(tree).toHaveLength(2);
    expect(tree[0].file).toBeUndefined();
    expect(tree[1].file?.path).toBe("a");
  });

  it("ignores an empty path", () => {
    expect(buildFileTree([file(""), file("/")])).toEqual([]);
  });
});
