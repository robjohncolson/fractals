import { spawn } from "child_process";

interface RunCommandOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
}

function shouldUseShell(command: string): boolean {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
}

export function runCommand(
  command: string,
  args: string[],
  { cwd, env, input }: RunCommandOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: shouldUseShell(command),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `Exit code ${code}`));
    });

    child.stdin.setDefaultEncoding("utf8");
    child.stdin.end(input ?? "");
  });
}
