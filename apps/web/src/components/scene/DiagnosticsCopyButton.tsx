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
      className="text-[10px] rounded border border-gray-600 bg-gray-800 px-2 py-1 text-gray-400 hover:text-gray-200 disabled:opacity-40 disabled:hover:text-gray-400"
    >
      {copied ? "已复制" : label}
    </button>
  );
}
