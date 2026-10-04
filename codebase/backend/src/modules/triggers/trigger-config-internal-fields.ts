import { throwInvalidField } from './chat-channel-input-rules';
import { CHAT_CHANNEL_BLOCKED_FIELDS } from './chat-channel-rejection-messages.const';

// 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
// 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE#patch-본문-계약)
// 근거: [채팅 채널 「봇 토큰 변경 단일 경로」](CLE-CHAT-CORE#봇-토큰-변경-단일-경로)
// 위 세 곳의 규칙 23 · REQ-TRIG-053 · `details.field` 셋째 행은 NERV 초안(CLE-T-M9QKKX)이다.

/** 거부 메시지 뒤에 붙는 안내. 받은 값은 싣지 않는다. */
const CHAT_CHANNEL_HINT =
  '채팅 채널은 요청 본문의 chatChannel 로 설정하세요. 봇 토큰은 POST /api/triggers/:id/chat-channel/rotate-bot-token 으로만 바꿉니다.';

const NOTIFICATION_HINT =
  '알림 서명 시크릿은 POST /api/triggers/:id/notification/rotate-secret 으로만 바꿉니다.';

/**
 * 원시 `config` 에서 받지 않는 내부 필드의 경로와 안내 문구.
 *
 * `chatChannel` 쪽은 타입 필드 `chatChannel` 의 차단 다섯 필드(`CHAT_CHANNEL_BLOCKED_FIELDS`)에서
 * 유도한다. 두 번째 목록을 손으로 두지 않는다. 타입 필드와 달리 원시 `config` 에는 `setupChannel()`
 * 과 평문 제거가 돌지 않으므로 생성에서도 값 필드(`botToken` · `inboundSigningPlaintext`)를 받지 않는다.
 */
export const CONFIG_INTERNAL_FIELDS: readonly {
  readonly path: readonly string[];
  readonly hint: string;
}[] = [
  ...CHAT_CHANNEL_BLOCKED_FIELDS.map((field) => ({
    path: ['chatChannel', field],
    hint: CHAT_CHANNEL_HINT,
  })),
  {
    path: ['notification', 'signing', 'secretRef'],
    hint: NOTIFICATION_HINT,
  },
];

/** 위 경로를 `config.` 접두와 함께 나열한 문자열. DTO 설명이 같은 목록을 쓴다. */
export const CONFIG_INTERNAL_FIELD_PATHS: readonly string[] =
  CONFIG_INTERNAL_FIELDS.map(({ path }) => `config.${path.join('.')}`);

// `execution-engine/utils/to-record.ts` 의 `isRecord` 와 같은 구현이다. 모듈 경계를 넘는 import 를
// 피하려고 둔다.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPath(
  source: Record<string, unknown>,
  path: readonly string[],
): boolean {
  let node: unknown = source;
  for (const key of path) {
    if (!isRecord(node) || !Object.hasOwn(node, key)) return false;
    node = node[key];
  }
  return true;
}

/**
 * 요청 본문의 원시 `config` 에 서버가 소유하는 내부 필드가 실렸으면 400 으로 거부한다.
 *
 * 시크릿 참조(`botTokenRef` 등)는 서버가 자기 트리거 id 로 만들어 쓴다. 시크릿 저장소의 `resolve` ·
 * `rotate` 는 참조만 보고 소유 워크스페이스를 확인하지 않는다. 그래서 원시 `config` 로 다른 트리거의
 * 참조를 심으면 봇 토큰 재발급이 그 트리거의 비밀을 덮어썼다(NERV Task `CLE-T-M9QKKX`,
 * `test/trigger-config-internal-fields.e2e-spec.ts`). 평문 필드는 원시 `config` 에서 제거되지 않아
 * JSONB 에 남는다. 응답은 이 필드들을 지우므로 정상 클라이언트는 이 키를 보낼 일이 없다.
 *
 * 값이 무엇이든(자기 트리거의 참조여도) 거부한다. 메시지는 고정 문구이고 받은 값을 되돌려 싣지
 * 않는다. 생성 · 수정 모두 같은 규칙이다. 내부 필드가 여럿이면 `CONFIG_INTERNAL_FIELDS` 순서로 첫
 * 필드를 보고한다. `config` 가 객체가 아니면 아무것도 하지 않는다(형식은 DTO 의 `@IsObject` 가 본다).
 */
export function assertConfigCarriesNoInternalFields(config: unknown): void {
  if (!isRecord(config)) return;
  for (const { path, hint } of CONFIG_INTERNAL_FIELDS) {
    if (!hasPath(config, path)) continue;
    const field = `config.${path.join('.')}`;
    throwInvalidField(
      field,
      `${field} 는 서버가 관리하는 필드라 config 로 보낼 수 없습니다. ${hint}`,
    );
  }
}
