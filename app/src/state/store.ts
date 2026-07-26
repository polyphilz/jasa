import { create } from "zustand";
import { buildPrompt } from "../agent/prompt";
import { parseAgentLine, splitFollowUps, visibleAnswer } from "../agent/stream";
import { ipc, type AgentExit, type AgentLine, type CliDefaults } from "../ipc";
import {
  AgentEffort,
  AgentModel,
  NodeStatus,
  type QuestionNode,
  type Session,
  type SessionMeta,
} from "../types";

const now = () => new Date().toISOString();

const metaOf = (session: Session): SessionMeta => ({
  id: session.id,
  question: session.question,
  updatedAt: session.updatedAt,
  nodeCount: session.nodes.length,
});

/** Raw streamed text per generating node; flushed into state on a throttle. */
const buffers = new Map<string, string>();
let flushTimer: number | null = null;
let initialized = false;

type JasaState = {
  metas: SessionMeta[];
  sessions: Record<string, Session>;
  currentSessionId: string | null;
  selectedNodeId: string | null;
  /** What the agent CLI defaults to when the session doesn't pin a value. */
  cliDefaults: CliDefaults;
  /** nodeId → markdown streamed so far (marker-stripped), while generating. */
  streams: Record<string, string>;
  /** Resolves with the most recent session id, for the launch redirect. */
  init: () => Promise<string | null>;
  openSession: (id: string) => Promise<boolean>;
  createSession: (
    question: string,
    source: string,
    model: AgentModel,
    effort: AgentEffort,
  ) => Promise<string | null>;
  deleteSession: (id: string) => Promise<boolean>;
  setSessionModel: (sessionId: string, model: AgentModel) => void;
  setSessionEffort: (sessionId: string, effort: AgentEffort) => void;
  selectNode: (nodeId: string | null) => void;
  askFollowUp: (parentId: string, question: string) => void;
  adoptSuggestion: (parentId: string, question: string) => void;
  regenerate: (nodeId: string) => void;
  cancelGeneration: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
};

