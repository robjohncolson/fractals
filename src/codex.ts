import fs from "fs";
import os from "os";
import path from "path";
import { resolveBinary } from "./binaries.js";
import { runCommand } from "./process.js";

type CodexSandbox = "read-only" | "workspace-write" | "danger-full-access";

interface RunCodexOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  outputSchema?: object;
  sandbox?: CodexSandbox;
  skipGitRepoCheck?: boolean;
  bypassApprovalsAndSandbox?: boolean;
}

function buildTempPath(prefix: string, ext: string): string {
  return path.join(
    os.tmpdir(),
    `fractals-${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
  );
}

function resolveCodexCommand(): { command: string; preArgs: string[] } {
  const codex = resolveBinary("codex");

  if (process.platform === "win32" && /\.cmd$/i.test(codex)) {
    const jsEntry = path.join(
      path.dirname(codex),
      "node_modules",
      "@openai",
      "codex",
      "bin",
      "codex.js"
    );

    if (fs.existsSync(jsEntry)) {
      return { command: process.execPath, preArgs: [jsEntry] };
    }
  }

  return { command: codex, preArgs: [] };
}

export async function runCodex(prompt: string, options: RunCodexOptions): Promise<string> {
  const { command, preArgs } = resolveCodexCommand();
  const messagePath = buildTempPath("message", ".txt");
  const schemaPath = options.outputSchema ? buildTempPath("schema", ".json") : undefined;

  if (schemaPath) {
    fs.writeFileSync(schemaPath, JSON.stringify(options.outputSchema, null, 2));
  }

  const args = [
    ...preArgs,
    "exec",
    "--ephemeral",
    "--output-last-message",
    messagePath,
  ];

  if (schemaPath) {
    args.push("--output-schema", schemaPath);
  }
  if (options.skipGitRepoCheck) {
    args.push("--skip-git-repo-check");
  }
  if (options.bypassApprovalsAndSandbox) {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  } else if (options.sandbox) {
    args.push("--sandbox", options.sandbox);
  }

  args.push("-");

  try {
    const stdout = await runCommand(command, args, {
      cwd: options.cwd,
      env: options.env,
      input: prompt,
    });

    if (fs.existsSync(messagePath)) {
      const message = fs.readFileSync(messagePath, "utf8").trim();
      if (message) {
        return message;
      }
    }

    const fallback = stdout.trim();
    if (fallback) {
      return fallback;
    }

    throw new Error("Codex completed without returning a final message.");
  } finally {
    if (schemaPath && fs.existsSync(schemaPath)) {
      fs.unlinkSync(schemaPath);
    }
    if (fs.existsSync(messagePath)) {
      fs.unlinkSync(messagePath);
    }
  }
}
