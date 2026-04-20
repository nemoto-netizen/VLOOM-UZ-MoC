"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TextareaAutosize from "react-textarea-autosize";
import type { PanelImperativeHandle } from "react-resizable-panels";
import {
  Bot,
  ChevronDown,
  Copy,
  FileSpreadsheet,
  Folder,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  Send,
  Star,
  Settings2,
  Sparkles,
  Table2,
  Trash2,
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

type OutputFormat = "text" | "table" | "markdown";

type CentralTab = "chat" | "data";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestChips?: string[];
  showExecutionCard?: boolean;
  executionPrompt?: string;
  assistantList?: {
    intro: string;
    bullets: string[];
    outro: string;
  };
};

type ChatSession = {
  id: string;
  title: string;
  date: string;
  isPinned: boolean;
};

type ArtifactRow = {
  rank: number;
  reason: string;
  count: number;
  ratio: string;
  status: "risk-high" | "risk-mid" | "positive";
  sample: string;
};

const SUGGEST_CARD_CONTENT: Record<
  string,
  { icon?: string; title: string; description: string }
> = {
  "1位の理由を通話ログで深掘り": {
    title: "1位理由を深掘り",
    description: "上位要因に紐づく具体的な通話例を抽出します。",
  },
  "年代別にクロス集計": {
    title: "年代別クロス集計",
    description: "年代セグメント別に解約理由を比較表示します。",
  },
};

const WIZARD_PURPOSES = [
  { id: "quality", emoji: "🎧", label: "オペレータ通話品質の分析" },
  { id: "faq", emoji: "📚", label: "FAQ, QAの整備" },
  { id: "trend", emoji: "📈", label: "成功・失敗の傾向分析" },
  { id: "script", emoji: "📝", label: "スクリプトの整備" },
  { id: "other", emoji: "✍️", label: "その他（自由記述）" },
] as const;

type WizardPurposeId = (typeof WIZARD_PURPOSES)[number]["id"];

const WIZARD_DATE_PRESETS: { id: "today" | "week" | "lastMonth"; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "week", label: "今週" },
  { id: "lastMonth", label: "先月" },
];

const WIZARD_BUSINESS_OPTIONS = [
  "解約受付センター",
  "料金問合せ窓口",
  "契約変更サポート",
];

const WIZARD_SKILL_OPTIONS = ["新人", "中堅", "ベテラン"];

const WIZARD_ADVANCED_FIELDS = [
  { id: "callStart", label: "通話開始日時", type: "datetime-local" as const },
  { id: "callEnd", label: "終了日時", type: "datetime-local" as const },
  { id: "phone", label: "顧客電話番号", type: "text" as const, placeholder: "例: 090-xxxx-xxxx" },
  { id: "ngWord", label: "NGワード", type: "text" as const, placeholder: "例: 解約, 値上げ" },
  { id: "callDuration", label: "通話時間", type: "text" as const, placeholder: "例: 5分以上" },
  { id: "holdDuration", label: "保留時間", type: "text" as const, placeholder: "例: 30秒以上" },
  { id: "direction", label: "通話方向", type: "select" as const, options: ["すべて", "インバウンド", "アウトバウンド"] },
  { id: "group", label: "グループ", type: "select" as const, options: ["すべて", "Aチーム", "Bチーム", "新人"] },
];

type CallRecord = {
  id: string;
  startedAt: string;
  duration: string;
  operator: string;
  business: string;
  phone: string;
};

const MOCK_CALL_RECORDS: CallRecord[] = [
  {
    id: "call-1",
    startedAt: "2026/03/27 09:12",
    duration: "06:32",
    operator: "鈴木 直子",
    business: "解約受付センター",
    phone: "090-1234-5678",
  },
  {
    id: "call-2",
    startedAt: "2026/03/27 09:45",
    duration: "04:11",
    operator: "田中 健一",
    business: "料金問合せ窓口",
    phone: "080-9876-5432",
  },
  {
    id: "call-3",
    startedAt: "2026/03/27 10:20",
    duration: "12:05",
    operator: "佐藤 美咲",
    business: "契約変更サポート",
    phone: "070-2468-1357",
  },
  {
    id: "call-4",
    startedAt: "2026/03/27 10:58",
    duration: "03:47",
    operator: "山本 拓也",
    business: "解約受付センター",
    phone: "090-1111-2222",
  },
];

