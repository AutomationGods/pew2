/**
 * The shapes a provider connection exposes: what a session handle can do, the
 * options it is opened with, and the stored conversations it reports.
 */
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ClientConnection } from "@agentclientprotocol/sdk";
import type { wire } from "@pew2/protocol";

/** A GG Coder desktop question card's answers, keyed by question id. */
export type DesktopAnswers = wire.DesktopAnswers;

/** How a permission request was answered: the option picked, plus card answers if any. */
export interface PermissionAnswer {
  optionId: string;
  answers?: DesktopAnswers;
}
import type { StoredAttachment } from "../attachments.js";
import type { AgentProject } from "../projects.js";
import type { LoadedProvider } from "../providers/registry.js";
import type { Trace } from "../trace.js";
import type { AvailableCommand, ConfigOption } from "./config-options.js";
import type { PromptCapabilities } from "./promptBlocks.js";

/**
 * A conversation the agent already has on disk.
 *
 * Coding agents keep their own history, so a phone should see the work started
 * at the desk, not just what it started itself.
 * https://agentclientprotocol.com/protocol/v1/session-listing
 */
export interface AgentSession {
  sessionId: string;
  cwd: string;
  title?: string;
  /** ISO 8601 timestamp of last activity, when the agent tracks one. */
  updatedAt?: string;
  /** Number of message rows the app will render before this session is opened. */
  messageCount?: number;
}

/**
 * What one `session/list` call yields.
 *
 * Three views of the same answer because they serve different screens: the
 * capped `sessions` are the drawer's recent history (the only ones whose
 * message counts are worth reading from disk up front), `projects` is the
 * complete set of places this agent has worked, and `all` is kept so choosing
 * one of those projects can be answered without asking the agent again.
 */
export interface AgentSessionList {
  sessions: AgentSession[];
  projects: AgentProject[];
  all: AgentSession[];
}

export interface AcpSessionHandle {
  connection: ClientConnection;
  child: ChildProcessWithoutNullStreams;
  /** The session prompts currently target. Changes when `adopt` opens another. */
  readonly sessionId: string;
  /** Selectors for the current session. Empty when it offers none. */
  readonly configOptions: ConfigOption[];
  /**
   * Slash commands the agent advertised for the current session.
   *
   * Sent as a notification shortly after `session/new`, not as part of its
   * result, so this fills in a moment after the session opens. The set depends
   * on the project's own `commands/` directories, so it is per session rather
   * than a property of the agent.
   */
  readonly availableCommands: AvailableCommand[];
  /** True when the agent can replay a past session via `session/load`. */
  canLoadSession: boolean;
  /**
   * The agent's own stored conversations, newest first.
   *
   * Empty when the agent does not advertise `session/list` — not every agent
   * persists history, and asking one that doesn't is an error, not an empty list.
   */
  listSessions(): Promise<AgentSessionList>;
  /**
   * Open another session on this same agent process.
   *
   * Booting the process is the expensive part of a connection — GG Coder
   * takes ~5s while `session/load` itself answers in ~30ms — so the daemon
   * keeps a warm handle per provider and adopts it for the next conversation
   * instead of spawning again.
   */
  adopt(options: AdoptOptions): Promise<void>;
  /**
   * What this agent accepts in a prompt besides text.
   *
   * Undefined when it advertised nothing, which means text only: sending an
   * image block to an agent that never claimed `image` is a protocol error,
   * not a graceful degradation.
   */
  readonly promptCapabilities?: PromptCapabilities;
  prompt(text: string, attachments?: readonly StoredAttachment[]): Promise<unknown>;
  cancel(): Promise<void>;
  setConfigOption(configId: string, value: string | boolean): Promise<ConfigOption[]>;
  /** `answers` is a whole GG Coder desktop question card; other agents never get it. */
  answerPermission(requestId: string, optionId: string, answers?: DesktopAnswers): boolean;
  close(): void;
}

export interface AdoptOptions {
  /** Resume this stored session; a fresh one is created when omitted. */
  loadSessionId?: string;
  /**
   * The project this conversation opens in.
   *
   * Required, and not optional with a fallback: a warm process was spawned for
   * whatever workspace the capability probe happened to use, which under
   * launchd is the home directory. Reusing that for a session the user opened
   * against a chosen project is what made the agent report the wrong `cwd` —
   * so every adopt has to say where it is going.
   */
  cwd: string;
  /** As on {@link ConnectOptions}: skip the replay, keep the agent context. */
  haveHistory?: boolean;
  onUpdate: (payload: unknown) => void;
  onPermissionRequest: (request: { requestId: string; params: unknown }) => void;
  onConfigOptions?: (options: ConfigOption[]) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface ConnectOptions {
  trace?: Trace;
  provider: LoadedProvider;
  cwd: string;
  /** Called for every ACP `session/update` notification, in arrival order. */
  onUpdate: (payload: unknown) => void;
  /**
   * Called when the agent asks the user to approve something. Resolve the
   * returned promise by calling `answerPermission` with one of the option ids.
   */
  onPermissionRequest: (request: { requestId: string; params: unknown }) => void;
  /**
   * The agent changed the session's selectors on its own.
   *
   * Not every change comes from `setConfigOption`: the option set is
   * model-dependent, so switching model adds or removes the thinking-level
   * selector, and `/model` typed as a prompt changes it with no request at all.
   * Without this the pills keep describing the model that was current when the
   * session opened.
   */
  onConfigOptions?: (options: ConfigOption[]) => void;
  onStderr?: (line: string) => void;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  /**
   * Resume one of the agent's own sessions instead of starting a fresh one.
   *
   * `session/load` replays the whole conversation through `onUpdate` before it
   * resolves, which is how a phone picks up a thread started at the desk.
   */
  loadSessionId?: string;
  /**
   * The caller already has this conversation's history and does not want it
   * replayed — only the agent-side context back.
   *
   * Set when the daemon painted the thread from its own cache, which it does
   * for every provider. Without it the agent replays a transcript the user is
   * already looking at, and the daemon drops every message of it: 8,354
   * notifications and 938ms, measured against GG Coder, to arrive at the screen
   * that was already drawn.
   *
   * Only a hint. An agent that does not advertise `session/resume` still gets a
   * `session/load`, and the duplicate replay is still discarded as before.
   */
  haveHistory?: boolean;
  /**
   * How long to wait for the agent to answer `initialize`.
   *
   * Overridable mainly so tests do not have to wait out the real budget.
   */
  handshakeTimeoutMs?: number;
}
