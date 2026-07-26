import { AlertDialog } from "@base-ui-components/react/alert-dialog";
import { useState } from "react";
import { useJasaStore } from "../state/store";
import { AgentEffort, AgentEffortLabel, AgentModel, AgentModelLabel, type Session } from "../types";
import { JasaSelect, type JasaSelectOption } from "./JasaSelect";

const MODEL_OPTIONS: readonly JasaSelectOption<AgentModel>[] = Object.values(AgentModel).map(
  (model) => ({ value: model, label: AgentModelLabel[model] }),
);

const EFFORT_OPTIONS: readonly JasaSelectOption<AgentEffort>[] = Object.values(AgentEffort).map(
  (effort) => ({ value: effort, label: AgentEffortLabel[effort] }),
);

/**
 * Per-session model and effort controls shown on the canvas. Switching the
 * model after answers exist warns first: the provider prompt cache is keyed
 * by model, so a switch re-ingests full thread context at uncached rates.
 */
export const SessionControls = ({ session }: { session: Session }) => {
  const setSessionModel = useJasaStore((state) => state.setSessionModel);
  const setSessionEffort = useJasaStore((state) => state.setSessionEffort);
  const [pendingModel, setPendingModel] = useState<AgentModel | null>(null);
  const currentModel = session.model ?? AgentModel.Default;
  const currentEffort = session.effort ?? AgentEffort.Default;
  const hasAnswers = session.nodes.some((node) => node.answer !== "");

  const requestModelChange = (model: AgentModel) => {
    if (model === currentModel) {
      return;
    }
    if (hasAnswers) {
      setPendingModel(model);
    } else {
      setSessionModel(session.id, model);
    }
  };

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface/90 px-2.5 py-1.5 shadow-md">
      <span className="text-[11px] font-semibold text-muted">Model</span>
      <JasaSelect
        ariaLabel="Model"
        value={currentModel}
        onChange={requestModelChange}
        options={MODEL_OPTIONS}
      />
      <span className="h-4 w-px bg-line" />
      <span className="text-[11px] font-semibold text-muted">Effort</span>
      <JasaSelect
        ariaLabel="Effort"
        value={currentEffort}
        onChange={(effort) => setSessionEffort(session.id, effort)}
        options={EFFORT_OPTIONS}
      />
      <AlertDialog.Root
        open={pendingModel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingModel(null);
          }
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
          <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface p-5 shadow-xl">
            <AlertDialog.Title className="text-sm font-bold text-balance text-ink">
              Switch model mid-session?
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-1.5 text-[13px] text-pretty text-muted">
              New answers will use {pendingModel ? AgentModelLabel[pendingModel] : ""} instead of{" "}
              {AgentModelLabel[currentModel]}. The prompt cache is keyed by model, so existing
              threads lose their cache and follow-ups re-send their full context at uncached rates —
              expect higher usage until new caches build up.
            </AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Close className="jasa-btn">Cancel</AlertDialog.Close>
              <AlertDialog.Close
                className="jasa-btn-primary"
                onClick={() => {
                  if (pendingModel) {
                    setSessionModel(session.id, pendingModel);
                  }
                }}
              >
                Switch model
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
};
