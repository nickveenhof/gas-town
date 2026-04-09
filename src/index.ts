/**
 * Gas Town: Agent-less orchestration infrastructure for OpenCode.
 *
 * Model routing, identity injection, error recovery.
 * Zero agent opinions. Bring your own agents.
 *
 * @see https://github.com/nickveenhof/gas-town
 */

import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin";
import { createToolExecuteAfterHook } from "./hooks.js";

const GasTown: Plugin = async (_input: PluginInput): Promise<Hooks> => {
  return {
    // Error recovery: JSON truncation + delegate-task retry guidance.
    // core-rules.md loaded natively via opencode.json "instructions".
    // Agent identity loaded natively via agents/*.md frontmatter.
    // Model routing configured natively via agents/*.md frontmatter.
    // GitLab work tracking handled by opencode-gitlab-workstream plugin.
    "tool.execute.after": createToolExecuteAfterHook(),
  };
};

export default GasTown;
export { GasTown };
