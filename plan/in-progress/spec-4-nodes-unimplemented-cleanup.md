# spec/4-nodes 미구현 항목 코드·spec 정정 (A + C + D)

## Context

직전 spec 정합화 작업(커밋 `15cfad45`) 에서 spec/4-nodes 에 `> ⚠ 미구현 (P0/P1)` 마커로 명시된 항목이 총 58건. 이 중 사용자 결정에 따라 다음 처리:

| 분류 | 결정 |
|---|---|
| **A. 명백 정정 (13건)** | 진행 (코드를 spec에 맞춤) |
| 🎯 **B. 정책 결정 (6건)** | 이번 작업 제외 (정책 결정 후 별도) |
| 📈 **C. 기능 추가 (22건)** | **카테고리별 별도 커밋** 으로 진행 |
| ⚠️ **D. 호환성 (17건)** | **호환성 무시하고 진행** (마이그레이션 가이드 없이) |

A와 D는 같은 노드(workflow / ai_agent / http_request / database_query 등)를 동시에 만지는 경우가 많아 **묶어서 노드 단위로 한 커밋에 처리**. C는 사용자 지시에 따라 카테고리별 별도 커밋.

목적: 미구현 P0/P1 코드 갭 49건(A 13 + C 22 + D 17 - 중복 약간) 을 모두 닫고, 각 노드 spec의 `⚠ 미구현` 마커를 제거하여 spec ↔ 코드를 fully synchronized 상태로.

## 결정사항

| 항목 | 결정 |
|---|---|
| **A + D 묶음** | 한 커밋 (`fix(nodes): A+D — 명백 정정 + 호환성 무시 마이그레이션`) |
| **C 분할** | 카테고리별 3 커밋 (Logic / Data / AI+Integration+Flow) |
| **B 제외** | 정책 결정 미완 — 별도 plan 으로 분리 |
| **호환성 정책** | D는 마이그레이션 가이드 없이 즉시 변경. 다운스트림 워크플로우 영향 사용자가 직접 정정 |
| **spec 마커 제거** | 각 코드 변경 후 해당 노드 spec 의 `⚠ 미구현 (P0/P1)` 마커도 함께 제거 |
| **테스트** | 변경된 핸들러는 `*.handler.spec.ts` 의 expected 출력 정정 + 누락 케이스 추가 |

## Critical Files

- 코드 변경: `backend/src/nodes/<cat>/<node>/{handler,schema,handler.spec}.ts`
- spec 마커 제거: `spec/4-nodes/<cat>/<n>-<node>.md`
- 0-common 정정 (해당 시): `spec/4-nodes/<cat>/0-common.md`
- 영향 받는 외부 spec (해당 시): `spec/3-workflow-editor/`, `spec/5-system/`

---

## Phase 1: A + D — 명백 정정 + 호환성 무시 (1 commit)

A 13건 + D 17건 중 같은 노드 항목은 묶어서 처리. 노드별 변경 매트릭스:

### 1.1 Logic 노드

| 노드 | 변경 (A + D) |
|---|---|
| `if_else` | A: `meta.conditionResult: boolean` / `meta.matchedConditions[]` 핸들러 반환 + `meta.durationMs` 보장 |
| `variable_modification` | A: schema enum의 `set_field` / `delete_field` 제거 (handler 미구현 항목) |
| `split` | D: `output: SplitItem[]` → `output: { items: SplitItem[], count: number }` 래핑 |
| `loop` | D: `output.count` 제거 (config.count echo 위반 → 다운스트림은 `output.iterations.length` 사용) |
| `foreach` | D: errorPolicy=skip 결과를 `output.items` 와 `output.skipped: [{index, error}]` 로 분리 + `meta.skippedCount` |
| `parallel` | D: `output.branches[i]` → `{ status: 'fulfilled'\|'rejected', value?, error? }` 표준화 + `output.count` 제거 + 시작 시점 `output: null` |

### 1.2 Data 노드

