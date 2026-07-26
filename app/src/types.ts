export const AgentModel = {
  Default: "default",
  Fable: "fable",
  Opus: "opus",
  Sonnet: "sonnet",
  Haiku: "haiku",
} as const;

export type AgentModel = (typeof AgentModel)[keyof typeof AgentModel];

export const AgentModelLabel: Record<AgentModel, string> = {
  [AgentModel.Default]: "CLI default",
  [AgentModel.Fable]: "Fable",
  [AgentModel.Opus]: "Opus",
  [AgentModel.Sonnet]: "Sonnet",
  [AgentModel.Haiku]: "Haiku",
};

export const AgentEffort = {
  Default: "default",
  Low: "low",
  Medium: "medium",
  High: "high",
  XHigh: "xhigh",
  Max: "max",
} as const;

export type AgentEffort = (typeof AgentEffort)[keyof typeof AgentEffort];

export const AgentEffortLabel: Record<AgentEffort, string> = {
  [AgentEffort.Default]: "CLI default",
  [AgentEffort.Low]: "Low",
  [AgentEffort.Medium]: "Medium",
  [AgentEffort.High]: "High",
  [AgentEffort.XHigh]: "X-high",
  [AgentEffort.Max]: "Max",
};

export const NodeStatus = {
  Idle: "IDLE",
  Generating: "GENERATING",
  Done: "DONE",
  Error: "ERROR",
} as const;

export type NodeStatus = (typeof NodeStatus)[keyof typeof NodeStatus];

export type QuestionNode = {
  id: string;
  parentId: string | null;
  question: string;
  /** Markdown. Empty until the first successful generation. */
  answer: string;
  status: NodeStatus;
  /** AI-suggested follow-up questions not yet adopted as child nodes. */
  suggestions: string[];
  error?: string;
  createdAt: string;
  answeredAt?: string;
};

export type Session = {
  id: string;
  /** The root research question; doubles as the session title. */
  question: string;
  source?: string;
  /** Model alias passed to the agent CLI; absent means the CLI default. */
  model?: AgentModel;
  /** Reasoning effort passed to the agent CLI; absent means the CLI default. */
  effort?: AgentEffort;
  createdAt: string;
  updatedAt: string;
  nodes: QuestionNode[];
};

export type SessionMeta = {
  id: string;
  question: string;
  updatedAt: string;
  nodeCount: number;
};
