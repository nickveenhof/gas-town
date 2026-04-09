/**
 * Gas Town plan tools.
 *
 * plan_create - Create a parent GitLab issue as a project container
 * plan_track  - Create a child issue linked to the parent
 * plan_close  - Close an issue when a task is complete
 *
 * Uses glab CLI (already authenticated) via execSync.
 * Config from gas-town.jsonc work_tracking section.
 *
 * Epic support pending Ultimate license on ai-work-tracker group.
 * For now: parent issue = project container, child issues = tasks.
 * Linked via GitLab "relates_to" issue links.
 */

import { tool } from "@opencode-ai/plugin";
import { execSync } from "child_process";
import type { WorkTrackingConfig } from "./config.js";

function glab(
  endpoint: string,
  method = "GET",
  fields: Record<string, string> = {},
): any {
  const fieldArgs = Object.entries(fields)
    .map(([k, v]) => `-f '${k}=${v.replace(/'/g, "'\\''")}'`)
    .join(" ");
  const cmd = `glab api "${endpoint}" --method ${method} ${fieldArgs} 2>/dev/null`;
  try {
    const out = execSync(cmd, { encoding: "utf-8", timeout: 15000 });
    return JSON.parse(out.trim());
  } catch {
    return null;
  }
}

export function createPlanTools(config: WorkTrackingConfig) {
  const pid = String(config.gitlab_project_id ?? encodeURIComponent(config.gitlab_project));
  const projectUrl = `https://gitlab.com/${config.gitlab_project}`;
  const labels = (config.default_labels ?? ["gas-town"]).join(",");

  return {
    /**
     * Create a parent issue that acts as a project/initiative container.
     * Child task issues link back to this via plan_track.
     */
    plan_create: tool({
      description:
        `Create a GitLab issue as a project container in ${config.gitlab_project}. ` +
        "Use for multi-session initiatives. Child tasks link back to this issue. " +
        "Returns issue IID to pass to plan_track as parent_iid.",
      args: {
        title: tool.schema
          .string()
          .describe("Project title. Short, imperative. e.g. 'Migrate Gas Town orchestration'"),
        description: tool.schema
          .string()
          .describe("What this initiative delivers. Include success criteria and involved agents."),
        due_date: tool.schema
          .string()
          .optional()
          .describe("Due date in YYYY-MM-DD format"),
      },
      async execute(args) {
        const fields: Record<string, string> = {
          title: args.title,
          description: args.description,
          labels: [labels, "project"].join(","),
        };
        if (args.due_date) fields.due_date = args.due_date;

        const result = glab(`projects/${pid}/issues`, "POST", fields);
        if (!result?.iid) {
          return `[gas-town] Failed to create project issue. Check glab auth and ${config.gitlab_project}.`;
        }

        const url = `${projectUrl}/-/issues/${result.iid}`;
        return (
          `Project created: ${args.title}\n` +
          `URL: ${url}\n` +
          `Issue IID: ${result.iid}\n\n` +
          `<plan_metadata>\n` +
          `parent_iid: ${result.iid}\n` +
          `parent_url: ${url}\n` +
          `project: ${config.gitlab_project}\n` +
          `</plan_metadata>\n\n` +
          `Pass parent_iid: ${result.iid} to plan_track to link child tasks.`
        );
      },
    }),

    /**
     * Create a child task issue and link it to a parent project issue.
     */
    plan_track: tool({
      description:
        `Create a task issue in ${config.gitlab_project} and link it to a parent project. ` +
        "Pass parent_iid from plan_create to link tasks to their project. " +
        "Pass issue_iid to update or close an existing task.",
      args: {
        title: tool.schema
          .string()
          .describe("Task title. Include agent name. e.g. 'analyst: research Q2 KPI trajectory'"),
        description: tool.schema
          .string()
          .describe("What this task does, which agent runs it, expected output format."),
        parent_iid: tool.schema
          .number()
          .optional()
          .describe("IID of parent project issue from plan_create"),
        session_id: tool.schema
          .string()
          .optional()
          .describe("Opencode session ID for cross-referencing"),
        due_date: tool.schema
          .string()
          .optional()
          .describe("Due date in YYYY-MM-DD format"),
        issue_iid: tool.schema
          .number()
          .optional()
          .describe("Existing issue IID to update instead of creating new"),
        status: tool.schema
          .enum(["open", "closed"])
          .optional()
          .describe("Set to 'closed' when the task is done"),
      },
      async execute(args) {
        // Update existing issue
        if (args.issue_iid) {
          const fields: Record<string, string> = {};
          if (args.status === "closed") fields.state_event = "close";
          if (args.status === "open") fields.state_event = "reopen";
          if (args.description) fields.description = args.description;
          if (args.due_date) fields.due_date = args.due_date;

          const result = glab(`projects/${pid}/issues/${args.issue_iid}`, "PUT", fields);
          if (!result?.iid) {
            return `[gas-town] Failed to update issue #${args.issue_iid}.`;
          }
          const url = `${projectUrl}/-/issues/${result.iid}`;
          return `Issue #${result.iid} updated: ${result.state}\nURL: ${url}`;
        }

        // Create new task issue
        const sessionNote = args.session_id
          ? `\n\n---\n**Opencode session:** \`${args.session_id}\``
          : "";

        const fields: Record<string, string> = {
          title: args.title,
          description: args.description + sessionNote,
          labels: [labels, "task"].join(","),
        };
        if (args.due_date) fields.due_date = args.due_date;

        const result = glab(`projects/${pid}/issues`, "POST", fields);
        if (!result?.iid) {
          return `[gas-town] Failed to create task issue. Check glab auth and ${config.gitlab_project}.`;
        }

        const url = `${projectUrl}/-/issues/${result.iid}`;
        let output =
          `Task created: ${args.title}\n` +
          `URL: ${url}\n` +
          `Issue IID: ${result.iid}`;

        // Link to parent via relates_to
        if (args.parent_iid) {
          const link = glab(
            `projects/${pid}/issues/${result.iid}/links`,
            "POST",
            {
              target_project_id: pid,
              target_issue_iid: String(args.parent_iid),
              link_type: "relates_to",
            },
          );
          output += link
            ? `\nLinked to parent #${args.parent_iid}`
            : `\n[gas-town] Warning: issue created but link to parent #${args.parent_iid} failed`;
        }

        return (
          output +
          `\n\n<plan_metadata>\n` +
          `issue_iid: ${result.iid}\n` +
          `issue_url: ${url}\n` +
          `project: ${config.gitlab_project}\n` +
          `</plan_metadata>`
        );
      },
    }),
  };
}
