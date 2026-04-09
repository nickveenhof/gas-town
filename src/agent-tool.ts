/**
 * Gas Town agent spawning tool.
 *
 * Registers a custom tool that spawns subagent sessions with
 * per-agent model routing via session.promptAsync().
 *
 * This is required because opencode's built-in `task` tool
 * does not support per-agent model overrides. The model must
 * be passed directly in the promptAsync() call body.
 */

import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import type { GasTownConfig } from "./config.js";
import { parseModelString } from "./config.js";

export function createAgentTool(
  config: GasTownConfig,
  ctx: PluginInput,
) {
  return tool({
    description:
      "Spawn a Gas Town subagent with per-agent model routing. " +
      "Use this instead of the built-in task tool when you need " +
      "a specific agent from gas-town.jsonc with its configured model.",
    args: {
      subagent_type: tool.schema
        .string()
        .describe("Agent name from gas-town.jsonc (e.g. explore, librarian, oracle)"),
      prompt: tool.schema
        .string()
        .describe("The task prompt for the subagent"),
      description: tool.schema
        .string()
        .optional()
        .describe("Short description of the task"),
    },
    async execute(args, toolContext) {
      const agentName = args.subagent_type.toLowerCase();
      const agentConfig = config.agents[agentName]
        ?? Object.entries(config.agents).find(
          ([k]) => k.toLowerCase() === agentName,
        )?.[1];

      // Parse model from config
      let model: { providerID: string; modelID: string } | undefined;
      if (agentConfig?.model) {
        model = parseModelString(agentConfig.model) ?? undefined;
      }

      // Parse tool restrictions
      const tools: Record<string, boolean> = {};
      if (agentConfig?.tools) {
        Object.assign(tools, agentConfig.tools);
      }
      // Subagents should not spawn further subagents by default
      if (tools.task === undefined) {
        tools.task = false;
      }
      if (tools.call_gas_town_agent === undefined) {
        tools.call_gas_town_agent = false;
      }

      try {
        // Create child session
        const createResult = await ctx.client.session.create({
          body: {
            parentID: toolContext.sessionID,
            title: `${args.description ?? args.subagent_type} (@${agentName})`,
          },
          query: { directory: ctx.directory },
        });

        if (createResult.error) {
          return `[gas-town] Failed to create session: ${createResult.error}`;
        }

        const sessionID = (createResult.data as any)?.id;
        if (!sessionID) {
          return `[gas-town] Session created but no ID returned`;
        }

        // Send prompt with model override
        const promptResult = await ctx.client.session.promptAsync({
          path: { id: sessionID },
          body: {
            agent: agentName,
            ...(model ? { model } : {}),
            ...(Object.keys(tools).length > 0 ? { tools } : {}),
            parts: [{ type: "text" as const, text: args.prompt }],
          },
          query: { directory: ctx.directory },
        });

        if (promptResult.error) {
          return `[gas-town] Prompt error: ${promptResult.error}`;
        }

        // Wait for completion by polling session messages
        const maxWait = 300000; // 5 minutes
        const pollInterval = 2000;
        let elapsed = 0;

        while (elapsed < maxWait) {
          if (toolContext.abort.aborted) {
            return `[gas-town] Task aborted after ${elapsed}ms`;
          }

          await new Promise((r) => setTimeout(r, pollInterval));
          elapsed += pollInterval;

          // Check session status
          const session = await ctx.client.session.get({
            path: { id: sessionID },
          });

          const sessionData = session.data as any;
          if (sessionData?.status === "idle" || sessionData?.idle) {
            // Session completed, get messages
            const messages = await ctx.client.session.messages({
              path: { id: sessionID },
            });

            const msgData = messages.data as any;
            if (Array.isArray(msgData)) {
              // Find the last assistant message
              const assistantMsgs = msgData.filter(
                (m: any) => m.role === "assistant",
              );
              const lastMsg = assistantMsgs[assistantMsgs.length - 1];
              if (lastMsg?.parts) {
                const textParts = lastMsg.parts
                  .filter((p: any) => p.type === "text")
                  .map((p: any) => p.text)
                  .join("\n");
                return textParts || "[gas-town] Agent completed but returned no text";
              }
            }

            return "[gas-town] Agent completed but could not read response";
          }
        }

        return `[gas-town] Agent timed out after ${maxWait}ms. Session: ${sessionID}`;
      } catch (e: any) {
        return `[gas-town] Error: ${e.message}`;
      }
    },
  });
}
