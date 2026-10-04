import { BadRequestException } from '@nestjs/common';

import { ErrorCode } from '../../nodes/core/error-codes';
import { CHAT_CHANNEL_BLOCKED_FIELDS } from './chat-channel-rejection-messages.const';

// 근거: [시크릿 저장소 규칙 23](CLE-INT-SECRET), [트리거 관리 REQ-TRIG-053](CLE-TRIG-MANAGE),
// [채팅 채널 「봇 토큰 변경 단일 경로」 의 `details.field` 표](CLE-CHAT-CORE).

const CHAT_CHANNEL_MESSAGE =
  '채팅 채널은 요청 본문의 chatChannel 로 설정하세요. 봇 토큰은 POST /api/triggers/:id/chat-channel/rotate-bot-token 으로만 바꿉니다.';

const NOTIFICATION_MESSAGE =
  '알림 서명 비밀은 POST /api/triggers/:id/notification/rotate-secret 으로만 바꿉니다.';

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
    hint: CHAT_CHANNEL_MESSAGE,
  })),
  {
    path: ['notification', 'signing', 'secretRef'],
    hint: NOTIFICATION_MESSAGE,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPath(source: Record<string, unknown>, path: readonly string[]) {
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
 * 시크릿 참조(`botTokenRef` 등)는 서버가 자기 트리거 id 로 만들어 쓴다. 비밀 저장소의 `resolve` ·
 * `rotate` 는 참조만 보고 소유 워크스페이스를 확인하지 않는다. 그래서 원시 `config` 로 다른 트리거의
 * 참조를 심으면 봇 토큰 재발급이 그 트리거의 비밀을 덮어썼다(NERV Task `CLE-T-M9QKKX`,
 * `test/trigger-config-internal-fields.e2e-spec.ts`). 평문 필드는 원시 `config` 에서 제거되지 않아
 * JSONB 에 남는다. 응답은 이 필드들을 지우므로 정상 클라이언트는 이 키를 보낼 일이 없다.
 *
 * 값이 무엇이든(자기 트리거의 참조여도) 거부한다. 메시지는 고정 문구이고 받은 값을 되돌려 싣지
 * 않는다. 생성 · 수정 모두 같은 규칙이다. `config` 가 없으면 아무것도 하지 않는다.
 */
export function assertConfigCarriesNoInternalFields(config: unknown): void {
  if (!isRecord(config)) return;
  for (const { path, hint } of CONFIG_INTERNAL_FIELDS) {
    if (!hasPath(config, path)) continue;
    const field = `config.${path.join('.')}`;
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `${field} 는 서버가 관리하는 필드라 config 로 보낼 수 없습니다. ${hint}`,
      details: { field, code: ErrorCode.INVALID_FIELD },
    });
  }
}
