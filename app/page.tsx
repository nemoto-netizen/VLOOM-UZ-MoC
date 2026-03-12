"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  FileText,
  Folder,
  Paperclip,
  Save,
  Search,
  Send,
  Star,
  Settings2,
  Trash2,
  User,
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type OutputFormat = "text" | "table" | "markdown";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestChips?: string[];
};

type ArtifactRow = {
  rank: number;
  reason: string;
  count: number;
  ratio: string;
  status: "risk-high" | "risk-mid" | "positive";
  sample: string;
};

const INITIAL_CHIPS = [
  "ありがとう分析",
  "ネガポジ分析",
  "成約分析",
  "解約分析",
  "OP通話品質分析",
];

const SUGGEST_CARD_CONTENT: Record<string, { title: string; description: string }> = {
  ありがとう分析: {
    title: "ありがとう分析",
    description: "感謝・満足の発言を抽出し、応対品質の強みを整理します。",
  },
  ネガポジ分析: {
    title: "ネガポジ分析",
    description: "ネガティブ/ポジティブ発言を分類し、傾向を可視化します。",
  },
  成約分析: {
    title: "成約分析",
    description: "成約に寄与した発言や案内パターンを要因分解します。",
  },
  解約分析: {
    title: "クレーム要因の抽出",
    description: "不満やネガティブな発言を抽出し、表形式でまとめます。",
  },
  OP通話品質分析: {
    title: "OP通話品質分析",
    description: "案内品質・説明力・共感姿勢を観点別に評価します。",
  },
  "1位の理由を通話ログで深掘り": {
    title: "1位理由を深掘り",
    description: "上位要因に紐づく具体的な通話例を抽出します。",
  },
  "年代別にクロス集計": {
    title: "年代別クロス集計",
    description: "年代セグメント別に解約理由を比較表示します。",
  },
};

const FAVORITE_PROMPTS = [
  "クレーム要因抽出（表形式）",
  "年代別ネガポジ集計",
  "解約理由の深掘り",
  "応対品質の改善提案",
];

const FAVORITE_PROMPT_PREVIEWS: Record<string, string> = {
  "クレーム要因抽出（表形式）":
    "以下の通話ログを分析し、解約リスクが高い発話を抽出してください。カテゴリ別に件数と代表例を表形式で提示し、優先度の高い改善アクションを3つ提案してください。",
  "年代別ネガポジ集計":
    "顧客年代ごとにネガティブ/ポジティブ発言を分類し、件数と比率を算出してください。年代間の差分が大きいトピックを上位3つ抽出し、要因仮説を添えてください。",
  "解約理由の深掘り":
    "解約理由トップ項目に紐づく通話を再抽出し、初回対応・説明品質・料金認識の観点で深掘りしてください。再発防止に向けた具体施策を箇条書きで示してください。",
  "応対品質の改善提案":
    "オペレーターの応対品質を評価し、共感姿勢・案内の明瞭性・解決速度の3軸でスコアリングしてください。低スコア要因とトレーニング施策を提案してください。",
};

const ARTIFACT_ROWS: ArtifactRow[] = [
  {
    rank: 1,
    reason: "初回対応で問題が解決しない",
    count: 43,
    ratio: "43.0%",
    status: "risk-high",
    sample: "たらい回しにされ、結局解決しなかった",
  },
  {
    rank: 2,
    reason: "オペレーターの説明不足",
    count: 28,
    ratio: "28.0%",
    status: "risk-mid",
    sample: "手続きの説明が曖昧で不安になった",
  },
  {
    rank: 3,
    reason: "価格・費用対効果への不満",
    count: 19,
    ratio: "19.0%",
    status: "positive",
    sample: "使っていない機能に対して料金が高い",
  },
];

