import { hierarchy, tree } from "d3-hierarchy";
import { NodeStatus, type QuestionNode, type Session } from "../types";

export const NODE_WIDTH = 264;
export const NODE_HEIGHT = 88;
const VERTICAL_SPACING = NODE_HEIGHT + 32;
const HORIZONTAL_SPACING = NODE_WIDTH + 136;

export type CanvasItem = {
  id: string;
  kind: "question" | "ghost";
  parentId: string | null;
  question: string;
  status: NodeStatus;
  isRoot: boolean;
};

export type PositionedItem = CanvasItem & { x: number; y: number };

/** Node data shared by the React Flow canvas and its custom node views. */
export type CanvasNodeData = { item: PositionedItem; selected: boolean };

type TreeNode = CanvasItem & { children: TreeNode[] };

/**
 * Tidy left-to-right tree layout for a session: real question nodes plus
 * ghost nodes for not-yet-adopted suggestions.
 */
export const layoutSession = (session: Session): PositionedItem[] => {
  const byParent = new Map<string | null, QuestionNode[]>();
  for (const node of session.nodes) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }
  const root = (byParent.get(null) ?? [])[0];
  if (!root) {
    return [];
  }

  const toTreeNode = (node: QuestionNode): TreeNode => {
    const children = (byParent.get(node.id) ?? []).map(toTreeNode);
    if (node.status === NodeStatus.Done) {
      for (const [index, question] of node.suggestions.entries()) {
        children.push({
          id: `ghost:${node.id}:${index}`,
          kind: "ghost",
          parentId: node.id,
          question,
          status: NodeStatus.Idle,
          isRoot: false,
          children: [],
        });
      }
    }
    return {
      id: node.id,
      kind: "question",
      parentId: node.parentId,
      question: node.question,
      status: node.status,
      isRoot: node.parentId === null,
      children,
    };
  };

  const laidOut = tree<TreeNode>().nodeSize([VERTICAL_SPACING, HORIZONTAL_SPACING])(
    hierarchy(toTreeNode(root), (node) => node.children),
  );

  const items: PositionedItem[] = [];
  laidOut.each((point) => {
    const { children: _children, ...item } = point.data;
    items.push({ ...item, x: point.y, y: point.x });
  });
  return items;
};
