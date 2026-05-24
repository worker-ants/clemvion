# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] DTO 형식 검증과 서비스 비즈니스 검증의 책임 경계가 의도적으로 분리되어 있으나, 분리 근거 문서화가 DTO 주석에만 편중되어 있음
- 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` L28–30, `triggers.service.ts` L222–224
- 상세: DTO 주석과 서비스 주석 양쪽 모두 "형식 검증은 service 단에서 수행 (provider 정보가 있어야 분기 가능)"이라는 이유를 기재하고 있다. 이는 올바른 설계 결정이다 — provider-contextual 검증(`^[a-f0-9]{32}$` vs `^[a-f0-9]{64}$`)은 provider 값을 알아야 하므로 cross-field 검증이 필요하고, NestJS DTO 단의 class-validator는 단일 필드 단위라 cross-field 분기가 어색하다. 단, DTO 의 `@ApiPropertyOptional`에 `minLength: 32`가 설정되어 있는데, Discord의 최소값은 64다. 이 minLength 는 Slack 기준으로만 정확하다 — 서비스 단에서 재검증되므로 런타임 오류는 없지만, Swagger 문서에서 Discord 사용자에게 "minLength: 32"를 보여줘 혼란을 줄 수 있다.
- 제안: `minLength` 를 Swagger 메타에서 제거하거나, 주석에 "Swagger minLength 는 Slack 기준 최솟값 — Discord 는 64 (service 단 재검증)"임을 명시한다.

---

### [WARNING] `tryRevokeOldBotToken` — 어댑터 인터페이스 우회 캐스트로 인한 개방-폐쇄 원칙(OCP) 위반
- 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` L901–929
- 상세: Slack auth revoke 를 수행할 때 `TriggersService` 가 `SlackAdapter` 의 내부 `client.authRevoke` 를 `as unknown as { client?: { authRevoke? } }` 로 강제 캐스팅해 호출한다. 이는 `ChatChannelAdapter` 인터페이스를 우회하는 구조다. 메서드 자체의 주석도 "향후 adapter 에 `revokeBotToken(token)` 옵션 함수를 추가하면 더 깔끔"이라고 인정하고 있다. 결과적으로 새 provider 가 추가될 때 이 메서드의 `if (config.provider !== 'slack') return;` 분기를 `TriggersService` 에서 직접 확장해야 하며, adapter 를 추가해도 이 메서드는 건드려야 한다. OCP(확장에 열리고 수정에 닫힘) 와 의존성 역전(DIP) 모두 어긋난다.
- 제안: `ChatChannelAdapter` 인터페이스에 `revokeBotToken?(token: string): Promise<void>` 옵션 메서드를 추가한다. `TriggersService.tryRevokeOldBotToken` 은 `adapter.revokeBotToken` 존재 여부만 체크해 호출하면 된다. Slack 만 구현하고 나머지는 미구현(optional)으로 두면 현재 동작과 동일하면서도 인터페이스가 보존된다.

---

### [WARNING] `setupChatChannel` 내 `inboundSigningPlaintext` 접근 시 중복 타입 캐스트
- 위치: `triggers.service.ts` L461–494
- 상세: `chatChannelCfg` 는 이미 `ChatChannelConfigDto` 타입으로 선언되어 있고, `inboundSigningPlaintext` 가 해당 DTO 에 정식 필드로 추가되었음에도, 두 곳에서 `as ChatChannelConfigDto & { inboundSigningPlaintext?: string }` 캐스트를 반복한다. DTO 에 이미 선언된 필드를 다시 intersection-cast 하는 것은 코드 중복이자 타입 신뢰도를 낮춘다.
- 제안: `chatChannelCfg.inboundSigningPlaintext` 를 캐스트 없이 직접 참조한다. 같은 이유로 L461 의 `(chatChannelCfg as ChatChannelConfig & { botToken?: string }).botToken` 도 `chatChannelCfg.botToken` 으로 직접 접근 가능하다.

---

### [INFO] `mergeExternalConfig` — chatChannel DTO 가 config JSONB 에 그대로 직렬화되는 경로 존재
- 위치: `triggers.service.ts` L414–425
- 상세: `mergeExternalConfig` 는 `chatChannel: ChatChannelConfigDto` 객체를 `next.chatChannel` 에 바로 할당한다. 이후 `setupChatChannel` 이 `inboundSigningPlaintext`, `botToken` plaintext 를 strip 하고 ref 로 교체하지만, `setupChatChannel` 이 호출되지 않는 경우(예: `chatChannel` 이 있으나 adapter 가 미등록인 경우)에는 `inboundSigningPlaintext` 가 DB JSONB 에 그대로 기록될 수 있다. L436–441 의 adapter 미등록 early-return 이후 `triggerRepository.update` 가 없으므로 `mergeExternalConfig` 결과의 config 가 saved entity 에 plaintext 와 함께 남는다.
- 제안: `mergeExternalConfig` 또는 `create`/`update` 직후 plaintext 필드(`botToken`, `inboundSigningPlaintext`)를 무조건 strip 하는 sanitize 단계를 두거나, DB 저장 전 반드시 sanitize 된 config 만 persist 하도록 보장한다. `setupChatChannel` 의 성공/실패/skip 경로 모두에서 plaintext 가 DB 에 쓰이지 않음을 명시적으로 보장해야 한다.

