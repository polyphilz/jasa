import { Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { useJasaStore } from "./state/store";

const App = () => {
  const navigate = useNavigate();
  const router = useRouter();

  // Land on the most recently updated session at launch. Only the initial
  // "/" is redirected, so deliberate navigation home is never hijacked.
  useEffect(() => {
    void useJasaStore
      .getState()
      .init()
      .then((recentId) => {
        if (recentId && router.state.location.pathname === "/") {
          void navigate({
            to: "/session/$sessionId",
            params: { sessionId: recentId },
            replace: true,
          });
        }
      });
  }, [navigate, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      if (event.key === "[") {
        event.preventDefault();
        router.history.back();
      } else if (event.key === "]") {
        event.preventDefault();
        router.history.forward();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <div className="flex h-dvh bg-canvas font-sans text-ink">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default App;
