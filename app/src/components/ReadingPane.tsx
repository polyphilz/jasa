import { useState } from "react";
import { useJasaStore } from "../state/store";
import { NodeStatus, type QuestionNode } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { CheckIcon, CopyIcon, RefreshIcon, StopIcon, TrashIcon, XIcon } from "./icons";
import { Markdown } from "./Markdown";
import { Spinner } from "./Spinner";

export const ReadingPane = ({ node }: { node: QuestionNode }) => {
  const stream = useJasaStore((state) => state.streams[node.id]);
  const selectNode = useJasaStore((state) => state.selectNode);
  const askFollowUp = useJasaStore((state) => state.askFollowUp);
  const adoptSuggestion = useJasaStore((state) => state.adoptSuggestion);
  const regenerate = useJasaStore((state) => state.regenerate);
  const cancelGeneration = useJasaStore((state) => state.cancelGeneration);
  const deleteNode = useJasaStore((state) => state.deleteNode);

  const [followUp, setFollowUp] = useState("");
  const [copied, setCopied] = useState(false);

  const generating = node.status === NodeStatus.Generating;

  const submitFollowUp = () => {
    const question = followUp.trim();
    if (question) {
      askFollowUp(node.id, question);
      setFollowUp("");
    }
  };

  const copyAnswer = () => {
    void navigator.clipboard.writeText(node.answer).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <aside className="flex w-[30rem] shrink-0 flex-col border-l border-line bg-surface/50">
      <header className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[15px]/[1.4] font-bold text-balance text-ink">{node.question}</h2>
          <button
            type="button"
            aria-label="Close panel"
            className="jasa-icon-btn -mr-1 shrink-0"
            onClick={() => selectNode(null)}
          >
            <XIcon className="size-4" />
          </button>
        </div>
        <div className="mt-2.5 flex items-center gap-1">
          {generating ? (
            <button type="button" className="jasa-btn" onClick={() => cancelGeneration(node.id)}>
              <StopIcon className="size-3.5" />
              Stop
            </button>
          ) : (
            <button type="button" className="jasa-btn" onClick={() => regenerate(node.id)}>
              <RefreshIcon className="size-3.5" />
              {node.status === NodeStatus.Done ? "Regenerate" : "Generate"}
            </button>
          )}
          {node.status === NodeStatus.Done && (
            <button type="button" className="jasa-btn" onClick={copyAnswer}>
              {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {node.parentId !== null && (
            <ConfirmDialog
              trigger={<TrashIcon className="size-3.5" />}
              triggerClassName="jasa-icon-btn ml-auto"
              triggerLabel="Delete this question"
              title="Delete this question?"
              description="The question, its answer, and every follow-up beneath it will be removed."
              confirmLabel="Delete"
              onConfirm={() => deleteNode(node.id)}
            />
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {generating &&
          (stream ? (
            <Markdown text={stream} />
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner />
              Researching…
            </div>
          ))}

        {node.status === NodeStatus.Done && <Markdown text={node.answer} />}

        {node.status === NodeStatus.Error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-4">
            <p className="text-sm font-medium text-red-300">Generation failed</p>
            <p className="mt-1.5 font-mono text-xs text-pretty break-words text-red-300/70">
              {node.error}
            </p>
          </div>
        )}

        {node.status === NodeStatus.Idle && (
          <p className="text-sm text-muted">
            Not answered yet. Generate an answer, or edit your follow-up below first.
          </p>
        )}

        {node.status === NodeStatus.Done && node.suggestions.length > 0 && (
          <div className="mt-6 border-t border-line pt-4">
            <p className="text-[11px] font-semibold tracking-normal text-muted uppercase">
              Suggested follow-ups
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {node.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-lg border border-dashed border-line-strong px-3 py-2 text-left text-[13px] text-ink/80 transition-colors hover:border-accent hover:text-ink"
                  onClick={() => adoptSuggestion(node.id, suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-line p-4">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            submitFollowUp();
          }}
        >
          <textarea
            rows={2}
            className="jasa-input w-full resize-none"
            placeholder="Ask a follow-up about this answer…"
            value={followUp}
            onChange={(event) => setFollowUp(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitFollowUp();
              }
            }}
          />
          <div className="flex justify-end">
            <button type="submit" className="jasa-btn-primary" disabled={!followUp.trim()}>
              Ask follow-up
            </button>
          </div>
        </form>
      </footer>
    </aside>
  );
};
