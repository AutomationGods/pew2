/**
 * The rules of a GG Coder desktop question card, kept apart from the drawing
 * so they can be tested: which answers a question takes, and when the card is
 * finished. Mirrors the desktop's band (gg-app/src/AskBand.tsx): a pick commits
 * on the tap, a multi-select on its confirm, a typed answer on its send, and
 * the card goes back once every question has an answer.
 *
 * Expo-free so `bun test` can load it.
 */
import type { DesktopAnswers, DesktopOption, DesktopQuestion } from "./permissions";

/** A yes/no question the agent sent without options still needs two buttons. */
const YES_NO: DesktopOption[] = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

/** The choices to draw for a question; none for a typed-answer question. */
export function choicesOf(question: DesktopQuestion): DesktopOption[] {
  if (question.kind === "text") return [];
  return question.options ?? (question.kind === "confirm" ? YES_NO : []);
}

/** What a choice sends back: its value, or its label when it has none. */
export function valueOf(option: DesktopOption): string {
  return option.value ?? option.label;
}

/** Free text is offered unless the agent opted out, as on the desktop. */
export function allowsTyping(question: DesktopQuestion): boolean {
  return question.kind === "text" || question.allowOther !== false;
}

/** A multi-select pick list with one value toggled. */
export function toggled(picked: readonly string[], value: string): string[] {
  return picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value];
}

/** True once an answer would be accepted for this question. */
export function isAnswered(answer: string | string[] | undefined): boolean {
  if (Array.isArray(answer)) return answer.length > 0;
  return typeof answer === "string" && answer.trim().length > 0;
}

/**
 * The card's answers once every question has one, or undefined while any is
 * still open. Only the asked questions are sent, so a stale key from an
 * earlier card can never ride along.
 */
export function completeAnswers(
  questions: readonly DesktopQuestion[],
  answers: DesktopAnswers,
): DesktopAnswers | undefined {
  const done: DesktopAnswers = {};
  for (const question of questions) {
    const answer = answers[question.id];
    if (!isAnswered(answer)) return undefined;
    done[question.id] = typeof answer === "string" ? answer.trim() : (answer as string[]);
  }
  return done;
}
