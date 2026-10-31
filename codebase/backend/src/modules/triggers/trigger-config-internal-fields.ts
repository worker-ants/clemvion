import { throwInvalidField } from './chat-channel-input-rules';
import { CHAT_CHANNEL_BLOCKED_FIELDS } from './chat-channel-rejection-messages.const';

// 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)
// 근거: [트리거 관리 「PATCH 본문 계약」](CLE-TRIG-MANAGE#patch-본문-계약)
// 근거: [채팅 채널 「봇 토큰 변경 단일 경로」](CLE-CHAT-CORE#봇-토큰-변경-단일-경로)
// 위 세 곳의 해당 조항: 시크릿 저장소 규칙 23 · 트리거 관리 REQ-TRIG-053 · 채팅 채널 `details.field` 표 셋째 행.
// 타입 키 · `secret://` 값 거부는 원시 `config` 계약을 정한 NERV Task `CLE-T-EA7B5M` 의 사용자 결정(2026-10-31)이다.

/** 거부 메시지 뒤에 붙는 안내. 받은 값은 싣지 않는다. */
const CHAT_CHANNEL_HINT =
  '채팅 채널은 요청 본문의 chatChannel 로 설정하세요. 봇 토큰은 POST /api/triggers/:id/chat-channel/rotate-bot-token 으로만 바꿉니다.';

const NOTIFICATION_HINT =
  '알림 서명 시크릿은 POST /api/triggers/:id/notification/rotate-secret 으로만 바꿉니다.';

const INTERACTION_TOKEN_HINT =
  '트리거 단위 토큰은 서버가 발급하고 POST /api/triggers/:id/interaction/revoke-token 으로만 바꿉니다.';

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
  // 트리거 단위 토큰(`itk_*`)은 서버가 만든 값이다. 원시 `config` 로 심으면 그 값이 인터랙션 가드를 통과하는 토큰이
  // 된다(NERV Task `CLE-T-EQDYC1`). 저장된 토큰은 PATCH 가 서버 쪽에서 이어받는다(`TriggersService` 의 토큰 정리).
  {
    path: ['interaction', 'triggerToken'],
    hint: INTERACTION_TOKEN_HINT,
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

/**
 * 원시 `config` 바로 아래에 오면 거부하는 타입 키. 이 세 설정은 요청 본문의 최상위 타입 필드로만 받는다.
 *
 * 타입 필드는 DTO 검증 · 알림 URL 검사 · 채널 붙이기와 `provider` 변경 거부 · 서버가 만드는 값의 판정을 거친다.
 * 원시 `config` 는 `@IsObject` 뿐이라 같은 키를 받으면 그 검사를 모두 건너뛴다.
 *
 * 이 목록은 생성 · 수정 DTO 에서 `@ValidateNested` 로 검증하는 필드와 같은 집합이어야 한다. 한쪽만 늘면 원시 `config`
 * 우회가 다시 열리므로 `trigger-config-internal-fields.spec.ts` 가 두 DTO 의 메타데이터와 이 목록을 대조한다.
 */
export const RAW_CONFIG_TYPED_KEYS = [
  'notification',
  'interaction',
  'chatChannel',
] as const;

const SECRET_REF_PREFIX = 'secret://';

/** 원시 `config` 의 거부 규칙을 한 문장으로 적은 것. 생성 · 수정 DTO 의 `config` 설명이 같은 문장을 쓴다. */
export const RAW_CONFIG_REJECTION_SUMMARY =
  `서버가 관리하는 시크릿 참조 · 평문 필드(${CONFIG_INTERNAL_FIELD_PATHS.join(', ')})를 실으면 400 VALIDATION_ERROR 로 거부한다. ` +
  `${RAW_CONFIG_TYPED_KEYS.join(' · ')} 키는 값과 상관없이 400 이다. 이 설정은 요청 본문의 최상위 필드로 보낸다. ` +
  `어느 위치든 ${SECRET_REF_PREFIX} 로 시작하는 문자열 값도 400 이다.`;

/**
 * 거부 응답의 `details` 형식을 적은 문장. 생성 · 수정 컨트롤러의 400 설명이 같은 문장을 쓴다.
 * 거부 규칙({@link RAW_CONFIG_REJECTION_SUMMARY})과 함께 한 곳에서만 고친다.
 */
export const RAW_CONFIG_REJECTION_FIELD_NOTE =
  '거부 응답의 details 는 단일 object 이고 field 는 거부한 위치의 원시 config 경로다. ' +
  '내부 필드는 "config.chatChannel.botTokenRef", 타입 키는 "config.<키>", ' +
  `${SECRET_REF_PREFIX} 값은 그 값의 경로이며 배열 원소는 "config.custom.refs[1]" 형식이다.`;

/**
 * PATCH 의 원시 `config` 병합 규칙을 적은 문장. 수정 DTO 의 `config` 설명과 컨트롤러의 PATCH 설명이 같은 문장을 쓴다.
 * 동작의 정본은 `TriggersService.mergeRawConfig` 이다.
 *
 * `config` 자체가 `null` 인 입력은 DTO 가 통과시킨다(`@IsOptional`). 종전에도 «보내지 않음» 으로 처리했으므로
 * 그 동작을 유지한다.
 */
export const RAW_CONFIG_MERGE_SUMMARY =
  '저장된 config 위에 최상위 키 단위로 병합한다. 보낸 키는 그 값으로 바꾸고(키 아래는 병합하지 않는다) 보내지 않은 키는 두며 값이 null 인 키는 지운다. ' +
  'config 자체가 null 이면 보내지 않은 것으로 본다. ' +
  `${RAW_CONFIG_TYPED_KEYS.join(' · ')} 은 config 로 받지 않으므로 config 만 보낸 PATCH 는 그 설정을 바꾸지 않는다. ` +
  `조회 응답의 config 에는 저장된 ${RAW_CONFIG_TYPED_KEYS.join(' · ')} 이 들어 있으므로 응답의 config 를 그대로 되보내면 400 이다.`;

/**
 * 원시 `config` 아래에서 `secret://` 로 시작하는 첫 문자열 값의 경로를 찾는다. 없으면 `null` 이다.
 *
 * 키 순서대로 깊이 우선으로 본다. 경로는 점으로 잇고 배열 원소는 `[<index>]` 로 적는다(`config.custom.refs[1]`).
 * 요청 본문은 깊이에 상한이 없으므로 재귀 대신 명시적 스택을 쓴다. 재귀로 돌면 깊은 본문이 `RangeError` 로 500 이 된다.
 */
function findSecretRefPath(config: Record<string, unknown>): string | null {
  const stack: { value: unknown; path: string }[] = [
    { value: config, path: 'config' },
  ];
  while (stack.length > 0) {
    const { value, path } = stack.pop()!;
    if (typeof value === 'string') {
      if (value.startsWith(SECRET_REF_PREFIX)) return path;
      continue;
    }
    // 스택이라 뒤에서부터 넣어야 앞 원소를 먼저 꺼낸다.
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) {
        stack.push({ value: value[i], path: `${path}[${i}]` });
      }
    } else if (isRecord(value)) {
      const entries = Object.entries(value);
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        stack.push({ value: entries[i][1], path: `${path}.${entries[i][0]}` });
      }
    }
  }
  return null;
}

