# 신규 식별자 충돌 검토 — chat-channel-spec-fix

검토 일시: 2026-05-22  
검토 대상 파일:
- `spec/5-system/15-chat-channel.md`
- `spec/5-system/14-external-interaction-api.md`
- `spec/conventions/chat-channel-adapter.md`
- `spec/4-nodes/7-trigger/providers/telegram.md`

---

## 발견사항

### [INFO] `languageHints.executionStillRunning` — namespace 내 신규 key, 충돌 없음
- target 신규 식별자: `languageHints.executionStillRunning`
- 기존 사용처: `spec/5-system/15-chat-channel.md` §CCH-CV-05, `spec/4-nodes/7-trigger/providers/telegram.md` §5.2, `spec/conventions/chat-channel-adapter.md` §6, `codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts`
- 상세: `languageHints` 는 `Record<string, string>` 으로 선언되어 있으며, 기존에 정의된 key 목록은 `groupChatRefusal`, `executionStarted`, `executionCompleted`, `executionFailed`, `executionCancelled`, `awaitingInput`, `buttonPrompt`, `unsupportedInteraction`, `help`, `formValidationFailed`, `formNextField`, `unsupportedMessageKind`. `executionStillRunning` 은 이 중 어느 것과도 중복되지 않는다. 코드베이스에도 해당 key 사용처가 없다.
- 제안: 충돌 없음. 단, `telegram-message.renderer.ts` 및 `hooks.service.ts` 에 `executionStillRunning` key 처리 로직이 아직 없으므로 구현 시 추가 필요 (spec 충돌 문제는 아님).

---

### [INFO] 에러 코드 `TRIGGER_NOT_FOUND` — 기존 codebase 와 동일 의미로 정의, 충돌 없음
- target 신규 식별자: `TRIGGER_NOT_FOUND` (chat-channel.md §5.4 신규 정의)
- 기존 사용처:
  - `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts:70` — 동일 의미로 이미 구현됨
  - `codebase/backend/src/modules/hooks/hooks.service.ts:90` — 동일 의미로 이미 구현됨
  - `codebase/backend/test/webhook-trigger.e2e-spec.ts:91` — 동일 코드로 테스트됨
- 상세: `spec/5-system/3-error-handling.md` 의 공식 에러 코드 카탈로그에는 `TRIGGER_NOT_FOUND` 가 없다 (`RESOURCE_NOT_FOUND` 만 존재). chat-channel.md §5.4 는 rotate-bot-token API 전용 문맥에서 `TRIGGER_NOT_FOUND` 를 신규 명시한다. 코드베이스에 이미 같은 이름·같은 의미로 사용되고 있으므로 충돌은 없지만, spec 에러 코드 카탈로그(3-error-handling.md)에는 아직 등재되지 않았다.
- 제안: 충돌 없음. `3-error-handling.md` 카탈로그에 `TRIGGER_NOT_FOUND` 추가를 별도 spec 정비 작업으로 추적하면 일관성 향상.

---

### [INFO] 에러 코드 `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN` — 기존 codebase 와 동일 의미, 충돌 없음
- target 신규 식별자: `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`
- 기존 사용처:
  - `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts:79,85` — 동일 이름·동일 의미
  - `codebase/backend/src/modules/hooks/hooks.service.ts:188` — `CHAT_CHANNEL_PROVIDER_UNKNOWN` 동일 이름
- 상세: spec 이 코드베이스의 기존 구현을 소급 명문화하는 것. 의미 충돌 없음.
- 제안: 충돌 없음.

---

### [INFO] 에러 코드 `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` — spec 신규, codebase 미구현, 충돌 없음
- target 신규 식별자: `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`
- 기존 사용처: spec 전체 및 codebase 전체에서 해당 식별자 미사용 (검색 결과 없음)
- 상세: `spec/5-system/3-error-handling.md` 카탈로그에도 없고 코드베이스에도 없다. 신규 rotate-bot-token API 의 예상 에러 코드로 처음 도입. `TOKEN_INVALID` (3-error-handling.md §1.2) 는 JWT/Bearer 토큰 검증 실패 코드이며, `BOT_TOKEN_INVALID` 는 Bot Father 토큰 형식 위반·Telegram API 401/403 의미이므로 의미적으로 분리되어 있다.
- 제안: 충돌 없음. `BOT_TOKEN_INVALID` 가 `TOKEN_INVALID` 와 prefix 공유하나 도메인이 다름 (Telegram bot vs JWT) — 혼동 가능성 낮음.

---

### [INFO] Rationale ID `R8` — 파일 내 로컬 번호, 문서 간 충돌 없음
- target 신규 식별자: `R8` (`spec/5-system/15-chat-channel.md` Rationale 섹션)
- 기존 사용처: 동일 파일 내 `R1`~`R7` 연속, `spec/5-system/14-external-interaction-api.md` 는 독자 `R1`~`R12` 체계, `spec/conventions/chat-channel-adapter.md` 는 독자 `R1`~`R4`, `spec/4-nodes/7-trigger/providers/telegram.md` 는 독자 `R1`~`R5`
- 상세: Rationale ID 는 파일 로컬 번호이며 문서 간 전역 고유성이 없다. R8 은 chat-channel.md 파일 내에서 R7 다음 순서로 자연스럽게 이어진다. 다른 파일의 R8 과 혼동될 여지는 참조 방식(파일명 포함 앵커)으로 해소된다.
- 제안: 충돌 없음.

