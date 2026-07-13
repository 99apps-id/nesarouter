import crypto from "node:crypto";

export function keyPreview(token: string) {
  return token.length > 18 ? `${token.slice(0, 12)}...${token.slice(-4)}` : token;
}

export function keyId(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
}

export interface KeyRow {
  id: string;
  preview: string;
}

export function keyRows(tokens: string[]): KeyRow[] {
  return tokens.map((token) => ({ id: keyId(token), preview: keyPreview(token) }));
}
