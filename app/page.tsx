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
  Loader2,
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
  qualityForm?: boolean;
  qualityFormSubmitted?: boolean;
  qualityFormSnapshot?: {
    phase: string;
    focus: string[];
    usage: string;
  };
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
  updatedAt?: number;
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

const FILTER_USER_OPTIONS = [
  "佐藤",
  "鈴木",
  "田中",
  "山田",
  "伊藤",
  "渡辺",
  "中村",
  "小林",
];

const FILTER_PERIOD_PRESETS = [
  "過去1週間",
  "過去1ヶ月",
  "過去3ヶ月",
  "過去6ヶ月",
  "過去1年",
];

type QualityQuestionId = "phase" | "focus" | "usage";

const QUALITY_FORM_QUESTIONS: {
  id: QualityQuestionId;
  title: string;
  multi: boolean;
  options: string[];
}[] = [
  {
    id: "phase",
    title: "1. どのような応対フェーズに焦点を当てますか？",
    multi: false,
    options: [
      "接客マナー・基本応対",
      "ニーズ把握・ヒアリング",
      "ソリューション提案",
      "クロージング・手続き",
      "反論・クレーム処理",
    ],
  },
  {
    id: "focus",
    title: "2. 特に何を見極めたいですか？(複数選択可)",
    multi: true,
    options: [
      "共感・情緒的つながり",
      "正確な知識・マニュアル遵守",
      "論理的な説明能力",
      "誘導・成約力",
      "無駄な対話の削減",
      "コンプライアンス",
    ],
  },
  {
    id: "usage",
    title: "3. 分析結果を何に使いますか？",
    multi: false,
    options: [
      "本人へのフィードバック",
      "管理者への報告書作成",
      "ベストプラクティス抽出",
      "教育研修案の策定",
    ],
  },
];

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

