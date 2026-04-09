/**
 * opencode-gitlab-workstream
 *
 * Two plugins in one repo:
 *
 * 1. ErrorRecovery  - tool.execute.after hook for JSON truncation and
 *                     unknown agent type errors. Use in all opencode projects.
 *
 * 2. GitLabWorkstream - plan_create + plan_track tools for tracking
 *                       multi-session agent projects as GitLab issues.
 *                       Config: gas-town.jsonc → work_tracking section.
 *
 * @see https://github.com/nickveenhof/opencode-gitlab-workstream
 */

import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin";
import { createToolExecuteAfterHook } from "./hooks.js";
import { loadWorkTrackingConfig } from "./config.js";
import { createPlanTools } from "./plan-tools.js";

/**
 * ErrorRecovery plugin.
 * Catches JSON truncation errors and unknown agent type errors at runtime,
 * appends actionable retry guidance to the tool output.
 */
const ErrorRecovery: Plugin = async (_input: PluginInput): Promise<Hooks> => {
  return {
    "tool.execute.after": createToolExecuteAfterHook(),
  };
};

/**
 * GitLabWorkstream plugin.
 * Registers plan_create and plan_track tools for GitLab issue tracking.
 * Requires work_tracking config in gas-town.jsonc.
 */
const GitLabWorkstream: Plugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadWorkTrackingConfig(input.directory);

  if (!config || config.enabled === false) {
    return { tool: {} };
  }

  return {
    tool: createPlanTools(config),
  };
};

export default ErrorRecovery;
export { ErrorRecovery, GitLabWorkstream };
