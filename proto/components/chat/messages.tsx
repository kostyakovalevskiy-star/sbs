"use client";

import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/types";

const BOT_NAME = "Станислав";
const AVATAR_SRC = "/avatars/stanislav.svg";

function BotAvatar({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-block overflow-hidden rounded-full bg-sber-green-light ring-1 ring-sber-green/20"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={AVATAR_SRC}
        alt={BOT_NAME}
        width={size}
        height={size}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

export function BotMessage({
  text,
  showAvatar,
}: {
  text: string;
  showAvatar: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {showAvatar && (
        <div className="flex items-center gap-2 mb-0.5">
          <BotAvatar size={24} />
          <span className="text-xs text-gray-500">{BOT_NAME}</span>
        </div>
      )}
      <div className="text-[16px] leading-snug text-gray-900 max-w-[88%]">
        {text}
      </div>
    </div>
  );
}

export function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "max-w-[80%] rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-[15px] text-gray-900 shadow-sm"
        )}
      >
        {text}
      </div>
    </div>
  );
}

export function TypingIndicator({ showAvatar }: { showAvatar: boolean }) {
  return (
    <div className="flex flex-col gap-1.5" aria-label={`${BOT_NAME} печатает`}>
      {showAvatar && (
        <div className="flex items-center gap-2 mb-0.5">
          <BotAvatar size={24} />
          <span className="text-xs text-gray-500">{BOT_NAME}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5 rounded-2xl border border-gray-300 bg-white px-4 py-3 w-fit shadow-sm">
        <span
          className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDuration: "1s", animationDelay: "0ms" }}
        />
        <span
          className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDuration: "1s", animationDelay: "150ms" }}
        />
        <span
          className="inline-block h-2 w-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDuration: "1s", animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}

// Determine if a bot message is the first of a series (different from previous role).
export function shouldShowAvatar(
  messages: ChatMessage[],
  index: number
): boolean {
  if (messages[index].role !== "bot") return false;
  if (index === 0) return true;
  return messages[index - 1].role !== "bot";
}
