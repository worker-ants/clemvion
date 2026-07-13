# Cross-Spec 일관성 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 검토 범위 보정 안내

payload 의 "관련 spec 본문" 섹션에는 `spec/0-overview.md`·`spec/1-data-model.md` 두 문서만 포함되어 있었으나, 실제 diff 는 `execution-engine` 뿐 아니라 `external-interaction`(EIA)·`chat-channel`(hooks)·telegram provider 문서·`data-flow` 문서까지 걸쳐 있어 Cross-Spec 관점에서는 이 영역들이 더 직접적인 충돌 후보다. 이에 payload 범위를 넘어 워크트리의 실제 spec 파일(`spec/5-system/4-execution-engine.md` §7.5.1, `spec/5-system/14-external-interaction-api.md` §5.1, `spec/5-system/15-chat-channel.md` §4.1/§4.1.1, `spec/4-nodes/7-trigger/providers/telegram.md` §5.8, `spec/data-flow/15-external-interaction.md`)를 직접 대조했다.

## 발견사항

검토 결과 CRITICAL/WARNING 급 충돌은 발견되지 않았다. 오히려 이례적일 정도로 spec 과 구현이 정확히 정합한다:

- **F-1 (nodeId 불일치 거부)** — `execution-engine.service.ts` 의 `resolveWaitingNodeExecutionId(executionId, expectedCommand, expectedNodeId?)` 신규 파라미터·거부 로직은 `spec/5-system/4-execution-engine.md` §7.5.1 "대기 표면 ↔ 명령 매트릭스" 표(2026-07-11 갱신, nodeId 행 날짜 2026-07-14)의 진입점별 커버리지 표(외부 EIA `/interact` 적용 / chat-channel `in_process_trusted` scope 단위 면제 / WS·REST `/continue` 미적용)와 1:1 대응한다.
- 같은 계약이 `spec/5-system/14-external-interaction-api.md` §5.1 (`409 STATE_MISMATCH` — "nodeId 불일치" 사유, "**`STATE_MISMATCH` 강제 정합 (2026-07)**" 문단에 nodeId=2026-07-14 로 명시)과 `spec/data-flow/15-external-interaction.md` (dispatch 매핑에 `expectedNodeId` 인자까지 시그니처 단위로 기재)에도 동일하게 이미 반영되어 있다.
- **F-2 (surfaceMismatch 안내)** — `language-hint-defaults.ts` 의 `SURFACE_MISMATCH_DEFAULTS`/`resolveSurfaceMismatchMessage`, `hooks.service.ts` 의 `sendSurfaceMismatchNotice` 는 `spec/5-system/15-chat-channel.md` §4.1 (`languageHints.surfaceMismatch` 필드 예시) / §4.1.1 (KO/EN default 문구 표, MarkdownV2-safe 특수문자 배제 근거) 및 `spec/4-nodes/7-trigger/providers/telegram.md` §5.8 (non-escape 예외 경로 설명)과 문자열 단위까지 동일하다. frontend i18n 도움말(`triggers.ts`) 갱신 키 목록(`formOpenLabel / sessionExpired / surfaceMismatch`)도 §4.1.1 의 키 목록과 일치한다.
- **계층 책임** — `InteractionService.interact` 는 여전히 대기 표면·nodeId 검증을 직접 하지 않고 `ExecutionEngineService`(publisher)에 위임한다는 기존 주석/설계(R2: chat-channel 은 EIA 의 consumer)를 그대로 유지하며, nodeId 검증은 publisher 계층(`resolveWaitingNodeExecutionId`)에만 추가됐다 — 계층 책임 분할과 충돌 없음.
- **데이터 모델** — `spec/1-data-model.md` §2.13 Execution / §2.14 NodeExecution 에 새 컬럼이 필요한 변경이 아니다(기존 `NodeExecution.node_id` 를 조회해 대조하는 로직만 추가). `expectedNodeId` 는 API 계층 파라미터일 뿐 영속 스키마 변경이 없어 데이터 모델과 충돌하지 않는다.
- **요구사항 ID** — 새로 등장하는 식별자는 plan 레벨 라벨(F-1/F-2, plan `eia-command-waiting-surface-guard.md`)과 테스트 라벨(`G-2`)이며, 기존 CCH-*/EIA-*/§7.5.1 requirement 네임스페이스와 이름 충돌이 없다.

## 요약

target 코드 변경(F-1 nodeId 검증, F-2 surfaceMismatch 안내)은 payload 에 제공된 `0-overview.md`/`1-data-model.md` 와 충돌하지 않을 뿐 아니라, 실제로 더 밀접하게 관련된 다른 영역 spec(`execution-engine.md` §7.5.1, `external-interaction-api.md` §5.1, `chat-channel.md` §4.1/§4.1.1, telegram provider §5.8, `data-flow/15-external-interaction.md`)과도 문자열·시그니처 단위까지 이미 정합되어 있다 — 즉 이번 구현은 사전에 spec 이 규정한 계약을 코드가 뒤늦게 따라잡은 케이스로 보인다. 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 어느 관점에서도 모순이 발견되지 않았다.

## 위험도
NONE
