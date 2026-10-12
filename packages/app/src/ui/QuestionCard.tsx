/**
 * A GG Coder desktop question card, drawn the way the desktop draws it: each
 * question with its detail, numbered option rows with the recommended one
 * marked, checkboxes and a confirm for a multi-select, and a field for a typed
 * answer. A pick answers on the tap; the card goes back to the desktop as soon
 * as every question has an answer, exactly as the desktop band commits.
 */
import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme, useThemeStyles } from "../appearance";
import type { AppTheme } from "../theme";
import { touchSlop } from "./controls";
import { SHEET_ROW_HEIGHT } from "./Sheet";
import type { DesktopAnswers, DesktopQuestion } from "../permissions";
import {
  allowsTyping,
  choicesOf,
  completeAnswers,
  isAnswered,
  toggled,
  valueOf,
} from "../questionCard";

interface QuestionCardProps {
  questions: DesktopQuestion[];
  /** Called once, with every question answered. */
  onSubmit: (answers: DesktopAnswers) => void;
}

function QuestionCardView({ questions, onSubmit }: QuestionCardProps) {
  const [answers, setAnswers] = useState<DesktopAnswers>({});
  const [sent, setSent] = useState(false);
  const numbered = questions.length > 1;

  const answer = (id: string, value: string | string[]): void => {
    if (sent) return;
    const next = { ...answers, [id]: value };
    setAnswers(next);
    const complete = completeAnswers(questions, next);
    if (complete) {
      setSent(true);
      onSubmit(complete);
    }
  };

  return (
    <View>
      {questions.map((question, index) => (
        <Question
          key={question.id}
          question={question}
          number={numbered ? index + 1 : undefined}
          answer={answers[question.id]}
          disabled={sent}
          onAnswer={(value) => answer(question.id, value)}
        />
      ))}
    </View>
  );
}