---

### [INFO] Section ID `§3.3.1 EIA-AU-08 Implementation Note` — EIA spec 내 신규 하위 절, 충돌 없음
- target 신규 식별자: `§3.3.1` (`spec/5-system/14-external-interaction-api.md`)
- 기존 사용처: `§3.3` 은 기존 "인증" 절. 신규 `§3.3.1` 이 추가됨. `§3.4`, `§3.5` 등 기존 절과 번호 충돌 없음.
- 상세: 파일 내 절 번호 체계가 3.3 → 3.3.1 → 3.4 순으로 자연스럽게 유지된다. 다른 파일에 동일 절 번호 참조 패턴 없음.
- 제안: 충돌 없음.

---

### [WARNING] Section ID `§5.4` — chat-channel.md 와 eia spec 에 모두 존재, 크로스 참조 혼동 가능
- target 신규 식별자: `§5.4 Bot Token Rotation API 응답 계약` (`spec/5-system/15-chat-channel.md`)
- 기존 사용처: `spec/5-system/14-external-interaction-api.md:384` — `### 5.4 명시적 취소 — POST /api/external/executions/:executionId/cancel`
- 상세: 두 파일이 독립적으로 `§5.4` 절을 가진다. 문서가 다르므로 엄밀한 충돌은 아니지만, 두 spec 이 밀접하게 연관되어 있고 chat-channel.md 가 eia spec 을 여러 번 크로스 참조하는 구조에서, 독자가 맥락 없이 "§5.4" 단독 언급을 볼 때 어느 파일의 §5.4 인지 불명확해질 수 있다. 실제로 `spec/4-nodes/6-presentation/` 등 다수 파일이 `§5.4` 를 파일명 없이 약식으로 인용한다(단, 해당 맥락은 각 presentation node 파일 내 로컬 §5.4).
- 제안: 위험도는 낮으나, chat-channel.md §5.4 를 크로스 참조할 때 반드시 파일명(`[chat-channel §5.4](./15-chat-channel.md#54-...)`) 형식으로 명시하여 혼동을 방지할 것.

---

### [INFO] Type 이름 `ExternalInteractionRequestContext`, `InternalInteractionRequestContext`, `InteractionScope` — v2 권고사항, 현재 코드와 충돌 없음
- target 신규 식별자: `ExternalInteractionRequestContext`, `InternalInteractionRequestContext` (eia spec §3.3.1 권고), `InteractionScope` (기존 코드베이스에 이미 존재)
- 기존 사용처:
  - `codebase/backend/src/modules/external-interaction/interaction.guard.ts:35` — `InteractionScope` 이미 `export type` 으로 정의됨
  - `codebase/backend/src/modules/external-interaction/interaction.guard.ts:37` — `InteractionRequestContext` 단일 interface 로 정의됨
  - `plan/complete/chat-channel-impl.md:259` — `InteractionScope` 동일 이름·동일 의미로 plan 에도 등장
  - `plan/in-progress/spec-fix-chat-channel-security.md:59,60` — `ExternalInteractionRequestContext`, `InternalInteractionRequestContext` 이름을 동일하게 선언
- 상세: `InteractionScope` 는 codebase 에 이미 동일 이름·동일 의미로 존재하므로 spec 이 소급 명문화하는 것이다. `ExternalInteractionRequestContext` / `InternalInteractionRequestContext` 는 v2 이후 권고로 표시되어 있으며 현재 codebase 에는 없다. plan/in-progress 파일과도 동일 명칭을 사용하여 일관성 있음.
- 제안: 충돌 없음.

---

### [INFO] Plan 이름 `spec-update-chat-channel-bot-token-stub`, `spec-fix-eia-au-08-type-split`, `spec-fix-form-phone-validation`, `chat-channel-dispatcher-split` — 동명 파일 없음
- target 신규 식별자: 위 4개 plan 파일명 (spec 내 후속 추적 언급)
- 기존 사용처: `plan/in-progress/` 및 `plan/complete/` 전체 탐색 결과 동명 파일 없음
- 상세:
  - `plan/in-progress/` 에 `spec-fix-chat-channel-arch.md`, `spec-fix-chat-channel-behavior.md`, `spec-fix-chat-channel-security.md` 존재. 언급된 4개 이름은 이들과 겹치지 않는다.
  - `plan/complete/` 에도 동명 파일 없음.
- 제안: 충돌 없음.

---

## 요약

검토한 7개 신규 식별자 군(languageHints key, 에러 코드 5종, Rationale ID, Section ID 2종, Type 이름 3종, Plan 이름 4종) 모두 기존 사용처와 의미 충돌이 없다. 단 하나의 WARNING 이 발견되었다: `§5.4` 절 번호가 `spec/5-system/14-external-interaction-api.md` (명시적 취소 API) 와 `spec/5-system/15-chat-channel.md` (Bot Token Rotation 응답 계약) 에 각각 독립적으로 존재하며, 두 spec 이 상호 밀접하게 연관된 상황에서 크로스 참조 시 혼동 가능성이 있다. 에러 코드 `TRIGGER_NOT_FOUND` 는 코드베이스에 이미 존재하지만 `spec/5-system/3-error-handling.md` 공식 카탈로그에 미등재 상태이므로 별도 정비를 권장한다. 전반적으로 식별자 충돌 위험은 낮다.

## 위험도

LOW

STATUS: WARNING
