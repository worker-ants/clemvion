---
worktree: fix-bg-context-key
started: 2026-05-31
owner: developer
---

# Background context-key race — 후속 결정 기록 & 잔여 backlog

본 PR(`claude/fix-bg-context-key`, background ExecutionContext Map 키 분리 race 수정)의
ai-review(`review/code/2026/05/31/22_50_09/`)·자체 분석에서 나온 **결정 기록**과 **선택적 후속**.
`review/` 는 gitignored 라 INFO 결정의 committed 단일 기록은 본 문서다.

## 1. interactive 노드 in background 본문 — pendingContinuations 격리 (본 PR 처리)

### 배경
`executeBackgroundSubgraph → executeInline` 의 blocking dispatch 는 본문 노드가
`waiting_for_input`(form / button / ai_conversation) 이면 `waitForX` 를 호출하고,
`waitForX` 는 `pendingContinuations.set(<key>, …)` 후 await 한다. 키가 부모와 같은
`executionId` 였을 때 두 문제:
1. **키 충돌**: 메인 흐름도 대기 중이면 본문의 `set(executionId,…)` 가 메인 resolver 를 stomp.
2. **워커 점유**: bg 본문 await 가 BullMQ 워커를 maxDurationMs 까지 점유.

### 조치 (본 PR)
- [x] `pendingContinuations.set` 4개 사이트(waitForFormSubmission / waitForButtonInteraction /
  runAiConversationLoop ×2)를 `contextKeyOf(context)` 로 격리 — 메인 키 분리(`_contextKey`)와 동일 테마.
- [x] `executeBackgroundSubgraph` finally 에서 `pendingContinuations.delete(bgKey)` 추가 (resolver 누수 정리).
- [x] 외부 resume 경로(`resolvePending`/`rejectPending`/`has`/rehydration delete)는 `executionId` 유지
  — 메인 실행만 외부에서 재개되며, 본문 키와 충돌하지 않는다.

### 잔여 한계 (의도적 — 추가 작업 아님)
background 는 fire-and-forget(spec §4 "결과 비반환")이고 본문 대기 노드를 구동할 **외부
interactive surface 가 없다**. 따라서 본문 interactive 노드는 외부 `continueExecution(executionId)`
로 재개되지 않으며 `maxDurationMs` 타임아웃으로 종결된다. 격리로 **메인 오염은 제거**됐고,
타임아웃 시 finally 가 정리한다. 본문에서 interactive 노드를 fail-fast 차단하는 가드는 별도
behavior+spec 결정이 필요해 본 PR 범위 밖으로 둔다(아래 backlog 참조).

## 2. ai-review INFO 처리 기록

| INFO | 내용 | 처리 |
|---|---|---|
| #1 | `_contextKey` 가 공개 `ExecutionContext` 노출 | **수용** — `_executedNodes`/`_resumeState` 선례 따른 `_`-prefix 엔진 내부 필드. execution-context 규약 원칙 4 로 분류 확정. |
| #2 | `contextKeyOf` 헬퍼 vs `contextKey` 파라미터 경로 혼재 | **수용** — AI 멀티턴 클러스터가 `context` 미보유라 구조적으로 불가피. |
| #3 | `createContext` 5번째 위치 파라미터(중간 기본값 명시 불편) | **deferred** — options-bag 리팩터는 광범위, 즉시 가치 낮음. 아래 backlog. |
| #4 | bgKey 삼중 폴백 인라인 가독성 | **done** — `bgKeySuffix` 로컬 추출(본 PR). |
| #5 | execution-context.md frontmatter `status: spec-only` 미갱신 | **N/A** — convention/rule 문서로 특정 코드의 "구현 대상"이 아니라 `code: []` / spec-only 유지가 적절. |
| #7 | `setStructuredOutput`/`setEngineResolvedConfig` context 미존재 시 silent no-op | **deferred** — 진단 warn 추가는 기존 동작 변경. 아래 backlog. |
| #8 | 테스트 `contextKey separation` 각 it 의 `new ExecutionContextService()` 중복 | **수용(skip)** — 격리성 우선, 사소. |
| #9 | 12-background §4 신규 항목 한 문장 3사실 | **수용(skip)** — 가독 사소. |
| #10 | bgKey 폴백 제거 조건(마이그레이션) 주석 | **done** — 주석 추가(본 PR). |

## 3. 선택적 backlog (별 PR — 본 PR 범위 밖)
- [ ] **INFO#3**: `createContext` / 엔진 내부 부가 필드 options-bag 패턴 검토 (God Object 방지 규약과 정합).
- [ ] **INFO#7**: `setStructuredOutput`/`setEngineResolvedConfig` context 미존재 시 `logger.warn` 추가 (잘못된 키 진단성).
- [ ] **(검토)** background 본문 interactive 노드 fail-fast 가드 + 에러코드(`BACKGROUND_INTERACTIVE_UNSUPPORTED`) — spec(12-background §4/§6) 변경 동반, project-planner 선행. 현재는 격리+타임아웃으로 안전 종결만 보장.