| 노드 | 변경 (A + D) |
|---|---|
| `code` | A: 정상 케이스 `port: 'success'` 명시 반환 |
| `code` | A: 에러 케이스 `config.code` echo 정책 정렬 (코드 본문 포함, 메모리 절약 시 생략) |
| `code` | A: 컴파일 실패(vm.Script 구문 오류) → pre-flight throw (현재 `port: 'error'` 반환을 throw로) |
| `code` | D: `meta.error` / `meta.errorCode` / `meta.stack` deprecated alias 제거 → `output.error.{code, message, details.stack}` 만 사용 |

### 1.3 AI 노드

| 노드 | 변경 (A + D) |
|---|---|
| `ai_agent` | A: multi-turn `buildMultiTurnFinalOutput` 의 `port: 'out'` hardcode 제거 → 종결 사유별 정확한 port (`<cond_id>` / `user_ended` / `max_turns` / `error`) |
| `ai_agent` | D: `output.response` → `output.result.response` (single-turn 정상) |
| `ai_agent` | D: `output.metadata.{model, inputTokens, outputTokens, totalTokens, thinkingTokens, toolCalls, ragSources, mcpDiagnostics}` → `meta.*` |
| `ai_agent` | D: `output._turnDebugHistory` → `meta.turnDebug` |
| `ai_agent` | D: `output.data.*` (condition wrapper) 폐지 → 평탄화된 `output.result.*` |
| `ai_agent` | D: multi-turn ended/condition `config.model` echo 를 raw template 으로 통일 (이미 single/waiting 은 raw, follow-up 으로 ended/condition 도 동일 정책) |
| `info_extractor` | D: `output.output.extracted` → `output.result.extracted` (이중 wrapper 제거) + 다른 multi-turn 필드들도 `output.result.{endReason, turnCount, messages}` 로 평탄화 |

### 1.4 Integration 노드

| 노드 | 변경 (A + D) |
|---|---|
| `http_request` | A + D: `meta.duration` → `meta.durationMs` (코드 측 정정, spec 결정 §6.1) |
| `database_query` | A: 에러 코드 세분화 (`DB_CONNECTION_ERROR` / `DB_CONSTRAINT_VIOLATION` / `DB_PERMISSION_DENIED` / `DB_QUERY_FAILED` 기본) — driver error code 매핑 추가 + `output.error.details.driverCode` |
| `database_query` | D: 옛 `'QUERY_FAILED'` alias 제거 → `'DB_QUERY_FAILED'` 만 사용 |

### 1.5 Flow 노드

| 노드 | 변경 (A + D) |
|---|---|
| `workflow` | A: schema 의 `target` / `source` 와 handler 의 `paramName` / `expression` 키 일치 (한쪽으로 통일 — `paramName`/`expression` 추천 — 핸들러 truth) |
| `workflow` | A: async `output: { executionId, workflowId, status: 'started' }` (workflowId / status 추가) + `meta.status` → top-level `status` 이동 |
| `workflow` | A: 에러 코드 세분화 (`SUB_WORKFLOW_NOT_FOUND` / `SUB_WORKFLOW_TIMEOUT` / `SUB_WORKFLOW_QUEUE_FAILED` / `SUB_WORKFLOW_FAILED` 기본) |
| `workflow` | D: sync 결과 `output: { result: <sub_workflow_output>, ... }` 1단 래핑 |

### 1.6 Trigger 노드

| 노드 | 변경 (A + D) | 상태 |
|---|---|---|
| `manual_trigger` | D: webhook 어댑터의 `body`/`headers`/`query`/`method` 를 `output.request.{...}` 묶음으로 이동 + `meta.source: 'manual'\|'webhook'\|'schedule'` 추가 | ✅ 완료 (2026-05-10) — 핸들러 + 3 어댑터(hooks/schedule-runner/schedules.runNow/workflows.controller.execute) `__triggerSource` 마커 stamp + spec(1-manual-trigger.md §4 / §5.1·§5.2 / 0-common.md §1·§3·CHANGELOG) 정정 |

### 1.7 Presentation 노드

| 노드 | 변경 (A + D) |
|---|---|
| `carousel` | A + D: static `output: {}` / dynamic `output: { items }` 분리 (Principle 1.1 / 4.3 준수). `output.rendered` HTML snapshot 은 제거 (또는 `meta.rendered` 로 이동 — 여기서는 제거 선택, 프론트가 config + items 로 재구성) |
| `carousel` | D: resumed 시 `status: 'button_click'` / `'button_continue'` → `'resumed'` 통일 + `output.previousOutput` 폐기 |
| `form` | A: `output.submittedData` 잔재 제거 → `output.interaction.{type: 'form_submitted', data, receivedAt}` 만 사용 + `status: 'submitted'` → `'resumed'` |

