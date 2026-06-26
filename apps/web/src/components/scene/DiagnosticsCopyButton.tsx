// =========================================================================
// DiagnosticsCopyButton — 统一复制按钮
// 在诊断抽屉中用于复制 taskId / error / failedReason / promptTips / full diagnostics
// =========================================================================

import { useState } from "react";

interface DiagnosticsCopyButtonProps {
  label: string;
  value: string | null | undefined;
}

export default function DiagnosticsCopyButton({ label, value }: DiagnosticsCopyButtonProps) {
  var [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(function () { setCopied(false); }, 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!value}
      className="text-[10px] rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:text-zinc-400"
    >
      {copied ? "已复制" : label}
    </button>
  );
}
