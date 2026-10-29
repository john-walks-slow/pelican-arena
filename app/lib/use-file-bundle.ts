import { useState } from "react";
import {
  buildBundle,
  BundleError,
  formatBytes,
  readTextBundle,
  singleFileLimit,
  unzipBundle,
  type BundleEntry,
} from "~/lib/bundle";
import { KIND_META, type PromptKind } from "~/lib/kinds";

export interface PickedBundle {
  name: string;
  entries: BundleEntry[];
}

export function useFileBundle(kind: PromptKind) {
  const [picked, setPicked] = useState<PickedBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickFile(file: File) {
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const isZip = kind === "web" && file.name.toLowerCase().endsWith(".zip");
      if (!isZip && file.size > singleFileLimit(kind)) {
        throw new BundleError(`文件超过 ${formatBytes(singleFileLimit(kind))}`);
      }
      let entries: BundleEntry[];
      if (isZip) {
        entries = buildBundle(unzipBundle(bytes), kind);
      } else {
        const entry = KIND_META[kind].entry;
        if (kind !== "web") readTextBundle(kind, bytes);
        entries = buildBundle([{ path: entry, data: bytes }], kind);
      }
      setPicked({ name: file.name, entries });
    } catch (e) {
      setPicked(null);
      setError(e instanceof BundleError ? e.message : "无法读取文件，请确认格式");
    }
  }

  return { picked, setPicked, error, pickFile };
}
