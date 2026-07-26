import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { cn } from "../lib/cn";
import { useJasaStore } from "../state/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { PlusIcon, TrashIcon } from "./icons";

export const Sidebar = () => {
  const metas = useJasaStore((state) => state.metas);
  const deleteSession = useJasaStore((state) => state.deleteSession);
  const { sessionId: activeSessionId } = useParams({ strict: false });
  const navigate = useNavigate();

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r border-line bg-surface/60">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link to="/" className="text-sm font-bold text-ink transition-colors hover:text-accent">
          jasa
        </Link>
        <Link to="/" className="jasa-btn">
          <PlusIcon className="size-3.5" />
          New
        </Link>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {metas.map((meta) => (
          <li key={meta.id} className="group relative">
            <Link
              to="/session/$sessionId"
              params={{ sessionId: meta.id }}
              className={cn(
                "block w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-ink/5",
                meta.id === activeSessionId && "bg-accent-soft",
              )}
            >
              <span className="line-clamp-2 pr-5 text-[13px]/[1.4] text-ink/90">
                {meta.question}
              </span>
              <span className="mt-1 block text-[11px] text-muted tabular-nums">
                {meta.nodeCount} {meta.nodeCount === 1 ? "question" : "questions"}
              </span>
            </Link>
            <ConfirmDialog
              trigger={<TrashIcon className="size-3.5" />}
              triggerClassName="jasa-icon-btn absolute top-2 right-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              triggerLabel={`Delete session: ${meta.question}`}
              title="Delete this session?"
              description="The whole question tree and all generated answers will be removed."
              confirmLabel="Delete"
              onConfirm={() => {
                void deleteSession(meta.id).then((deleted) => {
                  if (deleted && meta.id === activeSessionId) {
                    void navigate({ to: "/" });
                  }
                });
              }}
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