const MOCK_SESSIONS: ChatSession[] = [
  { id: "1", title: "【月次】2026年3月 解約分析", date: "今日", isPinned: true },
  { id: "2", title: "新人オペレーターの保留時間傾向", date: "昨日", isPinned: false },
  { id: "3", title: "キャンペーンCのクレーム抽出", date: "過去7日間", isPinned: false },
  { id: "4", title: "料金改定に関するVOCまとめ", date: "過去30日間", isPinned: false },
];

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
  const sidebarRef = useRef<PanelImperativeHandle | null>(null);
  const rightPanelRef = useRef<PanelImperativeHandle | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingOpen, setSettingOpen] = useState(false);
  const [maskPii, setMaskPii] = useState(true);
  const [analyzePerCall, setAnalyzePerCall] = useState(false);

  const [executionOutputFormat, setExecutionOutputFormat] = useState<OutputFormat>("table");
  const [chatInput, setChatInput] = useState("");
  const [isPromptSheetOpen, setIsPromptSheetOpen] = useState(false);
  const [promptDraftName, setPromptDraftName] = useState("解約分析_定型プロンプト");
  const [promptDraftContent, setPromptDraftContent] = useState(
    "以下の通話ログを対象に、解約理由を分類し、上位3カテゴリの傾向と具体例を抽出してください。\n加えて、改善アクションを優先度順で提案してください。"
  );
  const [isClient, setIsClient] = useState(false);
  const [hasAttachedFile, setHasAttachedFile] = useState(false);
  const [activeTab, setActiveTab] = useState<CentralTab>("chat");
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [highlightedCallId, setHighlightedCallId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Left/Right を跨いで利用する分析状態（親レベル管理）
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [artifactRows, setArtifactRows] = useState<ArtifactRow[] | null>(null);
  const [artifactTitle, setArtifactTitle] = useState("分析レポート結果（未実行）");
  const [artifactSummary, setArtifactSummary] = useState("");

  const analyzingTimeoutRef = useRef<number | null>(null);
  const canSend = chatInput.trim().length > 0 && !isAnalyzing;

  const appendUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: createId(), role: "user", text }]);
  };

  const appendAssistantMessage = (
    text: string,
    options?: {
      chips?: string[];
      assistantList?: ChatMessage["assistantList"];
      showExecutionCard?: boolean;
      executionPrompt?: string;
    }
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "assistant",
        text,
        suggestChips: options?.chips,
        assistantList: options?.assistantList,
        showExecutionCard: options?.showExecutionCard,
        executionPrompt: options?.executionPrompt,
      },
    ]);
  };

  const cancelAnalysis = () => {
    if (analyzingTimeoutRef.current) {
      window.clearTimeout(analyzingTimeoutRef.current);
      analyzingTimeoutRef.current = null;
    }
    setIsAnalyzing(false);
  };

  const startAnalysis = (
    format: OutputFormat,
    options?: {
      onFinished?: () => void;
    }
  ) => {
    if (analyzingTimeoutRef.current) {
      window.clearTimeout(analyzingTimeoutRef.current);
      analyzingTimeoutRef.current = null;
    }
    setIsAnalyzing(true);
    setShowResult(false);
    setArtifactRows(null);
    setArtifactSummary("");
    setArtifactTitle(
      `分析レポート結果（${format === "text" ? "テキスト" : format === "table" ? "表形式" : "Markdown"}）`
    );
    setHighlightedCallId(null);
    rightPanelRef.current?.collapse();

    analyzingTimeoutRef.current = window.setTimeout(() => {
      setArtifactRows(ARTIFACT_ROWS);
      setArtifactSummary(
        "解約理由の上位は「初回未解決」「説明不足」「価格不満」で、応対品質と情報設計の改善余地が高いと判断されます。"
      );
      setIsAnalyzing(false);
      setShowResult(true);
      rightPanelRef.current?.resize("40%");
      analyzingTimeoutRef.current = null;
      options?.onFinished?.();
    }, 3000);
  };

  const runAnalysis = (prompt: string, format: OutputFormat = "table") => {
    if (!prompt.trim() || isAnalyzing) return;
    appendUserMessage(prompt);
    setChatInput("");
    startAnalysis(format, {
      onFinished: () => {
        appendAssistantMessage(
          "右側のパネルに分析結果を出力しました。この結果をさらに深掘りしますか？",
          { chips: ["1位の理由を通話ログで深掘り", "年代別にクロス集計"] }
        );
      },
    });
  };

  const handleSuggestClick = (chip: string) => {
    runAnalysis(chip);
  };

  const handleWizardSubmit = () => {
    if (isAnalyzing) return;
    appendUserMessage("指定した条件で通話データを検索し、分析を実行してください。");
    startAnalysis("table", {
      onFinished: () => {
        appendAssistantMessage("分析が完了しました。右ペインをご確認ください。");
        rightPanelRef.current?.resize("40%");
      },
    });
  };

  const handleBottomSend = () => {
    if (!canSend) return;
    const text = chatInput.trim();
    appendUserMessage(text);
    setChatInput("");
    window.setTimeout(() => {
      appendAssistantMessage("指示を受け付けました。分析を更新します。");
      startAnalysis("table", {
        onFinished: () => {
          rightPanelRef.current?.resize("40%");
        },
      });
    }, 700);
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

  const handleCitationClick = (callId: string) => {
    setActiveTab("data");
    setHighlightedCallId(callId);
  };

  const handleReset = () => {
    cancelAnalysis();
    setArtifactRows(null);
    setArtifactSummary("");
    setArtifactTitle("分析レポート結果（未実行）");
    setShowResult(false);
    rightPanelRef.current?.collapse();
  };

  const handleSidebarToggle = () => {
    if (!sidebarRef.current) return;
    if (sidebarRef.current.isCollapsed()) {
      sidebarRef.current.resize("20%");
    } else {
      sidebarRef.current.collapse();
    }
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

  useEffect(() => {
    return () => {
      if (analyzingTimeoutRef.current) {
        window.clearTimeout(analyzingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
      <ResizablePanel
        panelRef={sidebarRef}
        defaultSize="20%"
        minSize="20%"
        maxSize="20%"
        collapsible={true}
        collapsedSize={0}
        onResize={(size) => setSidebarCollapsed(size.asPercentage <= 1)}
      >
        <aside className="h-full border-r border-gray-200 bg-slate-50">
          <div
            className={cx(
              "flex h-full flex-col overflow-hidden transition-opacity duration-150",
              sidebarCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
            )}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3">
              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-gray-700">
                <Folder className="h-4 w-4" />
                セッション履歴
              </div>
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setActiveTab("chat");
                  rightPanelRef.current?.collapse();
                }}
                className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 text-[11px] font-medium text-gray-700 hover:bg-slate-100"
                title="新規セッション作成"
              >
                <Plus className="h-3.5 w-3.5" />
                新規作成
              </button>
            </div>
            <div className="shrink-0 space-y-2 border-b border-gray-200 px-3 py-2.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="🔍 履歴検索"
                  className="h-8 w-full rounded-md border border-gray-200 bg-white pl-8 pr-2 text-xs text-gray-700 placeholder:text-gray-400 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <button
                type="button"
                className="inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-teal-700 transition hover:bg-teal-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                ✨ プロンプトテンプレート管理
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {MOCK_SESSIONS.map((session) => (
                  <div
                    key={session.id}
                    className="group relative rounded-md border border-transparent transition hover:border-slate-200 hover:bg-slate-100"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveTab("chat");
                        setMessages([
                          {
                            id: "dummy1",
                            role: "user",
                            text: "過去の分析データを開きました。",
                          },
                          {
                            id: "dummy2",
                            role: "assistant",
                            text: "分析結果は右ペインの通りです。",
                          },
                        ]);
                        rightPanelRef.current?.resize("40%");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                        }
                      }}
                      className="cursor-pointer px-3 py-2 text-left outline-none"
                    >
                      <div className="flex items-start justify-between gap-2 pr-6">
                        <p className="text-sm text-gray-700">{session.title}</p>
                        {session.isPinned ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            固定
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">{session.date}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuSessionId((prev) =>
                          prev === session.id ? null : session.id
                        );
                      }}
                      className={cx(
                        "absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-slate-200 hover:text-gray-700 focus:opacity-100 group-hover:opacity-100",
                        openMenuSessionId === session.id ? "opacity-100" : "opacity-0"
                      )}
                      title="操作メニュー"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {openMenuSessionId === session.id ? (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenMenuSessionId(null)}
                        />
                        <div
                          role="menu"
                          className="absolute right-1.5 top-8 z-50 w-44 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setOpenMenuSessionId(null)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-slate-50"
                          >
                            {session.isPinned ? (
                              <>
                                <PinOff className="h-3.5 w-3.5 text-gray-500" />
                                固定解除
                              </>
                            ) : (
                              <>
                                <Pin className="h-3.5 w-3.5 text-gray-500" />
                                固定
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setOpenMenuSessionId(null)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-500" />
                            名称を変更
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setOpenMenuSessionId(null)}
                            className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            削除
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </ResizablePanel>
      <ResizableHandle disabled={true} tabIndex={-1} className="pointer-events-none cursor-default w-px bg-border outline-none ring-0 focus:ring-0 focus-visible:ring-0" />
      <ResizablePanel defaultSize="36%" minSize="25%">
      <section className="flex h-full min-w-[450px] flex-col border-r border-gray-200 bg-white font-sans text-sm antialiased">
        <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleSidebarToggle}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-slate-100 hover:text-gray-800"
              title="サイドバー開閉"
            >
              <PanelLeft className="h-4 w-4" />
            </button>

            <div
              role="tablist"
              aria-label="中央ペイン表示切り替え"
              className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "chat"}
                onClick={() => setActiveTab("chat")}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  activeTab === "chat"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                対話モード
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "data"}
                onClick={() => setActiveTab("data")}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  activeTab === "data"
                    ? "bg-white text-teal-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-800"
                )}
              >
                <Table2 className="h-3.5 w-3.5" />
                抽出データ（150件）
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingOpen((v) => !v)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 p-0 text-gray-600 hover:border-teal-300 hover:text-teal-700"
                title="分析設定"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              {settingOpen && (
                <div className="absolute right-0 top-10 z-20 w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg">
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
          {activeTab === "data" ? (
            <div className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-800">VLOOM対応履歴一覧</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  抽出期間: 2026/01/01〜01/14 ／ 対象: 150件中 4件表示
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed text-xs">
                  <thead className="bg-slate-50 text-gray-600">
                    <tr>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-medium">通話開始</th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-medium">通話時間</th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-medium">応対ユーザー</th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-medium">業務名</th>
                      <th className="whitespace-nowrap px-3 py-2 text-left font-medium">顧客電話番号</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {MOCK_CALL_RECORDS.map((row) => {
                      const highlighted = highlightedCallId === row.id;
                      return (
                        <tr
                          key={row.id}
                          className={cx(
                            "transition",
                            highlighted
                              ? "bg-yellow-100 ring-1 ring-inset ring-yellow-300"
                              : "hover:bg-slate-50"
                          )}
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-gray-800">
                            {highlighted ? (
                              <span className="mr-1 inline-flex items-center rounded bg-yellow-200 px-1 text-[10px] font-semibold text-yellow-800">
                                根拠
                              </span>
                            ) : null}
                            {row.startedAt}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.duration}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.operator}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-gray-700">{row.business}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-700">{row.phone}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <AnalysisWizard onSubmit={handleWizardSubmit} />
          ) : (
          <div className="space-y-6 py-2">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cx("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" ? (
                  <div className="flex w-full gap-4">
                    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="w-full max-w-[90%] text-sm leading-7 text-gray-800">
                      {m.text ? <p className="whitespace-pre-line">{m.text}</p> : null}
                      {m.assistantList ? (
                        <div className={cx("space-y-2", m.text ? "mt-3" : "")}>
                          <p>{m.assistantList.intro}</p>
                          <ul className="list-disc space-y-1 pl-5">
                            {m.assistantList.bullets.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                          <p>{m.assistantList.outro}</p>
                        </div>
                      ) : null}
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
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5 text-base leading-none">
                                    {card.icon ?? "•"}
                                  </span>
                                  <div>
                                    <div className="text-sm font-semibold text-teal-800">
                                      {card.title}
                                    </div>
                                    <div className="mt-1 text-xs leading-5 text-teal-700/80">
                                      {card.description}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {m.showExecutionCard ? (
                        <div className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-gray-800">
                            🚀 以下の内容で分析を実行しますか？
                          </p>
                          <div className="mt-3 whitespace-pre-line rounded-md bg-slate-50 p-3 text-xs leading-6 text-gray-700">
                            {m.executionPrompt ?? m.text}
                          </div>
                          <div className="mt-4 flex justify-end gap-2">
                            <select
                              value={executionOutputFormat}
                              onChange={(e) =>
                                setExecutionOutputFormat(e.target.value as OutputFormat)
                              }
                              disabled={isAnalyzing}
                              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700"
                            >
                              <option value="text">📝 テキスト</option>
                              <option value="table">📊 表形式</option>
                              <option value="markdown">📄 Markdown</option>
                            </select>
                            {isAnalyzing ? (
                              <button
                                type="button"
                                onClick={cancelAnalysis}
                                className="inline-flex h-9 items-center gap-1 rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
                              >
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                                ⏹️ 生成をキャンセル
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  startAnalysis(executionOutputFormat, {
                                    onFinished: () => {
                                      appendAssistantMessage(
                                        "分析が完了しました。右ペインで結果をご確認ください。"
                                      );
                                    },
                                  })
                                }
                                className="inline-flex h-9 items-center rounded-md bg-teal-600 px-3 text-xs font-semibold text-white hover:bg-teal-700"
                              >
                                🚀 分析を実行
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-100 px-4 py-3 text-sm text-gray-800">
                    {m.text}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
            {hasAttachedFile ? (
              <div className="mb-2">
                <button
                  type="button"
                  onClick={() => setHasAttachedFile(false)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-slate-50"
                >
                  📄 評価フォーマット.xlsx ✕
                </button>
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setHasAttachedFile((v) => !v)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-teal-700"
                title="添付ファイルを切り替え"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <TextareaAutosize
                minRows={1}
                maxRows={8}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleBottomSend();
                  }
                }}
                placeholder="分析の指示や、さらに深掘りしたい質問を入力してください..."
                className="max-h-28 min-h-[40px] flex-1 resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400"
                disabled={isAnalyzing}
              />
              <button
                type="button"
                onClick={handleBottomSend}
                disabled={!canSend}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                title="送信"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        </div>
      </section>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel
        panelRef={rightPanelRef}
        defaultSize={0}
        minSize="30%"
        collapsible={true}
        collapsedSize={0}
      >

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
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
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
          {!isAnalyzing && !showResult && (
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
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-teal-600" />
              <p className="mt-3 text-sm text-gray-600">分析を実行中... (処理中)</p>
            </div>
          )}

          {!isAnalyzing && showResult && artifactRows && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">解約理由分析（TOP3）</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  {artifactSummary}
                  <button
                    type="button"
                    onClick={() => handleCitationClick("call-1")}
                    className="mx-1 rounded border border-teal-200 bg-teal-50 px-1 align-baseline text-xs font-bold text-teal-600 hover:bg-teal-100 hover:underline"
                    title="根拠となる通話データを開く"
                  >
                    [1]
                  </button>
                </p>
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
                        <td className="px-4 py-3">
                          {row.sample}
                          {row.rank === 1 ? (
                            <button
                              type="button"
                              onClick={() => handleCitationClick("call-1")}
                              className="ml-1 rounded border border-teal-200 bg-teal-50 px-1 align-baseline text-xs font-bold text-teal-600 hover:bg-teal-100 hover:underline"
                              title="根拠となる通話データを開く"
                            >
                              [1]
                            </button>
                          ) : null}
                        </td>
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

function AnalysisWizard({
  onSubmit,
}: {
  onSubmit: (summary: string, executionPrompt: string) => void;
}) {
  const [purpose, setPurpose] = useState<WizardPurposeId | null>(null);
  const [purposeOther, setPurposeOther] = useState("");
  const [datePreset, setDatePreset] = useState<"today" | "week" | "lastMonth" | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [business, setBusiness] = useState<string[]>([]);
  const [skill, setSkill] = useState<string[]>([]);
  const [userName, setUserName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedValues, setAdvancedValues] = useState<Record<string, string>>({});

  const purposeLabel = useMemo(() => {
    if (!purpose) return null;
    const entry = WIZARD_PURPOSES.find((p) => p.id === purpose);
    if (!entry) return null;
    if (purpose === "other") {
      return purposeOther.trim() ? `その他: ${purposeOther.trim()}` : null;
    }
    return entry.label;
  }, [purpose, purposeOther]);

  const dateRangeLabel = useMemo(() => {
    if (datePreset === "today") return "今日";
    if (datePreset === "week") return "今週";
    if (datePreset === "lastMonth") return "先月";
    if (dateFrom && dateTo) return `${dateFrom} 〜 ${dateTo}`;
    if (dateFrom) return `${dateFrom} 〜`;
    if (dateTo) return `〜 ${dateTo}`;
    return null;
  }, [datePreset, dateFrom, dateTo]);

  const canRun = Boolean(purposeLabel);

  const handleRun = () => {
    if (!canRun) return;
    const base: string[] = [];
    if (purposeLabel) base.push(`目的: ${purposeLabel}`);
    if (dateRangeLabel) base.push(`期間: ${dateRangeLabel}`);
    if (business.length) base.push(`業務名: ${business.join(", ")}`);
    if (skill.length) base.push(`スキル: ${skill.join(", ")}`);
    if (userName.trim()) base.push(`ユーザー名: ${userName.trim()}`);

    const advancedLines = WIZARD_ADVANCED_FIELDS.flatMap((field) => {
      const v = advancedValues[field.id];
      if (!v || (field.type === "select" && v === "すべて")) return [];
      return [`${field.label}: ${v}`];
    });

    const summary = base.join(" / ");
    const executionPrompt = [
      "【問診票による分析リクエスト】",
      ...base,
      ...(advancedLines.length ? ["", "■ 詳細条件", ...advancedLines] : []),
    ].join("\n");

    onSubmit(summary, executionPrompt);
  };

  return (
    <div className="mx-auto w-full max-w-2xl py-4">
      <div className="flex gap-4">
        <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Bot className="h-4 w-4" />
        </div>
        <div className="w-full space-y-6 text-sm leading-7 text-gray-800">
          <p>
            全データにアクセス可能です。どのような通話を分析しますか？
            <br />
            以下の問診票に答えていただくと、最適な条件で検索を実行します。
          </p>

          {/* Q1. 目的 */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-semibold text-teal-700">
                Q1
              </span>
              <p className="text-sm font-semibold text-gray-800">
                分析の目的を教えてください
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {WIZARD_PURPOSES.map((p, idx) => {
                const selected = purpose === p.id;
                const isLast = idx === WIZARD_PURPOSES.length - 1;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPurpose(p.id)}
                    className={cx(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs transition",
                      isLast ? "col-span-2" : "",
                      selected
                        ? "border-teal-400 bg-teal-50 text-teal-800 shadow-sm"
                        : "border-slate-200 bg-white text-gray-700 hover:border-teal-200 hover:bg-teal-50/40"
                    )}
                  >
                    <span className="text-base leading-none">{p.emoji}</span>
                    <span className="font-medium">{p.label}</span>
                  </button>
                );
              })}
            </div>
            {purpose === "other" ? (
              <input
                type="text"
                value={purposeOther}
                onChange={(e) => setPurposeOther(e.target.value)}
                placeholder="分析したい目的を自由にご記入ください"
                className="mt-3 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-gray-800 outline-none ring-2 ring-transparent focus:ring-teal-100"
              />
            ) : null}
          </section>

          {/* Q2. 期間 */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-semibold text-teal-700">
                Q2
              </span>
              <p className="text-sm font-semibold text-gray-800">対象期間を選んでください</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {WIZARD_DATE_PRESETS.map((preset) => {
                const selected = datePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setDatePreset(preset.id);
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className={cx(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      selected
                        ? "border-teal-400 bg-teal-50 text-teal-800"
                        : "border-slate-200 bg-white text-gray-600 hover:border-teal-200 hover:bg-teal-50/40"
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="text-gray-500">または範囲指定</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDatePreset(null);
                }}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-teal-400"
              />
              <span className="text-gray-400">〜</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDatePreset(null);
                }}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-teal-400"
              />
            </div>
          </section>

          {/* Q3. 詳細条件 */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[11px] font-semibold text-teal-700">
                Q3
              </span>
              <p className="text-sm font-semibold text-gray-800">詳細条件を指定します</p>
            </div>
            <div className="grid grid-cols-3 items-start gap-2.5">
              <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                <div className="flex items-center justify-between">
                  <span>業務名（複数選択可）</span>
                  {business.length ? (
                    <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                      {business.length}
                    </span>
                  ) : null}
                </div>
                <div className="flex h-28 flex-col gap-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                  {WIZARD_BUSINESS_OPTIONS.map((opt) => {
                    const checked = business.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={cx(
                          "inline-flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs transition",
                          checked ? "bg-teal-50 text-teal-800" : "text-gray-700 hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBusiness((prev) => [...prev, opt]);
                            } else {
                              setBusiness((prev) => prev.filter((v) => v !== opt));
                            }
                          }}
                          className="h-3.5 w-3.5 shrink-0 accent-teal-600"
                        />
                        <span className="truncate">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-gray-500">
                <div className="flex items-center justify-between">
                  <span>スキル（複数選択可）</span>
                  {skill.length ? (
                    <span className="rounded-full bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700">
                      {skill.length}
                    </span>
                  ) : null}
                </div>
                <div className="flex h-28 flex-col gap-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
                  {WIZARD_SKILL_OPTIONS.map((opt) => {
                    const checked = skill.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={cx(
                          "inline-flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs transition",
                          checked ? "bg-teal-50 text-teal-800" : "text-gray-700 hover:bg-slate-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSkill((prev) => [...prev, opt]);
                            } else {
                              setSkill((prev) => prev.filter((v) => v !== opt));
                            }
                          }}
                          className="h-3.5 w-3.5 shrink-0 accent-teal-600"
                        />
                        <span className="truncate">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <label className="flex flex-col gap-1 text-[11px] text-gray-500">
                ユーザー名
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="例: 山田 太郎"
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-teal-400"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50"
            >
              <ChevronDown
                className={cx(
                  "h-3.5 w-3.5 transition-transform",
                  showAdvanced ? "rotate-180" : ""
                )}
              />
              {showAdvanced ? "詳細条件を閉じる" : "＋ さらに詳細な条件を指定する"}
            </button>

            {showAdvanced ? (
              <div className="mt-3 grid grid-cols-2 gap-2.5 rounded-lg bg-slate-50 p-3">
                {WIZARD_ADVANCED_FIELDS.map((field) => (
                  <label key={field.id} className="flex flex-col gap-1 text-[11px] text-gray-500">
                    {field.label}
                    {field.type === "select" ? (
                      <select
                        value={advancedValues[field.id] ?? ""}
                        onChange={(e) =>
                          setAdvancedValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-teal-400"
                      >
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={advancedValues[field.id] ?? ""}
                        onChange={(e) =>
                          setAdvancedValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        placeholder={"placeholder" in field ? field.placeholder : undefined}
                        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-teal-400"
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : null}
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleRun}
              disabled={!canRun}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Sparkles className="h-4 w-4" />
              🚀 検索を実行する
            </button>
          </div>
        </div>
      </div>
    </div>
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
