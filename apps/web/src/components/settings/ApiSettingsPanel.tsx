// =========================================================================
// ApiSettingsPanel — API 配置面板（右侧抽屉）
// =========================================================================

import { useState, useEffect } from "react";
import { useApiSettings } from "../../hooks/useApiSettings";
import type { ApiSettingsStatus, ApiSettingsCheckResult } from "../../hooks/useApiSettings";
import RhCliPanel from "../rhcli/RhCliPanel";
import { useImageProviderStore } from "../../stores/imageProviderStore";

interface ApiSettingsPanelProps {
  onClose: () => void;
}

export default function ApiSettingsPanel({ onClose }: ApiSettingsPanelProps) {
  const { getApiSettings, saveApiSettings, checkApiSettings } = useApiSettings();
  const { provider, setProvider, runninghubImageModel, setRunninghubImageModel } = useImageProviderStore();

  const [status, setStatus] = useState<ApiSettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkResult, setCheckResult] = useState<ApiSettingsCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [chatKey, setChatKey] = useState("");
  const [chatBaseUrl, setChatBaseUrl] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [clearChatKey, setClearChatKey] = useState(false);
  const [showChatAdvanced, setShowChatAdvanced] = useState(false);
  const [packyKey, setPackyKey] = useState("");
  const [packyBaseUrl, setPackyBaseUrl] = useState("");
  const [packyModel, setPackyModel] = useState("");
  const [clearPackyKey, setClearPackyKey] = useState(false);
  const [rhKey, setRhKey] = useState("");
  const [rhSubmitUrl, setRhSubmitUrl] = useState("");
  const [rhQueryUrl, setRhQueryUrl] = useState("");
  const [rhUploadUrl, setRhUploadUrl] = useState("");
  const [clearRhKey, setClearRhKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await getApiSettings();
        setStatus(s);
        setChatBaseUrl(s.chat.baseUrl);
        setChatModel(s.chat.model);
        setPackyBaseUrl(s.packy.baseUrl);
        setPackyModel(s.packy.imageModel);
        setRhSubmitUrl(s.runninghub.submitUrl);
        setRhQueryUrl(s.runninghub.queryUrl);
        setRhUploadUrl(s.runninghub.uploadUrl);
      } catch {
        setError("读取配置失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [getApiSettings]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  async function handleSave() {
    setError(null); setSuccessMsg(null); setSaving(true);
    try {
      const payload: any = {
        chat: { baseUrl: chatBaseUrl.trim() || undefined, model: chatModel.trim() || undefined, apiKey: chatKey.trim() || undefined, clearApiKey: clearChatKey },
        packy: { baseUrl: packyBaseUrl.trim() || undefined, imageModel: packyModel.trim() || undefined, apiKey: packyKey.trim() || undefined, clearApiKey: clearPackyKey },
        runninghub: { apiKey: rhKey.trim() || undefined, clearApiKey: clearRhKey, submitUrl: rhSubmitUrl.trim() || undefined, queryUrl: rhQueryUrl.trim() || undefined, uploadUrl: rhUploadUrl.trim() || undefined },
      };
      const result = await saveApiSettings(payload);
      setStatus(result);
      setChatKey(""); setPackyKey(""); setRhKey(""); setClearChatKey(false); setClearPackyKey(false); setClearRhKey(false);
      setSuccessMsg("已保存");
    } catch {
      setError("保存失败，请检查配置格式或服务端日志。");
    } finally {
      setSaving(false);
    }
  }

  async function handleCheck() {
    setError(null); setCheckResult(null);
    try { setCheckResult(await checkApiSettings()); }
    catch { setError("自检失败"); }
  }

  async function handleReload() {
    setCheckResult(null); setError(null); setChatKey(""); setPackyKey(""); setRhKey("");
    try {
      const s = await getApiSettings();
      setStatus(s);
      setChatBaseUrl(s.chat.baseUrl);
      setChatModel(s.chat.model);
      setPackyBaseUrl(s.packy.baseUrl);
      setPackyModel(s.packy.imageModel);
      setRhSubmitUrl(s.runninghub.submitUrl);
      setRhQueryUrl(s.runninghub.queryUrl);
      setRhUploadUrl(s.runninghub.uploadUrl);
    } catch { setError("读取配置失败"); }
  }

  function SourceBadge({ source }: { source: string }) {
    if (source === "env") return <span className="text-[9px] bg-gray-600 text-gray-400 px-1 rounded">ENV</span>;
    if (source === "stored") return <span className="text-[9px] bg-blue-800/40 text-blue-400 px-1 rounded">本地配置</span>;
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[460px] bg-gray-900 border-l border-gray-700 shadow-2xl z-[70] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <h2 className="text-sm font-semibold text-gray-200">API 配置</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading ? (
            <p className="text-xs text-gray-500">加载中...</p>
          ) : (
            <>
              {error && <div className="text-xs text-red-400 bg-red-600/10 rounded px-3 py-2">{error}</div>}
              {successMsg && <div className="text-xs text-green-400 bg-green-600/10 rounded px-3 py-2">{successMsg}</div>}

              {/* Chat / Script LLM */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-300">脚本生成 API · Chat LLM</span>
                  <ConfiguredBadge configured={status?.chat.configured ?? false} />
                  <SourceBadge source={status?.chat.source ?? "missing"} />
                  <div className="flex-1" />
                  <button onClick={handleSave} disabled={saving}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 transition disabled:opacity-50"
                    title="保存全部配置">
                    {saving ? "..." : "保存"}
                  </button>
                </div>
                <label className="block">
                  <span className="text-[10px] text-gray-500">Base URL</span>
                  <input type="text" value={chatBaseUrl} onChange={(e) => setChatBaseUrl(e.target.value)}
                    placeholder="https://www.packyapi.com/v1"
                    className="w-full mt-0.5 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600" />
                </label>
                <label className="block">
                  <span className="text-[10px] text-gray-500">Model</span>
                  <input type="text" value={chatModel} onChange={(e) => setChatModel(e.target.value)}
                    placeholder="gpt-5.4"
                    className="w-full mt-0.5 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600" />
                </label>
                <label className="block">
                  <span className="text-[10px] text-gray-500">API Key</span>
                  <input type="password" value={chatKey} onChange={(e) => setChatKey(e.target.value)}
                    placeholder={status?.chat.configured ? "已配置，留空则不修改" : "请输入 API Key"}
                    className="w-full mt-0.5 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600" />
                </label>
                {status?.chat.configured && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={clearChatKey} onChange={(e) => setClearChatKey(e.target.checked)} className="accent-red-600" />
                    <span className="text-[10px] text-gray-500">清除已保存的密钥</span>
                  </label>
                )}
                <p className="text-[10px] text-gray-600">支持 OpenAI 兼容接口（/v1/chat/completions），可接入 Packy、RunningHub LLM、Qwen 等。</p>
              </section>

              <hr className="border-gray-700" />

              {/* Image Provider Toggle */}
              <section className="space-y-2">
                <span className="text-xs font-medium text-gray-300">Image Provider</span>
                <div className="flex gap-2 items-center">
                  <button onClick={() => setProvider("packy")}
                    className={`flex-1 text-[10px] py-1.5 rounded font-medium transition ${
                      provider === "packy" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-gray-200"}`}>
                    Packy (gpt-image-2)
                  </button>
                  <button onClick={() => setProvider("runninghub")}
                    className={`flex-1 text-[10px] py-1.5 rounded font-medium transition ${
                      provider === "runninghub" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400 hover:text-gray-200"}`}>
                    RunningHub (5 models)
                  </button>
                </div>
              </section>

              <hr className="border-gray-700" />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-300">图片生成 API · Packy (gpt-image-2)</span>
                  <ConfiguredBadge configured={status?.packy.configured ?? false} />
                  <SourceBadge source={status?.packy.source ?? "missing"} />
                  <div className="flex-1" />
                  <button onClick={handleSave} disabled={saving}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 transition disabled:opacity-50"
                    title="保存全部配置">
                    {saving ? "..." : "保存"}
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  API Key 需归属 <b className="text-gray-400">Sora 分组</b>。
                  文生图：<code className="text-blue-400">POST {packyBaseUrl || 'https://www.packyapi.com/v1'}/images/generations</code>，
                  图生图：<code className="text-purple-400">POST /images/edits</code>
                </p>
                <label className="block">
                  <span className="text-[10px] text-gray-500">Base URL（不含路径尾缀）</span>
                  <input type="text" value={packyBaseUrl} onChange={(e) => setPackyBaseUrl(e.target.value)}
                    placeholder="https://www.packyapi.com/v1"
                    className="w-full mt-0.5 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600" />
                </label>
                <label className="block">
                  <span className="text-[10px] text-gray-500">Image Model（固定为 gpt-image-2）</span>
                  <input type="text" value={packyModel} onChange={(e) => setPackyModel(e.target.value)}
                    placeholder="gpt-image-2"
                    className="w-full mt-0.5 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600" />
                </label>
                <label className="block">
                  <span className="text-[10px] text-gray-500">API Key（Sora 分组）</span>
                  <input type="password" value={packyKey} onChange={(e) => setPackyKey(e.target.value)}
                    placeholder={status?.packy.configured ? "已配置，留空则不修改" : "请输入 API Key"}
                    className="w-full mt-0.5 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600" />
                </label>
                {status?.packy.configured && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={clearPackyKey} onChange={(e) => setClearPackyKey(e.target.checked)} className="accent-red-600" />
                    <span className="text-[10px] text-gray-500">清除已保存的密钥</span>
                  </label>
                )}
              </section>

              <hr className="border-gray-700" />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-300">视频生成 API · RunningHub</span>
                  <ConfiguredBadge configured={status?.runninghub.configured ?? false} />
                  <SourceBadge source={status?.runninghub.source ?? "missing"} />
                  <div className="flex-1" />
                  <button onClick={handleSave} disabled={saving}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 transition disabled:opacity-50"
                    title="保存全部配置">
                    {saving ? "..." : "保存"}
                  </button>
                </div>
                <label className="block">
                  <span className="text-[10px] text-gray-500">API Key</span>
                  <input type="password" value={rhKey} onChange={(e) => setRhKey(e.target.value)}
                    placeholder={status?.runninghub.configured ? "已配置，留空则不修改" : "请输入 API Key"}
                    className="w-full mt-0.5 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-600" />
                </label>
                {status?.runninghub.configured && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={clearRhKey} onChange={(e) => setClearRhKey(e.target.checked)} className="accent-red-600" />
                    <span className="text-[10px] text-gray-500">清除已保存的密钥</span>
                  </label>
                )}
                <button onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
                  {showAdvanced ? "收起高级设置" : "展开高级设置"}
                </button>
                {showAdvanced && (
                  <div className="space-y-3 pl-2 border-l border-gray-700">
                    {[{ l: "Submit URL", v: rhSubmitUrl, s: setRhSubmitUrl }, { l: "Query URL", v: rhQueryUrl, s: setRhQueryUrl }, { l: "Upload URL", v: rhUploadUrl, s: setRhUploadUrl }].map(({ l, v, s }) => (
                      <label key={l} className="block">
                        <span className="text-[10px] text-gray-500">{l}</span>
                        <input type="text" value={v} onChange={(e) => s(e.target.value)}
                          className="w-full mt-0.5 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-600" />
                      </label>
                    ))}
                  </div>
                )}
              </section>

              <hr className="border-gray-700" />

              {checkResult && (
                <div className="space-y-1">
                  <p className={`text-xs ${checkResult.chat.configured ? "text-green-400" : "text-red-400"}`}>
                    Chat LLM: {checkResult.chat.message}
                  </p>
                  <p className={`text-xs ${checkResult.packy.configured ? "text-green-400" : "text-red-400"}`}>
                    Packy: {checkResult.packy.message}
                  </p>
                  <p className={`text-xs ${checkResult.runninghub.configured ? "text-green-400" : "text-red-400"}`}>
                    RunningHub: {checkResult.runninghub.message}
                  </p>
                </div>
              )}

              <hr className="border-gray-700" />
              <RhCliPanel />
            </>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-gray-700 bg-gray-900/95 backdrop-blur-sm px-5 py-3 flex items-center gap-2 shrink-0">
          <button onClick={handleReload} className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="重新读取已保存的配置">
            <i className="fa-solid fa-rotate-right mr-1" />重新读取
          </button>
          <button onClick={handleCheck} className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors" title="检查 API 连通性">
            <i className="fa-solid fa-check-circle mr-1" />自检
          </button>
          <div className="flex-1" />
          <span className="text-[10px] text-gray-500">保存全部配置</span>
          <button onClick={handleSave} disabled={saving}
            className="text-xs px-5 py-2 rounded-lg font-semibold transition-all bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 active:from-blue-600 active:to-blue-700 text-white shadow-sm shadow-blue-500/20 disabled:bg-gray-600 disabled:from-gray-600 disabled:to-gray-600 disabled:text-gray-500 disabled:shadow-none">
            {saving ? "保存中..." : "保存全部"}
          </button>
        </div>
      </div>
    </>
  );
}

function ConfiguredBadge({ configured }: { configured: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${configured ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
      {configured ? "已配置" : "未配置"}
    </span>
  );
}
