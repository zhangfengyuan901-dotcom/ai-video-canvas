// =========================================================================
// App Root
// =========================================================================

import TopBar from "./components/layout/TopBar";
import WorkspaceLayout from "./components/layout/WorkspaceLayout";

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <TopBar />
      <WorkspaceLayout />
    </div>
  );
}
