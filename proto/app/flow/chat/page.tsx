"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  BotMessage,
  TypingIndicator,
  UserMessage,
  shouldShowAvatar,
} from "@/components/chat/messages";
import {
  AddressConfirmControl,
  AddressControl,
  ChoiceControl,
  DateControl,
  GosuslugiControl,
  MultiChoiceControl,
  NumericControl,
  PhoneControl,
  PolicyFoundControl,
  TextControl,
  type SubmitPayload,
} from "@/components/chat/controls";
import {
  flattenSteps,
  getCompoundParent,
  getFullScript,
  initialChatState,
  makeMsgId,
  mapAnswersToDraft,
} from "@/lib/chat/engine";
import { INTRO_STEPS, getBranchSteps, shouldShowStep, type Branch } from "@/lib/chat/script";
import type { ChatMessage, ChatState, Step } from "@/lib/chat/types";
import type { DraftState, EventType } from "@/types";

const EMPTY_DRAFT: DraftState = {
  id: "",
  created_at: "",
  current_step: "chat",
};

// Random typing delay between min/max ms — feels less robotic than a fixed value.
const TYPING_MIN_MS = 1500;
const TYPING_MAX_MS = 2800;
function pickTypingDelay() {
  return TYPING_MIN_MS + Math.floor(Math.random() * (TYPING_MAX_MS - TYPING_MIN_MS));
}

