/**
 * Gas Town hooks.
 *
 * Two hooks:
 * 1. experimental.chat.system.transform - Inject core-rules.md into every session
 * 2. tool.execute.after - Error recovery (JSON truncation, task retry)
 *
 * Agent identity injection is handled natively by opencode via
 * YAML frontmatter in agents/*.md files. No plugin hook needed.
 *
 * Model routing is handled natively by opencode via the `model`
 * field in agents/*.md frontmatter. No plugin hook needed.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

// ── Core rules loader ─────────────────────────────────────────────────

let coreRulesCache: string | null = null;

function loadCoreRules(projectDir: string): string {
  if (coreRulesCache !== null) return coreRulesCache;

  const searchPaths = [
    join(projectDir, ".opencode", "core-rules.md"),
    join(projectDir, "core-rules.md"),
    join(import.meta.dir ?? __dirname, "..", "core-rules.md"),
  ];

  for (const p of searchPaths) {
    if (existsSync(p)) {
      coreRulesCache = readFileSync(p, "utf-8");
      return coreRulesCache;
    }
  }

  coreRulesCache = "";
  return coreRulesCache;
}

// ── Hook: experimental.chat.system.transform ──────────────────────────

export function createSystemTransformHook(projectDir: string) {
  return async (
    _input: { model: any },
    output: { system: string[] },
  ) => {
    const coreRules = loadCoreRules(projectDir);
    if (coreRules) {
      output.system.push(coreRules);
    }
  };
}

// ── Hook: tool.execute.after (error recovery) ─────────────────────────

const JSON_ERROR_PATTERNS = [
  "JSON Parse error: Expected '}'",
  "JSON Parse error: Unterminated string",
  "expected string, received undefined",
];

const TASK_ERROR_PATTERNS = [
  {
    pattern: /Unknown agent type: (\S+) is not a valid agent type/i,
    guidance:
      "[gas-town] Unknown agent type. Check agents/*.md files and opencode.json. " +
      "Agent name must match the .md filename exactly.",
  },
];

export function createToolExecuteAfterHook() {
  return async (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any },
  ) => {
    if (typeof output.output !== "string") return;

    if (JSON_ERROR_PATTERNS.some((p) => output.output.includes(p))) {
      output.output +=
        "\n\n[gas-town] JSON truncation detected. " +
        "Do NOT retry with the same payload. " +
        "Split content into smaller pieces or write to a temp file first.";
      return;
    }

    if (input.tool === "task") {
      for (const { pattern, guidance } of TASK_ERROR_PATTERNS) {
        if (pattern.test(output.output)) {
          output.output += `\n\n${guidance}`;
          return;
        }
      }
    }
  };
}
