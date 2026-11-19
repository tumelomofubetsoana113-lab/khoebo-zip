"use client";

import { ArrowLeft, FileText, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChatResponse } from "@/app/api/chat/route";
import { Logo } from "@/components/ui/Logo";
import { PrototypePill } from "@/components/ui/Pill";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ChatAction } from "@/lib/blocks";
import {
  buildHistory,
  buttonKey,
  clearChat,
  currentQuickReplies,
  demoWelcome,
  fieldVisitStart,
  greeting,
  loadChat,
  messageId,
  saveChat,
  type ChatMessage,
} from "@/lib/chat";
import { todayISO } from "@/lib/dates";
import { demoMultiState, demoRunnerState, demoTraderState } from "@/lib/demo";
import { attachmentKind, type ReceiptAttachment } from "@/lib/receipts";
import { clearState, emptyState, loadState, saveState, type TraderState } from "@/lib/state";
import { statementPath } from "@/lib/statement";
import { strings } from "@/lib/strings";
import { UiBlocks } from "./cards";
import { Composer } from "./Composer";
import { DemoMenu, type DemoChoice } from "./DemoMenu";
import { MessageBubble } from "./MessageBubble";
import { QuickReplies } from "./QuickReplies";
import { ReceiptSheet } from "./ReceiptSheet";
import { TypingIndicator } from "./TypingIndicator";
import { VoiceBubbleContent } from "./VoiceBubble";
import { VoiceSheet, type VoiceSample } from "./VoiceSheet";

const t = strings.chat;
const REQUEST_TIMEOUT_MS = 30_000;
const RECEIPT_TIMEOUT_MS = 90_000; // sending a picture takes longer on a slow network

type Outgoing = { text: string; voice?: { duration: string }; action?: ChatAction; attachment?: ReceiptAttachment };

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const noSubscribe = () => () => {};

// The chat reads the trader's records from localStorage, which only exists in
// the browser. The server (and the first render in the browser) shows the
// empty frame; the live chat mounts once the page is running in the browser.
export function ChatShell() {
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  return inBrowser ? <ChatSession /> : <ChatFrame />;
}

function ChatHeader({ onDemo }: { onDemo?: () => void }) {
  return (
    <>
      <header className="flex items-center gap-2 bg-brand px-2 py-2 text-surface">
        <Link
          href="/"
          aria-label={t.back}
          className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface/10"
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <Logo size={40} className="rounded-full ring-2 ring-surface" />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="font-semibold">{t.title}</h1>
          <p className="text-xs sm:text-sm">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onDemo}
          disabled={!onDemo}
          className="min-h-11 shrink-0 rounded-full border-2 border-surface px-3 text-sm font-semibold hover:bg-surface/10"
        >
          {t.demo}
        </button>
      </header>
      <div className="flex justify-center border-b border-line bg-surface py-1">
        <PrototypePill />
      </div>
    </>
  );
}

const frameClass =
  "mx-auto my-2 flex h-[calc(100dvh-16px)] w-[calc(100%-16px)] max-w-[420px] flex-col overflow-hidden rounded-[28px] border border-line bg-page shadow-xl shadow-ink/10 sm:my-4 sm:h-[calc(100dvh-32px)]";

function ChatFrame() {
  return (
    <div className={frameClass}>
      <ChatHeader />
      <div className="flex-1 px-3 py-4">
        <p className="mx-auto max-w-xs text-center text-xs text-muted">{strings.footer.text}</p>
      </div>
    </div>
  );
}

// The picture shows for this visit only. After a reload there is nothing kept
// to show, so the bubble just says a receipt was sent.
function ReceiptPreview({ kind, file }: { kind: "photo" | "pdf"; file?: ReceiptAttachment }) {
  if (kind === "photo" && file) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a local data URL, which next/image can't optimise
      <img
        src={`data:${file.mediaType};base64,${file.data}`}
        alt={t.receipt.previewAlt}
        className="mb-1 max-h-48 rounded-lg"
      />
    );
  }
  return <FileText size={18} aria-hidden="true" className="mr-1.5 inline-block align-text-bottom" />;
}

