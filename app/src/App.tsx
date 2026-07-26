import { useEffect } from "react";
import { Canvas } from "./components/Canvas";
import { NewSession } from "./components/NewSession";
import { ReadingPane } from "./components/ReadingPane";
import { Sidebar } from "./components/Sidebar";
import { useJasaStore } from "./state/store";

const App = () => {
  const init = useJasaStore((state) => state.init);
  const creatingSession = useJasaStore((state) => state.creatingSession);
  const session = useJasaStore((state) =>
    state.currentSessionId ? state.sessions[state.currentSessionId] : undefined,
  );
  const selectedNodeId = useJasaStore((state) => state.selectedNodeId);
  const selectNode = useJasaStore((state) => state.selectNode);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        selectNode(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectNode]);

  const showCanvas = session !== undefined && !creatingSession;
  const selectedNode = showCanvas
    ? session.nodes.find((node) => node.id === selectedNodeId)
    : undefined;

  return (
    <div className="flex h-dvh bg-canvas font-sans text-ink">
      <Sidebar />
      <main className="relative min-w-0 flex-1">
        {showCanvas ? <Canvas session={session} /> : <NewSession />}
      </main>
      {selectedNode && <ReadingPane node={selectedNode} />}
    </div>
  );
};

export default App;