export default function ChatFlowPage() {
  const router = useRouter();
  const [state, setState] = useState<ChatState>(() => initialChatState());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastBotMsgRef = useRef<HTMLDivElement | null>(null);
  const typingRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<DraftState>(EMPTY_DRAFT);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Index of the latest bot message — used to attach the scroll anchor.
  const lastBotIdx = useMemo(() => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === "bot") return i;
    }
    return -1;
  }, [state.messages]);

  // Hydrate draft on mount and reveal the first bot question after typing delay.
  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("claim_draft") : null;
    draftRef.current = raw ? (JSON.parse(raw) as DraftState) : { ...EMPTY_DRAFT };

    typingTimerRef.current = setTimeout(() => {
      const firstStep = INTRO_STEPS[0];
      setState((prev) => ({
        ...prev,
        messages: [
          { role: "bot", id: makeMsgId(), text: firstStep.question },
        ],
        currentStepId: firstStep.id,
        isTyping: false,
      }));
    }, pickTypingDelay());

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Auto-scroll. While typing, keep the typing dots anchored at the bottom so
  // they stay visible. When a new bot message lands, lift that question to the
  // top of the viewport so the user reads it first and the controls below sit
  // in the readable area.
  useEffect(() => {
    if (state.isTyping) {
      typingRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    } else if (lastBotMsgRef.current) {
      lastBotMsgRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages.length, state.isTyping]);

  const activeStep = useMemo<Step | null>(() => {
    if (!state.currentStepId) return null;
    return findStepById(state.currentStepId, state.answers);
  }, [state.currentStepId, state.answers]);

  const totalVisible = useMemo(() => {
    const branch = (state.answers.event_type as Branch | undefined) ?? null;
    const flat = getFullScript(branch);
    return flat.filter((f) => shouldShowStep(f.step.id, state.answers)).length;
  }, [state.answers]);

  const answeredCount = useMemo(
    () => state.messages.filter((m) => m.role === "user").length,
    [state.messages]
  );

  const progressPct = totalVisible
    ? Math.round((answeredCount / totalVisible) * 100)
    : 0;

  function persistDraft(answers: Record<string, unknown>) {
    const next = mapAnswersToDraft(answers, draftRef.current);
    draftRef.current = next;
    if (typeof window !== "undefined") {
      localStorage.setItem("claim_draft", JSON.stringify(next));
    }
  }

  function handleSubmit(payload: SubmitPayload) {
    if (!activeStep || !state.currentStepId) return;
    const currentId = state.currentStepId;

    // Compute everything based on the current snapshot (state.answers).
    const newAnswers: Record<string, unknown> = { ...state.answers, ...payload.fieldUpdates };

    // Synthesize parent compound answer if this was its last leaf.
    const allSourceSteps: Step[] = [
      ...INTRO_STEPS,
      ...(newAnswers.event_type
        ? getBranchSteps(newAnswers.event_type as Branch)
        : []),
    ];
    const parent = getCompoundParent(allSourceSteps, currentId);
    if (parent && parent.kind === "compound") {
      const last = parent.subSteps[parent.subSteps.length - 1];
      if (last.id === currentId) {
        const partsMap: Record<string, string> = {};
        for (const sub of parent.subSteps) {
          partsMap[sub.field] = String(newAnswers[sub.field] ?? "");
        }
        newAnswers[parent.field] = parent.combine(partsMap);
      }
    }

    // Find the next step.
    const branch = (newAnswers.event_type as Branch | undefined) ?? null;
    const flat = getFullScript(branch);
    const curIdx = flat.findIndex((f) => f.step.id === currentId);
    let nextIdx = curIdx + 1;
    while (nextIdx < flat.length && !shouldShowStep(flat[nextIdx].step.id, newAnswers)) {
      nextIdx++;
    }

    const userMsg: ChatMessage = {
      role: "user",
      id: makeMsgId(),
      stepId: currentId,
      text: payload.displayText,
    };

    persistDraft(newAnswers);

    if (nextIdx >= flat.length) {
      const eventType = newAnswers.event_type as EventType | undefined;
      const finalText =
        eventType === "flood"
          ? "Готово! Теперь сделаем фотографии повреждений."
          : "Передаём заявку эксперту. С вами свяжутся в течение часа.";
      const finalMsg: ChatMessage = { role: "bot", id: makeMsgId(), text: finalText };

      // Phase 1: append user msg, hide controls, show typing.
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMsg],
        answers: newAnswers,
        currentStepId: null,
        isTyping: true,
      }));

      // Phase 2: after delay, append final bot message and route.
      typingTimerRef.current = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, finalMsg],
          isTyping: false,
          finished: true,
        }));
        setTimeout(() => {
          if (eventType === "flood") router.push("/flow/camera");
          else router.push("/thank-you");
        }, 800);
      }, pickTypingDelay());
      return;
    }

    const nextStep = flat[nextIdx].step;
    const nextParent = getCompoundParent(allSourceSteps, nextStep.id);
    const botMsgs: ChatMessage[] = [];

    // Special-case: confirm Gosuslugi auto-fill before continuing.
    if (currentId === "A0" && newAnswers.auth_method === "gosuslugi") {
      const phoneDisplay = String(newAnswers.gosuslugi_phone_display ?? "");
      botMsgs.push({
        role: "bot",
        id: makeMsgId(),
        text: `Получили ваши данные через Госуслуги: ${newAnswers.name}, ${phoneDisplay}.`,
      });
    }

    // Special-case: confirm prefilled fields after a found policy was accepted.
    if (currentId === "AP" && newAnswers.policy_found === true) {
      botMsgs.push({
        role: "bot",
        id: makeMsgId(),
        text: `Отлично! Подтянул из полиса адрес (${newAnswers.address}), площадь (${newAnswers.apartment_area_m2} м²) и уровень отделки. Уточним последние детали.`,
      });
    }

    if (nextParent && nextParent.kind === "compound") {
      const isFirstLeaf = nextParent.subSteps[0].id === nextStep.id;
      if (isFirstLeaf) {
        botMsgs.push({ role: "bot", id: makeMsgId(), text: nextParent.question });
      }
    }
    botMsgs.push({ role: "bot", id: makeMsgId(), text: nextStep.question });

    // Phase 1: append user msg, hide controls, start typing indicator.
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      answers: newAnswers,
      currentStepId: null,
      isTyping: true,
      finished: false,
    }));

    // Phase 2: after delay, reveal next bot question(s) and unhide controls.
    typingTimerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, ...botMsgs],
        currentStepId: nextStep.id,
        isTyping: false,
      }));
    }, pickTypingDelay());
  }

  // Revert: drop messages and answers from a given step onward, return to it.
  function handleRevert(toStepId: string) {
    setState((prev) => {
      const targetStep = findStepById(toStepId, prev.answers);
      if (!targetStep) return prev;

      const dropFrom = prev.messages.findIndex(
        (m) => m.role === "user" && (m as { stepId?: string }).stepId === toStepId
      );
      const trimmedMsgs = dropFrom >= 0 ? prev.messages.slice(0, dropFrom) : prev.messages;

      const branch = (prev.answers.event_type as Branch | undefined) ?? null;
      const flat = getFullScript(branch);
      const fromIdx = flat.findIndex((f) => f.step.id === toStepId);
      const fieldsToDrop = new Set<string>();
      if (fromIdx >= 0) {
        for (let i = fromIdx; i < flat.length; i++) {
          fieldsToDrop.add(flat[i].step.id);
          fieldsToDrop.add(flat[i].step.field);
        }
        if (toStepId === "A3") {
          fieldsToDrop.add("region");
          fieldsToDrop.add("address_iso");
          fieldsToDrop.add("address_confirmed");
        }
      }
      const cleanedAnswers = { ...prev.answers };
      for (const k of Object.keys(cleanedAnswers)) {
        if (fieldsToDrop.has(k)) delete cleanedAnswers[k];
      }

      return {
        messages: trimmedMsgs,
        answers: cleanedAnswers,
        currentStepId: toStepId,
        finished: false,
        isTyping: false,
      };
    });
  }

  // Avatar shown above the typing indicator only if the message above it
  // wasn't already from the bot.
  const typingShowsAvatar =
    state.messages.length === 0 ||
    state.messages[state.messages.length - 1].role !== "bot";

  return (
    <main
      className="bg-[#f5f6f7] flex flex-col overflow-hidden"
      style={{ height: "100dvh" }}
    >
      <div className="shrink-0 sticky top-0 z-20 bg-white pt-safe">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-gray-100 px-4 py-3">
          {/* Left: back */}
          <button
            onClick={() => router.push("/")}
            className="text-gray-400 hover:text-gray-600 p-1 -ml-1"
            aria-label="Назад"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Center: title + Lemonade-style step progress */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-900">Чат-помощник</span>
            <FlowProgress activePct={progressPct} />
          </div>

          {/* Right: end */}
          <button
            onClick={() => router.push("/thank-you?abandoned=1")}
            className="text-xs text-sber-green font-medium whitespace-nowrap"
          >
            Завершить
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-6">
        <div
          className="mx-auto flex max-w-lg flex-col gap-4"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
        >
          {state.messages.map((m, i) => {
            if (m.role === "user") return <UserMessage key={m.id} text={m.text} />;
            const attachRef = i === lastBotIdx ? lastBotMsgRef : undefined;
            return (
              <div
                key={m.id}
                ref={attachRef}
                // scroll-mt-20 leaves room under the sticky header when the
                // bot message is scrolled into view at the top.
                className="scroll-mt-20"
              >
                <BotMessage
                  text={m.text}
                  showAvatar={shouldShowAvatar(state.messages, i)}
                />
              </div>
            );
          })}
          {state.isTyping && (
            <div ref={typingRef}>
              <TypingIndicator showAvatar={typingShowsAvatar} />
            </div>
          )}
          {!state.finished && activeStep && !state.isTyping && (
            <div className="mt-1">
              <ActiveControl
                step={activeStep}
                onSubmit={handleSubmit}
                onRevert={handleRevert}
                currentAddress={String(state.answers.address ?? "")}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Lemonade-style stepper: 5 segments, the first is the chat-flow itself
// (filled proportionally to progressPct), the remaining 4 are upcoming
// pages of the broader claim journey (camera, review, etc).
function FlowProgress({ activePct }: { activePct: number }) {
  const TOTAL = 5;
  const ACTIVE_INDEX = 0;
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: TOTAL }).map((_, i) => {
        if (i < ACTIVE_INDEX) {
          // already-completed sections — solid pill.
          return (
            <span
              key={i}
              className="inline-block h-1.5 w-6 rounded-full bg-sber-green"
            />
          );
        }
        if (i === ACTIVE_INDEX) {
          return (
            <span
              key={i}
              className="inline-block h-1.5 w-12 overflow-hidden rounded-full bg-gray-200"
            >
              <span
                className="block h-full rounded-full bg-sber-green transition-all duration-300"
                style={{ width: `${Math.max(8, Math.min(100, activePct))}%` }}
              />
            </span>
          );
        }
        return (
          <span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300"
          />
        );
      })}
    </div>
  );
}

