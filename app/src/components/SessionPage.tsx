import { Navigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useJasaStore } from "../state/store";
import { Canvas } from "./Canvas";
import { ReadingPane } from "./ReadingPane";

export const SessionPage = () => {
  const { sessionId } = useParams({ from: "/session/$sessionId" });
  const session = useJasaStore((state) => state.sessions[sessionId]);
  const openSession = useJasaStore((state) => state.openSession);
  const selectedNodeId = useJasaStore((state) => state.selectedNodeId);
  const selectNode = useJasaStore((state) => state.selectNode);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let stale = false;
    setMissing(false);
    void openSession(sessionId).then((opened) => {
      if (!opened && !stale) {
        setMissing(true);
      }
    });
    return () => {
      stale = true;
    };
  }, [sessionId, openSession]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        selectNode(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectNode]);

  if (missing) {
    return <Navigate to="/" replace />;
  }
  if (!session) {
    return null;
  }
  const selectedNode = session.nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1">
        <Canvas session={session} />
      </div>
      {selectedNode && <ReadingPane node={selectedNode} />}
    </div>
  );
};
