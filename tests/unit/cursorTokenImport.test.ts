import { describe, expect, it } from "vitest";
import {
  cursorAutoImportNotFoundMessage,
  cursorAutoImportPartialMessage,
  cursorDbCandidatePaths,
  normalizeCursorDbValue
} from "@/core/cursorTokenImport";

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