function createId() {
  return Math.random().toString(36).slice(2, 11);
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function VocArtifactsSplitViewPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [reportName, setReportName] = useState("新規作成");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [settingOpen, setSettingOpen] = useState(false);
  const [maskPii, setMaskPii] = useState(true);
  const [analyzePerCall, setAnalyzePerCall] = useState(false);

  const [outputFormat, setOutputFormat] = useState<OutputFormat>("table");
  const [inputValue, setInputValue] = useState("");
  const [isPromptSheetOpen, setIsPromptSheetOpen] = useState(false);
  const [promptDraftName, setPromptDraftName] = useState("解約分析_定型プロンプト");
  const [promptDraftContent, setPromptDraftContent] = useState(
    "以下の通話ログを対象に、解約理由を分類し、上位3カテゴリの傾向と具体例を抽出してください。\n加えて、改善アクションを優先度順で提案してください。"
  );
  const [isClient, setIsClient] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      text: "100件の通話データ（業務名：カスタマーサポート）の読み込みが完了しました。以下の観点での分析がすぐに行えます。",
      suggestChips: INITIAL_CHIPS,
    },
  ]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [artifactRows, setArtifactRows] = useState<ArtifactRow[] | null>(null);
  const [artifactTitle, setArtifactTitle] = useState("分析レポート結果（未実行）");
  const [artifactSummary, setArtifactSummary] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canConsult = inputValue.trim().length > 0 && !isAnalyzing;
  const canAnalyze = inputValue.trim().length > 0 && !isAnalyzing;

  const appendUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: createId(), role: "user", text }]);
  };

  const appendAssistantMessage = (text: string, chips?: string[]) => {
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "assistant", text, suggestChips: chips },
    ]);
  };

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  };

  const runAnalysis = (prompt: string) => {
    if (!prompt.trim() || isAnalyzing) return;

    appendUserMessage(prompt);
    setInputValue("");
    setIsAnalyzing(true);
    setArtifactRows(null);
    setArtifactSummary("");
    setArtifactTitle(
      `分析レポート結果（${outputFormat === "text" ? "テキスト" : outputFormat === "table" ? "表形式" : "Markdown"}）`
    );

    window.setTimeout(() => {
      setArtifactRows(ARTIFACT_ROWS);
      setArtifactSummary(
        "解約理由の上位は「初回未解決」「説明不足」「価格不満」で、応対品質と情報設計の改善余地が高いと判断されます。"
      );
      setIsAnalyzing(false);
      appendAssistantMessage(
        "右側のパネルに分析結果を出力しました。この結果をさらに深掘りしますか？",
        ["1位の理由を通話ログで深掘り", "年代別にクロス集計"]
      );
    }, 2600);
  };

  const handleSuggestClick = (chip: string) => {
    runAnalysis(chip);
  };

  const handleConsult = () => {
    if (!canConsult) return;
    const text = inputValue.trim();
    appendUserMessage(text);
    setInputValue("");
    window.setTimeout(() => {
      appendAssistantMessage(
        "了解しました。まず仮説ベースで観点を整理します。必要ならこの内容をそのまま分析実行できます。"
      );
    }, 700);
  };

  const handleRunButton = () => {
    if (!canAnalyze) return;
    runAnalysis(inputValue.trim());
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setAttachedFiles(files.map((f) => f.name));
  };

  const handleCopyArtifact = async () => {
    if (!artifactRows) return;
    const text = [
      artifactTitle,
      artifactSummary,
      ...artifactRows.map(
        (r) => `${r.rank}. ${r.reason} / ${r.count}件 / ${r.ratio} / ${r.sample}`
      ),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    alert("分析結果をコピーしました。");
  };

  const handleExportExcel = () => {
    if (!artifactRows) return;
    alert("MoC: Excel出力を実行する想定です。");
  };

  const handleReset = () => {
    setArtifactRows(null);
    setArtifactSummary("");
    setArtifactTitle("分析レポート結果（未実行）");
    setIsAnalyzing(false);
  };

  const previewTitle = useMemo(
    () =>
      artifactRows
        ? artifactTitle
        : isAnalyzing
          ? "分析レポート結果（生成中）"
          : "分析レポート結果（未実行）",
    [artifactRows, artifactTitle, isAnalyzing]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <aside
        className={cx(
          "border-r border-gray-200 bg-slate-50 transition-all duration-200",
          sidebarCollapsed ? "w-14" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Folder className="h-4 w-4" />
                お気に入りプロンプト
              </div>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="rounded-md p-1 text-gray-500 hover:bg-slate-200 hover:text-gray-700"
              title={sidebarCollapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <TooltipProvider delayDuration={120}>
              {FAVORITE_PROMPTS.map((item) => (
                <Tooltip key={item}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-slate-200"
                      title={item}
                    >
                      {sidebarCollapsed ? "•" : item}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" className="max-w-xs whitespace-normal">
                    <p className="font-semibold text-gray-800">{item}</p>
                    <p className="mt-1 text-gray-600">
                      {FAVORITE_PROMPT_PREVIEWS[item] ?? "このプロンプトの詳細は未設定です。"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        </div>
      </aside>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
      <ResizablePanel defaultSize={40} minSize={30}>
      <section className="flex h-full min-w-[450px] flex-col border-r border-gray-200 bg-white font-sans text-sm antialiased">
        <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {isEditingTitle ? (
                <input
                  autoFocus
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-800 outline-none ring-2 ring-teal-100"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-left text-sm font-semibold text-gray-800 hover:text-teal-700"
                >
                  {reportName}
                </button>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Search className="h-3.5 w-3.5" />
                  2026年1月_クレーム対応
                </span>
                <span className="text-gray-300">|</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  2026/01/14
                </span>
                <span className="text-gray-300">|</span>
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  池田
                </span>
                <span className="text-gray-300">|</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px]">
                  <FileText className="h-3 w-3" />
                  参照中: 100件の通話データ
                </span>
              </div>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingOpen((v) => !v)}
                className="rounded-md border border-gray-200 p-2 text-gray-600 hover:border-teal-300 hover:text-teal-700"
                title="分析設定"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              {settingOpen && (
                <div className="absolute right-0 top-11 w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
                  <div className="mb-2 font-semibold text-gray-700">分析設定</div>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between">
                      <span className="text-gray-600">要配慮個人情報をMASKする</span>
                      <Toggle checked={maskPii} onToggle={setMaskPii} />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-gray-600">1通話毎に個別分析する</span>
                      <Toggle checked={analyzePerCall} onToggle={setAnalyzePerCall} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cx(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-teal-600 text-white"
                      : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                  )}
                >
                  {m.text}
                  {m.suggestChips && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {m.suggestChips.map((chip) => {
                        const card = SUGGEST_CARD_CONTENT[chip] ?? {
                          title: chip,
                          description: "この観点で分析を実行します。",
                        };
                        return (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => handleSuggestClick(chip)}
                            className="rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-2.5 text-left transition hover:border-teal-300 hover:bg-teal-50"
                          >
                            <div className="text-sm font-semibold text-teal-800">
                              {card.title}
                            </div>
                            <div className="mt-1 text-xs text-teal-700/80">
                              {card.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2">
              <button
                type="button"
                onClick={handleAttachClick}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-teal-700"
                title="参考ファイルを追加"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileChange}
              />
              {attachedFiles.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  添付: {attachedFiles.join(", ")}
                </p>
              )}
            </div>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                resizeTextarea();
              }}
              placeholder="分析の指示や、さらに深掘りしたい質問を入力してください..."
              className="max-h-32 w-full resize-none overflow-y-auto bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
              disabled={isAnalyzing}
            />
            <div className="mt-2 flex items-end justify-between">
              <div className="flex flex-col gap-1 text-xs text-gray-600">
                <span className="whitespace-nowrap font-medium">出力形式:</span>
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                  className="h-10 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                  disabled={isAnalyzing}
                >
                  <option value="text">📝 テキスト（要約中心）</option>
                  <option value="table">📊 表（比較しやすい形式）</option>
                  <option value="markdown">📄 Markdown（共有向け）</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConsult}
                  disabled={!canConsult}
                  className="h-10 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  💬 AIと対話
                </button>
                <button
                  type="button"
                  onClick={handleRunButton}
                  disabled={!canAnalyze}
                  className="inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  🚀 分析を実行
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={60} minSize={40}>

      <section className="relative flex min-w-[500px] flex-col overflow-hidden bg-white">
        <div
          className={cx(
            "sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4 transition-[margin] duration-300",
            isPromptSheetOpen ? "mr-[420px]" : "mr-0"
          )}
        >
          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center justify-between gap-3">
            <h2 className="shrink-0 whitespace-nowrap text-sm font-semibold text-gray-800">{previewTitle}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPromptSheetOpen(true)}
                className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
              >
                <Star className="h-3.5 w-3.5" /> プロンプトを登録
              </button>
              <button
                type="button"
                onClick={handleCopyArtifact}
                disabled={!artifactRows}
                className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-transparent px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" />
                内容をコピー
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!artifactRows}
                className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-transparent px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel出力
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-transparent px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                リセット
              </button>
              <button
                type="button"
                className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Save className="h-3.5 w-3.5" />
                保存
              </button>
            </div>
          </div>
          </div>
        </div>

        <div
          className={cx(
            "flex-1 overflow-y-auto p-10 transition-[margin] duration-300",
            isPromptSheetOpen ? "mr-[420px]" : "mr-0"
          )}
        >
          {!isAnalyzing && !artifactRows && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-3 rounded-full bg-slate-100 p-4">
                <Folder className="h-6 w-6 text-slate-500" />
              </div>
              <p className="text-sm text-gray-500">
                左側のチャットで分析を実行すると、ここに結果が表示されます。
              </p>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-teal-600" />
              <p className="mt-3 text-sm text-gray-600">分析を実行中...</p>
            </div>
          )}

          {!isAnalyzing && artifactRows && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">解約理由分析（TOP3）</h3>
                <p className="mt-1 text-sm text-gray-600">{artifactSummary}</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">順位</th>
                      <th className="px-4 py-3 text-left">解約理由</th>
                      <th className="px-4 py-3 text-right">件数</th>
                      <th className="px-4 py-3 text-right">比率</th>
                      <th className="px-4 py-3 text-left">ステータス</th>
                      <th className="px-4 py-3 text-left">具体例</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                    {artifactRows.map((row) => (
                      <tr key={row.rank} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-teal-700">{row.rank}</td>
                        <td className="px-4 py-3">{row.reason}</td>
                        <td className="px-4 py-3 text-right">{row.count}</td>
                        <td className="px-4 py-3 text-right">{row.ratio}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-4 py-3">{row.sample}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </section>
      </ResizablePanel>
      </ResizablePanelGroup>

      {isClient &&
        createPortal(
          <aside
            className={cx(
              "fixed right-0 top-0 z-40 h-screen w-[420px] border-l border-gray-200 bg-white shadow-xl transition-transform duration-300",
              isPromptSheetOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-gray-200 px-5 py-4">
                <h3 className="text-sm font-semibold text-gray-800">プロンプト登録</h3>
                <p className="mt-1 text-xs text-gray-500">
                  現在の分析観点を再利用できるように保存します。
                </p>
              </div>
              <div className="overflow-y-auto p-5">
                <div className="flex flex-col gap-6">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      プロンプト名
                    </label>
                    <input
                      type="text"
                      value={promptDraftName}
                      onChange={(e) => setPromptDraftName(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none ring-2 ring-transparent focus:ring-teal-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      内容
                    </label>
                    <textarea
                      rows={11}
                      value={promptDraftContent}
                      onChange={(e) => setPromptDraftContent(e.target.value)}
                      className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none ring-2 ring-transparent focus:ring-teal-100"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsPromptSheetOpen(false)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPromptSheetOpen(false);
                        alert("MoC: プロンプトを登録しました。");
                      }}
                      className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      登録
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>,
          document.body
        )}
    </div>
  );
}

function Toggle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className={cx(
        "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
        checked ? "border-teal-500 bg-teal-100" : "border-gray-300 bg-gray-100"
      )}
    >
      <span
        className={cx(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

function StatusBadge({ status }: { status: ArtifactRow["status"] }) {
  if (status === "risk-high") {
    return (
      <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        解約リスク高
      </span>
    );
  }
  if (status === "risk-mid") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
        解約リスク中
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
      ポジティブ傾向
    </span>
  );
}
