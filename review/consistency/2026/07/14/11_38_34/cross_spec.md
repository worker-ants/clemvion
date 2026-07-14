# Cross-Spec 일관성 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 검토 범위

- target 영역: `spec/5-system/4-execution-engine.md` (§7.5.1 nodeId 불일치 검증 확장 — F-1/F-6, plan `eia-command-waiting-surface-guard`)
- 구현 diff: `execution-engine.service.ts`(`expectedNodeId` 신설) · `interaction.service.ts`(`assertNodeId` scope-aware 면제) · `hooks.service.ts`(F-2 surfaceMismatch 안내 + F-4 `sendBestEffortNotice` 리팩터) · `websocket.gateway.ts`(F-6 forwarding) · `chat-channel-config.dto.ts`(F-5 telegram raw-send MarkdownV2 검증) · 신규 `chat-channel/shared/markdown-v2.ts`
- 교차 대조한 spec: `spec/5-system/4-execution-engine.md §7.5.1/§Rationale`, `spec/5-system/14-external-interaction-api.md §5.1/§R5/§R10`, `spec/5-system/6-websocket-protocol.md §4.2`, `spec/5-system/15-chat-channel.md §4.1/§4.1.1`, `spec/1-data-model.md §2.8 Trigger`, `spec/0-overview.md`, `spec/conventions/error-codes.md`, 관련 frontend(`use-execution-interaction-commands.ts`) 및 backend(`interaction.guard.ts`)

## 발견사항

교차 영역 충돌은 발견되지 않았다. 확인한 세부 사항은 다음과 같다.

- **nodeId 검사 진입점 커버리지 표 (execution-engine §7.5.1)** — diff 가 구현한 4개 진입점(EIA REST `/interact` 적용, chat-channel `in_process_trusted` scope 단위 면제, WS continuation 제공 시 적용/미제공 시 skip, REST `/continue` 미적용)이 spec 표(§7.5.1 nodeId 검사 진입점별 커버리지)와 정확히 1:1 대응한다. `interaction.service.ts` 의 `isInternalCtx(ctx) ? undefined : dto.nodeId` 분기, `hooks.service.ts` 의 `forwardToInteractionService`/`handleFormStep` 양쪽이 동일 `in_process_trusted` scope 를 쓰는 점(스코프 단위 면제, 진입점별 아님) 모두 spec 서술과 일치.
- **EIA REST 계약 (`14-external-interaction-api.md §5.1`)** — `409 STATE_MISMATCH` 사유에 "nodeId 불일치" 가 이미 명시돼 있고, "**nodeId=2026-07-14**" 로 구현-계약 정합 완료 시점이 오늘 날짜로 기록돼 있어 diff 와 spec 갱신이 같은 시점의 짝 변경임을 확인. `interaction.service.spec.ts` 의 `dto.nodeId` → `expectedNodeId` 전달 테스트가 이 표와 부합.
- **WS 프로토콜 (`6-websocket-protocol.md §4.2`)** — `execution.click_button` 의 `nodeId` 가 optional 필드이며 "frontend 는 click_button 에 nodeId 를 싣지 않아 실질 no-op" 이라는 서술을 실제 프런트 코드(`use-execution-interaction-commands.ts`)로 재확인 — `clickButton` 은 `buttonId` 만, `sendMessage`/`endConversation` 은 `nodeId` 를 포함해 emit. `websocket.gateway.spec.ts` F-6 테스트(`handleClickButton` → `undefined` 전달)와 일치.
- **chat-channel spec (`15-chat-channel.md §4.1.1`)** — `surfaceMismatch` KO/EN default 문구, MarkdownV2-safe 설계 근거(punctuation 회피), F-5 telegram raw-send 검증 대상 7개 키(`help`/`groupChatRefusal`/`unsupportedMessageKind`/`executionStillRunning`/`surfaceMismatch`/`formValidationFailed`/`formNextField`) 목록이 diff 의 `TELEGRAM_RAW_SEND_HINT_KEYS` 상수·`language-hint-defaults.ts` 의 `SURFACE_MISMATCH_DEFAULTS` 와 완전히 일치.
- **데이터 모델 (`1-data-model.md §2.8 Trigger`)** — `Trigger.config.chatChannel` 필드는 `15-chat-channel.md` 를 참조만 하고 자체 필드를 재정의하지 않아 이번 `languageHints.surfaceMismatch` 신규 키 추가와 충돌 없음.
- **계층 책임** — `triggers/dto/chat-channel-config.dto.ts` 가 `chat-channel/shared/markdown-v2.ts` 를 import 하는 것은 기존에도 `triggers` 모듈이 `chat-channel` 모듈의 공유 유틸(`shared/form-mode`, `shared/language-hint-defaults` 등)을 참조해 온 것과 동일한 기존 패턴이며 신규 레이어링 결정이 아니다. `HooksService` → `InteractionService` 호출 경로도 [EIA §R5/§R10 facade 원칙](../../../../../spec/5-system/14-external-interaction-api.md) 을 그대로 따른다(엔진 직접 호출 없음, 기존 facade 재사용).
- **RBAC** — 이번 diff 는 신규 권한 구조를 도입하지 않는다(트리거 config 편집 권한은 기존 Editor+ 라우트 가드 유지, 변경 없음).

특기: `spec/5-system/4-execution-engine.md` 자체는 이번 diff 범위(git diff origin/main...HEAD -- code_areas)에 변경 사항이 없었다(payload "구현 대상 spec 영역: (없음)"). 워킹트리에서 직접 확인한 결과 §7.5.1 서술은 이미 diff 의 코드 동작을 정확히 반영하는 상태였다 — 즉 이 구현 커밋은 이미 갱신된 spec 계약을 뒤늦게 코드로 이행한 것으로 보이며, spec↔코드 사이에 새로 벌어진 갭은 없다.

## 요약

target 영역(nodeId 불일치 publisher 검증 확장)은 `spec/5-system/4-execution-engine.md §7.5.1`, `14-external-interaction-api.md §5.1`, `6-websocket-protocol.md §4.2`, `15-chat-channel.md §4.1.1`, `1-data-model.md` 등 관련된 모든 타 영역 spec 과 정합적이다. 각 진입점(EIA REST/chat-channel in_process_trusted/WS/REST `/continue`)의 nodeId 검사 적용·면제 여부가 표 단위로 이미 명문화돼 있고, diff 의 실제 동작·테스트가 그 표와 문자 그대로 일치한다. F-2(surfaceMismatch 안내)·F-5(telegram MarkdownV2 raw-send 검증)도 chat-channel spec 의 기존 CCH-ERR-04 "silently swallow 금지" 원칙, 기존 `UNKNOWN_PLACEHOLDER` 검증 패턴과 동형으로 확장되어 새로운 모순을 만들지 않는다. 데이터 모델·RBAC·계층 책임 분할에도 위반이 없다.

## 위험도

NONE
