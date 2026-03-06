import { Task, ExecutorProvider } from "./types.js";
import { resolveBinary } from "./binaries.js";
import { runCodex } from "./codex.js";
import { formatLineage } from "./lineage.js";
import { runCommand } from "./process.js";
import { createWorktree } from "./workspace.js";

function buildChildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  return env;
}

function invokeClaude(message: string, cwd: string): Promise<string> {
  const claude = resolveBinary("claude");
  console.log(`  [executor] spawning: ${claude} --dangerously-skip-permissions ...`);
  console.log(`  [executor] cwd: ${cwd}`);

  return runCommand(claude, ["--dangerously-skip-permissions", "-p", message], {
    cwd,
    env: buildChildEnv(),
  });
}

function invokeCodex(message: string, cwd: string): Promise<string> {
  console.log("  [executor] spawning: codex exec --dangerously-bypass-approvals-and-sandbox ...");
  console.log(`  [executor] cwd: ${cwd}`);

  return runCodex(message, {
    cwd,
    env: buildChildEnv(),
    bypassApprovalsAndSandbox: true,
  });
}

function buildPrompt(task: Task): string {
  const hierarchy = formatLineage(task.lineage, task.description);
  const siblingContext = task.lineage.length > 0
    ? `\nYou are one of several agents working in parallel on sibling tasks under the same parent. Do not duplicate work that sibling tasks would handle. Focus only on your specific task.`
    : "";

  return `You are a coding agent executing one task in a larger project.

PROJECT CONTEXT:
${hierarchy}
${siblingContext}

YOUR TASK: ${task.description}

INSTRUCTIONS:
- Implement this task fully and write real, working code.
- Create any files and directories needed. Use sensible project structure.
- If this task depends on interfaces or types from sibling tasks, define reasonable stubs or interfaces that siblings can implement.
- Keep your changes focused. Do not implement functionality that belongs to other tasks in the hierarchy.
- Commit your work with a clear commit message describing what you built.`;
}

/** Execute a single atomic task using the specified provider in a git worktree. */
export async function executeTask(
  task: Task,
  workspacePath: string,
  provider: ExecutorProvider = "codex"
): Promise<string> {
  console.log(`[execute] [${task.id}] "${task.description}" (${provider})`);

  const worktreePath = await createWorktree(workspacePath, task.id);
  console.log(`[execute] [${task.id}] worktree: ${worktreePath}`);

  const prompt = buildPrompt(task);

  const invoke = provider === "codex" ? invokeCodex : invokeClaude;
  const result = await invoke(prompt, worktreePath);
  console.log(`[execute] [${task.id}] done`);
  return result;
}
