/**
 * Slack API payload TypeScript 타입 (최소 필요 fields).
 *
 * Spec [providers/slack §4 명령 매핑] 의 3종 envelope 분기 + §3 Web API 응답 형식.
 * Phase 1 = 시그니처만, Phase 2 에서 본문 활용.
 *
 * 알려진 literal 외 다른 값도 들어올 수 있어 `(string & {})` trick 으로 literal preserve.
 * 단순 `| string` 은 eslint `no-redundant-type-constituents` 위배.
 */

/** Literal 유지 + open string 허용 — `LiteralOrString<'a' | 'b'> = 'a' | 'b' | (string & {})`. */
type LiteralOrString<L extends string> = L | (string & Record<never, never>);

// ---------- Events API ----------

/** Events API envelope. 진입 시 raw body 의 root. */
export interface SlackEventEnvelope {
  type: LiteralOrString<'event_callback' | 'url_verification'>;
  event_id?: string;
  team_id?: string;
  api_app_id?: string;
  event?: SlackEvent;
  /** url_verification 케이스만. */
  challenge?: string;
}

/** Events API 의 inner event. Spec §4.1 의 매핑 표 대상. */
export interface SlackEvent {
  type: LiteralOrString<'message' | 'app_mention' | 'file_shared'>;
  channel?: string;
  /** 'im' = DM, 'channel' / 'group' / 'mpim' = 그룹/채널. */
  channel_type?: LiteralOrString<'im' | 'channel' | 'group' | 'mpim'>;
  user?: string;
  text?: string;
  /** message subtype — 'bot_message' 등. undefined = 일반 user message. */
  subtype?: string;
  bot_id?: string;
  ts?: string;
  /** file_shared event. */
  file_id?: string;
}

// ---------- Interactivity ----------

/** Interactivity payload (form url-encoded body 의 `payload` 필드를 JSON.parse 한 결과). */
export interface SlackInteractivityPayload {
  type: LiteralOrString<
    | 'block_actions'
    | 'view_submission'
    | 'shortcut'
    | 'message_action'
    | 'view_closed'
  >;
  team?: { id: string; domain?: string };
  user?: { id: string; username?: string };
  channel?: { id: string; name?: string };
  /** block_actions: 메시지가 속한 채널 (channel object 부재 시 fallback). */
  container?: { channel_id?: string };
  /** block_actions: 사용자가 누른 component(s). */
  actions?: SlackInteractivityAction[];
  /** view_submission: modal 의 입력 값. */
  view?: {
    id: string;
    callback_id?: string;
    /** §4.1 modal-open 시 set 한 conversationKey 운반 슬롯. */
    private_metadata?: string;
    state?: { values: Record<string, Record<string, unknown>> };
  };
  /** 응답 url — 비동기 갱신용 (1시간 유효, 5회 한도). */
  response_url?: string;
  /** modal trigger_id (3초 유효). */
  trigger_id?: string;
}

export interface SlackInteractivityAction {
  action_id: string;
  block_id?: string;
  /** button 의 경우 — clicked 의 value. */
  value?: string;
  /** static_select 의 경우. */
  selected_option?: { value: string; text?: { text?: string } };
}

// ---------- Slash Commands ----------

/** Slash command body (application/x-www-form-urlencoded 의 parsed result). */
export interface SlackSlashCommandPayload {
  command: string;
  text: string;
  user_id: string;
  user_name?: string;
  channel_id: string;
  team_id: string;
  trigger_id?: string;
  response_url?: string;
}

// ---------- Web API responses ----------

/** Web API 공통 응답 envelope. */
export interface SlackWebApiResponse<T = unknown> {
  ok: boolean;
  error?: string;
  /** rate-limited 시 응답 헤더 Retry-After (초) — 본 응답 body 에는 없으나 caller 가 헤더에서 받음. */
  warning?: string;
  data?: T;
}

/** auth.test 응답 — bot identity 캐시용. */
export interface SlackAuthTestResult {
  ok: boolean;
  url?: string;
  team?: string;
  team_id?: string;
  user?: string;
  user_id?: string;
  bot_id?: string;
  /** ok=false 시 Slack 이 채움. */
  error?: string;
}

/** chat.postMessage 응답 (성공 시 ts + channel). */
export interface SlackChatPostMessageResult {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
}

/** files.info 응답 — file_shared event 보강용 (mimeType/filename/url_private). */
export interface SlackFilesInfoResult {
  ok: boolean;
  error?: string;
  file?: {
    id?: string;
    name?: string;
    mimetype?: string;
    filetype?: string;
    url_private?: string;
    size?: number;
  };
}