### 1.8 작업 절차 (각 노드)

1. `<node>.handler.ts` 핸들러 변경
2. `<node>.schema.ts` 변경 (해당 시)
3. `<node>.handler.spec.ts` 단위 테스트 expected 출력 정정 + 신규 케이스 추가
4. `spec/4-nodes/<cat>/<n>-<node>.md` 의 `⚠ 미구현 (A or D)` 마커 제거 (코드 ↔ spec 정합되었으므로)
5. 카테고리 0-common.md 의 색인이나 CHANGELOG 항목 정정 (해당 시)

### 1.9 검증

- `cd backend && npm test -- --testPathPattern=nodes` 통과
- `cd backend && npm run start:dev` 부팅 성공 (NodeComponentRegistry assertConsistency)
- `python3 scripts/check-doc-links.py` 0 broken refs

### 1.10 Commit

```
fix(nodes): A+D — 명백 정정 + 호환성 무시 마이그레이션 (29 항목)

- if_else: meta.conditionResult/matchedConditions 추가
- variable_modification: schema enum 정정 (set_field/delete_field 제거)
- code: port:'success' 명시, 컴파일 실패 throw, deprecated meta alias 제거
- split: output 래핑 ({items, count})
- loop: output.count 제거
- foreach: output.skipped 분리 + meta.skippedCount
- parallel: output.branches[i] 표준화 ({status, value?, error?}) + count 제거
- ai_agent: 5필드 모델 정합 (output.response → result.response, metadata → meta, _turnDebugHistory → meta.turnDebug, data.* 평탄화) + multi-turn port hardcode 제거
- info_extractor: output.output.extracted → output.result.extracted (이중 wrapper 제거)
- http_request: meta.duration → meta.durationMs
- database_query: 에러 코드 세분화 + driver code 매핑 + alias 제거
- workflow: paramName/expression 키 일치, async 출력 보강, 에러 코드 세분화, sync result 래핑
- manual_trigger: webhook output.request.{...} 묶음 + meta.source
- carousel: static/dynamic output 분리, resumed status 통일, previousOutput 폐기, rendered 제거
- form: submittedData 잔재 제거, status:'resumed' 통일

Breaking: 호환성 무시 마이그레이션 (D 카테고리). 다운스트림 워크플로우 expression 영향 받음.
spec/4-nodes/ 의 해당 ⚠ 미구현 (P0/P1) 마커 제거.
```

---

## Phase 2: C-Logic — Logic 카테고리 메타메트릭 추가 (1 commit)

10건 — 노드별 `meta.*` 메트릭 추가. 옵저버빌리티 개선. 비-breaking (additive).

| 노드 | 추가 |
|---|---|
| `switch` | `meta.matchedCaseLabel`, `meta.matchedCaseIndex`, `meta.resolvedValue` (옛 `meta.value` deprecate) |
| `loop` | `meta.iterations`, `meta.maxIterationsReached` |
| `variable_declaration` | `meta.declared[]`, `meta.skipped[]`, `meta.coercionWarnings[]` |
| `variable_modification` | `meta.modifications[]`, `meta.coercionWarnings[]`, `meta.createdVariables[]` |
| `split` | `meta.itemCount`, `meta.fellBackToEmpty` |
| `filter` | `meta.matchedCount`, `meta.unmatchedCount`, `meta.totalCount`, `meta.fellBackToEmpty`, `meta.invalidRegexPatterns[]` + `null`/`undefined` 입력 `[]` fallback (Principle 10) |
| `map` | 시작 시점 `output: null` 통일 (loop/foreach 와 일관) |
| `foreach` | `meta.iterations` (Container 메트릭) |
| `merge` | `meta.inputCount`, `meta.strategy`, `meta.outputFormat`, `meta.skippedKeys[]`, `meta.dormantFields[]` |
| `background` | `meta.durationMs`, `meta.backgroundRunId`, `meta.forkedAt`, `meta.jobId` |

