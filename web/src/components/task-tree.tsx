"use client";

import { useState } from "react";
import { Task } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  ChevronDown,
  Layers,
  SquareCheck,
} from "lucide-react";

const statusStyle: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "pending", variant: "outline" },
  decomposing: { label: "decomposing", variant: "secondary" },
  ready: { label: "ready", variant: "secondary" },
  running: { label: "running", variant: "default" },
  done: { label: "done", variant: "default" },
  failed: { label: "failed", variant: "destructive" },
};

function TaskNode({ task, depth, onViewResult }: { task: Task; depth: number; onViewResult: (task: Task) => void }) {
  const [open, setOpen] = useState(true);
  const hasChildren = task.children.length > 0;
  const config = statusStyle[task.status] ?? statusStyle.pending;

  const row = (
    <div className="flex items-center gap-1.5 py-1 px-2 -mx-2 rounded hover:bg-muted/50 min-w-0">
      <span className="w-4 shrink-0 flex items-center justify-center text-muted-foreground">
        {hasChildren ? (
          open ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : (
          <span className="w-3.5" />
        )}
      </span>

      <span className="shrink-0 flex items-center text-muted-foreground">
        {hasChildren ? <Layers size={14} /> : <SquareCheck size={14} />}
      </span>

      <span className="text-muted-foreground text-xs shrink-0 font-mono">
        {task.id}
      </span>

      <span className="text-sm truncate min-w-0 flex-1" title={task.description}>
        {task.description}
      </span>

      <Badge variant={config.variant} className="shrink-0 text-[10px] px-1.5 py-0">
        {config.label}
      </Badge>
    </div>
  );

  if (hasChildren) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left cursor-pointer">{row}</button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-4 border-l border-border pl-2">
            {task.children.map((child) => (
              <TaskNode key={child.id} task={child} depth={depth + 1} onViewResult={onViewResult} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div>
      {row}
      {task.result && (
        <button
          className="ml-10 text-xs text-muted-foreground border-l border-border pl-2 py-1 whitespace-pre-wrap max-h-16 overflow-hidden text-left w-full hover:text-foreground cursor-pointer"
          onClick={() => onViewResult(task)}
        >
          {task.result.slice(0, 300)}
          {task.result.length > 300 && <span className="text-muted-foreground/50"> ...</span>}
        </button>
      )}
    </div>
  );
}

export function TaskTree({ tree }: { tree: Task }) {
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  return (
    <div className="font-mono text-sm overflow-hidden">
      <TaskNode task={tree} depth={0} onViewResult={setViewingTask} />

      <Dialog open={viewingTask !== null} onOpenChange={(open) => !open && setViewingTask(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          {viewingTask && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-sm font-normal">
                  <span className="text-muted-foreground">[{viewingTask.id}]</span>{" "}
                  {viewingTask.description}
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-auto flex-1 min-h-0">
                <pre className="text-xs whitespace-pre-wrap break-words p-4 bg-muted rounded">
                  {viewingTask.result}
                </pre>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