/**
 * 요청 본문의 원시 `config` 를 받을 수 있는지 보고 아니면 400 으로 거부한다. 생성 · 수정 모두 같은 규칙이다.
 *
 * 세 검사를 이 순서로 돌고 첫 위반 하나만 보고한다. 응답은 모두 `VALIDATION_ERROR` 와 단일 object
 * `details: { field: 'config.<경로>', code: 'INVALID_FIELD' }` 다.
 *
 * 1. 내부 필드({@link assertConfigCarriesNoInternalFields}). 먼저 돌아 기존 거부의 `details.field` 가 바뀌지 않는다.
 * 2. 타입 키({@link RAW_CONFIG_TYPED_KEYS}). 값이 `null` 이어도 키가 있으면 거부한다.
 * 3. `secret://` 로 시작하는 문자열 값. 키 이름과 위치는 보지 않는다. 시크릿 참조는 서버가 리소스 id 로 만든다.
 *    경로 목록(1)은 사람이 더해야 하므로 새 참조 슬롯을 놓칠 수 있다. 값 검사는 그 슬롯 이름과 상관없이 잡는다.
 *
 * 메시지는 고정 문구이고 받은 값을 되돌려 싣지 않는다. `config` 가 객체가 아니면 아무것도 하지 않는다.
 */
export function assertRawConfigAccepted(config: unknown): void {
  if (!isRecord(config)) return;
  assertConfigCarriesNoInternalFields(config);
  for (const key of RAW_CONFIG_TYPED_KEYS) {
    if (!Object.hasOwn(config, key)) continue;
    const field = `config.${key}`;
    throwInvalidField(
      field,
      `${field} 는 config 로 보낼 수 없습니다. 요청 본문의 최상위 ${key} 로 보내세요.`,
    );
  }
  const secretRefPath = findSecretRefPath(config);
  if (secretRefPath !== null) {
    throwInvalidField(
      secretRefPath,
      `${secretRefPath} 에 시크릿 참조(${SECRET_REF_PREFIX}…)를 실을 수 없습니다. 시크릿 참조는 서버가 만들고 관리합니다.`,
    );
  }
}