function Question({
  question,
  number,
  answer,
  disabled,
  onAnswer,
}: {
  question: DesktopQuestion;
  number?: number;
  answer: string | string[] | undefined;
  disabled: boolean;
  onAnswer: (value: string | string[]) => void;
}) {
  const { theme } = useAppTheme();
  const styles = useThemeStyles(makeStyles);
  const choices = choicesOf(question);
  const multi = question.kind === "multi";
  // A multi-select parks its picks until confirmed, as on the desktop: "two of
  // these three" is not an answer until the user says they are done.
  const [picked, setPicked] = useState<string[]>([]);
  const [typing, setTyping] = useState(question.kind === "text");
  const [typed, setTyped] = useState("");
  const typedValue = typeof answer === "string" && !choices.some((c) => valueOf(c) === answer) ? answer : undefined;

  return (
    <View style={styles.question}>
      <Text style={styles.heading} accessibilityRole="header">
        {number !== undefined ? `${number}. ` : ""}
        {question.question}
      </Text>
      {question.detail ? <Text style={styles.detail}>{question.detail}</Text> : null}

      {choices.length > 0 && (
        <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={question.question}>
          {choices.map((choice, index) => {
            const value = valueOf(choice);
            const on = multi ? picked.includes(value) : answer === value;
            return (
              <Pressable
                key={`${value}-${index}`}
                disabled={disabled}
                style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.rowPressed]}
                hitSlop={touchSlop(theme.space(1))}
                accessibilityRole={multi ? "checkbox" : "radio"}
                accessibilityState={{ checked: on, disabled }}
                accessibilityLabel={choice.recommended ? `${choice.label}, recommended` : choice.label}
                accessibilityHint={choice.hint}
                onPress={() => (multi ? setPicked((current) => toggled(current, value)) : onAnswer(value))}
              >
                <Text style={[styles.lead, on && styles.textOn]}>{multi ? (on ? "☑" : "☐") : String(index + 1)}</Text>
                <View style={styles.rowMain}>
                  <Text style={[styles.label, on && styles.textOn]}>{choice.label}</Text>
                  {choice.hint ? <Text style={[styles.hint, on && styles.textOn]}>{choice.hint}</Text> : null}
                </View>
                {choice.recommended ? (
                  <Text style={[styles.badge, on && styles.textOn]}>Recommended</Text>
                ) : null}
              </Pressable>
            );
          })}
          {typedValue !== undefined && (
            <View style={[styles.row, styles.rowOn]}>
              <Text style={[styles.label, styles.textOn]}>{typedValue}</Text>
            </View>
          )}
        </View>
      )}

      {multi && (
        <Pressable
          disabled={disabled || picked.length === 0}
          style={({ pressed }) => [styles.confirm, (disabled || picked.length === 0) && styles.confirmOff, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityState={{ disabled: disabled || picked.length === 0 }}
          onPress={() => onAnswer(picked)}
        >
          <Text style={styles.confirmText}>
            {picked.length === 0 ? "Choose at least one" : `Confirm ${picked.length} selected`}
          </Text>
        </Pressable>
      )}

      {allowsTyping(question) && !typing && !isAnswered(answer) && (
        <Pressable
          disabled={disabled}
          style={styles.typeLink}
          hitSlop={touchSlop(theme.space(1))}
          accessibilityRole="button"
          onPress={() => setTyping(true)}
        >
          <Text style={styles.typeLinkText}>Answer in your own words</Text>
        </Pressable>
      )}

      {typing && (
        <View style={styles.typeRow}>
          <TextInput
            style={styles.input}
            value={typed}
            editable={!disabled}
            onChangeText={setTyped}
            placeholder="Type your answer"
            placeholderTextColor={theme.color.placeholder}
            accessibilityLabel={question.question}
            multiline
            autoFocus={question.kind !== "text"}
          />
          <Pressable
            disabled={disabled || !typed.trim()}
            style={({ pressed }) => [styles.confirm, (disabled || !typed.trim()) && styles.confirmOff, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || !typed.trim() }}
            onPress={() => onAnswer(typed.trim())}
          >
            <Text style={styles.confirmText}>Answer</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    question: { gap: theme.space(2), paddingBottom: theme.space(4) },
    heading: { color: theme.color.text, fontSize: theme.font.body, fontWeight: "600", lineHeight: 22 },
    detail: { color: theme.color.textDim, fontSize: theme.font.small, lineHeight: 20 },
    options: { gap: theme.space(1.5) },
    row: {
      minHeight: SHEET_ROW_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space(3),
      paddingVertical: theme.space(2),
      paddingHorizontal: theme.space(3),
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceRaised,
    },
    rowOn: { backgroundColor: theme.color.accentSolid, borderColor: theme.color.accentSolid },
    rowPressed: { opacity: 0.75 },
    rowMain: { flex: 1, gap: theme.space(0.5) },
    lead: { width: 20, textAlign: "center", color: theme.color.textDim, fontSize: theme.font.small, fontWeight: "600" },
    label: { color: theme.color.text, fontSize: theme.font.body, fontWeight: "600" },
    hint: { color: theme.color.textDim, fontSize: theme.font.small },
    badge: { color: theme.color.success, fontSize: theme.font.small, fontWeight: "600" },
    textOn: { color: theme.color.accentText },
    confirm: {
      minHeight: theme.size.touch,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space(4),
      borderRadius: theme.radius.pill,
      backgroundColor: theme.color.accentSolid,
    },
    confirmOff: { opacity: 0.45 },
    confirmText: { color: theme.color.accentText, fontSize: theme.font.body, fontWeight: "600" },
    typeLink: { minHeight: theme.size.touch, justifyContent: "center", alignSelf: "flex-start" },
    typeLinkText: { color: theme.color.accent, fontSize: theme.font.small, fontWeight: "600" },
    typeRow: { gap: theme.space(2) },
    input: {
      minHeight: theme.size.touch * 2,
      padding: theme.space(3),
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.borderStrong,
      color: theme.color.text,
      fontSize: theme.font.body,
      textAlignVertical: "top",
    },
  });
}

export const QuestionCard = memo(QuestionCardView);
