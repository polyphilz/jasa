import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NodeStatus, type NodeStatus as NodeStatusType } from "../types";
import { cn } from "../lib/cn";
import type { CanvasNodeData } from "../layout/tree";
import { Spinner } from "./Spinner";

type CanvasFlowNode = Node<CanvasNodeData>;

const StatusLine = ({ status }: { status: NodeStatusType }) => {
  switch (status) {
    case NodeStatus.Generating:
      return (
        <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-accent">
          <Spinner className="size-3" />
          Thinking…
        </span>
      );
    case NodeStatus.Done:
      return <span className="mt-1.5 block text-[11px] text-muted">Answered</span>;
    case NodeStatus.Error:
      return <span className="mt-1.5 block text-[11px] text-red-400">Failed</span>;
    case NodeStatus.Idle:
      return <span className="mt-1.5 block text-[11px] text-muted">Not answered yet</span>;
  }
};

export const QuestionNodeView = ({ data }: NodeProps<CanvasFlowNode>) => {
  const { item, selected } = data;
  return (
    <div
      className={cn(
        "w-[264px] cursor-pointer rounded-xl border border-line bg-surface px-4 py-3 shadow-md transition-colors duration-150 hover:border-line-strong",
        item.isRoot && "border-line-strong",
        item.status === NodeStatus.Error && "border-red-900 hover:border-red-800",
        selected && "border-accent ring-2 ring-accent/30 hover:border-accent",
      )}
    >
      <Handle type="target" position={Position.Left} className="jasa-handle" />
      <p className="line-clamp-3 text-[13px]/[1.4] font-medium text-pretty text-ink">
        {item.question}
      </p>
      <StatusLine status={item.status} />
      <Handle type="source" position={Position.Right} className="jasa-handle" />
    </div>
  );
};

export const GhostNodeView = ({ data }: NodeProps<CanvasFlowNode>) => (
  <div className="w-[264px] cursor-pointer rounded-xl border border-dashed border-line-strong bg-surface/40 px-4 py-3 transition-colors duration-150 hover:border-accent hover:bg-surface/70">
    <Handle type="target" position={Position.Left} className="jasa-handle" />
    <p className="line-clamp-3 text-[13px]/[1.4] text-pretty text-muted">{data.item.question}</p>
    <p className="mt-1.5 text-[11px] text-muted/70">Suggested · click to explore</p>
  </div>
);
