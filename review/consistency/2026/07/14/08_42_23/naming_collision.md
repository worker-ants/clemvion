# 신규 식별자 충돌 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 점검 배경

본 검토는 `--impl-done` 모드로, target spec 영역(`spec/5-system/4-execution-engine.md`) 자체에는 diff 가 없다("(없음)"). 실제 diff 는 `plan/in-progress/eia-command-waiting-surface-guard.md` F-1(`expectedNodeId` nodeId 일치 검사)·F-2(`surfaceMismatch` graceful 안내) 구현 코드다. payload 에 첨부된 "검색 대상 코퍼스"는 `spec/0-overview.md`·`spec/1-data-model.md`·cafe24 API 카탈로그·무관한 plan 문서들로 구성되어 있어 이번 변경과 직접 관련된 spec(§7.5.1, `15-chat-channel.md`, `14-external-interaction-api.md`, `data-flow/15-external-interaction.md`, `4-nodes/7-trigger/providers/telegram.md`)이 빠져 있었다. 이에 따라 코퍼스에 의존하지 않고 워킹트리 절대경로로 직접 대조했다.

신규 식별자 목록(diff 기준):
- `SURFACE_MISMATCH_DEFAULTS`, `resolveSurfaceMismatchMessage` (`language-hint-defaults.ts`)
- `languageHints.surfaceMismatch` 신규 키
- `HooksService.sendSurfaceMismatchNotice` (private)
- `expectedNodeId` 파라미터 (`continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation`/`resolveWaitingNodeExecutionId`)
- 테스트 라벨 `F-1`/`F-2`/`G-2`

## 발견사항

검토 관점 1~6 (요구사항 ID, 엔티티/타입명, API endpoint, 이벤트/메시지명, 환경변수/설정키, 파일 경로) 전체에서 **충돌 없음**을 확인했다. 근거:

- **§7.5.1 재사용** — 코드 주석이 인용하는 `§7.5.1 "nodeId 미일치"`는 `spec/5-system/4-execution-engine.md:1039-1067`에 이미 존재하는 "7.5.1 Publisher 측 사전 검증 — `INVALID_EXECUTION_STATE`" 섹션이며, `expectedNodeId` optional 파라미터·nodeId 검사 진입점별 커버리지 표(외부 EIA 적용/`in_process_trusted` 면제/WS·`/continue` 미적용)까지 diff 코드와 1:1로 이미 문서화되어 있다. 신규 서브섹션 번호 부여가 아니라 기존 지정 섹션의 구현 완료 확인이므로 번호 충돌 없음.
- **`STATE_MISMATCH` / `InvalidExecutionStateError`** — `git show origin/main:codebase/backend/src/modules/external-interaction/interaction.service.ts`에 이미 `STATE_MISMATCH` 매핑이 존재(PR #230 EIA 최초 구현)함을 확인. 이번 diff 는 기존 409 코드를 재사용할 뿐 새로 정의하지 않는다.
- **`surfaceMismatch` 키** — `spec/5-system/15-chat-channel.md:225,257,261`, `spec/4-nodes/7-trigger/providers/telegram.md:195-204`에 KO/EN 기본 문구·발송 조건·MarkdownV2-safe 근거까지 코드와 동일 문구로 이미 spec화되어 있다. 다른 `languageHints` 키(`groupChatRefusal`/`executionStarted`/`sessionExpired`/`formOpenLabel` 등)와 이름이 겹치지 않으며, frontend i18n help 문자열(`triggers.ts` ko/en)에도 신규 키가 정합적으로 추가되어 있다.
- **`expectedNodeId`** — 백엔드 전역(`execution-engine.service.ts`, `interaction.service.ts`)과 `spec/5-system/4-execution-engine.md:1050`, `spec/data-flow/15-external-interaction.md:102-109`, `plan/in-progress/eia-command-waiting-surface-guard.md:109-133`에서 동일 의미(대기 노드 대조용 caller-supplied nodeId)로만 사용된다. 다른 의미의 기존 사용처 없음.
- **`isInternalCtx`** — 이번 diff 에서 `interaction.service.ts`에 새로 import 됐을 뿐, 정의 자체는 `interaction.guard.ts`에 선재(PR #258/#259 계열)한다. 신규 식별자가 아니라 기존 유틸 재사용.
- **테스트 라벨 `F-1`/`F-2`/`G-2`** — 모두 `plan/in-progress/eia-command-waiting-surface-guard.md`의 동일 항목(F-1 §100행, F-2 §138행)을 가리키며, 각 spec 파일(`execution-engine.service.spec.ts`/`interaction.service.spec.ts`/`hooks.service.spec.ts`/`external-interaction.e2e-spec.ts`) 내에서 중복·재사용된 다른 의미의 `F-1`/`G-2`는 없음(grep 전수 확인).

## 요약

target 이 새로 도입하는 식별자(`SURFACE_MISMATCH_DEFAULTS`/`resolveSurfaceMismatchMessage`/`languageHints.surfaceMismatch`/`expectedNodeId`/테스트 라벨 F-1·F-2·G-2)는 모두 `spec/5-system/4-execution-engine.md` §7.5.1, `spec/5-system/15-chat-channel.md`, `spec/data-flow/15-external-interaction.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `plan/in-progress/eia-command-waiting-surface-guard.md`에 사전 정의된 것과 정확히 같은 의미로만 코드에 등장하며, 다른 의미로 기존에 쓰이던 동명 식별자는 발견되지 않았다. `STATE_MISMATCH`/`InvalidExecutionStateError`/`isInternalCtx`는 이번 diff 이전부터 존재하던 기존 정의를 그대로 재사용한다. payload 에 첨부된 검색 코퍼스가 이번 변경과 무관한 문서 위주였다는 점은 지적하되, 실제 관련 spec/plan 파일을 워킹트리에서 직접 대조한 결과 충돌 소지는 없었다.

## 위험도

NONE
