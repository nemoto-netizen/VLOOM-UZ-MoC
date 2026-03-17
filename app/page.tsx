"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  FileText,
  Folder,
  Paperclip,
  Plus,
  Save,
  Send,
  Star,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  showInlinePromptInput?: boolean;
  showExecutionCard?: boolean;
  executionPrompt?: string;
  assistantList?: {
    intro: string;
    bullets: string[];
    outro: string;
  };
};

type ArtifactRow = {
  rank: number;
  reason: string;
  count: number;
  ratio: string;
  status: "risk-high" | "risk-mid" | "positive";
  sample: string;
};

const FIRST_ACTION_CHIPS = [
  "経営・事業部への報告（VOC抽出）",
  "現場の育成と応対品質（QA・評価）",
  "業務効率・コストの改善（AHT短縮）",
  "リスク・クレームの早期発見（炎上防止）",
] as const;

const SUGGEST_CARD_CONTENT: Record<
  string,
  { icon?: string; title: string; description: string }
> = {
  "経営・事業部への報告（VOC抽出）": {
    icon: "🏢",
    title: "経営・事業部への報告（VOC抽出）",
    description: "解約の真因や、サービスへの隠れた要望・不満を抽出します。",
  },
  "現場の育成と応対品質（QA・評価）": {
    icon: "👥",
    title: "現場の育成と応対品質（QA・評価）",
    description: "優秀者のトーク分析や、NG対応の検知、自動スコアリングを行います。",
  },
  "業務効率・コストの改善（AHT短縮）": {
    icon: "📉",
    title: "業務効率・コストの改善（AHT短縮）",
    description: "通話が長引く原因の特定や、FAQ・マニュアルの改善点を探ります。",
  },
  "リスク・クレームの早期発見（炎上防止）": {
    icon: "⚠️",
    title: "リスク・クレームの早期発見（炎上防止）",
    description: "激しいクレームや、コンプライアンス違反リスクのある通話を洗い出します。",
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

const FIRST_ACTION_RESPONSES: Record<
  (typeof FIRST_ACTION_CHIPS)[number],
  { intro: string; bullets: string[]; outro: string }
> = {
  "経営・事業部への報告（VOC抽出）": {
    intro:
      "『経営・事業部への報告』ですね、承知いたしました。今回のデータ群であれば、以下の2つの切り口で深掘りすると有益なレポートが作成できそうです。",
    bullets: [
      "解約・離脱リスクの真因特定",
      "サービスへの潜在的な要望抽出",
    ],
    outro:
      "もちろん、両方組み合わせたり、独自の気になるキーワードを追加していただいたりすることも可能です。どのように進めましょうか？",
  },
  "現場の育成と応対品質（QA・評価）": {
    intro:
      "『現場の育成と応対品質』ですね、承知いたしました。以下の2つの観点で分析を進めることができます。",
    bullets: [
      "ハイパフォーマーの暗黙知抽出",
      "NG対応や説明不足の検知",
    ],
    outro:
      "もちろん、両方組み合わせたり、独自の気になるキーワードを追加していただいたりすることも可能です。どのように進めましょうか？",
  },
  "業務効率・コストの改善（AHT短縮）": {
    intro:
      "『業務効率・コストの改善』ですね、承知いたしました。AHT短縮に向けて、以下の要因を特定できそうです。",
    bullets: [
      "通話長期化のボトルネック特定",
      "FAQ・マニュアルの改善提案",
    ],
    outro:
      "もちろん、両方組み合わせたり、独自の気になるキーワードを追加していただいたりすることも可能です。どのように進めましょうか？",
  },
  "リスク・クレームの早期発見（炎上防止）": {
    intro:
      "『リスク・クレームの早期発見』ですね、承知いたしました。以下のリスク要因を洗い出すことができます。",
    bullets: [
      "クレーム化のトリガー特定",
      "コンプライアンス違反リスクの検知",
    ],
    outro:
      "もちろん、両方組み合わせたり、独自の気になるキーワードを追加していただいたりすることも可能です。どのように進めましょうか？",
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

  const [executionOutputFormat, setExecutionOutputFormat] = useState<OutputFormat>("table");
  const [chatInput, setChatInput] = useState("");
  const [isPromptSheetOpen, setIsPromptSheetOpen] = useState(false);
  const [promptDraftName, setPromptDraftName] = useState("解約分析_定型プロンプト");
  const [promptDraftContent, setPromptDraftContent] = useState(
    "以下の通話ログを対象に、解約理由を分類し、上位3カテゴリの傾向と具体例を抽出してください。\n加えて、改善アクションを優先度順で提案してください。"
  );
  const [isClient, setIsClient] = useState(false);
  const [isCreatePromptDialogOpen, setIsCreatePromptDialogOpen] = useState(false);
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptContent, setNewPromptContent] = useState("");
  const [inlinePromptInput, setInlinePromptInput] = useState("");
  const [hasAttachedFile, setHasAttachedFile] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: "assistant",
      text:
        "100件の通話データの読み込みが完了しました。お疲れ様です。\nさっそく分析を始めましょう。今回は、どのようなセンター課題の解決に向けてデータを活用したいですか？\n現在のお悩みに最も近いテーマをお選びいただくか、下部の入力欄から自由に教えてください。",
      suggestChips: [...FIRST_ACTION_CHIPS],
      showInlinePromptInput: true,
    },
  ]);

  // Left/Right を跨いで利用する分析状態（親レベル管理）
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [artifactRows, setArtifactRows] = useState<ArtifactRow[] | null>(null);
  const [artifactTitle, setArtifactTitle] = useState("分析レポート結果（未実行）");
  const [artifactSummary, setArtifactSummary] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
      showInlinePromptInput?: boolean;
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
        showInlinePromptInput: options?.showInlinePromptInput,
        showExecutionCard: options?.showExecutionCard,
        executionPrompt: options?.executionPrompt,
      },
    ]);
  };

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
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

    analyzingTimeoutRef.current = window.setTimeout(() => {
      setArtifactRows(ARTIFACT_ROWS);
      setArtifactSummary(
        "解約理由の上位は「初回未解決」「説明不足」「価格不満」で、応対品質と情報設計の改善余地が高いと判断されます。"
      );
      setIsAnalyzing(false);
      setShowResult(true);
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

  const isFirstActionChip = (
    chip: string
  ): chip is (typeof FIRST_ACTION_CHIPS)[number] =>
    (FIRST_ACTION_CHIPS as readonly string[]).includes(chip);

  const handleSuggestClick = (chip: string) => {
    if (isFirstActionChip(chip)) {
      appendUserMessage(chip);
      window.setTimeout(() => {
        appendAssistantMessage("", {
          assistantList: FIRST_ACTION_RESPONSES[chip],
          showExecutionCard: true,
          executionPrompt: `${chip}\n\n分析観点: ${FIRST_ACTION_RESPONSES[chip].bullets.join(" / ")}`,
        });
      }, 700);
      return;
    }
    runAnalysis(chip);
  };

  const handleInlinePromptSubmit = () => {
    const prompt = inlinePromptInput.trim();
    if (!prompt) return;
    appendUserMessage(prompt);
    setInlinePromptInput("");
    window.setTimeout(() => {
      appendAssistantMessage("", {
        assistantList: {
          intro:
            "ありがとうございます。ご入力内容を起点に、次の2ステップで整理すると実行しやすくなります。",
          bullets: [
            "課題の対象を特定（対象顧客・対象業務・対象期間の明確化）",
            "成果物の形式を確定（経営報告向け要約 or 現場改善向け詳細）",
          ],
          outro: "必要に応じて、実行待機カードから分析を開始できます。",
        },
      });
    }, 700);
  };

  const handleBottomSend = () => {
    if (!canSend) return;
    const text = chatInput.trim();
    appendUserMessage(text);
    setChatInput("");
    window.setTimeout(() => {
      if (hasAttachedFile) {
        setShowResult(false);
        appendAssistantMessage(
          "ファイル『評価フォーマット.xlsx』を読み込みました。この評価軸に沿って分析を実行します。",
          {
            showExecutionCard: true,
            executionPrompt: `${text}\n\n添付ファイル: 評価フォーマット.xlsx`,
          }
        );
      }
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

  const handleReset = () => {
    cancelAnalysis();
    setArtifactRows(null);
    setArtifactSummary("");
    setArtifactTitle("分析レポート結果（未実行）");
    setShowResult(false);
  };

  const handleCreatePromptRegister = () => {
    setIsCreatePromptDialogOpen(false);
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
      <aside
        className={cx(
          "border-r border-gray-200 bg-slate-50 transition-all duration-200",
          sidebarCollapsed ? "w-14" : "w-64"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3">
            {!sidebarCollapsed && (
              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-semibold text-gray-700">
                <Folder className="h-4 w-4" />
                お気に入りプロンプト
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsCreatePromptDialogOpen(true)}
                className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 text-[11px] font-medium text-gray-700 hover:bg-slate-100"
                title="新規プロンプト作成"
              >
                <Plus className="h-3.5 w-3.5" />
                {!sidebarCollapsed ? "新規作成" : null}
              </button>
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
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <TooltipProvider delayDuration={120}>
              {FAVORITE_PROMPTS.map((item) => (
                <Tooltip key={item}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setChatInput(FAVORITE_PROMPT_PREVIEWS[item] ?? item)}
                      className="mb-1 w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-slate-200"
                    >
                      {sidebarCollapsed ? "•" : item}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="start" className="max-w-xs whitespace-normal">
                    <p className="font-semibold text-gray-800">{item}</p>
                    <p className="mt-1 text-gray-600">
                      {FAVORITE_PROMPT_PREVIEWS[item] ?? "このプロンプトの詳細は未設定です。"}
                    </p>
                    <div className="mt-2 border-t border-gray-200 pt-2 text-[10px] text-gray-400">
                      👤 作成者: 根本 | 🕒 登録日: 2026/03/17
                    </div>
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
              <div className="mt-1 text-xs text-gray-500">
                🔍 検索条件: 2026/01/01〜01/14 | 担当者: すべて | 抽出: 100件
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
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
                      {m.showInlinePromptInput ? (
                        <div className="mt-4 rounded-lg bg-slate-50 p-4">
                          <p className="text-xs font-medium text-gray-600">
                            または、具体的なお悩みやキーワードを自由に入力：
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={inlinePromptInput}
                              onChange={(e) => setInlinePromptInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleInlinePromptSubmit();
                                }
                              }}
                              placeholder="例: 新人オペレーターの離脱につながる会話傾向を知りたい"
                              className="h-10 flex-1 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none ring-2 ring-transparent focus:ring-teal-100"
                            />
                            <button
                              type="button"
                              onClick={handleInlinePromptSubmit}
                              className="inline-flex h-10 items-center rounded-md bg-teal-600 px-4 text-xs font-semibold text-white hover:bg-teal-700"
                            >
                              送信
                            </button>
                          </div>
                        </div>
                      ) : null}
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
              <textarea
                ref={textareaRef}
                rows={1}
                value={chatInput}
                onChange={(e) => {
                  setChatInput(e.target.value);
                  resizeTextarea();
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

      <Dialog open={isCreatePromptDialogOpen} onOpenChange={setIsCreatePromptDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>新規プロンプト作成</DialogTitle>
            <DialogDescription>
              よく使う分析テンプレートを事前に登録します（MoCモック）。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">プロンプト名</label>
              <input
                type="text"
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
                placeholder="例: 解約理由の深掘り分析"
                className="h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-800 outline-none ring-2 ring-transparent focus:ring-teal-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">内容</label>
              <textarea
                rows={6}
                value={newPromptContent}
                onChange={(e) => setNewPromptContent(e.target.value)}
                placeholder="分析したい観点、出力形式、制約条件などを記入"
                className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none ring-2 ring-transparent focus:ring-teal-100"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsCreatePromptDialogOpen(false)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleCreatePromptRegister}
              className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
            >
              登録
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
