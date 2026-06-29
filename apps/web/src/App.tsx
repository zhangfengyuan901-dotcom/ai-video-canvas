// =========================================================================
// App Root — AI video canvas with dark professional UI
// =========================================================================

import { useEffect } from "react";
import TopBar from "./components/layout/TopBar";
import WorkspaceLayout from "./components/layout/WorkspaceLayout";

export default function App() {
  // Global toast listener — any component can fire:
  // window.dispatchEvent(new CustomEvent('toast', { detail: { message: '...', type: 'success'|'error'|'info' } }))
  useEffect(() => {
    function handleToast(e: Event) {
      const { message, type } = (e as CustomEvent).detail ?? {};
      if (!message) return;
      const colors: Record<string, string> = {
        success: "bg-green-600 border-green-500",
        error: "bg-red-600 border-red-500",
        info: "bg-blue-600 border-blue-500",
      };
      const icons: Record<string, string> = {
        success: "✓", error: "✕", info: "ℹ",
      };
      const toast = document.createElement("div");
      toast.className = `fixed bottom-4 right-4 z-[100] pointer-events-auto flex items-center gap-3 px-4 py-3 rounded shadow-lg border text-white text-sm font-medium animate-[slideIn_0.3s_ease-out] ${colors[type] ?? colors.info}`;
      toast.innerHTML = `<span class="font-bold">${icons[type] ?? icons.info}</span> <span>${message}</span>`;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
    window.addEventListener("toast", handleToast);
    return () => window.removeEventListener("toast", handleToast);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-900 text-gray-100">
      <TopBar />
      <WorkspaceLayout />
    </div>
  );
}
