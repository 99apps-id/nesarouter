// @ts-nocheck
// Port of Rust git::compact_diff (src/cmds/git/git.rs L325-413)
// Compacts unified diff: file headers, hunk-level truncation at 100 lines, +/-/context counting
// @ts-nocheck
import { GIT_DIFF_HUNK_MAX_LINES } from "../constants";

export function gitDiff(diff, maxLines = 500) {
  const result = [];
  let currentFile = "";
  let added = 0;
  let removed = 0;
  let inHunk = false;
  let hunkShown = 0;
  let hunkSkipped = 0;
  let contextSkipped = 0;
  let wasTruncated = false;
  const maxHunkLines = GIT_DIFF_HUNK_MAX_LINES;

  const lines = diff.split("\n");

  const flushContext = () => {
    if (contextSkipped > 0) {
      result.push(`  ... (${contextSkipped} unchanged context lines omitted)`);
      contextSkipped = 0;
      wasTruncated = true;
    }
  };

  outer: for (const line of lines) {
    if (line.startsWith("diff --git")) {
      flushContext();
      if (hunkSkipped > 0) {
        result.push(`  ... (${hunkSkipped} lines truncated)`);
        wasTruncated = true;
        hunkSkipped = 0;
      }
      if (currentFile && (added > 0 || removed > 0)) {
        result.push(`  +${added} -${removed}`);
      }
      const parts = line.split(" b/");
      currentFile = parts.length > 1 ? parts.slice(1).join(" b/") : "unknown";
      result.push(`\n${currentFile}`);
      added = 0;
      removed = 0;
      inHunk = false;
      hunkShown = 0;
    } else if (line.startsWith("@@")) {
      flushContext();
      if (hunkSkipped > 0) {
        result.push(`  ... (${hunkSkipped} lines truncated)`);
        wasTruncated = true;
        hunkSkipped = 0;
      }
      inHunk = true;
      hunkShown = 0;
      result.push(`  ${line}`);
    } else if (inHunk) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        flushContext();
        added += 1;
        if (hunkShown < maxHunkLines) {
          result.push(`  ${line}`);
          hunkShown += 1;
        } else {
          hunkSkipped += 1;
        }
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        flushContext();
        removed += 1;
        if (hunkShown < maxHunkLines) {
          result.push(`  ${line}`);
          hunkShown += 1;
        } else {
          hunkSkipped += 1;
        }
      } else if (!line.startsWith("\\")) {
        if (hunkShown < 3) {
          result.push(`  ${line}`);
          hunkShown += 1;
        } else {
          contextSkipped += 1;
        }
      }
    }

    if (result.length >= maxLines) {
      result.push("\n... (more changes truncated)");
      wasTruncated = true;
      break outer;
    }
  }

  flushContext();
  if (hunkSkipped > 0) {
    result.push(`  ... (${hunkSkipped} lines truncated)`);
    wasTruncated = true;
  }

  if (currentFile && (added > 0 || removed > 0)) {
    result.push(`  +${added} -${removed}`);
  }

  if (wasTruncated) {
    result.push("[full diff: rtk git diff --no-compact]");
  }

  return result.join("\n");
}

gitDiff.filterName = "git-diff";
