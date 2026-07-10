# Consistency Check SUMMARY — `--impl-prep`

- **일시**: 2026-07-10 22:52:18
- **모드**: `--impl-prep` (developer 가 구현 착수 직전 의무 호출)
- **대상**: #501 후속 attribution 하드닝 — (e) `llmContext` 타입 주석 · (g) IE collection-retry 2nd-chat 테스트
- **base**: `origin/main` @ `cc3dafa8c`
- **checker**: 5종 직접 Agent fan-out

## BLOCK: NO

Critical 0건. Warning 2건 (plan-coherence) — 반영. Info 다수 — 반영/기각 근거 아래.

| checker | Critical | Warning | Info |
| --- | --- | --- | --- |
| cross-spec | 0 | 0 | 0 |
| rationale-continuity | 0 | 0 | 0 |
| convention-compliance | 0 | 0 | 1 |
| plan-coherence | 0 | 2 | 2 |
| naming-collision | 0 | 0 | 2 |

## 사전 검증된 핵심 전제 (checker 가 코드로 확인)

- `LlmCallContext`(`modules/llm/llm.service.ts:41`) 필드가 `?: string | null` 이라
  resume 사이트가 넘기는 `string | undefined` 값이 **assignable** — 컴파일 실패 없음.
- **excess-property check 비대칭 실재**: 단발 경로(`ai-turn-executor.ts:1522`)는 fresh literal 을 인자로
  직접 넘겨 이미 보호되고, resume 경로(`:2599`)는 `const` 경유라 우회된다. → 변경 (e) 의 근거 성립.
- `runTurnWithCollectionRetries` 는 루프 **매 반복**에 `params.llmContext` 를 `traceChat` 에 넘기고
  (`information-extractor.handler.ts:1027-1037`), resume 진입은 `state.executionId ? {...} : undefined`
  (`:891`) 조건부. → 신규 테스트가 세 식별 필드를 **명시 주입**해야 유의미. (반영)
- `@typescript-eslint/consistent-type-imports` 는 `codebase/backend/eslint.config.mjs` 에 **미활성** →
  혼합 import 가 lint 실패를 내지 않음 (우려했던 Critical 은 기우).

## 대응

### W1 (plan-coherence) — 선행 docs PR #898 과 같은 plan 파일에서 merge conflict 위험
`plan/in-progress/resume-llm-usage-attribution.md` 의 INFO#1(74-75행) · INFO#4(78-79행) 는
#898 이 편집한 INFO#3(76-77행) 과 **빈 줄 없이 인접** → git 기본 context(3줄) 안에서 hunk 겹침.
→ **반영**: 본 코드 PR 은 **plan 파일을 건드리지 않는다**. #898 머지 후 별도 pass 에서
(e)(g) 체크 + `plan/complete/` 이동(+ `spec_impact` 리스트)을 수행한다.

### W2 (plan-coherence) — `task_6da430a3` 이 같은 코드 지점(`ai-turn-executor.ts:2599`)을 겨냥
기능 충돌은 아니다. (e) 는 그대로 진행하되, 그 리팩터가 도입할
`pickResumeIdentificationFields` 헬퍼는 **명시 반환 타입 `LlmCallContext`(또는 그 부분집합)** 를 가져야
(e) 가 확보한 타입 안전성이 보존된다. → 근거를 chip 으로 인계.

### I (convention-compliance) — import 스타일 결
자매 파일 `information-extractor.handler.ts:10` 은 `import { LlmService, LlmCallContext }` (plain) 이나,
수정 대상 `ai-turn-executor.ts:37-42` 는 인라인 `type` 수식어 관례(`{ AiConditionEvaluator, type ConditionDef }`)를 쓴다.
→ **반영**: 수정 대상 파일의 로컬 관례를 따라 `import { LlmService, type LlmCallContext }` 사용.

### I (naming-collision) — fixture id / 테스트 제목 구분
기존 `:930-933` 이 `exec-attr-1`/`wf-attr-1`/`nodeexec-row-1` 사용.
→ **반영**: 신규 테스트는 `-2` 계열(`exec-attr-2`/`wf-attr-2`/`nodeexec-row-2`/`node-def-2`) 사용,
제목도 attribution 명시(`passes the same llmContext attribution to the retried (2nd) chat call`).

## 구현 후 검증 (TEST WORKFLOW + mutation)

| stage | 결과 |
| --- | --- |
| lint | PASS (57s) |
| unit | PASS — backend 400 suites / 7952 tests, frontend 271 files / 5295 tests |
| build | PASS (180s) — 최초 실패는 Docker 디스크 포화, `docker builder prune -af` (24.7GB 회수) 후 통과 |
| e2e | PASS — 249 tests (211s) |

**mutation 검증 (vacuous test 방지)**

1. **(g)**: `runTurnWithCollectionRetries` 를 "첫 반복만 `llmContext` 전달, 재시도는 `undefined`" 로 변조 →
   신규 테스트 **단 1건만 실패**, 기존 `feeds tool_result back and loops...` 는 여전히 통과.
   → 신규 테스트가 기존 커버리지가 못 잡던 retry-specific 회귀를 실제로 검출함을 실증. 변조 되돌림.
2. **(e)**: `nodeExecutionId` → `nodeExecutionID` 오탈자 주입.
   - **주석 있음**: `TS2561: Object literal may only specify known properties, but 'nodeExecutionID' does not
     exist in type 'LlmCallContext'. Did you mean to write 'nodeExecutionId'?` → 컴파일 차단.
   - **주석 없음(대조군)**: `tsc` **에러 없음** — 오탈자가 조용히 통과하고 런타임에 `node_execution_id` 가
     NULL 로 적재된다(#501 의 실패 모드).
   → 타입 주석이 실효적 가드임을 실증. 변조 되돌림.
