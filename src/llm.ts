import { z } from "zod";
import { runCodex } from "./codex.js";
import { formatLineage } from "./lineage.js";

const ClassifySchema = z.object({
  kind: z.enum(["atomic", "composite"]),
});

const DecomposeSchema = z.object({
  subtasks: z.array(z.string().min(1)).min(2).max(7),
});

const ClassifyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: ["atomic", "composite"],
    },
  },
  required: ["kind"],
} as const;

const DecomposeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subtasks: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: {
        type: "string",
        minLength: 1,
      },
    },
  },
  required: ["subtasks"],
} as const;

function buildChildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  return env;
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    return JSON.parse(
      trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
    );
  }

  return JSON.parse(trimmed);
}

async function runPlanner<T>(
  instructions: string,
  context: string,
  schema: object,
  parser: z.ZodType<T>
): Promise<T> {
  const prompt = `${instructions}

Return only JSON that matches the provided schema.
You may read the current repository for context if it helps, but do not invent unrelated files or implementation details.

Task hierarchy:
${context}`;

  const output = await runCodex(prompt, {
    cwd: process.cwd(),
    env: buildChildEnv(),
    outputSchema: schema,
    sandbox: "read-only",
    skipGitRepoCheck: true,
  });

  try {
    return parser.parse(parseJson(output));
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(`Planner returned invalid JSON: ${details}`);
  }
}

export async function classify(task: string, lineage: string[]): Promise<"atomic" | "composite"> {
  const context = formatLineage(lineage, task);
  const res = await runPlanner(
    `You decide whether a software task is "atomic" or "composite".

- "atomic" = a developer can sit down and implement this directly without needing to plan further. It may involve multiple steps, but they all belong to one coherent unit of work.
- "composite" = this clearly contains 2 or more independent concerns that should be worked on separately.

Decision heuristics:
- If the task names a single feature, endpoint, component, or module: atomic.
- If the task bundles unrelated concerns (for example, "build auth and set up CI"): composite.
- If you are at depth 2 or deeper in the hierarchy, it is almost certainly atomic. Only mark composite if you can name 2 or more truly independent deliverables.
- When in doubt, choose atomic. Over-decomposition creates more overhead than under-decomposition.

Use the full task hierarchy to understand what ancestors already scoped. Do not re-decompose work that has already been narrowed.`,
    context,
    ClassifyJsonSchema,
    ClassifySchema
  );

  return res.kind;
}

export async function decompose(task: string, lineage: string[]): Promise<string[]> {
  const context = formatLineage(lineage, task);
  const res = await runPlanner(
    `You are a pragmatic task decomposition engine for software projects.

Given a composite task, break it into the minimum number of subtasks needed.
- A simple task might only need 2 subtasks.
- A complex task might need up to 7, but only if each is truly distinct and necessary.
- Do not pad the plan with extra subtasks.
- Do not create "test and polish" or "define requirements" subtasks unless they are genuinely separate work.
- Do not create subtasks that overlap or restate each other differently.
- Each subtask should represent real, distinct work that an experienced developer would naturally treat as a separate concern.

Use the full task hierarchy to understand what ancestors already cover. Never repeat their scope.`,
    context,
    DecomposeJsonSchema,
    DecomposeSchema
  );

  return [...new Set(res.subtasks.map((subtask) => subtask.trim()).filter(Boolean))];
}
