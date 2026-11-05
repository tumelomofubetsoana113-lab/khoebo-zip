// POST /api/chat. The only place the Anthropic API key is used.
// The server is stateless: the browser sends the trader's state with every
// request and saves the state that comes back.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { blocksToShow } from "@/lib/blocks";
import { todayISO } from "@/lib/dates";
import { contextBlock, SYSTEM_PROMPT } from "@/lib/prompt";
import { attachmentLooksValid, MAX_ATTACHMENT_CHARS, ReceiptAttachmentSchema } from "@/lib/receipts";
import { TraderStateSchema, type TraderState } from "@/lib/state";
import { strings } from "@/lib/strings";
import {
  ChatActionSchema,
  describeAction,
  runTool,
  toolDefinitions,
  type ToolContext,
  type UiBlock,
} from "@/lib/tools";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";
const MAX_MESSAGES = Number(process.env.MAX_MESSAGES_PER_SESSION) || 60;
const MAX_BODY_BYTES = 100 * 1024;
// A receipt is the one thing allowed to make a request bigger.
const MAX_BODY_WITH_RECEIPT_BYTES = MAX_BODY_BYTES + MAX_ATTACHMENT_CHARS;
const MAX_MESSAGE_CHARS = 500;
const HISTORY_TURNS = 20;
const MAX_TOOL_ROUNDS = 5;

// Created on first use, so building the app doesn't need the key.
let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const MessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
    voice: z.boolean().optional(), // the text is a voice note transcript
  }),
  z.object({ role: z.literal("assistant"), content: z.string().max(4000) }),
]);

const BodySchema = z.object({
  messages: z.array(MessageSchema).max(MAX_MESSAGES),
  state: TraderStateSchema,
  action: ChatActionSchema.optional(),
  attachment: ReceiptAttachmentSchema.optional(), // a receipt sent with the last message; never stored or logged
});

type Body = z.infer<typeof BodySchema>;

export type ChatResponse = {
  reply: string;
  state: TraderState;
  ui: UiBlock[];
  tools: { name: string; input: unknown }[]; // the tools called, in order (used by the chat eval)
  remaining: number; // messages left in this session
};

function randomString(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// The conversation as the model sees it: the last 20 turns, starting with
// the trader, plus a description of any button the trader tapped.
function buildMessages(body: Body): Anthropic.MessageParam[] {
  const history = body.messages.slice(-HISTORY_TURNS);
  while (history.length && history[0].role === "assistant") history.shift();
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.role === "user" && m.voice ? `[Voice note transcript] ${m.content}` : m.content,
  }));
  if (body.action) messages.push({ role: "user", content: describeAction(body.action) });

  // A receipt goes with the trader's latest message, on this request only.
  const last = messages.at(-1);
  if (body.attachment && last?.role === "user" && typeof last.content === "string") {
    const { mediaType, data } = body.attachment;
    const file: Anthropic.ContentBlockParam =
      mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: mediaType, data } }
        : { type: "image", source: { type: "base64", media_type: mediaType, data } };
    last.content = [file, { type: "text", text: `[The trader attached this file.] ${last.content}` }];
  }
  return messages;
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const started = Date.now();

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_WITH_RECEIPT_BYTES) return json({ error: "too_large" }, 413);
  const raw = await request.text();
  const size = new TextEncoder().encode(raw).length;
  if (size > MAX_BODY_WITH_RECEIPT_BYTES) return json({ error: "too_large" }, 413);

  let parsed;
  try {
    parsed = BodySchema.safeParse(JSON.parse(raw));
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  const body = parsed.data;
  if (!body.attachment && size > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);
  if (body.attachment && (body.action || !attachmentLooksValid(body.attachment))) {
    return json({ error: "invalid_attachment" }, 400);
  }

  const messages = buildMessages(body);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return json({ error: "no_message" }, 400);
  }

  // Session cap: the count lives in the trader's state.
  if (body.state.messageCount >= MAX_MESSAGES) {
    const response: ChatResponse = {
      reply: strings.chat.replies.limitReached,
      state: body.state,
      ui: [],
      tools: [],
      remaining: 0,
    };
    return json(response);
  }

  let state: TraderState = { ...body.state, messageCount: body.state.messageCount + 1 };
  const lastUser = body.messages.findLast((m) => m.role === "user");
  const ctx: ToolContext = {
    today: todayISO(),
    now: new Date().toISOString(),
    newId: () => randomString(8).toLowerCase(),
    newReference: () => `MOCK-${randomString(6)}`,
    source: body.action ? "button" : lastUser?.role === "user" && lastUser.voice ? "voice" : "text",
    action: body.action,
    hasAttachment: Boolean(body.attachment),
  };

  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    { type: "text", text: contextBlock(state, ctx.today) },
  ];

  const ui: UiBlock[] = [];
  const tools: ChatResponse["tools"] = [];
  const usage = { input: 0, output: 0, cacheRead: 0 };
  let reply = "";
  let stopReason: string | null = null;

  try {
    for (let round = 0; ; round++) {
      const lastRound = round === MAX_TOOL_ROUNDS;
      const response = await getClient().messages.create({
        model: MODEL,
        max_tokens: 4096,
        output_config: { effort: "medium" },
        system,
        tools: toolDefinitions,
        tool_choice: lastRound ? { type: "none" } : { type: "auto" },
        messages,
      });
      usage.input += response.usage.input_tokens;
      usage.output += response.usage.output_tokens;
      usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;
      stopReason = response.stop_reason;

      if (response.stop_reason === "refusal") {
        reply = strings.chat.replies.refusal;
        break;
      }
      const text = textOf(response);
      if (text) reply = text;
      if (response.stop_reason !== "tool_use" || lastRound) break;

      // Run every tool call in order, so each sees the state the last one left,
      // and send all the results back in one message.
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const outcome = runTool(block.name, block.input, state, ctx);
        state = outcome.state;
        if (outcome.ui) ui.push(...outcome.ui);
        tools.push({ name: block.name, input: block.input });
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(outcome.result),
          ...(outcome.isError ? { is_error: true } : {}),
        });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (error) {
    // Counts and error types only. Never message content.
    const status = error instanceof Anthropic.APIError ? error.status : undefined;
    const toolNames = tools.map((t) => t.name);
    console.error(JSON.stringify({ event: "chat_error", status, name: (error as Error)?.name, tools: toolNames }));
    // The file passed our checks but the API couldn't open it. The trader can try another.
    if (body.attachment && error instanceof Anthropic.BadRequestError) {
      const response: ChatResponse = {
        reply: strings.chat.replies.fileUnreadable,
        state,
        ui: [],
        tools,
        remaining: Math.max(0, MAX_MESSAGES - state.messageCount),
      };
      return json(response);
    }
    if (error instanceof Anthropic.RateLimitError) return json({ error: "busy" }, 503);
    if (error instanceof Anthropic.APIError) return json({ error: "upstream" }, 502);
    return json({ error: "server" }, 500);
  }

  console.info(
    JSON.stringify({
      event: "chat",
      model: MODEL,
      tools: tools.map((t) => t.name),
      stop: stopReason,
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheReadTokens: usage.cacheRead,
      ms: Date.now() - started,
    }),
  );

  const response: ChatResponse = {
    reply: reply || strings.chat.replies.fallback,
    state,
    ui: blocksToShow(ui),
    tools,
    remaining: Math.max(0, MAX_MESSAGES - state.messageCount),
  };
  return json(response);
}
