import { useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { effortOptions, modelOptions } from "../lib/agentOptions";
import { useJasaStore } from "../state/store";
import { AgentEffort, AgentModel } from "../types";
import { JasaSelect } from "./JasaSelect";
import { StarField } from "./StarField";

export const NewSession = () => {
  const createSession = useJasaStore((state) => state.createSession);
  const cliDefaults = useJasaStore((state) => state.cliDefaults);
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [question, setQuestion] = useState("");
  const [source, setSource] = useState("");
  const [model, setModel] = useState<AgentModel>(AgentModel.Default);
  const [effort, setEffort] = useState<AgentEffort>(AgentEffort.Default);
  const [creating, setCreating] = useState(false);

  const models = useMemo(() => modelOptions(cliDefaults), [cliDefaults]);
  const efforts = useMemo(() => effortOptions(cliDefaults), [cliDefaults]);

  const submit = () => {
    if (!question.trim() || creating) {
      return;
    }
    setCreating(true);
    void createSession(question, source, model, effort).then((id) => {
      if (id) {
        void navigate({ to: "/session/$sessionId", params: { sessionId: id } });
      } else {
        setCreating(false);
      }
    });
  };

  return (
    <div className="relative flex h-full items-center justify-center px-8">
      <StarField avoidRef={formRef} />
      <form
        ref={formRef}
        className="relative w-full max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h1 className="text-xl font-bold text-balance text-ink">What do you want to understand?</h1>
        <p className="mt-1.5 text-sm text-pretty text-muted">
          One research question per session. Answers branch into follow-ups on a canvas, so every
          rabbit hole keeps its own thread.
        </p>
        <textarea
          autoFocus
          rows={3}
          className="jasa-input mt-6 w-full resize-none"
          placeholder="e.g. How do modern large language models work?"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <input
          className="jasa-input mt-3 w-full"
          placeholder="Optional source — the lecture, paper, or URL you're studying"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        />
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold text-muted">Model</span>
            <JasaSelect ariaLabel="Model" value={model} onChange={setModel} options={models} />
            <span className="text-[11px] font-semibold text-muted">Effort</span>
            <JasaSelect ariaLabel="Effort" value={effort} onChange={setEffort} options={efforts} />
          </div>
          <button
            type="submit"
            className="jasa-btn-primary"
            disabled={!question.trim() || creating}
          >
            Start exploring
          </button>
        </div>
      </form>
    </div>
  );
};
