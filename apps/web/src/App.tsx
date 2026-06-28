// =========================================================================
// App Root — AI video canvas with dark professional UI
// =========================================================================

import TopBar from "./components/layout/TopBar";
import WorkspaceLayout from "./components/layout/WorkspaceLayout";

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-900 text-gray-100">
      <TopBar />
      <WorkspaceLayout />
    </div>
  );
}