### 작업 절차 (각 노드)

1. handler 에 meta 필드 추가
2. handler.spec.ts 신규 메트릭 검증 케이스 추가
3. spec 의 `⚠ 미구현 (C)` 마커 제거 + 필드 표 갱신

### Commit

```
feat(nodes/logic): C — 메타메트릭 추가 (10 노드)

switch/loop/variable_declaration/variable_modification/split/filter/map/foreach/merge/background 핸들러에 meta.* 옵저버빌리티 필드 추가. Principle 2 (meta는 실행 메트릭) 정합.

filter: null/undefined 입력 [] fallback (Principle 10) + meta.fellBackToEmpty 가시화.
map: 시작 시점 output: null 통일 (loop/foreach 와 일관).

비-breaking (additive). spec/4-nodes/1-logic/ 의 ⚠ 미구현 (C) 마커 제거.
```

---

## Phase 3: C-Data — Data 카테고리 메타메트릭 추가 (1 commit)

| 노드 | 추가 |
|---|---|
| `transform` | `meta.operationsApplied`, `meta.operationsSkipped` |

### Commit

```
feat(nodes/data): C — transform meta.operationsApplied/Skipped 추가

핸들러가 실제 변형 op 수와 no-op 처리 op 수를 meta 에 기록. Principle 2 정합.

비-breaking. spec/4-nodes/5-data/1-transform.md 의 ⚠ 미구현 (C) 마커 제거.
```

---

## Phase 4: C-AI/Integration/Flow — 나머지 메타메트릭 (1 commit)

| 노드 | 추가 |
|---|---|
| `text_classifier` | 에러 케이스 `meta.{durationMs, model, llmCalls}` 채우기 |
| `send_email` | `attachments` 필드 nodemailer 전달 구현 (현재 silent no-op) |
| `workflow` | sync 모드 `meta.durationMs` 등 메트릭 주입 |

> 제외: `ai_agent` 일반 도구 연결 입력 경로 재설계 — 별도 design doc 필요. 본 plan 범위 외.

### Commit

```
feat(nodes): C — AI/Integration/Flow 메타메트릭·기능 보강

- text_classifier: 에러 케이스 meta (durationMs/model/llmCalls) 채우기
- send_email: attachments 필드 nodemailer 실제 전달
- workflow: sync 모드 meta.durationMs 주입

비-breaking (send_email attachments 는 silent no-op 정상화 — 사용자 의도대로 작동 시작).
spec/4-nodes/ 의 해당 ⚠ 미구현 (C) 마커 제거.
```

---

## 작업 추정

| Phase | 노드 수 | 변경 규모 | 예상 |
|---|---|---|---|
| Phase 1 (A+D) | 13개 노드 | 핸들러/스키마/테스트/spec 마커 동시 변경 | 가장 무거움 (3~4시간 / 사람 기준) |
| Phase 2 (C-Logic) | 10개 노드 | meta 필드 추가 + 테스트 | 1~1.5시간 |
| Phase 3 (C-Data) | 1개 노드 | meta 필드 추가 | 15분 |
| Phase 4 (C-나머지) | 3개 노드 | meta + 기능 추가 | 30분~1시간 |

서브 에이전트 병렬화로 단축 가능 — Phase 1 노드별, Phase 2 노드별로 분할 dispatch.

---

## Verification (각 Phase 공통)

1. **단위 테스트**: `cd backend && npm test -- --testPathPattern=nodes` 통과
2. **타입 검사**: `cd backend && npm run typecheck` 통과 (있다면)
3. **부팅**: `cd backend && npm run start:dev` 시작 → `NodeComponentRegistry.assertConsistency` 통과
4. **메타데이터 API** (선택): `GET /api/v1/nodes/definitions` 응답에 변경된 schema 반영
5. **Doc-link**: `python3 scripts/check-doc-links.py` 0 broken refs (spec 마커 제거 후에도)
6. **Spec ↔ 코드 정합**: 변경된 노드의 spec 의 `⚠ 미구현` 마커가 모두 제거됨

## 후속 (별도 plan)

- 🎯 B 6건: 정책 결정 후 별도 plan
- ai_agent 일반 도구 연결 재설계: 별도 design doc + plan
