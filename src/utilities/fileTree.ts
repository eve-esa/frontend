import type { FileEntry } from "@/types";

export type FileTreeNode = {
  name: string;
  /** Full path from the listing root; a folder's has no trailing slash. */
  path: string;
  /** Set on files only. */
  file?: FileEntry;
  children: FileTreeNode[];
  /** Files under this node, itself included for a file. */
  fileCount: number;
  /** Bytes under this node. */
  size: number;
};

/**
 * Folders from `/`-separated paths, folders before files, each group by name. A path that is
 * both a file and a folder prefix (`a` and `a/b`) keeps both: the file and the folder are
 * separate nodes.
 */
export const buildFileTree = (items: FileEntry[]): FileTreeNode[] => {
  const root: FileTreeNode = { name: "", path: "", children: [], fileCount: 0, size: 0 };
  const folders = new Map<string, FileTreeNode>([["", root]]);

  for (const item of items) {
    const parts = item.path.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let parent = root;
    const trail: FileTreeNode[] = [root];
    for (let i = 0; i < parts.length - 1; i += 1) {
      const path = parts.slice(0, i + 1).join("/");
      let folder = folders.get(path);
      if (!folder) {
        folder = { name: parts[i], path, children: [], fileCount: 0, size: 0 };
        folders.set(path, folder);
        parent.children.push(folder);
      }
      parent = folder;
      trail.push(folder);
    }
    parent.children.push({
      name: parts[parts.length - 1],
      path: parts.join("/"),
      file: item,
      children: [],
      fileCount: 1,
      size: item.size,
    });
    for (const node of trail) {
      node.fileCount += 1;
      node.size += item.size;
    }
  }

  const sort = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (Boolean(a.file) !== Boolean(b.file)) return a.file ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) sort(node.children);
  };
  sort(root.children);
  return root.children;
};
