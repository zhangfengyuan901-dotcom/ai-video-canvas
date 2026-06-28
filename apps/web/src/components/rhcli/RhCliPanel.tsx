// =========================================================================
// RhCliPanel — RunningHub CLI 面板：余额、模型浏览、快捷生成
// =========================================================================

import { useState, useEffect } from "react";
import { useRhCli, type RhCheckData, type RhModel } from "../../hooks/useRhCli";
import { Coins, Image, Video, Sparkles, AlertCircle, Check, Loader2, Play } from "lucide-react";

const IMAGE_MODELS: { name: string; desc: string }[] = [
  { name: "全能图片PRO", desc: "默认推荐，综合效果最好" },
  { name: "全能图片V2", desc: "最快最便宜" },
  { name: "悠船 v7", desc: "Midjourney 风格" },
  { name: "GPT Image 2", desc: "语义理解强" },
  { name: "Seedream v5", desc: "写实照片感" },
];

const VIDEO_MODELS: { name: string; desc: string; num: string }[] = [
  { name: "全能视频V3.1 Fast", desc: "性价比之王（推荐）", num: "1" },
  { name: "全能视频X", desc: "Grok 驱动，想象力超强", num: "2" },
  { name: "可灵 v3.0 Pro", desc: "运动自然，拍人物首选", num: "3" },
  { name: "全能视频V3.1 Pro", desc: "电影感拉满", num: "4" },
  { name: "Vidu Q3 Pro", desc: "风格化独特", num: "5" },
  { name: "全能视频S", desc: "Sora 同款引擎", num: "6" },
  { name: "海螺 Hailuo", desc: "速度快、画面细腻", num: "7" },
  { name: "Seedance 2.0", desc: "最长15秒+配音，最高4K", num: "8" },
];