type PromptTemplate = {
  id: string;
  title: string;
  content: string;
};

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "t1",
    title: "解約理由の真因特定",
    content:
      "# 前提条件\n- 対象: 直近30日間の解約申込通話\n- 除外: 一時的休止・試用期間満了\n\n# 指示\n1. 解約理由を上位3カテゴリに分類し、件数と構成比を提示せよ。\n2. 各カテゴリの代表的発言（サンプル）を3件ずつ抜粋せよ。\n3. 真因（表層ではなく根本原因）を仮説ベースで提示し、対応優先度を付けよ。",
  },
  {
    id: "t2",
    title: "新人オペレーター品質チェック",
    content:
      "# 前提条件\n- 対象: 入社6ヶ月以内のオペレーター\n- スキル区分: 新人\n\n# 指示\n1. 保留時間の中央値・最大値を算出し、平均値を上回る通話を抽出せよ。\n2. NGワード（『わかりません』『たぶん』『できません』）の出現回数をカウントせよ。\n3. 改善すべきスクリプト箇所を通話例と共に提示せよ。",
  },
  {
    id: "t3",
    title: "クレーム通話の感情分析",
    content:
      "# 前提条件\n- 対象: 感情スコアがネガティブ閾値を下回る通話\n- 期間: 過去14日\n\n# 指示\n1. クレーム種別（製品・対応・費用）ごとの感情強度ランキングを作成せよ。\n2. エスカレーション対応が適切だった通話と失敗した通話を対比せよ。\n3. 再発防止策を業務マニュアル改訂案として提案せよ。",
  },
  {
    id: "t4",
    title: "FAQ整備のための頻出質問抽出",
    content:
      "# 前提条件\n- 対象: インバウンド通話の冒頭2分\n\n# 指示\n1. 顧客が最初に発した質問をクラスタリングし、頻出上位20件を抽出せよ。\n2. 既存FAQで回答可能なもの／新規FAQとして追加すべきものに分類せよ。\n3. 新規FAQは想定質問文と推奨回答文のドラフトを生成せよ。",
  },
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
  const [promptSheetMode, setPromptSheetMode] = useState<"list" | "register">("list");
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [registerDraftName, setRegisterDraftName] = useState("");
  const [registerDraftContent, setRegisterDraftContent] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [hasAttachedFile, setHasAttachedFile] = useState(false);
  const [activeTab, setActiveTab] = useState<CentralTab>("chat");
  const [sessions, setSessions] = useState<ChatSession[]>(MOCK_SESSIONS);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
  const [highlightedCallId, setHighlightedCallId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Left/Right を跨いで利用する分析状態（親レベル管理）
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isDataUnlocked, setIsDataUnlocked] = useState(false);
  const [searchConfig, setSearchConfig] = useState<{
    period: string;
    business: string[];
    skill: string[];
    user: string[];
    details: string[];
  }>({
    period: "過去1ヶ月",
    business: ["解約受付センター"],
    skill: ["新人", "中堅"],
    user: [],
    details: [],
  });
  const [sessionSearchQuery, setSessionSearchQuery] = useState("");
  const [openPopover, setOpenPopover] = useState<
    "period" | "business" | "skill" | "user" | "details" | null
  >(null);
  const [popoverSearch, setPopoverSearch] = useState<{
    business: string;
    skill: string;
    user: string;
  }>({ business: "", skill: "", user: "" });
  const [qualityFormAnswers, setQualityFormAnswers] = useState<{
    phase: string | null;
    focus: string[];
    usage: string | null;
  }>({ phase: null, focus: [], usage: null });
  const [qualityExecutionContext, setQualityExecutionContext] = useState<{
    phase: string;
    focus: string[];
    usage: string;
  } | null>(null);
  const activeQualityFormIdRef = useRef<string | null>(null);
  const businessSearchRef = useRef<HTMLInputElement>(null);
  const skillSearchRef = useRef<HTMLInputElement>(null);
  const userSearchRef = useRef<HTMLInputElement>(null);
  const [showResult, setShowResult] = useState(false);
  const [artifactRows, setArtifactRows] = useState<ArtifactRow[] | null>(null);
  const [artifactTitle, setArtifactTitle] = useState("分析レポート結果（未実行）");
  const [artifactSummary, setArtifactSummary] = useState("");

  const analyzingTimeoutRef = useRef<number | null>(null);
  const canSend = chatInput.trim().length > 0 && !isAnalyzing;

  const filteredBusinessOptions = useMemo(() => {
    const q = popoverSearch.business.trim().toLowerCase();
    return q
      ? WIZARD_BUSINESS_OPTIONS.filter((o) => o.toLowerCase().includes(q))
      : WIZARD_BUSINESS_OPTIONS;
  }, [popoverSearch.business]);

  const filteredSkillOptions = useMemo(() => {
    const q = popoverSearch.skill.trim().toLowerCase();
    return q
      ? WIZARD_SKILL_OPTIONS.filter((o) => o.toLowerCase().includes(q))
      : WIZARD_SKILL_OPTIONS;
  }, [popoverSearch.skill]);

  const filteredUserOptions = useMemo(() => {
    const q = popoverSearch.user.trim().toLowerCase();
    return q
      ? FILTER_USER_OPTIONS.filter((o) => o.toLowerCase().includes(q))
      : FILTER_USER_OPTIONS;
  }, [popoverSearch.user]);

  useEffect(() => {
    if (openPopover === "business") {
      businessSearchRef.current?.focus();
    } else if (openPopover === "skill") {
      skillSearchRef.current?.focus();
    } else if (openPopover === "user") {
      userSearchRef.current?.focus();
    }
  }, [openPopover]);

  const toggleFilterOption = (
    key: "business" | "skill" | "user",
    option: string
  ) => {
    setSearchConfig((prev) => {
      const list = prev[key];
      const next = list.includes(option)
        ? list.filter((x) => x !== option)
        : [...list, option];
      return { ...prev, [key]: next };
    });
  };

  const businessBadgeLabel = (() => {
    const n = searchConfig.business.length;
    if (n === 0) return "未選択";
    if (n === WIZARD_BUSINESS_OPTIONS.length) return "全業務";
    return `${n}業務`;
  })();

  const skillBadgeLabel = (() => {
    const n = searchConfig.skill.length;
    if (n === 0) return "未選択";
    if (n === WIZARD_SKILL_OPTIONS.length) return "全スキル";
    return `${n}スキル`;
  })();

  const userBadgeLabel = (() => {
    const n = searchConfig.user.length;
    if (n === 0 || n === FILTER_USER_OPTIONS.length) return "全ユーザー";
    return `${n}ユーザー`;
  })();

  const hasAssistantMessage = useMemo(
    () => messages.some((m) => m.role === "assistant"),
    [messages]
  );

  const executionContextLabel = (() => {
    const bn = searchConfig.business.length;
    const businessPart =
      bn === 0
        ? "未選択"
        : bn === WIZARD_BUSINESS_OPTIONS.length
        ? "全業務"
        : `${bn}業務`;
    const sn = searchConfig.skill.length;
    const skillPart =
      sn === 0
        ? "未選択"
        : sn === WIZARD_SKILL_OPTIONS.length
        ? "全スキル"
        : `${sn}スキル`;
    const un = searchConfig.user.length;
    const userPart =
      un === 0 || un === FILTER_USER_OPTIONS.length
        ? "全ユーザー"
        : searchConfig.user.join("、");
    return `🔍 実行条件：${searchConfig.period} / ${businessPart} / ${skillPart} / ユーザー: ${userPart}`;
  })();

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

  const isQualityFormComplete =
    qualityFormAnswers.phase !== null &&
    qualityFormAnswers.focus.length > 0 &&
    qualityFormAnswers.usage !== null;

  const toggleQualityAnswer = (
    qId: QualityQuestionId,
    option: string,
    multi: boolean
  ) => {
    setQualityFormAnswers((prev) => {
      if (qId === "focus") {
        const list = prev.focus;
        return {
          ...prev,
          focus: list.includes(option)
            ? list.filter((x) => x !== option)
            : [...list, option],
        };
      }
      if (qId === "phase") {
        return {
          ...prev,
          phase: prev.phase === option ? null : option,
        };
      }
      return {
        ...prev,
        usage: prev.usage === option ? null : option,
      };
    });
  };

  const handleQualityFormSubmit = () => {
    const { phase, focus, usage } = qualityFormAnswers;
    if (!phase || focus.length === 0 || !usage) return;

    const snapshot = { phase, focus: [...focus], usage };
    setQualityExecutionContext(snapshot);

    const formId = activeQualityFormIdRef.current;
    if (formId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === formId
            ? { ...m, qualityFormSubmitted: true, qualityFormSnapshot: snapshot }
            : m
        )
      );
    }
    activeQualityFormIdRef.current = null;

    const userText = [
      "【応対品質の分析要件】",
      `・応対フェーズ: ${phase}`,
      `・見極めたい観点: ${focus.join("、")}`,
      `・分析結果の活用: ${usage}`,
    ].join("\n");
    appendUserMessage(userText);

    const prompt = [
      "# 検索クエリ定義",
      "- Target: 応対通話録音データ",
      `- Focus Phase: ${phase}`,
      "",
      "# AI分析インストラクション",
      `対象通話を「${phase}」のフェーズに絞り込み、以下の観点で応対品質を評価してください。`,
      ...focus.map((f, i) => `${i + 1}. ${f}`),
      "",
      "# 活用目的",
      `本レポートは「${usage}」として使用します。この用途に最適化した表現・粒度で記述してください。`,
      "",
      "# 出力フォーマット",
      "Markdownの表形式（観点, スコア, 根拠, 代表発話）",
    ].join("\n");

    const greeting = `承知いたしました。ご指定いただいた『${phase}』フェーズを中心に、『${focus.join(
      "、"
    )}』の観点で分析条件を組み立てました。以下のプロンプトで問題なければ、結果を右ペインに抽出します。`;

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          text: greeting,
          showExecutionCard: true,
          executionPrompt: prompt,
        },
      ]);
    }, 800);
  };

  const handleSuggestClick = (chip: string) => {
    setMessages((prev) => [
      ...prev,
      { id: createId(), role: "user", text: chip },
    ]);
    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          text: "承知いたしました。ご要望に合わせて、検索条件と分析指示を最適化した以下のプロンプトを作成しました。この内容で裏側でデータを抽出し、一気に分析を実行してよろしいでしょうか？",
          showExecutionCard: true,
          executionPrompt:
            '# 検索クエリ定義\n- Target: 解約受付センター\n- VectorSearch: "解約の真因", "高い", "他社"\n\n# AI分析インストラクション\n抽出された通話録音データを解析し、以下の要件に従ってレポートを作成してください。\n1. 顧客が解約を決意した根本原因（真因）を特定し、出現頻度順にランキング化すること。\n2. 各要因に対して、実際の通話からの具体的な発話サンプルを引用すること。\n\n# 出力フォーマット\nMarkdownの表形式（順位, 解約理由, 件数, 比率, 具体例）',
        },
      ]);
    }, 800);
  };

  const handleExecuteAnalysis = () => {
    if (isExecuting) return;
    setIsExecuting(true);

    window.setTimeout(() => {
      setArtifactRows(ARTIFACT_ROWS);
      setArtifactSummary(
        "解約理由の上位は「初回未解決」「説明不足」「価格不満」で、応対品質と情報設計の改善余地が高いと判断されます。"
      );
      setArtifactTitle("分析レポート結果（表形式）");
      setShowResult(true);
      setIsExecuting(false);
      setIsDataUnlocked(true);
      rightPanelRef.current?.resize("40%");
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "assistant",
          text: "分析が完了しました。右パネルにレポートを出力しました。\n裏側で抽出された150件の対象データは、上部の「抽出データ」タブからご確認いただけます。",
        },
      ]);
    }, 3000);
  };

  const handleWelcomeCardClick = (title: string) => {
    appendUserMessage(title);

    if (title.includes("オペレータ品質")) {
      setQualityFormAnswers({ phase: null, focus: [], usage: null });
      setQualityExecutionContext(null);
      const formId = createId();
      activeQualityFormIdRef.current = formId;
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: formId,
            role: "assistant",
            text: "応対品質の分析ですね。的確な分析にするため、以下の3点を教えてください。",
            qualityForm: true,
          },
        ]);
      }, 800);
      return;
    }

    const scenario = (() => {
      if (title.includes("FAQ")) {
        return {
          text: "FAQの整備に向けて、どのようなデータを抽出しましょうか？",
          chips: [
            "よくある質問の自動集計",
            "回答に窮したケースの特定",
            "既存FAQとの乖離チェック",
          ],
        };
      }
      if (title.includes("成功・失敗")) {
        return {
          text: "傾向分析ですね。成功と失敗、どちらの要因を深掘りしますか？",
          chips: [
            "成約に至ったベストプラクティス抽出",
            "失注・解約のボトルネック特定",
            "両者のトーク比較",
          ],
        };
      }
      return {
        text: "スクリプトの改善ですね。現状の課題はどのあたりにありますか？",
        chips: [
          "オープニングの離脱率改善",
          "クロージングの決定率向上",
          "反論時の切り返し強化",
        ],
      };
    })();

    window.setTimeout(() => {
      appendAssistantMessage(scenario.text, { chips: scenario.chips });
    }, 800);
  };

  const handleWizardSubmit = (userText: string) => {
    appendUserMessage(userText);
    window.setTimeout(() => {
      appendAssistantMessage(
        "承知いたしました。対象業務とスキルの条件を確認しました。この条件でデータを抽出する前に、さらに解像度を上げるための質問です。今回の分析では、どのような『観点（例：解約の真因、NGワードの有無など）』をレポートにまとめたいですか？",
        {
          chips: [
            "解約の真因をランキングで抽出",
            "ポジティブ/ネガティブ要因の比較",
          ],
        }
      );
    }, 600);
  };

  const handleBottomSend = () => {
    if (!canSend) return;
    const text = chatInput.trim();
    appendUserMessage(text);
    setChatInput("");
    window.setTimeout(() => {
      appendAssistantMessage(
        "承知いたしました。分析を開始する前に、上部の「⚙️ 対象」バッジから、期間や対象業務の絞り込みに問題がないかご確認ください。"
      );
    }, 1000);
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

  const resetQualityState = () => {
    setQualityFormAnswers({ phase: null, focus: [], usage: null });
    setQualityExecutionContext(null);
    activeQualityFormIdRef.current = null;
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      resetQualityState();
    }
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
                  resetQualityState();
                  setActiveTab("chat");
                  rightPanelRef.current?.collapse();
                  const newSession: ChatSession = {
                    id: String(Date.now()),
                    title: "名称未設定",
                    date: "今日",
                    isPinned: false,
                  };
                  setSessions((prev) => [newSession, ...prev]);
                  setActiveSessionId(newSession.id);
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
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={sessionSearchQuery}
                  onChange={(e) => setSessionSearchQuery(e.target.value)}
                  placeholder="セッションを検索"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs text-slate-700 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setPromptSheetMode("list");
                  setIsPromptSheetOpen(true);
                }}
                className="inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-teal-700 transition hover:bg-teal-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                ✨ プロンプトテンプレート管理
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {(() => {
                const query = sessionSearchQuery.trim().toLowerCase();
                const filtered = query
                  ? sessions.filter((s) =>
                      s.title.toLowerCase().includes(query)
                    )
                  : sessions;
                const groups: { label: string; items: ChatSession[] }[] = [
                  { label: "📌 固定", items: filtered.filter((s) => s.isPinned) },
                  { label: "今日", items: filtered.filter((s) => !s.isPinned && s.date === "今日") },
                  { label: "昨日", items: filtered.filter((s) => !s.isPinned && s.date === "昨日") },
                  { label: "過去7日間", items: filtered.filter((s) => !s.isPinned && s.date === "過去7日間") },
                  { label: "過去30日間", items: filtered.filter((s) => !s.isPinned && s.date === "過去30日間") },
                ];

                const renderItem = (session: ChatSession) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      className={cx(
                        "group relative rounded-md border transition",
                        isActive
                          ? "border-teal-200 bg-teal-50"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {isActive ? (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-teal-500"
                        />
                      ) : null}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setActiveSessionId(session.id);
                          setActiveTab("chat");
                          resetQualityState();
                          setMessages([
                            {
                              id: createId(),
                              role: "user",
                              text: `${session.title}の内容を表示中...`,
                            },
                            {
                              id: createId(),
                              role: "assistant",
                              text: "当時の分析結果を復元しました。",
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
                        <p className="truncate pr-6 text-sm text-gray-700">{session.title}</p>
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
                              onClick={() => {
                                handleDeleteSession(session.id);
                                setOpenMenuSessionId(null);
                              }}
                              className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              削除
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                };

                return groups.map(({ label, items }) =>
                  items.length === 0 ? null : (
                    <section key={label}>
                      <div className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-500">
                        {label}
                      </div>
                      <div className="space-y-1">{items.map(renderItem)}</div>
                    </section>
                  )
                );
              })()}
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
                disabled={!isDataUnlocked}
                onClick={() => setActiveTab("data")}
                title={isDataUnlocked ? undefined : "分析を実行するとロックが解除されます"}
                className={cx(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                  !isDataUnlocked
                    ? "cursor-not-allowed text-gray-400"
                    : activeTab === "data"
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

          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            {openPopover && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setOpenPopover(null)}
                aria-hidden
              />
            )}

            {([
              {
                key: "period" as const,
                icon: "📅",
                label: "期間",
                value: searchConfig.period,
              },
              {
                key: "business" as const,
                icon: "🏢",
                label: "業務",
                value: businessBadgeLabel,
              },
              {
                key: "skill" as const,
                icon: "🎓",
                label: "スキル",
                value: skillBadgeLabel,
              },
              {
                key: "user" as const,
                icon: "👤",
                label: "ユーザー",
                value: userBadgeLabel,
              },
              {
                key: "details" as const,
                icon: "➕",
                label: "詳細条件",
                value: searchConfig.details.length
                  ? `${searchConfig.details.length}件`
                  : "追加",
              },
            ] as const).map((badge) => {
              const isActive = openPopover === badge.key;
              return (
                <div key={badge.key} className="relative z-20">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenPopover((prev) =>
                        prev === badge.key ? null : badge.key
                      )
                    }
                    className={cx(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition",
                      isActive
                        ? "bg-teal-50 text-teal-700 ring-2 ring-teal-500/20"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    <span aria-hidden>{badge.icon}</span>
                    <span>{badge.label}</span>
                    <span
                      className={cx(
                        "font-medium",
                        isActive ? "text-teal-700" : "text-slate-600"
                      )}
                    >
                      {badge.value}
                    </span>
                  </button>
                  <div
                    role="dialog"
                    aria-hidden={!isActive}
                    className={cx(
                      "absolute left-0 top-full z-20 mt-2 w-64 origin-top rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-lg transition-all duration-150 ease-out",
                      isActive
                        ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                        : "pointer-events-none -translate-y-1 scale-95 opacity-0"
                    )}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {badge.label}
                    </div>

                    {badge.key === "business" ||
                    badge.key === "skill" ||
                    badge.key === "user" ? (
                      (() => {
                        const filterKey = badge.key;
                        const options =
                          filterKey === "business"
                            ? filteredBusinessOptions
                            : filterKey === "skill"
                            ? filteredSkillOptions
                            : filteredUserOptions;
                        const selected = searchConfig[filterKey];
                        const inputRef =
                          filterKey === "business"
                            ? businessSearchRef
                            : filterKey === "skill"
                            ? skillSearchRef
                            : userSearchRef;
                        return (
                          <>
                            <div className="mt-2">
                              <input
                                ref={inputRef}
                                type="text"
                                value={popoverSearch[filterKey]}
                                onChange={(e) =>
                                  setPopoverSearch((prev) => ({
                                    ...prev,
                                    [filterKey]: e.target.value,
                                  }))
                                }
                                placeholder="🔍 検索"
                                className="w-full rounded-md border border-gray-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-500/20"
                              />
                            </div>
                            <div className="mt-2 max-h-48 overflow-y-auto">
                              {options.length === 0 ? (
                                <div className="px-1 py-2 text-slate-400">
                                  該当なし
                                </div>
                              ) : (
                                <ul className="space-y-0.5">
                                  {options.map((opt) => {
                                    const checked = selected.includes(opt);
                                    return (
                                      <li key={opt}>
                                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                              toggleFilterOption(filterKey, opt)
                                            }
                                            className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                          />
                                          <span className="text-slate-700">
                                            {opt}
                                          </span>
                                        </label>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          </>
                        );
                      })()
                    ) : badge.key === "period" ? (
                      <div className="mt-2">
                        <ul className="space-y-0.5">
                          {FILTER_PERIOD_PRESETS.map((preset) => {
                            const checked = searchConfig.period === preset;
                            return (
                              <li key={preset}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSearchConfig((prev) => ({
                                      ...prev,
                                      period: preset,
                                    }))
                                  }
                                  className={cx(
                                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition",
                                    checked
                                      ? "bg-teal-50 text-teal-700"
                                      : "text-slate-700 hover:bg-slate-50"
                                  )}
                                >
                                  <span>{preset}</span>
                                  {checked ? (
                                    <span aria-hidden className="text-teal-600">
                                      ✓
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-2 text-slate-500">
                        詳細条件は今後のアップデートで順次対応予定です。
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
            <div className="flex h-full flex-col px-6 py-4">
              <div className="flex-none text-center">
                <h2 className="text-2xl font-semibold text-slate-800">
                  何から始めますか？
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  目的に合ったカードを選ぶと、AIが必要な条件を対話で整えます。
                </p>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-4">
                  {[
                    {
                      icon: "🎯",
                      title: "オペレータ品質の分析",
                      desc: "応対品質の傾向や改善ポイントを抽出",
                    },
                    {
                      icon: "📚",
                      title: "FAQ・QAの整備",
                      desc: "よくある問い合わせと回答をナレッジ化",
                    },
                    {
                      icon: "📈",
                      title: "成功・失敗の傾向分析",
                      desc: "契約・解約・保留などの勝ち筋を可視化",
                    },
                    {
                      icon: "📝",
                      title: "スクリプトの整備",
                      desc: "現場で機能するトークスクリプトを設計",
                    },
                  ].map((card) => {
                    const label = `${card.icon} ${card.title}`;
                    return (
                      <button
                        key={card.title}
                        type="button"
                        onClick={() => handleWelcomeCardClick(label)}
                        className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-500 hover:shadow-md"
                      >
                        <span className="text-3xl leading-none">{card.icon}</span>
                        <span className="text-sm font-semibold text-slate-800 group-hover:text-teal-700">
                          {card.title}
                        </span>
                        <span className="text-xs leading-5 text-slate-500">
                          {card.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="flex-none text-center text-xs text-slate-400">
                または、下のチャット欄に直接ご要望をお書きいただけます。
              </p>
            </div>
          ) : (
          <div className="mx-auto max-w-3xl space-y-6 py-2">
            {hasAssistantMessage && (
              <div className="mb-4 space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div>{executionContextLabel}</div>
                {qualityExecutionContext ? (
                  <div className="border-t border-slate-200 pt-1.5">
                    🎯 応対フェーズ：{qualityExecutionContext.phase} ／ 観点：
                    {qualityExecutionContext.focus.join("、")} ／ 活用：
                    {qualityExecutionContext.usage}
                  </div>
                ) : null}
              </div>
            )}
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
                    <div className="w-full max-w-[90%] text-[15px] leading-relaxed text-gray-800">
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
                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.suggestChips.map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => handleSuggestClick(chip)}
                              className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm text-teal-700 transition hover:bg-teal-100"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                      )}
                      {m.qualityForm ? (
                        <div className="mt-5 space-y-6">
                          {QUALITY_FORM_QUESTIONS.map((q) => {
                            const source =
                              m.qualityFormSubmitted && m.qualityFormSnapshot
                                ? {
                                    phase: m.qualityFormSnapshot.phase,
                                    focus: m.qualityFormSnapshot.focus,
                                    usage: m.qualityFormSnapshot.usage,
                                  }
                                : {
                                    phase: qualityFormAnswers.phase,
                                    focus: qualityFormAnswers.focus,
                                    usage: qualityFormAnswers.usage,
                                  };
                            return (
                              <div key={q.id}>
                                <p className="text-[15px] font-semibold text-slate-800">
                                  {q.title}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {q.options.map((opt) => {
                                    const isSelected =
                                      q.id === "focus"
                                        ? source.focus.includes(opt)
                                        : q.id === "phase"
                                        ? source.phase === opt
                                        : source.usage === opt;
                                    const frozen = !!m.qualityFormSubmitted;
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        disabled={frozen}
                                        onClick={() =>
                                          toggleQualityAnswer(q.id, opt, q.multi)
                                        }
                                        className={cx(
                                          "rounded-full border px-4 py-2 text-sm transition-all duration-200",
                                          isSelected
                                            ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                                            : "border-gray-200 bg-white text-gray-700",
                                          frozen
                                            ? "cursor-not-allowed opacity-80"
                                            : isSelected
                                            ? ""
                                            : "hover:border-teal-400 hover:text-teal-700"
                                        )}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          {!m.qualityFormSubmitted && isQualityFormComplete ? (
                            <div className="flex justify-center pt-2">
                              <button
                                type="button"
                                onClick={handleQualityFormSubmit}
                                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:from-teal-600 hover:to-emerald-700 hover:shadow-xl"
                              >
                                <Sparkles className="h-4 w-4" />
                                分析を開始する
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {m.showExecutionCard ? (
                        <div className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-gray-800">
                            🚀 以下の内容で分析を実行しますか？
                          </p>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-900 p-4 font-mono text-xs leading-5 text-teal-400">
                            {m.executionPrompt ?? m.text}
                          </pre>
                          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                            <select
                              value={executionOutputFormat}
                              onChange={(e) =>
                                setExecutionOutputFormat(e.target.value as OutputFormat)
                              }
                              disabled={isExecuting}
                              className="h-9 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <option value="text">📝 テキスト</option>
                              <option value="table">📊 表形式</option>
                              <option value="markdown">📄 Markdown</option>
                            </select>
                            <button
                              type="button"
                              onClick={handleExecuteAnalysis}
                              disabled={isExecuting}
                              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-400"
                            >
                              {isExecuting ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ⏳ 検索・分析を実行中...
                                </>
                              ) : (
                                <>🚀 この内容で検索・分析を実行する</>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-slate-100 px-4 py-3 text-[15px] leading-relaxed text-gray-800">
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
                onClick={() => {
                  setPromptSheetMode("register");
                  setIsPromptSheetOpen(true);
                }}
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
              {promptSheetMode === "list" ? (
                <>
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">
                    ✨ プロンプトテンプレート管理
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    検索して、過去の定型プロンプトをワンクリックで適用します。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPromptSheetOpen(false)}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
              <div className="shrink-0 border-b border-gray-200 px-5 py-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={templateSearchQuery}
                    onChange={(e) => setTemplateSearchQuery(e.target.value)}
                    placeholder="プロンプト名・内容で検索"
                    className="h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {(() => {
                  const q = templateSearchQuery.trim().toLowerCase();
                  const filtered = q
                    ? PROMPT_TEMPLATES.filter(
                        (t) =>
                          t.title.toLowerCase().includes(q) ||
                          t.content.toLowerCase().includes(q)
                      )
                    : PROMPT_TEMPLATES;
                  if (filtered.length === 0) {
                    return (
                      <p className="px-3 py-6 text-center text-xs text-gray-400">
                        該当するテンプレートが見つかりません。
                      </p>
                    );
                  }
                  return (
                    <ul className="space-y-1.5">
                      {filtered.map((t) => {
                        const expanded = expandedTemplateId === t.id;
                        return (
                          <li
                            key={t.id}
                            className={cx(
                              "overflow-hidden rounded-lg border transition",
                              expanded
                                ? "border-teal-300 bg-teal-50/40 shadow-sm"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            )}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTemplateId(expanded ? null : t.id)
                              }
                              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                            >
                              <span className="truncate text-sm font-medium text-gray-800">
                                {t.title}
                              </span>
                              <ChevronDown
                                className={cx(
                                  "h-4 w-4 shrink-0 text-gray-500 transition-transform",
                                  expanded ? "rotate-180" : ""
                                )}
                              />
                            </button>
                            {expanded ? (
                              <div className="border-t border-teal-100 bg-white px-3 py-3">
                                <pre className="mb-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-[11px] leading-5 text-gray-700">
                                  {t.content}
                                </pre>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsPromptSheetOpen(false);
                                    appendUserMessage(t.content);
                                  }}
                                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  ✨ このプロンプトを適用
                                </button>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
              <div className="shrink-0 border-t border-gray-200 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setPromptSheetMode("register")}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-teal-300 bg-teal-50/40 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:border-teal-400 hover:bg-teal-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新しくプロンプトを登録する
                </button>
              </div>
                </>
              ) : (
                <>
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">
                    💾 プロンプトの新規登録
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    よく使う観点を保存して、次回以降ワンクリックで呼び出せます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPromptSheetOpen(false)}
                  className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="閉じる"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-5">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      テンプレート名
                    </label>
                    <input
                      type="text"
                      value={registerDraftName}
                      onChange={(e) => setRegisterDraftName(e.target.value)}
                      placeholder="例: 解約分析_定型プロンプト"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-800 outline-none ring-2 ring-transparent focus:border-teal-400 focus:ring-teal-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      プロンプト内容
                    </label>
                    <textarea
                      rows={12}
                      value={registerDraftContent}
                      onChange={(e) => setRegisterDraftContent(e.target.value)}
                      placeholder="# 前提条件&#10;- 対象: ...&#10;&#10;# 指示&#10;1. ..."
                      className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm leading-6 text-gray-800 outline-none ring-2 ring-transparent focus:border-teal-400 focus:ring-teal-100"
                    />
                  </div>
                </div>
              </div>
              <div className="shrink-0 border-t border-gray-200 px-5 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPromptSheetMode("list")}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPromptSheetOpen(false);
                      setPromptSheetMode("list");
                      setRegisterDraftName("");
                      setRegisterDraftContent("");
                      alert("保存しました");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700"
                  >
                    <Save className="h-3.5 w-3.5" />
                    💾 保存する
                  </button>
                </div>
              </div>
                </>
              )}
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
  onSubmit: (userText: string) => void;
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

    const lines: string[] = [
      "以下の条件で通話データの分析を行いたいです。要件のすり合わせをお願いします。",
    ];
    if (purposeLabel) lines.push(`【分析目的】${purposeLabel}`);
    if (dateRangeLabel) lines.push(`【対象期間】${dateRangeLabel}`);
    if (business.length) lines.push(`【対象業務】${business.join(", ")}`);
    if (skill.length) lines.push(`【対象スキル】${skill.join(", ")}`);
    if (userName.trim()) lines.push(`【対象オペレータ】${userName.trim()}`);

    const advancedLines = WIZARD_ADVANCED_FIELDS.flatMap((field) => {
      const v = advancedValues[field.id];
      if (!v || (field.type === "select" && v === "すべて")) return [];
      return [`【${field.label}】${v}`];
    });
    if (advancedLines.length) lines.push(...advancedLines);

    onSubmit(lines.join("\n"));
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
              <MessageSquare className="h-4 w-4" />
              💬 AIと分析要件をすり合わせる
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
