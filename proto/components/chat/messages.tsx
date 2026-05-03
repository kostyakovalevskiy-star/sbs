"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";

const BOT_NAME = "Станислав";

// Filled green circle with a white linear bot glyph — per redesign §05.
// Avatar shown only for the first bubble in a bot group; following bubbles
// in the same run align via an invisible spacer of the same width.
function BotAvatar({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-sber-green"
      style={{ width: size, height: size }}
    >
      <Bot className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.6} />
    </span>
  );
}

function AvatarSpacer({ size = 32 }: { size?: number }) {
  return <span style={{ width: size, height: size }} className="inline-block shrink-0" aria-hidden />;
}

export function BotMessage({
  text,
  showAvatar,
}: {
  text: string;
  showAvatar: boolean;
}) {
  return (
    <div className="flex flex-col">
      {showAvatar && (
        <div className="mb-1 ml-[40px] text-[12px] font-medium leading-4 text-chat-muted tracking-[0.1px]">
          {BOT_NAME}
        </div>
      )}
      <div className="flex items-end gap-2">
        {showAvatar ? <BotAvatar size={32} /> : <AvatarSpacer size={32} />}
        <div
          className={cn(
            "bg-chat-surface text-chat-ink text-[15px] leading-[22px] px-[14px] py-[12px] max-w-[85%]",
            "rounded-[4px_18px_18px_18px] [overflow-wrap:anywhere]"
          )}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "bg-sber-green text-white font-medium text-[15px] leading-[22px] px-4 py-[11px] max-w-[75%]",
          "rounded-[18px_18px_4px_18px] [overflow-wrap:anywhere]"
        )}
      >
        {text}
      </div>
    </div>
  );
}

export function TypingIndicator({ showAvatar }: { showAvatar: boolean }) {
  return (
    <div className="flex flex-col" aria-label={`${BOT_NAME} печатает`}>
      {showAvatar && (
        <div className="mb-1 ml-[40px] text-[12px] font-medium leading-4 text-chat-muted tracking-[0.1px]">
          {BOT_NAME}
        </div>
      )}
      <div className="flex items-end gap-2">
        {showAvatar ? <BotAvatar size={32} /> : <AvatarSpacer size={32} />}
        <div className="bg-chat-surface px-[14px] py-[10px] rounded-[18px] flex items-center gap-1.5 w-fit">
          <span className="inline-block h-1 w-1 rounded-full bg-chat-muted animate-chat-typing" style={{ animationDelay: "0ms" }} />
          <span className="inline-block h-1 w-1 rounded-full bg-chat-muted animate-chat-typing" style={{ animationDelay: "200ms" }} />
          <span className="inline-block h-1 w-1 rounded-full bg-chat-muted animate-chat-typing" style={{ animationDelay: "400ms" }} />
        </div>
      </div>
    </div>
  );
}

// First bubble of a bot group gets an avatar + name above; subsequent ones in
// the same group hide both for visual cohesion.
export function shouldShowAvatar(
  messages: ChatMessage[],
  index: number
): boolean {
  if (messages[index].role !== "bot") return false;
  if (index === 0) return true;
  return messages[index - 1].role !== "bot";
}
