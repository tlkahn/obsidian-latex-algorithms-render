import { createHash } from "crypto";

/**
 * Compute SHA-256 hex digest of the given string.
 * Normalizes input (strips trailing whitespace, normalizes line endings to \n).
 */
export function sha256(input: string): string {
  const normalized = input.replace(/\r\n/g, "\n").trimEnd();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
