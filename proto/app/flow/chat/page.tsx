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
  RoomsControl,
  TextControl,
  isComposerStep,
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

  // Most recent user reply — drives the "← Назад" affordance.
  const lastUserMsg = useMemo(() => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const m = state.messages[i];
      if (m.role === "user") return m;
    }
    return null;
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

    // Expert short-circuit: at A7 ("event_type") if the user picks anything
    // other than flood, we skip the rest of the chat (branch + post-steps)
    // and hand off to the expert immediately. AI auto-flow is only built
    // out for floods today.
    const justPickedNonFlood =
      currentId === "A7" &&
      newAnswers.event_type !== undefined &&
      newAnswers.event_type !== "flood";

    if (nextIdx >= flat.length || justPickedNonFlood) {
      const eventType = newAnswers.event_type as EventType | undefined;
      const isFlood = eventType === "flood";
      const finalText = isFlood
        ? "Готово! Теперь сделаем фотографии повреждений."
        : "Ваше обращение переведено на эксперта. С вами свяжутся в течение 8 рабочих часов.";
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
          if (isFlood) router.push("/flow/camera");
          else router.push("/thank-you?routed=expert");
        }, 1500);
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
        text: `Отлично! Подтянул из полиса адрес (${newAnswers.address}), площадь (${newAnswers.apartment_area_m2} м²). Теперь уточним детали по страховому событию.`,
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
      className="bg-chat-canvas flex flex-col overflow-hidden text-chat-ink [font-feature-settings:'ss01','tnum']"
      style={{ height: "100dvh" }}
    >
      <div className="shrink-0 sticky top-0 z-20 bg-chat-canvas pt-safe">
        <div className="flex items-center justify-between gap-3 px-[18px] pt-[14px] pb-3">
          {/* Left: round back button (per design §04) */}
          <button
            onClick={() => router.push("/")}
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-chat-surface border border-chat-line text-chat-ink hover:bg-white"
            aria-label="Назад"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </button>

          {/* Center: title + online status */}
          <div className="flex flex-1 flex-col items-center min-w-0">
            <span className="text-[20px] font-bold leading-[26px] text-chat-ink tracking-[-0.3px] truncate">
              Чат-помощник
            </span>
            <span className="mt-0.5 text-[12px] leading-4 font-medium text-sber-green flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sber-green" />
              онлайн
            </span>
          </div>

          {/* Right: exit (preserving "Завершить" semantics from prior UX) */}
          <button
            onClick={() => router.push("/thank-you?abandoned=1")}
            className="shrink-0 flex h-9 px-3 items-center justify-center rounded-full bg-chat-surface border border-chat-line text-[12px] font-medium text-chat-muted hover:text-chat-ink hover:bg-white"
            aria-label="Завершить"
          >
            Завершить
          </button>
        </div>

        {/* Chat-only progress: one continuous bar that fills as the user
            answers questions. Total adapts to the current branch (e.g. flood
            has more steps than the post-block alone). */}
        <ChatProgress pct={progressPct} />

        <div className="px-[18px] pt-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-chat-muted tabular-nums">
          {totalVisible > 0
            ? `ШАГ ${state.finished ? totalVisible : Math.min(answeredCount + 1, totalVisible)} ИЗ ${totalVisible} · ОПРОС`
            : "ОПРОС"}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-6">
        <div
          className="mx-auto flex max-w-lg flex-col gap-4"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))" }}
        >
          {state.messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <UserMessage
                  key={m.id}
                  text={m.text}
                  onEdit={() => {
                    const ok = window.confirm(
                      "Изменить этот ответ? Все следующие шаги будут сброшены — их нужно будет пройти заново."
                    );
                    if (ok) handleRevert(m.stepId);
                  }}
                />
              );
            }
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
          {/* "Назад" affordance — reverts to the most recent user-answered
              step. Visible whenever there's at least one prior answer. */}
          {!state.finished && !state.isTyping && lastUserMsg && (
            <div className="flex justify-start ml-[40px]">
              <button
                type="button"
                onClick={() => handleRevert(lastUserMsg.stepId)}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-chat-muted hover:text-sber-green transition-colors"
              >
                ← Назад
              </button>
            </div>
          )}
          {/* In-stream controls: choice / multi-choice / date / multiline /
              gosuslugi / policy / address — anything that doesn't fit a
              single-line pill composer. */}
          {!state.finished && activeStep && !state.isTyping && !isComposerStep(activeStep) && (
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

      {/* Sticky-bottom pill composer — text/phone/numeric only. Hidden when
          the active control is bubble-button / date / etc. */}
      {!state.finished && activeStep && !state.isTyping && isComposerStep(activeStep) && (
        <div
          className="shrink-0 border-t border-chat-line bg-chat-canvas px-[18px] pt-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
        >
          <ActiveControl
            step={activeStep}
            onSubmit={handleSubmit}
            onRevert={handleRevert}
            currentAddress={String(state.answers.address ?? "")}
          />
        </div>
      )}
    </main>
  );
}

// Single 4px progress bar tracking only the chat itself: width = answered
// questions / total visible questions. Total adapts to the current branch
// (intro → flood → post-block, or just intro for the expert short-circuit).
function ChatProgress({ pct }: { pct: number }) {
  const fill = Math.max(0, Math.min(100, pct));
  return (
    <div className="px-[18px]">
      <div className="h-1 rounded-sm bg-[#E1E4DE] overflow-hidden">
        <div
          className="h-full rounded-sm bg-sber-green transition-all duration-300"
          style={{ width: `${fill}%` }}
        />
      </div>
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
    case "rooms":
      return <RoomsControl step={step} onSubmit={onSubmit} />;
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
