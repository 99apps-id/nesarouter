import { describe, expect, it } from "vitest";
import {
  cursorAccessTokenExpiresAt,
  cursorAutoImportNotFoundMessage,
  cursorAutoImportPartialMessage,
  cursorDbCandidatePaths,
  normalizeCursorDbValue
} from "@/core/cursorTokenImport";
import { takeCompleteFrames } from "@/core/providers/cursor";
import { buildCursorHeaders } from "@/core/providers/cursorChecksum";

describe("cursor token import helpers", () => {
  it("lists common Windows cursor db paths", () => {
    const paths = cursorDbCandidatePaths("win32");
    expect(paths.some((path) => path.includes("Cursor") && path.endsWith("state.vscdb"))).toBe(true);
    expect(paths.some((path) => path.includes("Programs"))).toBe(true);
  });

  it("unwraps JSON-encoded sqlite values", () => {
    expect(normalizeCursorDbValue('"token-value"')).toBe("token-value");
    expect(normalizeCursorDbValue("plain-token")).toBe("plain-token");
  });

  it("reads JWT exp for Cursor access tokens", () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
    const token = `hdr.${payload}.sig`;
    const expiresAt = cursorAccessTokenExpiresAt(token);
    expect(expiresAt).toBe(new Date(exp * 1000).toISOString());
    expect(cursorAccessTokenExpiresAt("not-a-jwt")).toBeUndefined();
  });

  it("explains VPS limitation when db is missing on linux", () => {
    const message = cursorAutoImportNotFoundMessage("linux", ["/root/.config/Cursor/User/globalStorage/state.vscdb"]);
    expect(message).toContain("VPS");
    expect(message).toContain("Paste manually");
  });

  it("explains partial token extraction", () => {
    const message = cursorAutoImportPartialMessage("C:\\db\\state.vscdb", true, false);
    expect(message).toContain("machine id");
    expect(message).toContain("Paste manually");
  });
});

describe("cursor connect framing", () => {
  it("splits complete frames and keeps a partial trailer", () => {
    const payload = Buffer.from("hello");
    const frame = Buffer.alloc(5 + payload.length);
    frame[0] = 0;
    frame.writeUInt32BE(payload.length, 1);
    payload.copy(frame, 5);
    const partial = Buffer.concat([frame, Buffer.from([0, 0, 0])]);
    const { frames, remaining } = takeCompleteFrames(partial);
    expect(frames).toHaveLength(1);
    expect(Buffer.from(frames[0]).toString()).toBe("hello");
    expect(remaining.length).toBe(3);
  });
});

describe("cursor headers", () => {
  it("uses preset client version overrides", () => {
    const headers = buildCursorHeaders("a".repeat(60), "machine-id", true, {
      clientVersion: "9.9.9",
      clientType: "cli"
    });
    expect(headers["x-cursor-client-version"]).toBe("9.9.9");
    expect(headers["x-cursor-client-type"]).toBe("cli");
  });
});
