# Cross-Spec 일관성 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 검토 방법 메모

payload 의 "관련 spec 본문" 첨부는 `spec/0-overview.md`·`spec/1-data-model.md` 2개뿐이었으나, 실제 diff 가 건드리는 도메인(EIA nodeId 검증, chat-channel `surfaceMismatch` 안내)에 직접 관련된 타 영역 spec — `spec/5-system/4-execution-engine.md`(§7.5.1), `spec/5-system/15-chat-channel.md`(§4.1/§4.1.1), `spec/5-system/6-websocket-protocol.md`(§4.6), `spec/5-system/3-error-handling.md`, `spec/data-flow/15-external-interaction.md`, `spec/data-flow/3-execution.md`, `spec/4-nodes/7-trigger/providers/telegram.md`(§5.8), `spec/4-nodes/6-presentation/0-common.md`, `spec/3-workflow-editor/3-execution.md`, `spec/conventions/interaction-type-registry.md` — 를 워크트리 절대경로로 직접 Read/Grep 하여 diff 내용과 대조했다 (payload 지시대로 target spec 자체는 "(없음)"으로 diff 가 없었음 — 이미 워크트리에 최신 상태로 존재).

## 발견사항

없음. 아래는 확인한 교차 지점의 정합성 근거.

- **nodeId 검사 (F-1)** — `execution-engine.service.ts` 의 `resolveWaitingNodeExecutionId(executionId, expectedCommand, expectedNodeId?)` 신규 파라미터·`in_process_trusted` 면제 로직은 `spec/5-system/4-execution-engine.md` §7.5.1 "nodeId 검사 진입점별 커버리지" 표(외부 EIA=적용 / chat-channel scope=면제 / WS·`/continue`=미적용)와 문구까지 정확히 일치한다. `interaction.service.ts` 의 `isInternalCtx(ctx) ? undefined : dto.nodeId` 분기, `assertNodeId(dto, ctx)` 의 internal bypass 도 동일 표와 정합.
- **`STATE_MISMATCH` 강제 (target §5.1)** — `spec/5-system/14-external-interaction-api.md` 는 이미 "nodeId=2026-07-14" 로 표면·nodeId 두 사유 강제를 명시하고 있어 코드 변경(diff)과 날짜·의미 모두 일치한다. `spec/3-workflow-editor/3-execution.md`(REST `/continue` 422 `INVALID_STATE`) · `spec/5-system/6-websocket-protocol.md`(WS 는 nodeId 미전달) 와도 모순 없음.
- **`surfaceMismatch` 안내 (F-2)** — `language-hint-defaults.ts` 의 `SURFACE_MISMATCH_DEFAULTS`(KO/EN, MarkdownV2 특수문자 미포함) · `resolveSurfaceMismatchMessage` 3-level lookup · `HooksService.sendSurfaceMismatchNotice` 는 `spec/5-system/15-chat-channel.md` §4.1(`languageHints.surfaceMismatch` 예시)·§4.1.1(KO/EN 표, "문장부호 미사용" 근거, `CCH-ERR-04` cross-ref, lookup 경로 `sessionExpired` 동일 서술) 및 `spec/4-nodes/7-trigger/providers/telegram.md` §5.8 과 완전히 일치한다. frontend i18n dict(`triggers.ts` KO/EN) 의 `languageHintsHelp` 키 나열 순서(`.../formOpenLabel / sessionExpired / surfaceMismatch`)도 chat-channel spec 표 순서와 동일.
- **에러 코드 매핑** — `interaction.controller.ts` 의 `ApiConflictResponse` 문구 갱신("또는 명령의 nodeId 가 실제 대기 노드와 불일치")은 `spec/5-system/14-external-interaction-api.md` §5.1 `STATE_MISMATCH` 행·`spec/5-system/3-error-handling.md`(REST/WS/EIA 3-way 코드 분리 원칙)과 충돌 없음.
- **계층 책임** — `resolveWaitingNodeExecutionId`(execution-engine, publisher 사전 검증) vs `InteractionService.assertNodeId`(존재 검사 floor) vs `HooksService`(control-plane 안내, renderer 우회) 의 책임 분할은 `spec/5-system/14-external-interaction-api.md` §R10(facade 원칙) · `spec/5-system/4-execution-engine.md` §7.5.1 이 규정한 기존 계층 분리와 일치 — 새로운 계층 위반 없음.
- **요구사항 ID** — 코드/테스트가 참조하는 `F-1`/`F-2`(plan 라벨), `EIA-IN-13`, `CCH-ERR-04` 등은 각 영역에서 기존 정의 그대로 재사용되며 다른 의미로 재정의된 곳이 없다 (`EIA-IN-13` 은 `14-external-interaction-api.md` §3.2 요구사항 표와 §5.1 Rationale 노트 두 곳에서 동일 의미).
- **데이터 모델** — 이번 diff 는 DB 스키마·엔티티 필드를 추가하지 않는다(순수 파라미터 threading + 안내 문구). `spec/1-data-model.md` Trigger 엔티티의 `config.chatChannel.languageHints`/`interaction` 서술과도 모순 없음.

## 요약

이번 변경(F-1 nodeId 불일치 거부, F-2 surfaceMismatch 안내)은 `spec/5-system/4-execution-engine.md` §7.5.1, `spec/5-system/15-chat-channel.md` §4.1/§4.1.1, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/3-error-handling.md`, `spec/data-flow/15-external-interaction.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/4-nodes/6-presentation/0-common.md` 등 관련된 모든 타 영역 spec 이 이미 동일한 용어·표·날짜(2026-07-10/2026-07-14)로 코드와 정합하게 갱신되어 있어, 데이터 모델·API 계약·요구사항 ID·상태 전이·계층 책임 어느 관점에서도 충돌이 발견되지 않았다.

## 위험도

NONE