export default function RhCliPanel() {
  const { checkBalance, generateImage, generateVideo } = useRhCli();
  const [check, setCheck] = useState<RhCheckData | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const [imgPrompt, setImgPrompt] = useState("");
  const [imgModel, setImgModel] = useState("1");
  const [imgResult, setImgResult] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  const [vidPrompt, setVidPrompt] = useState("");
  const [vidModel, setVidModel] = useState("1");
  const [vidResult, setVidResult] = useState<string | null>(null);
  const [vidLoading, setVidLoading] = useState(false);
  const [vidError, setVidError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"image" | "video">("image");

  useEffect(() => { handleCheck(); }, []);

  async function handleCheck() {
    setCheckLoading(true);
    try {
      const data = await checkBalance();
      setCheck(data);
    } catch {
      setCheck({ available: false, hint: "Backend request failed" });
    } finally {
      setCheckLoading(false);
    }
  }

  async function handleGenerateImage() {
    if (!imgPrompt.trim()) return;
    setImgLoading(true); setImgError(null); setImgResult(null);
    try {
      const r = await generateImage(imgPrompt.trim(), imgModel);
      if (r.error) { setImgError(r.error); }
      else if (r.files && r.files.length > 0) {
        setImgResult(`Generated: ${r.files[0]} (cost ¥${r.cost ?? "?"}, ${r.duration ?? "?"}s)`);
      } else { setImgResult("Done — no output files"); }
    } catch (e) { setImgError(e instanceof Error ? e.message : "Failed"); }
    finally { setImgLoading(false); }
  }

  async function handleGenerateVideo() {
    if (!vidPrompt.trim()) return;
    setVidLoading(true); setVidError(null); setVidResult(null);
    try {
      const r = await generateVideo(vidPrompt.trim(), vidModel);
      if (r.error) { setVidError(r.error); }
      else if (r.files && r.files.length > 0) {
        setVidResult(`Generated: ${r.files[0]} (cost ¥${r.cost ?? "?"}, ${r.duration ?? "?"}s)`);
      } else { setVidResult("Done — no output files"); }
    } catch (e) { setVidError(e instanceof Error ? e.message : "Failed"); }
    finally { setVidLoading(false); }
  }

  return (
    <div className="space-y-4">
      {/* ---- Balance Card ---- */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-yellow-500" />
            RunningHub Balance
          </span>
          <button onClick={handleCheck} disabled={checkLoading}
            className="text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition disabled:opacity-50">
            {checkLoading ? "Checking..." : "Refresh"}
          </button>
        </div>

        {!check ? (
          <p className="text-[10px] text-gray-500">Loading...</p>
        ) : !check.available ? (
          <div className="text-[11px] text-amber-400 bg-amber-600/10 rounded px-2 py-1.5">
            <AlertCircle className="h-3 w-3 inline mr-1" />
            {check.hint || "RH CLI not available"}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div><span className="text-gray-500">Balance:</span> <span className="text-green-400 font-mono">¥{Number(check.balance).toLocaleString()}</span></div>
            <div><span className="text-gray-500">Coins:</span> <span className="text-blue-400 font-mono">{Number(check.coins).toLocaleString()}</span></div>
            <div><span className="text-gray-500">Status:</span> <span className="text-gray-300">{check.status}</span></div>
            <div><span className="text-gray-500">Running:</span> <span className="text-gray-300">{check.runningTasks ?? "0"} tasks</span></div>
          </div>
        )}
      </div>

      {/* ---- Quick Generation Tabs ---- */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
        <div className="flex gap-1 mb-3">
          <button onClick={() => setActiveTab("image")}
            className={`flex-1 text-[11px] py-1.5 rounded font-medium transition flex items-center justify-center gap-1 ${
              activeTab === "image" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400 hover:text-gray-200"}`}>
            <Image className="h-3 w-3" /> Image
          </button>
          <button onClick={() => setActiveTab("video")}
            className={`flex-1 text-[11px] py-1.5 rounded font-medium transition flex items-center justify-center gap-1 ${
              activeTab === "video" ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400 hover:text-gray-200"}`}>
            <Video className="h-3 w-3" /> Video
          </button>
        </div>

        {activeTab === "image" ? (
          <div className="space-y-2">
            <textarea value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)}
              placeholder="Describe your image..."
              rows={2}
              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none placeholder-gray-500" />
            <div className="flex gap-2">
              <select value={imgModel} onChange={(e) => setImgModel(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500">
                {IMAGE_MODELS.map((m, i) => (
                  <option key={i} value={String(i + 1)}>{m.name} — {m.desc}</option>
                ))}
              </select>
              <button onClick={handleGenerateImage} disabled={imgLoading || !imgPrompt.trim() || !check?.available}
                className="px-3 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1">
                {imgLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Generate
              </button>
            </div>
            {imgError && <p className="text-[10px] text-red-400">{imgError}</p>}
            {imgResult && <p className="text-[10px] text-green-400"><Check className="h-3 w-3 inline mr-1" />{imgResult}</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea value={vidPrompt} onChange={(e) => setVidPrompt(e.target.value)}
              placeholder="Describe your video..."
              rows={2}
              className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-white focus:outline-none focus:border-purple-500 resize-none placeholder-gray-500" />
            <div className="flex gap-2">
              <select value={vidModel} onChange={(e) => setVidModel(e.target.value)}
                className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-purple-500">
                {VIDEO_MODELS.map((m) => (
                  <option key={m.num} value={m.num}>{m.name} — {m.desc}</option>
                ))}
              </select>
              <button onClick={handleGenerateVideo} disabled={vidLoading || !vidPrompt.trim() || !check?.available}
                className="px-3 py-1 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1">
                {vidLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Generate
              </button>
            </div>
            {vidError && <p className="text-[10px] text-red-400">{vidError}</p>}
            {vidResult && <p className="text-[10px] text-green-400"><Check className="h-3 w-3 inline mr-1" />{vidResult}</p>}
          </div>
        )}
      </div>

      {/* ---- Model List ---- */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
        <h4 className="text-[11px] font-medium text-gray-400 mb-2 flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Available Models (via rh CLI)
        </h4>

        <div className="space-y-2">
          <div>
            <p className="text-[10px] text-gray-500 mb-1">Image Models (5)</p>
            <div className="grid grid-cols-2 gap-1">
              {IMAGE_MODELS.map((m, i) => (
                <div key={i} className="text-[10px] text-gray-400 bg-gray-900/50 rounded px-2 py-1">
                  <span className="text-gray-300 font-medium">{m.name}</span>
                  <span className="text-gray-600 ml-1">— {m.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-gray-500 mb-1">Video Models (8)</p>
            <div className="grid grid-cols-2 gap-1">
              {VIDEO_MODELS.map((m) => (
                <div key={m.num} className="text-[10px] text-gray-400 bg-gray-900/50 rounded px-2 py-1">
                  <span className="text-gray-300 font-medium">{m.name}</span>
                  <span className="text-gray-600 ml-1">— {m.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
