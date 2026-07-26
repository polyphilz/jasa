import type { QuestionNode, Session } from "../types";
import { FOLLOW_UPS_MARKER } from "./stream";

/** The linear chain of nodes from the session root down to `nodeId`. */
export const chainToRoot = (session: Session, nodeId: string): QuestionNode[] => {
  const byId = new Map(session.nodes.map((node) => [node.id, node]));
  const chain: QuestionNode[] = [];
  let current = byId.get(nodeId);
  while (current) {
    chain.unshift(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return chain;
};

export const buildPrompt = (session: Session, nodeId: string): string => {
  const chain = chainToRoot(session, nodeId);
  const target = chain[chain.length - 1];
  const ancestors = chain.slice(0, -1);

  const lines: string[] = [
    'You are the research engine inside "jasa", a desktop app where the user explores one research question as a tree of sub-questions. Each path through the tree is an independent conversation thread; you are answering the deepest question of one path.',
    "",
    "# Session",
    `Root question: ${session.question}`,
  ];
  if (session.source?.trim()) {
    lines.push(`Source the user is studying alongside: ${session.source.trim()}`);
  }
  if (ancestors.length > 0) {
    lines.push("", "# Thread so far (root to parent, already answered)");
    for (const ancestor of ancestors) {
      lines.push("", `## Q: ${ancestor.question}`, ancestor.answer || "(not yet answered)");
    }
  }
  lines.push(
    "",
    "# Current question",
    target?.question ?? session.question,
    "",
    "# Instructions",
    "- Answer the current question directly, in GitHub-flavored Markdown.",
    "- Use $...$ or $$...$$ LaTeX for math and fenced code blocks for code.",
    "- Be information-dense; prefer 150-400 words unless the question truly needs more.",
    "- Build on the thread; do not repeat what earlier answers already covered.",
    "- Use WebSearch or WebFetch only for facts you are unsure of or anything recent.",
    `- After the answer, output this marker alone on one line: ${FOLLOW_UPS_MARKER}`,
    '- After the marker, suggest exactly 3 natural next questions the user might explore, one per line, each starting with "- ". Nothing else after the marker section.',
  );
  return lines.join("\n");
};
