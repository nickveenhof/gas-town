/**
 * Config loader for opencode-gitlab-workstream.
 * Reads work_tracking from gas-town.jsonc in user config or project dir.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface WorkTrackingConfig {
  /** GitLab project path for issues, e.g. "ai-work-tracker/tasks" */
  gitlab_project: string;
  /** GitLab project numeric ID */
  gitlab_project_id?: number;
  /** GitLab group path for epics (requires Ultimate), e.g. "ai-work-tracker" */
  gitlab_group?: string;
  /** GitLab group numeric ID */
  gitlab_group_id?: number;
  /** Default labels on all created issues */
  default_labels?: string[];
  /** Set false to disable without removing config */
  enabled?: boolean;
}

function parseJsonc(raw: string): any {
  const stripped = raw
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return JSON.parse(stripped);
}

function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "opencode");
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return join(home, ".config", "opencode");
}

export function loadWorkTrackingConfig(projectDir: string): WorkTrackingConfig | null {
  const searchPaths = [
    join(projectDir, ".opencode", "gas-town.jsonc"),
    join(projectDir, "gas-town.jsonc"),
    join(getConfigDir(), "gas-town.jsonc"),
  ];

  for (const filepath of searchPaths) {
    if (!existsSync(filepath)) continue;
    try {
      const raw = readFileSync(filepath, "utf-8");
      const parsed = parseJsonc(raw);
      if (parsed?.work_tracking?.gitlab_project) {
        return parsed.work_tracking as WorkTrackingConfig;
      }
    } catch {
      continue;
    }
  }

  return null;
}
