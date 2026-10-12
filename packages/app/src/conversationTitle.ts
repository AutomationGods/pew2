/**
 * The title a conversation carries until its first user message arrives.
 *
 * It is also compared against, to decide whether the first prompt may replace
 * it. Anything that shows this text on screen must use this constant, or a
 * later wording change silently stops titles from being filled in.
 */
export const NEW_CONVERSATION_TITLE = "New conversation";
