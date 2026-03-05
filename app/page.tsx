"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

type SavedPrompt = {
  id: string;
  name: string;
  prompt: string;
  chatHistory: ChatMessage[];
  savedAt: string;
};

const SAVED_PROMPTS_KEY = "moc-saved-prompts";

const MOCK_AI_REPLIES = [
  "承知しました。コーパスを参照して分析を進めます。",
  "ご質問の内容を把握しました。データを確認したうえで回答いたします。",
  "分析結果をまとめました。必要に応じて詳細もお伝えします。",
  "ご指示ありがとうございます。こちらの条件で検索・分析を行います。",
  "了解しました。出力は右側のエリアに反映されます。",
];

const PRESET_PROMPTS: Record<string, string> = {
  ありがとう分析: "お礼・感謝に関する発話を分析し、傾向と改善点をまとめてください。",
  ネガポジ分析: "ネガティブ・ポジティブの感情傾向を分析し、スコアと代表発話を出してください。",
  成約分析: "成約に至った要因と顧客の特徴を分析し、レポート形式でまとめてください。",
  解約分析: "解約理由の分類と傾向を分析し、防止策の提案を含めてください。",
  OP通話品質分析: "OP通話の品質指標（応答時間・丁寧さ等）を分析し、改善ポイントを出してください。",
};

const MOCK_ANALYSIS_RESULT = `# VoC 分析レポート（モック）

## 概要
生成AIによる分析結果を整形して表示しています。

## 分析結果
- サンプルデータに基づく傾向が右側に表示されます。
- 実際の環境では軽量モデル（Gemini 3 Flash等）の出力がここに反映されます。
- コーパスを通したアウトプットとして利用できます。

## 次のアクション
- **結果を保存**: レポート名を付けて保存
- **エクスポート**: Markdown / テキストでダウンロード
- **スライド作成**: 別画面でスライド表示
`;

function getMockReply(): string {
  return MOCK_AI_REPLIES[Math.floor(Math.random() * MOCK_AI_REPLIES.length)];
}

function loadSavedPromptsFromStorage(): SavedPrompt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_PROMPTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePromptsToStorage(prompts: SavedPrompt[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(prompts));
}

