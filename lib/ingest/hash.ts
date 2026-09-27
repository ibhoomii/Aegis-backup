// Real evidence-integrity hashing via the Web Crypto API.
//
// Unlike the rest of the analysis (which is heuristic), these hashes are
// genuine SHA-256 digests of the uploaded bytes — the one place the console
// makes a cryptographic claim it can actually back up.

// Full 64-char hex SHA-256 of a UTF-8 string.
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Abbreviated form used throughout the UI ("3f8a…d29b"), matching the demo's
// evidence-list style. Falls back to a dashed placeholder if Web Crypto is
// unavailable (very old browser / insecure context).
export async function sha256Short(text: string): Promise<string> {
  try {
    const hex = await sha256Hex(text);
    return `${hex.slice(0, 4)}…${hex.slice(-4)}`;
  } catch {
    return "----…----";
  }
}
