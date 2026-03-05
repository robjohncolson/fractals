import { execSync, spawn } from "child_process";
import { Task } from "./types.js";
import { createWorktree } from "./workspace.js";

function formatLineage(lineage: string[], current: string): string {
  const parts = lineage.map((desc, i) => `${"  ".repeat(i)}${i}. ${desc}`);
  parts.push(`${"  ".repeat(lineage.length)}${lineage.length}. ${current}  <-- (this task)`);
  return parts.join("\n");
}

/** Resolve the full path to the claude binary. */
function resolveClaudePath(): string {
  try {
    return execSync("which claude", { encoding: "utf8" }).trim();
  } catch {
    return "claude"; // fallback, let it fail with a clear error
  }
}

const CLAUDE_BIN = resolveClaudePath();

function invokeClaudeCLI(message: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    console.log(`  [executor] spawning: ${CLAUDE_BIN} --dangerously-skip-permissions -p "..."`);
    console.log(`  [executor] cwd: ${cwd}`);

    const args = ["--dangerously-skip-permissions", "-p", message];
    const child = spawn(CLAUDE_BIN, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (err) => {
      console.error(`  [executor] spawn error: ${err.message}`);
      reject(err);
    });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`  [executor] claude exited 0, output length: ${stdout.length}`);
        resolve(stdout);
      } else {
        const msg = stderr.trim() || `claude exited with code ${code}`;
        console.error(`  [executor] claude exited ${code}: ${msg}`);
        reject(new Error(msg));
      }
    });
  });
}

/** Execute a single atomic task using Claude CLI in a git worktree. */
export async function executeTask(task: Task, workspacePath: string): Promise<string> {
  console.log(`[execute] [${task.id}] "${task.description}"`);

  const worktreePath = await createWorktree(workspacePath, task.id);
  console.log(`[execute] [${task.id}] worktree: ${worktreePath}`);

  const prompt = `You are executing a task as part of a larger project plan.

Task hierarchy (your position in the plan):
${formatLineage(task.lineage, task.description)}

Your job: Complete task "${task.description}"

Work in this directory. Write real, production-quality code. Commit your changes when done.`;

  const result = await invokeClaudeCLI(prompt, worktreePath);
  console.log(`[execute] [${task.id}] done`);
  return result;
}