function ChatSession() {
  // An officer's field-visit link fills in the set-up on a phone that isn't set up yet.
  const [start] = useState(() => {
    const saved = loadState();
    return fieldVisitStart(window.location.search, saved, new Date().toISOString()) ?? { state: saved, message: null };
  });
  const [trader, setTrader] = useState<TraderState>(start.state);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (start.message) return [start.message];
    const saved = loadChat();
    return saved?.length ? saved : [greeting(new Date().toISOString())];
  });

  // The link's job is done once the chat has started; a reload shouldn't apply it again.
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const [pending, setPending] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  // Receipts sent this visit, for retrying and for the picture in the bubble.
  // Held in memory only: they are never written to localStorage.
  const [attachments, setAttachments] = useState<Record<string, ReceiptAttachment>>({});
  const [demoOpen, setDemoOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // The latest values, for use inside async callbacks.
  const traderRef = useRef(trader);
  const messagesRef = useRef(messages);
  useEffect(() => {
    traderRef.current = trader;
    messagesRef.current = messages;
  });

  useEffect(() => {
    saveState(trader);
    saveChat(messages);
  }, [trader, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  const updateMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  // Sends one message or button tap and adds Khoebo's reply. `retryOf` is the
  // id of a failed message being sent again.
  const send = useCallback(
    async (out: Outgoing, options: { retryOf?: string; showBubble?: boolean } = {}) => {
      if (pending) return;
      const showBubble = options.showBubble ?? true;
      const before = messagesRef.current.filter((m) => m.id !== options.retryOf);
      const id = options.retryOf ?? messageId();

      if (options.retryOf) {
        updateMessage(id, { status: "sending" });
      } else if (showBubble) {
        const bubble: ChatMessage = {
          id,
          role: "user",
          text: out.text,
          at: new Date().toISOString(),
          ...(out.voice ? { voice: out.voice } : {}),
          ...(out.attachment ? { attachment: attachmentKind(out.attachment) } : {}),
          ...(out.action ? { button: true, action: out.action } : {}),
          status: "sending",
        };
        setMessages((all) => [...all, bubble]);
        const attachment = out.attachment;
        if (attachment) setAttachments((all) => ({ ...all, [id]: attachment }));
      }
      setPending(true);

      // A typed message goes to the API as the trader's turn. A button tap
      // goes as an action, so it can't be faked by typing.
      const history = buildHistory(before);
      const body = out.action
        ? { messages: history, state: traderRef.current, action: out.action }
        : {
            messages: [...history, { role: "user", content: out.text, ...(out.voice ? { voice: true } : {}) }],
            state: traderRef.current,
            ...(out.attachment ? { attachment: out.attachment } : {}),
          };

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), out.attachment ? RECEIPT_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as ChatResponse;

        setTrader(data.state);
        setMessages((all) => [
          ...all.map((m) => (m.id === id ? { ...m, status: undefined } : m)),
          { id: messageId(), role: "assistant", text: data.reply, at: new Date().toISOString(), ui: data.ui },
        ]);
      } catch {
        if (showBubble || options.retryOf) {
          updateMessage(id, { status: "failed" });
        } else {
          // A demo action with no bubble of its own: show one so it can be retried.
          setMessages((all) => [
            ...all,
            { id, role: "user", text: out.text, at: new Date().toISOString(), button: true, action: out.action, status: "failed" },
          ]);
        }
      } finally {
        setPending(false);
      }
    },
    [pending, updateMessage],
  );

  function retry(message: ChatMessage) {
    const attachment = attachments[message.id];
    // The file isn't kept after the page closes, so it has to be chosen again.
    if (message.attachment && !attachment) {
      setReceiptOpen(true);
      return;
    }
    send({ text: message.text, voice: message.voice, action: message.action, attachment }, { retryOf: message.id });
  }

  // A card button: mark it used on its message, show the tap, send the action.
  function tapButton(message: ChatMessage, action: ChatAction, label: string) {
    updateMessage(message.id, { used: [...(message.used ?? []), buttonKey(action)] });
    send({ text: label, action });
  }

  function sendVoice(sample: VoiceSample) {
    setVoiceOpen(false);
    send({ text: sample.transcript, voice: { duration: sample.duration } });
  }

  function sendReceipt(attachment: ReceiptAttachment) {
    setReceiptOpen(false);
    send({ text: attachmentKind(attachment) === "pdf" ? t.receipt.pdfSent : t.receipt.photoSent, attachment });
  }

  function chooseDemo(choice: DemoChoice) {
    setDemoOpen(false);
    const now = new Date().toISOString();
    if (choice === "load") {
      setTrader(demoTraderState(todayISO()));
      setMessages([demoWelcome(now)]);
    } else if (choice === "loadRunner") {
      setTrader(demoRunnerState(todayISO()));
      setMessages([demoWelcome(now, "runner")]);
    } else if (choice === "loadMulti") {
      setTrader(demoMultiState(todayISO()));
      setMessages([demoWelcome(now, "multi")]);
    } else if (choice === "summary") {
      send({ text: t.demoMenu.weekSummaryMessage });
    } else if (choice === "reminder") {
      send({ text: t.demoMenu.reminder, action: { type: "simulate_reminder" } }, { showBubble: false });
    } else if (choice === "statement") {
      router.push(statementPath("this_month"));
    } else {
      setResetOpen(true);
    }
  }

  function resetEverything() {
    setResetOpen(false);
    clearState();
    clearChat();
    setTrader(emptyState());
    setMessages([greeting(new Date().toISOString())]);
  }

  const quickReplies = pending ? [] : currentQuickReplies(messages);

  return (
    <div className={frameClass}>
      <ChatHeader onDemo={() => setDemoOpen(true)} />

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mx-auto mb-4 max-w-xs text-center text-xs text-muted">{strings.footer.text}</p>
          <div role="log" aria-live="polite" aria-label={t.messages} className="space-y-3">
            {messages.map((m) => (
              <div key={m.id}>
                <MessageBubble
                  from={m.role === "user" ? "trader" : "assistant"}
                  time={m.status ? undefined : timeLabel(m.at)}
                  wide={m.ui?.some((b) => b.type !== "quick_replies")}
                >
                  <span className="sr-only">{m.role === "user" ? t.youSaid : t.assistantSaid}: </span>
                  {m.voice ? (
                    <>
                      <span className="sr-only">{t.voiceNote(m.voice.duration)}. </span>
                      <VoiceBubbleContent duration={m.voice.duration} />
                    </>
                  ) : (
                    <>
                      {m.attachment && <ReceiptPreview kind={m.attachment} file={attachments[m.id]} />}
                      <span className="whitespace-pre-wrap break-words">{m.text}</span>
                    </>
                  )}
                  {m.ui && (
                    <UiBlocks
                      blocks={m.ui}
                      used={m.used ?? []}
                      disabled={pending}
                      onAction={(action, label) => tapButton(m, action, label)}
                    />
                  )}
                </MessageBubble>
                {m.voice && (
                  <p className="ml-auto mt-1 max-w-[85%] text-right text-sm text-muted">
                    <span className="font-semibold">{t.transcript}:</span> {m.text}
                  </p>
                )}
                {m.status === "failed" && (
                  <button
                    type="button"
                    onClick={() => retry(m)}
                    disabled={pending}
                    className="ml-auto mt-1 flex min-h-11 items-center gap-1 text-sm font-semibold text-status-followup"
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    {t.notSent}
                  </button>
                )}
              </div>
            ))}
            {pending && <TypingIndicator />}
          </div>
          {quickReplies.length > 0 && (
            <div className="mt-3">
              <QuickReplies options={quickReplies} disabled={pending} onPick={(option) => send({ text: option })} />
            </div>
          )}
          <div ref={endRef} />
        </div>

        <Composer
          disabled={pending}
          onSend={(text) => send({ text })}
          onOpenVoice={() => setVoiceOpen(true)}
          onOpenReceipt={() => setReceiptOpen(true)}
        />
      </main>

      <VoiceSheet open={voiceOpen} disabled={pending} onClose={() => setVoiceOpen(false)} onPick={sendVoice} />
      <ReceiptSheet open={receiptOpen} disabled={pending} onClose={() => setReceiptOpen(false)} onSend={sendReceipt} />
      <DemoMenu open={demoOpen} busy={pending} onClose={() => setDemoOpen(false)} onChoose={chooseDemo} />
      <ConfirmDialog
        open={resetOpen}
        title={t.demoMenu.resetTitle}
        body={t.demoMenu.resetBody}
        confirmLabel={t.demoMenu.resetConfirm}
        onConfirm={resetEverything}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}
