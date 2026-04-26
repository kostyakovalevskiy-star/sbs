import type { ReactNode } from "react";

export type StepKind =
  | "text"
  | "phone"
  | "address"
  | "address_confirm"
  | "numeric"
  | "date"
  | "choice"
  | "multi_choice"
  | "compound"
  | "gosuslugi";

export interface ChoiceOption {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

interface BaseStep {
  id: string;
  field: string;
  question: string;
  optional?: boolean;
}

export type Step =
  | (BaseStep & {
      kind: "text";
      placeholder?: string;
      minLength?: number;
      multiline?: boolean;
    })
  | (BaseStep & { kind: "phone" })
  | (BaseStep & { kind: "address" })
  | (BaseStep & { kind: "address_confirm" })
  | (BaseStep & {
      kind: "numeric";
      placeholder?: string;
      min?: number;
      max?: number;
      suffix?: string;
      integer?: boolean;
    })
  | (BaseStep & { kind: "date" })
  | (BaseStep & { kind: "choice"; options: ChoiceOption[] })
  | (BaseStep & { kind: "multi_choice"; options: ChoiceOption[]; minSelected?: number })
  | (BaseStep & {
      kind: "compound";
      subSteps: Step[];
      combine: (parts: Record<string, string>) => string;
    })
  | (BaseStep & { kind: "gosuslugi" })
  | (BaseStep & { kind: "policy_found" });

export interface BotMessageItem {
  role: "bot";
  id: string;
  text: string;
}

export interface UserMessageItem {
  role: "user";
  id: string;
  stepId: string;
  text: string;
}

export type ChatMessage = BotMessageItem | UserMessageItem;

export interface ChatState {
  messages: ChatMessage[];
  answers: Record<string, unknown>;
  currentStepId: string | null;
  finished: boolean;
  isTyping: boolean;
}
