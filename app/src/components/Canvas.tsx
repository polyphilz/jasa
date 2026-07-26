import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef } from "react";
import { layoutSession, NODE_HEIGHT, NODE_WIDTH, type CanvasNodeData } from "../layout/tree";
import { useJasaStore } from "../state/store";
import type { Session } from "../types";
import { GhostNodeView, QuestionNodeView } from "./CanvasNodes";
import { SessionControls } from "./SessionControls";

const nodeTypes = { question: QuestionNodeView, ghost: GhostNodeView };

type CanvasFlowNode = Node<CanvasNodeData>;

const CanvasInner = ({ session }: { session: Session }) => {
  const selectedNodeId = useJasaStore((state) => state.selectedNodeId);
  const selectNode = useJasaStore((state) => state.selectNode);
  const adoptSuggestion = useJasaStore((state) => state.adoptSuggestion);
  const { setCenter, getZoom } = useReactFlow();

  const items = useMemo(() => layoutSession(session), [session]);

  const nodes: CanvasFlowNode[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        type: item.kind,
        position: { x: item.x, y: item.y },
        data: { item, selected: item.id === selectedNodeId },
        // Static dimensions: with a fully-controlled `nodes` prop (no
        // onNodesChange), measured sizes never reach these objects, and the
        // minimap skips nodes it cannot size.
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        draggable: false,
        connectable: false,
        selectable: false,
      })),
    [items, selectedNodeId],
  );

  const edges: Edge[] = useMemo(
    () =>
      items
        .filter((item) => item.parentId !== null)
        .map((item) => ({
          id: `${item.parentId}->${item.id}`,
          source: item.parentId ?? "",
          target: item.id,
          className: item.kind === "ghost" ? "jasa-edge-ghost" : "jasa-edge",
        })),
    [items],
  );

  // Smoothly bring newly created question nodes into view.
  const seen = useRef<{ sessionId: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    const questionIds = new Set(
      items.filter((item) => item.kind === "question").map((item) => item.id),
    );
    const previous = seen.current;
    seen.current = { sessionId: session.id, ids: questionIds };
    if (!previous || previous.sessionId !== session.id) {
      return;
    }
    const added = items.filter((item) => item.kind === "question" && !previous.ids.has(item.id));
    const latest = added[added.length - 1];
    if (latest) {
      void setCenter(latest.x + NODE_WIDTH / 2, latest.y + NODE_HEIGHT / 2, {
        zoom: getZoom(),
        duration: 250,
      });
    }
  }, [items, session.id, setCenter, getZoom]);

  const onNodeClick: NodeMouseHandler<CanvasFlowNode> = (_event, node) => {
    const { item } = node.data;
    if (item.kind === "ghost") {
      if (item.parentId !== null) {
        adoptSuggestion(item.parentId, item.question);
      }
      return;
    }
    selectNode(item.id);
  };

  return (
    <div className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.6}
        panOnScroll
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1.2}
          bgColor="var(--color-canvas)"
          color="var(--color-line)"
        />
        <Panel position="top-left">
          <SessionControls session={session} />
        </Panel>
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          bgColor="#23211f"
          maskColor="rgb(25 24 23 / 0.6)"
          nodeColor="#55504a"
          nodeStrokeWidth={0}
          nodeBorderRadius={6}
        />
      </ReactFlow>
    </div>
  );
};

export const Canvas = ({ session }: { session: Session }) => (
  <ReactFlowProvider>
    <CanvasInner session={session} />
  </ReactFlowProvider>
);
