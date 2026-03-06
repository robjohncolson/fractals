import fs from "fs";
import os from "os";
import path from "path";
import { resolveBinary } from "./binaries.js";
import { runCommand } from "./process.js";

function resolvePath(p: string): string {
  return p.startsWith("~") ? p.replace("~", os.homedir()) : p;
}

/** Initialize workspace: create dir, git init, initial commit. */
export async function initWorkspace(workspacePath: string): Promise<void> {
  workspacePath = resolvePath(workspacePath);
  const git = resolveBinary("git");
  fs.mkdirSync(workspacePath, { recursive: true });

  if (!fs.existsSync(path.join(workspacePath, ".git"))) {
    await runCommand(git, ["init"], { cwd: workspacePath });
    fs.writeFileSync(path.join(workspacePath, ".gitkeep"), "");
    await runCommand(git, ["add", "."], { cwd: workspacePath });
    await runCommand(git, ["commit", "-m", "initial commit"], { cwd: workspacePath });
  }
}

/** Create a git worktree for a specific task. Returns the worktree path. */
export async function createWorktree(workspacePath: string, taskId: string): Promise<string> {
  workspacePath = resolvePath(workspacePath);
  const git = resolveBinary("git");
  const branchName = `task/${taskId}`;
  const worktreePath = path.join(workspacePath, ".worktrees", taskId);

  if (fs.existsSync(worktreePath)) return worktreePath;

  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  await runCommand(git, ["worktree", "add", "-b", branchName, worktreePath], { cwd: workspacePath });
  return worktreePath;
}

/** Remove a git worktree after task completion. */
export async function removeWorktree(workspacePath: string, taskId: string): Promise<void> {
  workspacePath = resolvePath(workspacePath);
  const git = resolveBinary("git");
  const worktreePath = path.join(workspacePath, ".worktrees", taskId);
  if (!fs.existsSync(worktreePath)) return;
  await runCommand(git, ["worktree", "remove", worktreePath, "--force"], { cwd: workspacePath });
}
