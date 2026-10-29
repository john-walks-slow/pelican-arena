import { decompress } from "fzstd";
import { LogParseError, parseSessionLog, type LogMeta } from "./session-log";

const ZSTD_MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

function isZstd(bytes: Uint8Array): boolean {
  return ZSTD_MAGIC.every((byte, i) => bytes[i] === byte);
}

export interface SessionLogFile {
  meta: LogMeta;
  text: string;
  name: string;
}

/**
 * Reads a log file, transparently unpacking DSH's zstd-compressed JSONL so the
 * user can pick the file exactly as it sits on disk.
 */
export function decodeSessionLog(bytes: Uint8Array): string {
  if (!isZstd(bytes)) return new TextDecoder().decode(bytes);
  try {
    return new TextDecoder().decode(decompress(bytes));
  } catch {
    throw new LogParseError("无法解压这个 zstd 日志，请确认文件完整");
  }
}

export async function readSessionLogFile(file: File): Promise<SessionLogFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const compressed = isZstd(bytes);
  const text = decodeSessionLog(bytes);
  return {
    meta: parseSessionLog(text),
    text,
    name: compressed ? file.name.replace(/\.zstd$/i, "") || "session.jsonl" : file.name,
  };
}
