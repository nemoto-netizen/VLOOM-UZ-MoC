"use client";

import { useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  Folder,
  Paperclip,
  Save,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";

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
  sample: string;
};

const INITIAL_CHIPS = [
  "ありがとう分析",
  "ネガポジ分析",
  "成約分析",
  "解約分析",
  "OP通話品質分析",
];

const FAVORITE_PROMPTS = [
  "クレーム要因抽出（表形式）",
  "年代別ネガポジ集計",
  "解約理由の深掘り",
  "応対品質の改善提案",
];

const ARTIFACT_ROWS: ArtifactRow[] = [
  {
    rank: 1,
    reason: "初回対応で問題が解決しない",
    count: 43,
    ratio: "43.0%",
    sample: "たらい回しにされ、結局解決しなかった",
  },
  {
    rank: 2,
    reason: "オペレーターの説明不足",
    count: 28,
    ratio: "28.0%",
    sample: "手続きの説明が曖昧で不安になった",
  },
  {
    rank: 3,
    reason: "価格・費用対効果への不満",
    count: 19,
    ratio: "19.0%",
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
            {FAVORITE_PROMPTS.map((item) => (
              <button
                key={item}
                type="button"
                className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-slate-200"
                title={item}
              >
                {sidebarCollapsed ? "•" : item}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex w-[420px] flex-col border-r border-gray-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600">
                  検索条件：2026年1月_クレーム対応
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600">
                  作成日：2026/01/14
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600">
                  作成者：池田
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
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                    m.role === "user"
                      ? "rounded-br-sm bg-teal-600 text-white"
                      : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                  )}
                >
                  {m.text}
                  {m.suggestChips && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.suggestChips.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => handleSuggestClick(chip)}
                          className="rounded-full border border-teal-200 px-4 py-2 text-sm text-teal-700 hover:bg-teal-50"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-white px-4 py-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2">
              <button
                type="button"
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-teal-700"
                title="参考ファイルを追加"
              >
                <Paperclip className="h-4 w-4" />
              </button>
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
              className="max-h-44 w-full resize-none bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
              disabled={isAnalyzing}
            />
            <div className="mt-2 flex items-center justify-between">
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                disabled={isAnalyzing}
              >
                <option value="text">テキスト</option>
                <option value="table">表（Table）</option>
                <option value="markdown">Markdown</option>
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConsult}
                  disabled={!canConsult}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  相談する
                </button>
                <button
                  type="button"
                  onClick={handleRunButton}
                  disabled={!canAnalyze}
                  className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  分析を実行
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-1 flex-col bg-white">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">{previewTitle}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyArtifact}
                disabled={!artifactRows}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" />
                内容をコピー
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={!artifactRows}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Excel出力
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                リセット
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
              >
                <Save className="h-3.5 w-3.5" />
                保存
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10">
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
                      <th className="px-4 py-3 text-left">具体例</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
                    {artifactRows.map((row) => (
                      <tr key={row.rank}>
                        <td className="px-4 py-3 font-semibold text-teal-700">{row.rank}</td>
                        <td className="px-4 py-3">{row.reason}</td>
                        <td className="px-4 py-3 text-right">{row.count}</td>
                        <td className="px-4 py-3 text-right">{row.ratio}</td>
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
