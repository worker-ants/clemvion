/**
 * Node 22 + undici fetch — IPv6 broken route 시 IPv4 fallback (Happy Eyeballs, RFC 8305) 활성.
 *
 * 배경: Node 22 의 built-in fetch 가 사용하는 undici Agent 의 default 가 단일 family
 * (보통 OS 가 선택한 IPv6 우선) 사용. DNS 가 AAAA 와 A 둘 다 반환할 때 IPv6 routing
 * 이 broken (ISP / 컨테이너 네트워크 / VPN 등에서 흔함) 이면 약 30초 후 syscall
 * `ETIMEDOUT` 으로 fail. 자동 IPv4 retry 없음.
 *
 * 해결: process boot 시 1회 `setGlobalDispatcher(new Agent({ autoSelectFamily: true,
 * autoSelectFamilyAttemptTimeout: 300 }))` 로 교체. 모든 outbound fetch (TelegramClient
 * / SlackClient / DiscordClient / LLM clients / HTTP node handler / cafe24 client 등)
 * 가 자동 영향 — 어댑터별 dispatcher 주입 불필요.
 *
 * 영향 범위 — 본 글로벌 설정은 다음 모든 outbound 경로에 적용:
 *   - codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts
 *   - codebase/backend/src/modules/chat-channel/providers/slack/slack-client.ts
 *   - codebase/backend/src/modules/chat-channel/providers/discord/discord-client.ts
 *   - codebase/backend/src/nodes/integration/http-request/http-request.handler.ts
 *   - codebase/backend/src/nodes/integration/send-email/send-email.handler.ts
 *   - codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts
 *   - codebase/backend/src/nodes/ai/ai-agent/* (LLM provider SDK 가 fetch 사용 시)
 *   - 기타 process 안의 모든 `globalThis.fetch` / `undici.fetch` 호출
 *
 * idempotent: 본 함수는 module-level side-effect 로 1회 실행. 중복 호출 시에도 같은
 * Agent 설정이라 무해 (Reference: 본 fix 의 SoT 커뮤니티 보고 — "idempotence on
 * repeated equal decisions").
 *
 * 비활성화: `DISABLE_UNDICI_AUTO_SELECT_FAMILY=1` 환경변수로 끌 수 있다 — 디버깅 또는
 * 테스트 격리 용도.
 */
import { Agent, setGlobalDispatcher } from 'undici';

const DEFAULT_ATTEMPT_TIMEOUT_MS = 300;

let applied = false;

export function applyAutoSelectFamilyDispatcher(): void {
  if (applied) return;
  if (process.env.DISABLE_UNDICI_AUTO_SELECT_FAMILY === '1') {
    applied = true;
    return;
  }
  const agent = new Agent({
    autoSelectFamily: true,
    autoSelectFamilyAttemptTimeout: DEFAULT_ATTEMPT_TIMEOUT_MS,
  });
  setGlobalDispatcher(agent);
  applied = true;
}

/** Test-only — 다른 dispatcher 설정 case 검증 위해 applied flag 리셋. */
export function resetAppliedForTesting(): void {
  applied = false;
}

// process boot 시 module-level 자동 적용. main.ts 가 instrumentation 직후 import.
applyAutoSelectFamilyDispatcher();
