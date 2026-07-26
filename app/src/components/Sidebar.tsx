import { cn } from "../lib/cn";
import { useJasaStore } from "../state/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { PlusIcon, TrashIcon } from "./icons";

export const Sidebar = () => {
  const metas = useJasaStore((state) => state.metas);
  const currentSessionId = useJasaStore((state) => state.currentSessionId);
  const creatingSession = useJasaStore((state) => state.creatingSession);
  const openSession = useJasaStore((state) => state.openSession);
  const showNewSession = useJasaStore((state) => state.showNewSession);
  const deleteSession = useJasaStore((state) => state.deleteSession);

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r border-line bg-surface/60">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="text-sm font-bold text-ink">jasa</span>
        <button type="button" className="jasa-btn" onClick={showNewSession}>
          <PlusIcon className="size-3.5" />
          New
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {metas.map((meta) => (
          <li key={meta.id} className="group relative">
            <button
              type="button"
              className={cn(
                "w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-ink/5",
                meta.id === currentSessionId && !creatingSession && "bg-accent-soft",
              )}
              onClick={() => void openSession(meta.id)}
            >
              <span className="line-clamp-2 pr-5 text-[13px]/[1.4] text-ink/90">
                {meta.question}
              </span>
              <span className="mt-1 block text-[11px] text-muted tabular-nums">
                {meta.nodeCount} {meta.nodeCount === 1 ? "question" : "questions"}
              </span>
            </button>
            <ConfirmDialog
              trigger={<TrashIcon className="size-3.5" />}
              triggerClassName="jasa-icon-btn absolute top-2 right-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              triggerLabel={`Delete session: ${meta.question}`}
              title="Delete this session?"
              description="The whole question tree and all generated answers will be removed."
              confirmLabel="Delete"
              onConfirm={() => void deleteSession(meta.id)}
            />
          </li>
        ))}
        {metas.length === 0 && (
          <li className="px-3 py-2.5 text-[13px] text-muted">No sessions yet.</li>
        )}
      </ul>
    </nav>
  );
};