export default function MoCReportPage() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [promptContent, setPromptContent] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [vocComplete, setVocComplete] = useState(false);
  const [outputContent, setOutputContent] = useState("");
  const [displayFormat, setDisplayFormat] = useState<"markdown" | "text">("text");
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [reportTitle, setReportTitle] = useState("レポート名を表示");

  type DialogType = "loadPrompt" | "startAnalysis" | "saveResult" | "export" | "slides" | null;
  const [dialog, setDialog] = useState<DialogType>(null);
  const [loadPromptSearch, setLoadPromptSearch] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [saveResultName, setSaveResultName] = useState("");
  const [exportFormat, setExportFormat] = useState<"markdown" | "text">("text");

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const shortcuts = [
    "ありがとう分析",
    "ネガポジ分析",
    "成約分析",
    "解約分析",
    "OP通話品質分析",
  ];

  useEffect(() => {
    setSavedPrompts(loadSavedPromptsFromStorage());
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatMessages]);

  const sendChatMessage = () => {
    const text = chatInput.trim();
    if (!text || isAiThinking || isAnalyzing) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsAiThinking(true);
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: getMockReply() },
      ]);
      setIsAiThinking(false);
    }, 800 + Math.random() * 700);
  };

  const handleShortcut = (label: string) => {
    if (isAnalyzing) return;
    const preset = PRESET_PROMPTS[label] ?? label;
    setPromptContent(preset);
  };

  const filteredSavedPrompts = savedPrompts.filter(
    (p) =>
      !loadPromptSearch.trim() ||
      p.name.includes(loadPromptSearch) ||
      p.prompt.includes(loadPromptSearch)
  );
  const selectedPrompt = selectedPromptId
    ? savedPrompts.find((p) => p.id === selectedPromptId)
    : null;

  const openLoadPromptDialog = () => {
    if (isAnalyzing) return;
    setLoadPromptSearch("");
    setSelectedPromptId(null);
    setDialog("loadPrompt");
  };

  const loadSelectedPrompt = () => {
    if (!selectedPrompt) return;
    setChatMessages(selectedPrompt.chatHistory);
    setPromptContent(selectedPrompt.prompt);
    setDialog(null);
  };

  const deleteSelectedPrompt = () => {
    if (!selectedPromptId) return;
    setSavedPrompts((prev) => {
      const next = prev.filter((p) => p.id !== selectedPromptId);
      savePromptsToStorage(next);
      return next;
    });
    setSelectedPromptId(null);
  };

  const saveCurrentPrompt = () => {
    if (isAnalyzing) return;
    const name = promptContent.slice(0, 50) || "無題のプロンプト";
    const item: SavedPrompt = {
      id: crypto.randomUUID(),
      name,
      prompt: promptContent,
      chatHistory: [...chatMessages],
      savedAt: new Date().toISOString(),
    };
    setSavedPrompts((prev) => {
      const next = [...prev, item];
      savePromptsToStorage(next);
      return next;
    });
    setDialog(null);
  };

  const openStartAnalysisDialog = () => {
    if (!promptContent.trim() || isAnalyzing) return;
    setDialog("startAnalysis");
  };

  const startAnalysis = () => {
    setDialog(null);
    setIsAnalyzing(true);
    setOutputContent("");
    setTimeout(() => {
      setOutputContent(MOCK_ANALYSIS_RESULT);
      setVocComplete(true);
      setIsAnalyzing(false);
    }, 2500);
  };

  const resetResult = () => {
    if (!vocComplete) return;
    setOutputContent("");
    setVocComplete(false);
  };

  const openSaveResultDialog = () => {
    if (!vocComplete) return;
    setSaveResultName(reportTitle === "レポート名を表示" ? "" : reportTitle);
    setDialog("saveResult");
  };

  const confirmSaveResult = () => {
    if (saveResultName.trim()) {
      setReportTitle(saveResultName.trim());
    }
    setDialog(null);
  };

  const openExportDialog = () => {
    setExportFormat(displayFormat);
    setDialog("export");
  };

  const doExport = () => {
    const blob = new Blob([outputContent], {
      type: exportFormat === "markdown" ? "text/markdown" : "text/plain",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `voc-report-${Date.now()}.${exportFormat === "markdown" ? "md" : "txt"}`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDialog(null);
  };

  const copyOutput = useCallback(() => {
    if (displayFormat !== "text" || !outputContent) return;
    navigator.clipboard.writeText(outputContent);
    alert("クリップボードにコピーしました。");
  }, [displayFormat, outputContent]);

  const openSlides = () => {
    setDialog("slides");
  };

  const disabledDuringAnalysis = isAnalyzing;

  return (
    <div className="moc-wrapper">
      {isAnalyzing && (
        <div className="moc-overlay" aria-busy="true">
          <div className="moc-spinner" />
          <p className="moc-overlay__message">分析中です。しばらくお待ちください...</p>
          <p className="moc-overlay__status">UZ相当の処理状況を表示</p>
        </div>
      )}

      <header className="moc-header">
        <div className="moc-header__row1">
          <div className="moc-header__title-wrap">
            <span className="moc-header__title-bar" aria-hidden />
            <h1 className="moc-header__title">{reportTitle}</h1>
          </div>
          <div className="moc-header__condition">検索条件名を表示</div>
        </div>
        <div className="moc-header__row2">
          <span>作成日 2026年1月14日</span>
          <span>作成者 池田</span>
        </div>
      </header>

      <main className="moc-main">
        <section className="moc-left">
          <div className="moc-chat">
            <div className="moc-chat__label">
              ハイエンドモデル (Gemini 3 Pro等) とのチャット（コーパスを通したやり取り）
            </div>
            <div className="moc-chat__messages" ref={chatScrollRef}>
              {chatMessages.length === 0 && (
                <p className="moc-chat__placeholder">
                  メッセージを入力して送信すると、AIの返答が表示されます。
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`moc-chat__bubble moc-chat__bubble--${msg.role}`}
                >
                  <span className="moc-chat__bubble-role">
                    {msg.role === "user" ? "あなた" : "AI"}
                  </span>
                  <div className="moc-chat__bubble-text">{msg.content}</div>
                </div>
              ))}
              {isAiThinking && (
                <div className="moc-chat__bubble moc-chat__bubble--assistant moc-chat__bubble--thinking">
                  <span className="moc-chat__bubble-role">AI</span>
                  <div className="moc-chat__bubble-text">
                    <span className="moc-chat__typing">考えています...</span>
                  </div>
                </div>
              )}
            </div>
            <div className="moc-chat__input-row">
              <input
                type="text"
                className="moc-chat__input"
                placeholder="メッセージを入力..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                disabled={isAiThinking || isAnalyzing}
              />
              <button
                type="button"
                className="moc-chat__send"
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || isAiThinking || isAnalyzing}
              >
                送信
              </button>
            </div>
          </div>
          <div className="moc-shortcuts">
            {shortcuts.map((label) => (
              <button
                key={label}
                type="button"
                className="moc-shortcut"
                onClick={() => handleShortcut(label)}
                disabled={disabledDuringAnalysis}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="moc-prompt"
            placeholder="プロンプトを記入 / 挿入"
            rows={4}
            value={promptContent}
            onChange={(e) => setPromptContent(e.target.value)}
            disabled={isAnalyzing}
          />
          <div className="moc-actions">
            <button
              type="button"
              className="moc-btn moc-btn--save"
              onClick={openLoadPromptDialog}
              disabled={disabledDuringAnalysis}
            >
              登録/保存呼び出し
            </button>
            <button
              type="button"
              className="moc-btn moc-btn--save"
              onClick={saveCurrentPrompt}
              disabled={disabledDuringAnalysis}
            >
              登録保存
            </button>
            <button
              type="button"
              className="moc-btn moc-btn--primary"
              onClick={openStartAnalysisDialog}
              disabled={!promptContent.trim() || isAnalyzing}
            >
              分析開始
            </button>
          </div>
        </section>

        <section className="moc-right">
          <div className="moc-output-wrap">
            <div className="moc-output__label">
              生成AIからのレスポンスを整形して表示する
            </div>
            <div className="moc-output" ref={outputRef}>
              {outputContent ? (
                displayFormat === "text" ? (
                  <pre className="moc-output__body">{outputContent}</pre>
                ) : (
                  <div className="moc-output__body">
                    {outputContent.split("\n").map((line, i) => (
                      <p key={i} className="moc-output__line">
                        {line || "\u00A0"}
                      </p>
                    ))}
                  </div>
                )
              ) : (
                <p className="moc-output__placeholder">
                  軽量モデル (Gemini 3 Flash等) による出力表示エリア（コーパスを通したアウトプット）
                </p>
              )}
            </div>
            <div className="moc-output-actions">
              <button
                type="button"
                className="moc-icon-refresh"
                title="再生成"
                disabled={!outputContent || isAnalyzing}
              >
                ↻
              </button>
              <button
                type="button"
                className="moc-icon-copy"
                title="内容をコピー"
                onClick={copyOutput}
                disabled={displayFormat !== "text" || !outputContent}
              >
                ⧉
              </button>
            </div>
          </div>
          <div className="moc-result-actions">
            <button
              type="button"
              className="moc-btn moc-btn--save"
              onClick={resetResult}
              disabled={!vocComplete}
            >
              結果を削除
            </button>
            <button
              type="button"
              className="moc-btn moc-btn--save"
              onClick={openSaveResultDialog}
              disabled={!vocComplete}
            >
              結果を保存
            </button>
            <button
              type="button"
              className="moc-btn moc-btn--save"
              onClick={openExportDialog}
              disabled={!outputContent}
            >
              エクスポート
            </button>
            <button
              type="button"
              className="moc-btn moc-btn--save"
              onClick={openSlides}
              disabled={!outputContent}
            >
              スライド作成
            </button>
          </div>
        </section>
      </main>

      {/* 登録/保存呼び出しダイアログ */}
      {dialog === "loadPrompt" && (
        <div className="moc-dialog-backdrop" onClick={() => setDialog(null)}>
          <div className="moc-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="moc-dialog__title">登録/保存呼び出し</h3>
            <div className="moc-dialog__field">
              <label>検索文字（プロンプト名で絞り込み）</label>
              <input
                type="text"
                className="moc-dialog__input"
                placeholder="検索文字を入力..."
                value={loadPromptSearch}
                onChange={(e) => setLoadPromptSearch(e.target.value)}
              />
            </div>
            <div className="moc-dialog__field">
              <label>登録済みプロンプト</label>
              <div className="moc-dialog__list">
                {filteredSavedPrompts.length === 0 ? (
                  <p className="moc-dialog__empty">登録済みプロンプトがありません</p>
                ) : (
                  filteredSavedPrompts.map((p) => (
                    <label key={p.id} className="moc-dialog__radio-wrap">
                      <input
                        type="radio"
                        name="savedPrompt"
                        checked={selectedPromptId === p.id}
                        onChange={() => setSelectedPromptId(p.id)}
                      />
                      <span>{p.name}</span>
                      <span className="moc-dialog__date">
                        {new Date(p.savedAt).toLocaleString("ja")}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
            {selectedPrompt && (
              <div className="moc-dialog__field">
                <label>選択したプロンプト内容</label>
                <pre className="moc-dialog__pre">{selectedPrompt.prompt}</pre>
              </div>
            )}
            <div className="moc-dialog__actions">
              <button
                type="button"
                className="moc-btn moc-btn--save"
                onClick={deleteSelectedPrompt}
                disabled={!selectedPromptId}
              >
                削除
              </button>
              <button type="button" className="moc-btn moc-btn--save" onClick={() => setDialog(null)}>
                キャンセル
              </button>
              <button
                type="button"
                className="moc-btn moc-btn--primary"
                onClick={loadSelectedPrompt}
                disabled={!selectedPrompt}
              >
                読込
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分析開始ダイアログ */}
      {dialog === "startAnalysis" && (
        <div className="moc-dialog-backdrop" onClick={() => setDialog(null)}>
          <div className="moc-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="moc-dialog__title">分析開始</h3>
            <div className="moc-dialog__field">
              <label>コンテンツ表示形式</label>
              <div className="moc-dialog__radio-group">
                <label className="moc-dialog__radio-wrap">
                  <input
                    type="radio"
                    name="displayFormat"
                    checked={displayFormat === "text"}
                    onChange={() => setDisplayFormat("text")}
                  />
                  テキスト
                </label>
                <label className="moc-dialog__radio-wrap">
                  <input
                    type="radio"
                    name="displayFormat"
                    checked={displayFormat === "markdown"}
                    onChange={() => setDisplayFormat("markdown")}
                  />
                  Markdown
                </label>
              </div>
            </div>
            <div className="moc-dialog__actions">
              <button type="button" className="moc-btn moc-btn--save" onClick={() => setDialog(null)}>
                キャンセル
              </button>
              <button type="button" className="moc-btn moc-btn--primary" onClick={startAnalysis}>
                分析開始
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 結果を保存ダイアログ */}
      {dialog === "saveResult" && (
        <div className="moc-dialog-backdrop" onClick={() => setDialog(null)}>
          <div className="moc-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="moc-dialog__title">結果を保存</h3>
            <div className="moc-dialog__field">
              <label>レポート名</label>
              <input
                type="text"
                className="moc-dialog__input"
                placeholder="レポート名を入力"
                value={saveResultName}
                onChange={(e) => setSaveResultName(e.target.value)}
              />
            </div>
            <div className="moc-dialog__actions">
              <button type="button" className="moc-btn moc-btn--save" onClick={() => setDialog(null)}>
                キャンセル
              </button>
              <button
                type="button"
                className="moc-btn moc-btn--primary"
                onClick={confirmSaveResult}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* エクスポートダイアログ */}
      {dialog === "export" && (
        <div className="moc-dialog-backdrop" onClick={() => setDialog(null)}>
          <div className="moc-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="moc-dialog__title">エクスポート</h3>
            <div className="moc-dialog__field">
              <label>形式を選択</label>
              <div className="moc-dialog__radio-group">
                <label className="moc-dialog__radio-wrap">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === "text"}
                    onChange={() => setExportFormat("text")}
                  />
                  テキスト
                </label>
                <label className="moc-dialog__radio-wrap">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === "markdown"}
                    onChange={() => setExportFormat("markdown")}
                  />
                  Markdown
                </label>
              </div>
            </div>
            <div className="moc-dialog__actions">
              <button type="button" className="moc-btn moc-btn--save" onClick={() => setDialog(null)}>
                キャンセル
              </button>
              <button type="button" className="moc-btn moc-btn--primary" onClick={doExport}>
                ダウンロード
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スライド作成（別画面風モーダル） */}
      {dialog === "slides" && (
        <div className="moc-dialog-backdrop" onClick={() => setDialog(null)}>
          <div className="moc-dialog moc-dialog--slides" onClick={(e) => e.stopPropagation()}>
            <h3 className="moc-dialog__title">スライド作成（生成AIレスポンスを整形して表示）</h3>
            <div className="moc-slides">
              {outputContent
                .split(/\n\n+/)
                .filter((s) => s.trim())
                .map((slide, i) => (
                  <section key={i} className="moc-slide">
                    <div className="moc-slide__content">{slide.trim()}</div>
                  </section>
                ))}
            </div>
            <div className="moc-dialog__actions">
              <button type="button" className="moc-btn moc-btn--primary" onClick={() => setDialog(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
