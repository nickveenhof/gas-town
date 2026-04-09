/**
 * opencode-gitlab-workstream
 *
 * GitLab issue tracking for multi-session agent projects.
 *
 * Tools:
 *   plan_create - Create a parent issue as a project/initiative container
 *   plan_track  - Create child task issues linked to a parent
 *
 * Config: gas-town.jsonc → work_tracking section
 * Future: epic support when gitlab_group has Ultimate license
 *
 * @see https://gitlab.com/ai-work-tracker/tasks
 */

import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin";
import { createPlanTools } from "./plan-tools.js";
import { loadWorkTrackingConfig } from "./config.js";

const GitLabWorkstream: Plugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadWorkTrackingConfig(input.directory);

  if (!config || config.enabled === false) {
    return { tool: {} };
  }

  return {
    tool: createPlanTools(config),
  };
};

export default GitLabWorkstream;
export { GitLabWorkstream };
