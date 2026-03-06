import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

type BinaryName = "git" | "codex" | "claude";

const cache = new Map<BinaryName, string>();

function firstExisting(paths: Array<string | undefined>): string | undefined {
  for (const candidate of paths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function lookupOnPath(name: string): string | undefined {
  const locator = process.platform === "win32" ? "where.exe" : "which";

  try {
    const output = execFileSync(locator, [name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    return firstExisting(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
  } catch {
    return undefined;
  }
}

function npmShimCandidates(name: string): Array<string | undefined> {
  if (process.platform !== "win32") return [];

  const appData = process.env.APPDATA;
  if (!appData) return [];

  return [
    path.join(appData, "npm", `${name}.cmd`),
    path.join(appData, "npm", name),
  ];
}

function gitCandidates(): Array<string | undefined> {
  if (process.platform !== "win32") return [];

  const gitBash = process.env.CLAUDE_CODE_GIT_BASH_PATH;
  const bundledGitRoot = gitBash ? path.resolve(path.dirname(gitBash), "..") : undefined;

  const installRoots = [
    process.env.ProgramFiles,
    process.env["ProgramFiles(x86)"],
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs") : undefined,
  ];

  return [
    bundledGitRoot ? path.join(bundledGitRoot, "cmd", "git.exe") : undefined,
    bundledGitRoot ? path.join(bundledGitRoot, "bin", "git.exe") : undefined,
    ...installRoots.flatMap((root) => root
      ? [
          path.join(root, "Git", "cmd", "git.exe"),
          path.join(root, "Git", "bin", "git.exe"),
        ]
      : []),
  ];
}

function fallbackCandidates(name: BinaryName): Array<string | undefined> {
  switch (name) {
    case "codex":
    case "claude":
      return npmShimCandidates(name);
    case "git":
      return gitCandidates();
  }
}

function missingBinaryMessage(name: BinaryName): string {
  switch (name) {
    case "codex":
      return "Unable to locate the Codex CLI. Add it to PATH or set CODEX_BIN.";
    case "claude":
      return "Unable to locate the Claude CLI. Add it to PATH or set CLAUDE_BIN.";
    case "git":
      return "Unable to locate Git. Add it to PATH or set GIT_BIN.";
  }
}

export function resolveBinary(name: BinaryName): string {
  const cached = cache.get(name);
  if (cached) return cached;

  const envVar = `${name.toUpperCase()}_BIN`;
  const resolved = firstExisting([
    process.env[envVar],
    lookupOnPath(name),
    ...fallbackCandidates(name),
  ]);

  if (!resolved) {
    throw new Error(missingBinaryMessage(name));
  }

  cache.set(name, resolved);
  return resolved;
}