function ActiveControl({
  step,
  onSubmit,
  onRevert,
  currentAddress,
}: {
  step: Step;
  onSubmit: (p: SubmitPayload) => void;
  onRevert: (id: string) => void;
  currentAddress: string;
}) {
  switch (step.kind) {
    case "text":
      return <TextControl step={step} onSubmit={onSubmit} />;
    case "phone":
      return <PhoneControl step={step} onSubmit={onSubmit} />;
    case "numeric":
      return <NumericControl step={step} onSubmit={onSubmit} />;
    case "date":
      return <DateControl step={step} onSubmit={onSubmit} />;
    case "choice":
      return <ChoiceControl step={step} onSubmit={onSubmit} />;
    case "multi_choice":
      return <MultiChoiceControl step={step} onSubmit={onSubmit} />;
    case "address":
      return <AddressControl step={step} onSubmit={onSubmit} />;
    case "address_confirm":
      return (
        <AddressConfirmControl
          step={step}
          onSubmit={onSubmit}
          onRevert={onRevert}
          currentAddress={currentAddress}
        />
      );
    case "gosuslugi":
      return <GosuslugiControl step={step} onSubmit={onSubmit} />;
    case "policy_found":
      return <PolicyFoundControl step={step} onSubmit={onSubmit} />;
    case "compound":
      return null;
  }
}

function findStepById(id: string, answers: Record<string, unknown>): Step | null {
  const branch = (answers.event_type as Branch | undefined) ?? null;
  const flat = getFullScript(branch);
  return flat.find((f) => f.step.id === id)?.step ?? null;
}

export { flattenSteps };