export const useJasaStore = create<JasaState>()((set, get) => {
  const updateSession = (sessionId: string, mutate: (session: Session) => void) => {
    const state = get();
    const existing = state.sessions[sessionId];
    if (!existing) {
      return;
    }
    const session = structuredClone(existing);
    mutate(session);
    session.updatedAt = now();
    set({
      sessions: { ...state.sessions, [sessionId]: session },
      metas: [metaOf(session), ...state.metas.filter((meta) => meta.id !== sessionId)],
    });
    void ipc.saveSession(session).catch((error) => console.error("failed to save session", error));
  };

  const clearStream = (nodeId: string) => {
    buffers.delete(nodeId);
    set((state) => {
      const { [nodeId]: _omit, ...streams } = state.streams;
      return { streams };
    });
  };

  const flushStreams = () => {
    flushTimer = null;
    set((state) => {
      const streams = { ...state.streams };
      for (const [nodeId, text] of buffers) {
        streams[nodeId] = visibleAnswer(text);
      }
      return { streams };
    });
  };

  const generateNode = (sessionId: string, nodeId: string) => {
    updateSession(sessionId, (session) => {
      const node = session.nodes.find((entry) => entry.id === nodeId);
      if (node) {
        node.status = NodeStatus.Generating;
        delete node.error;
      }
    });
    buffers.set(nodeId, "");
    set((state) => ({ streams: { ...state.streams, [nodeId]: "" } }));
    const session = get().sessions[sessionId];
    if (!session) {
      return;
    }
    void ipc
      .startGeneration({
        sessionId,
        nodeId,
        prompt: buildPrompt(session, nodeId),
        model: session.model ?? null,
        effort: session.effort ?? null,
      })
      .catch((error) => {
        clearStream(nodeId);
        updateSession(sessionId, (session) => {
          const node = session.nodes.find((entry) => entry.id === nodeId);
          if (node) {
            node.status = NodeStatus.Error;
            node.error = String(error);
          }
        });
      });
  };

  const handleAgentLine = ({ sessionId, nodeId, line }: AgentLine) => {
    const event = parseAgentLine(line);
    if (!event) {
      return;
    }
    if (event.kind === "delta") {
      if (!buffers.has(nodeId)) {
        return;
      }
      buffers.set(nodeId, (buffers.get(nodeId) ?? "") + event.text);
      if (flushTimer === null) {
        flushTimer = window.setTimeout(flushStreams, 90);
      }
      return;
    }
    clearStream(nodeId);
    updateSession(sessionId, (session) => {
      const node = session.nodes.find((entry) => entry.id === nodeId);
      if (!node || node.status !== NodeStatus.Generating) {
        return;
      }
      if (event.success) {
        const { answer, suggestions } = splitFollowUps(event.text);
        node.answer = answer;
        node.suggestions = suggestions;
        node.status = NodeStatus.Done;
        node.answeredAt = now();
        delete node.error;
      } else {
        node.status = NodeStatus.Error;
        node.error = event.error ?? "generation failed";
      }
    });
  };

  const handleAgentExit = ({ sessionId, nodeId, canceled, error }: AgentExit) => {
    const session = get().sessions[sessionId];
    const node = session?.nodes.find((entry) => entry.id === nodeId);
    if (!node || node.status !== NodeStatus.Generating) {
      return;
    }
    clearStream(nodeId);
    updateSession(sessionId, (session) => {
      const entry = session.nodes.find((entry) => entry.id === nodeId);
      if (!entry || entry.status !== NodeStatus.Generating) {
        return;
      }
      if (canceled) {
        entry.status = entry.answer ? NodeStatus.Done : NodeStatus.Idle;
      } else {
        entry.status = NodeStatus.Error;
        entry.error = error ?? "the agent exited without producing a result";
      }
    });
  };

  /** A session can be closed mid-generation; loaded copies must not claim to
   * still be generating. */
  const sanitize = (session: Session): Session => {
    for (const node of session.nodes) {
      if (node.status === NodeStatus.Generating) {
        node.status = node.answer ? NodeStatus.Done : NodeStatus.Idle;
      }
    }
    return session;
  };

  const addChild = (parentId: string, question: string, fromSuggestion: boolean) => {
    const { currentSessionId, sessions } = get();
    const session = currentSessionId ? sessions[currentSessionId] : undefined;
    const parent = session?.nodes.find((entry) => entry.id === parentId);
    if (!currentSessionId || !parent || !question.trim()) {
      return;
    }
    const child: QuestionNode = {
      id: crypto.randomUUID(),
      parentId,
      question: question.trim(),
      answer: "",
      status: NodeStatus.Idle,
      suggestions: [],
      createdAt: now(),
    };
    updateSession(currentSessionId, (session) => {
      const parent = session.nodes.find((entry) => entry.id === parentId);
      if (!parent) {
        return;
      }
      if (fromSuggestion) {
        parent.suggestions = parent.suggestions.filter((suggestion) => suggestion !== question);
      }
      session.nodes.push(child);
    });
    set({ selectedNodeId: child.id });
    generateNode(currentSessionId, child.id);
  };

  return {
    metas: [],
    sessions: {},
    currentSessionId: null,
    selectedNodeId: null,
    cliDefaults: { model: null, effort: null },
    streams: {},

    init: async () => {
      if (initialized) {
        return null;
      }
      initialized = true;
      ipc.onAgentLine(handleAgentLine);
      ipc.onAgentExit(handleAgentExit);
      void ipc
        .cliDefaults()
        .then((cliDefaults) => set({ cliDefaults }))
        .catch((error) => console.error("failed to read CLI defaults", error));
      const metas = await ipc.listSessions().catch((error) => {
        console.error("failed to list sessions", error);
        return [] as SessionMeta[];
      });
      set({ metas });
      return metas[0]?.id ?? null;
    },

    openSession: async (id) => {
      const cached = get().sessions[id];
      if (cached) {
        const root = cached.nodes.find((entry) => entry.parentId === null);
        set({
          currentSessionId: id,
          selectedNodeId: root?.id ?? null,
        });
        return true;
      }
      try {
        const session = sanitize(await ipc.loadSession(id));
        const root = session.nodes.find((entry) => entry.parentId === null);
        set((state) => ({
          sessions: { ...state.sessions, [id]: session },
          currentSessionId: id,
          selectedNodeId: root?.id ?? null,
        }));
        return true;
      } catch (error) {
        console.error("failed to open session", error);
        return false;
      }
    },

    createSession: async (question, source, model, effort) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) {
        return null;
      }
      const timestamp = now();
      const root: QuestionNode = {
        id: crypto.randomUUID(),
        parentId: null,
        question: trimmedQuestion,
        answer: "",
        status: NodeStatus.Idle,
        suggestions: [],
        createdAt: timestamp,
      };
      const session: Session = {
        id: crypto.randomUUID(),
        question: trimmedQuestion,
        createdAt: timestamp,
        updatedAt: timestamp,
        nodes: [root],
      };
      const trimmedSource = source.trim();
      if (trimmedSource) {
        session.source = trimmedSource;
      }
      if (model !== AgentModel.Default) {
        session.model = model;
      }
      if (effort !== AgentEffort.Default) {
        session.effort = effort;
      }
      set((state) => ({
        sessions: { ...state.sessions, [session.id]: session },
        metas: [metaOf(session), ...state.metas],
        currentSessionId: session.id,
        selectedNodeId: root.id,
      }));
      await ipc
        .saveSession(session)
        .catch((error) => console.error("failed to save session", error));
      generateNode(session.id, root.id);
      return session.id;
    },

    deleteSession: async (id) => {
      const session = get().sessions[id];
      for (const node of session?.nodes ?? []) {
        if (node.status === NodeStatus.Generating) {
          void ipc.cancelGeneration(node.id);
        }
        buffers.delete(node.id);
      }
      try {
        await ipc.deleteSession(id);
      } catch (error) {
        console.error("failed to delete session", error);
        return false;
      }
      set((state) => {
        const { [id]: _omit, ...sessions } = state.sessions;
        const metas = state.metas.filter((meta) => meta.id !== id);
        const wasCurrent = state.currentSessionId === id;
        return {
          sessions,
          metas,
          currentSessionId: wasCurrent ? null : state.currentSessionId,
          selectedNodeId: wasCurrent ? null : state.selectedNodeId,
        };
      });
      return true;
    },

    setSessionModel: (sessionId, model) => {
      updateSession(sessionId, (session) => {
        if (model === AgentModel.Default) {
          delete session.model;
        } else {
          session.model = model;
        }
      });
    },

    setSessionEffort: (sessionId, effort) => {
      updateSession(sessionId, (session) => {
        if (effort === AgentEffort.Default) {
          delete session.effort;
        } else {
          session.effort = effort;
        }
      });
    },

    selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

    askFollowUp: (parentId, question) => addChild(parentId, question, false),

    adoptSuggestion: (parentId, question) => addChild(parentId, question, true),

    regenerate: (nodeId) => {
      const { currentSessionId } = get();
      if (currentSessionId) {
        generateNode(currentSessionId, nodeId);
      }
    },

    cancelGeneration: (nodeId) => {
      void ipc.cancelGeneration(nodeId);
    },

    deleteNode: (nodeId) => {
      const { currentSessionId, sessions, selectedNodeId } = get();
      const session = currentSessionId ? sessions[currentSessionId] : undefined;
      const target = session?.nodes.find((entry) => entry.id === nodeId);
      if (!currentSessionId || !session || !target || target.parentId === null) {
        return;
      }
      const removed = new Set([nodeId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const node of session.nodes) {
          if (node.parentId !== null && removed.has(node.parentId) && !removed.has(node.id)) {
            removed.add(node.id);
            grew = true;
          }
        }
      }
      for (const node of session.nodes) {
        if (removed.has(node.id) && node.status === NodeStatus.Generating) {
          void ipc.cancelGeneration(node.id);
        }
        if (removed.has(node.id)) {
          buffers.delete(node.id);
        }
      }
      updateSession(currentSessionId, (session) => {
        session.nodes = session.nodes.filter((node) => !removed.has(node.id));
      });
      if (selectedNodeId !== null && removed.has(selectedNodeId)) {
        set({ selectedNodeId: target.parentId });
      }
    },
  };
});
