import { buildSecretRef } from '../secret-store/secret-ref';
import type { ChatChannelConfig } from './types';

// 근거: [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙)

/** `config.chatChannel` 의 시크릿 참조 필드와 그 참조의 이름. */
const SECRET_REF_NAMES = {
  botTokenRef: 'bot-token',
  inboundSigningRef: 'inbound-signing',
} as const;

export type ChatChannelSecretRefField = keyof typeof SECRET_REF_NAMES;

const SECRET_REF_FIELDS = Object.keys(
  SECRET_REF_NAMES,
) as ChatChannelSecretRefField[];

/**
 * 트리거 id 로 `config.chatChannel` 의 시크릿 참조를 만든다. 이 두 참조를 만드는 곳은 여기 하나다
 * (바인더의 최초 설정, 봇 토큰 재발급, 아래 읽기 관문).
 */
export function chatChannelSecretRef(
  triggerId: string,
  field: ChatChannelSecretRefField,
): string {
  return buildSecretRef({
    scope: 'triggers',
    resourceId: triggerId,
    name: SECRET_REF_NAMES[field],
  });
}

/**
 * 저장된 `config.chatChannel` 의 시크릿 참조를 이 트리거의 참조로 맞춘 사본을 돌려준다.
 *
 * 참조 필드는 있음 · 없음만 저장값에서 읽고 값은 트리거 id 로 다시 만든다. 시크릿 저장소의 `resolve`
 * 는 참조만 보고 어느 리소스의 비밀인지 확인하지 않는다. 그래서 요청 본문 거부(NERV Task
 * `CLE-T-M9QKKX`) 전에 저장된 행이 다른 트리거의 참조를 가리키면 그 비밀로 발송 · 서명 검증 · 해제를
 * 하게 된다(NERV Task `CLE-T-XYR067`). 비교는 접두가 아니라 다시 만든 참조와의 정확 일치다.
 *
 * 없는 참조는 붙이지 않는다. 인바운드 인증기는 `inboundSigningRef` 가 없으면 검증을 건너뛰므로 붙이면
 * 그 동작이 바뀐다(`chat-channel-binder.service.ts` 의 [ref 보존] 주석). 있는 참조를 지우지도 않는다.
 * 지우면 같은 이유로 검증이 열린다. 자기 비밀이 없으면 `resolve` 가 실패해 발송 실패 · 인바운드 401 로
 * 닫힌다.
 *
 * 저장값이 다시 만든 참조와 다르면 오류 로그를 남긴다. 저장값은 싣지 않는다. 참조 자리에 평문이
 * 들어 있을 수 있어서다. 정상 행은 같은 규칙으로 만든 값이라 결과가 같고 로그도 없다.
 *
 * @param caller 로그에 남길 호출 위치.
 */
export function pinChatChannelSecretRefs(
  triggerId: string,
  config: ChatChannelConfig,
  logger: { error(message: string): void },
  caller: string,
): ChatChannelConfig {
  const pinned: ChatChannelConfig = { ...config };
  for (const field of SECRET_REF_FIELDS) {
    const stored: unknown = config[field];
    if (!stored) continue;
    const own = chatChannelSecretRef(triggerId, field);
    if (stored === own) continue;
    logger.error(
      `${caller}: 트리거 ${triggerId} 의 저장된 chatChannel.${field} 가 이 트리거의 참조와 달라 ${own} 로 바꿔 씁니다. 저장된 행을 점검하세요.`,
    );
    pinned[field] = own;
  }
  return pinned;
}

/**
 * 트리거 행의 `config.chatChannel` 을 어댑터에 넘길 모양으로 읽는다. 저장된 채팅 채널 설정을 읽어
 * 어댑터 · 인바운드 인증기에 넘기는 곳은 모두 이 함수를 거친다(아웃바운드 dispatcher, 인바운드
 * hooks, 트리거 삭제의 해제). `provider` 가 없으면 채팅 채널이 아니라고 보고 `null` 이다.
 */
export function readTriggerChatChannelConfig(
  trigger: { id: string; config: unknown },
  logger: { error(message: string): void },
  caller: string,
): ChatChannelConfig | null {
  const { config } = trigger;
  if (!config || typeof config !== 'object') return null;
  const chatChannel = (config as { chatChannel?: unknown }).chatChannel;
  if (!chatChannel || typeof chatChannel !== 'object') return null;
  const provider = (chatChannel as { provider?: unknown }).provider;
  if (typeof provider !== 'string' || provider.length === 0) return null;
  return pinChatChannelSecretRefs(
    trigger.id,
    chatChannel as ChatChannelConfig,
    logger,
    caller,
  );
}