---

### [INFO] 이중 검증 (DTO `@IsEmpty` + `assertChatChannelInputSafe`) — 레이어 중복
- 위치: `chat-channel-config.dto.ts` L159–163, `triggers.service.ts` L226–255
- 상세: `inboundSigning`, `botTokenRef`, `inboundSigningRef` 는 DTO 에서 `@IsEmpty` 로 이미 400 을 반환한다. `assertChatChannelInputSafe` 는 동일 조건을 다시 확인한다. 두 레이어가 동일한 오류를 중복 방어하고 있다. 이는 "spec 의 VALIDATION_ERROR envelope 정합" 때문이라고 주석에 명시되어 있으나, NestJS global exception filter 를 통해 DTO 오류도 동일 envelope 로 변환할 수 있다.
- 제안: 단기적으로는 현 이중 방어 구조를 유지해도 무방하다. 단, 중기적으로는 global validation-error filter 가 DTO 오류를 spec-compliant envelope 로 변환하도록 통일해 service 단의 중복 guard 를 제거한다.

---

### [INFO] `ai-agent.handler.ts` — `capFormDataBytes` / `FORM_SUBMITTED_MAX_BYTES` 제거 (spec §12.7 삭제)
- 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- 상세: 이번 변경에서 formData byte cap 로직이 완전히 제거되었다. 제거 자체의 아키텍처 정합성은 문제없다 — spec 변경을 따른 제거이며, 해당 함수의 책임이 단일하고 명확했기 때문에 제거도 깔끔하다. 단, 제거된 코드가 spec §12.7 기반이었다면 spec 에서 해당 절이 폐기되었는지 확인이 필요하다. 구현 삭제와 spec 갱신이 동기화되었는지 별도 확인 권장.
- 제안: spec/4-nodes/3-ai/1-ai-agent.md §12.7 이 폐기되었음을 명시적으로 확인하고, spec 에 삭제 근거 Rationale 이 기재되어 있는지 검토한다.

---

### [INFO] `chat-channel-discord.e2e-spec.ts` — `ownerEmailVerified=false` 인가 모델 회귀 테스트 제거
- 위치: `codebase/backend/test/chat-channel-discord.e2e-spec.ts` L377–400 (삭제됨)
- 상세: "inbound webhook 은 owner.emailVerified 와 무관" 불변식을 검증하던 테스트가 제거되었다. 픽스처에서 `ownerEmailVerified` 옵션이 제거되면서 테스트 자체가 불가능해진 것으로 보인다. 해당 인가 불변식이 여전히 요구사항이라면, 픽스처 없이도 다른 방식으로 커버해야 한다.
- 제안: 인가 불변식이 폐기된 것인지(spec 변경), 아니면 픽스처 리팩터링의 부수 효과로 테스트가 소실된 것인지 명확히 한다. 불변식이 유효하다면 픽스처 의존 없이 독립적으로 테스트할 수 있는 방법을 마련한다.

---

### [INFO] 프론트엔드 클라이언트 사이드 inboundSigningPlaintext 검증 중복 — 서비스 레이어와 동일 정규식
- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` L281–290
- 상세: 프론트엔드가 `/^[a-f0-9]{32}$/i` (Slack) / `/^[a-f0-9]{64}$/i` (Discord) 정규식을 직접 인라인으로 정의해 클라이언트 사이드 검증을 수행한다. 동일 정규식이 backend `assertInboundSigningPlaintextByProvider` 에도 존재한다. 이는 단순 UX 친화 중복이고 의도된 것이지만, 두 정규식이 다를 경우 일관성이 깨질 수 있다.
- 제안: 장기적으로는 공유 패키지(`packages/`) 에 provider 스키마 상수를 두어 프론트엔드와 백엔드가 동일 소스에서 import 하도록 한다. 단기적으로는 현 인라인 방식에 SoT 주석을 추가해 backend 정규식과 동기화되어야 함을 명시한다.

---

## 요약

이번 변경의 핵심 아키텍처 결정 — DTO 는 형식·타입 상한만, service 는 provider-contextual 비즈니스 검증과 plaintext-to-secret-store 흐름 담당 — 은 레이어 책임 분리 원칙에 부합한다. `inboundSigningRef` 단일 슬롯을 provider 무관하게 공유하고 검증 알고리즘 분기를 backend 책임으로 위임한 설계(R-S-1 정합)도 적절하다. 그러나 `tryRevokeOldBotToken` 의 adapter 인터페이스 우회 캐스트는 현재 provider 분기 로직이 `TriggersService` 에 직접 하드코딩되어 있어, 4번째 provider 추가 시 service 수정 없이는 revoke 지원이 불가능한 OCP 위반이다. 또한 adapter 미등록 경로에서 plaintext가 DB에 잔류할 수 있는 경로가 잠재적 보안 주의 사항으로 남아 있다. 나머지 사항들은 타입 캐스트 중복·Swagger 메타 불일치·테스트 소실 등 정합성 수준의 문제다.

## 위험도

MEDIUM
