# Workflow Assistant — 자체 점검 + 에러 풍부화 (2026-04-23)

Assistant 가 복합 워크플로우 (예: 설문조사) 를 만들 때 실패 tool call 이 연쇄적으로 발생하던 문제와, 완료 후 자체 점검이 없던 문제를 해결한다. 본 메모는 향후 유지보수 시 놓치면 안 되는 결정·제약을 정리한다.

## Part A — Tool-call 오류 감소

### 에러 풍부화 (ShadowResult 확장)

`ShadowResult` 에 optional 필드 추가:
- `knownTypes: string[]` (정렬, 최대 `KNOWN_TYPES_MAX=40`) — `UNKNOWN_NODE_TYPE`
- `suggestedType: string` — alias 맵 hit (`NODE_TYPE_ALIASES`) 우선, 없으면 Levenshtein ≤ 3
- `repeatCount: number` — 같은 label LABEL_CONFLICT 가 `LABEL_CONFLICT_REPEAT_THRESHOLD(=2)` 이상 반복 시
- `hint: string` — 복구 지침 한 문장. 세 케이스에서 set 될 수 있다 (JSDoc 에 명시):
  - UNKNOWN_NODE_TYPE (alias / Levenshtein / 후보 없음 별로 문구 다름)
  - LABEL_CONFLICT (repeatCount ≥ 2)
  - NODE_NOT_FOUND on add_edge (recentFailedAddNodeLabels 가 있을 때 cascading 힌트)

### alias 별칭 정책

`NODE_TYPE_ALIASES` 는 `error_message | error | alert | notification | message | text → template`.
기준: LLM 이 "UI 메세지용 전용 노드" 가 있다고 가정해 만들어내는 타입명을 `template` 으로 라우팅.
반드시 `this.knownNodeTypes.has(aliasHit)` 를 확인한 뒤에만 suggestedType 으로 싣는다 (registry 변화 대응).

### LABEL_CONFLICT ≠ 실패한 노드 생성

**규약**: `addNode()` 의 LABEL_CONFLICT 분기에서는 `recordFailedAddNode` 를 호출하지 않는다. 이유: LABEL_CONFLICT 는 "이름만 겹쳤을 뿐 타입·config 자체는 타당" 한 상태이므로, 이후 `add_edge` 가 NODE_NOT_FOUND 로 떨어졌을 때 cascading 힌트에 섞이면 "앞서 노드 생성이 실패했다" 는 잘못된 진단을 LLM 에 준다. 테스트: `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint".

### LLM 제공 문자열 embedding 규약

LLM 이 자유 텍스트로 채우는 값(label, attemptedType) 을 힌트/에러 메세지에 embed 할 때는 **반드시** `sanitizeLlmProvidedString(value, maxLen)` 경유. 이 헬퍼가 제어 문자·개행 제거, 백틱·꺾쇠 중화, 길이 절단을 일관 처리한다. 이유: LLM 출력이 `\n## HACK` 같은 마크다운 헤더/인젝션을 품은 채 힌트로 재주입되면 다음 라운드 프롬프트에서 지시문으로 오해될 수 있다.

길이 상수:
- `ATTEMPTED_TYPE_MAX_LEN = 64` — node type 후보 embed
- `LABEL_HINT_MAX_LEN = 80` — NODE_NOT_FOUND 힌트 label 목록

### schemaCache 정책

`workflow-assistant-stream.service.ts` 의 턴 스코프 `schemaCache: Map<string, { result, hits }>`.

카운트 규칙: **hits 값은 호출 순번 그 자체**. 첫 호출 후 1, 두 번째 2, 세 번째 3...
- hits=1 (첫 호출): 정상 실행, cache set
- hits=2 (두 번째): cached + `warning: 'REDUNDANT_SCHEMA_LOOKUP'` + `cached: true`
- hits ≥ 3 (`SCHEMA_LOOKUP_HARD_STOP`): `ok: false, error: 'REDUNDANT_SCHEMA_LOOKUP'` (hard stop)

이 상수를 변경할 때는 서비스 L137–142 주석 + L459–462 inline 주석 + 테스트 3회차 기대값을 모두 동시에 고친다.

## Part B — 2-stage finish (self-review)

### 흐름

LLM 이 `finish` 를 호출하면 서버는 아래 순서로 판정:

1. `evaluateFinishGuard` → `PLAN_NOT_COMPLETE` 면 block (기존 동작, 변경 없음).
2. 통과하면 `evaluateReviewGuard` → `WORKFLOW_REVIEW_REQUIRED` 면 block.
3. 둘 다 통과하면 `{ ok: true }` 로 finish 성공.

Review 는 **한 턴에 한 번만** 발동 (`state.reviewCompleted`, `state.reviewRoundCount < 2`). 두 번째 `finish` 는 review 를 건너뛰고 통과해, LLM 이 사용자에게 다음 턴에서 후속 지시를 받을 기회를 보장.

### review skip 조건 (`shouldSkipReview`)

다음 중 하나라도 참이면 review 는 발동하지 않는다. **시스템 프롬프트의 Self-review 섹션 설명과 반드시 동기화 유지** (프롬프트·구현 drift 가 곧 LLM 혼란으로 이어짐):

- `state.reviewCompleted`
- `state.reviewRoundCount >= 2`
- `state.finishBlockCount > 0` — PLAN_NOT_COMPLETE 가 이미 발동했다면 LLM 은 한 라운드 feedback 을 받았으므로 review 는 중복
- `state.planClearedThisTurn`
- 이번 턴 성공 edit 이 0 — 실행 턴 아님
- non-trigger 노드 ≤ 1 — trivial 편집 (plan 유무 무관)

### 체크리스트 항목 (`review-workflow.ts`)

Blocking:
- **UNRESOLVED_FAILED_CALLS** — `kind === 'edit'` 실패 중 같은 label(add_node) / id(update/remove) / source+target+port 튜플(add_edge, camelCase 도 포함) 로 성공 흔적이 없는 것. **`finish` / `explore` 계열은 제외** (review-guard feedback 이나 `REDUNDANT_SCHEMA_LOOKUP` 은 실패 의미가 아님).
- **ORPHAN_NODES** — trigger category 에서 BFS 도달 불가 + container emit loopback 조상도 미reachable. `byId` Map 은 `collectOrphans` 에서 1회 생성 후 인자로 주입 (O(N²) → O(N+E)).
- **DANGLING_OUTPUT_PORTS** (2026-04-23 추가) — `resolveEffectiveOutputPorts` 가 돌려주는 `isUserConfigured=true` 포트 중 outgoing edge 없는 것. "ORPHAN_NODES 는 입력 방향 reachability, 이 검사는 출력 방향 connectivity" 의 대칭 쌍. weak 포트 (`error`/`default`/`fallback`/`continue`/단일 static `out`) 는 제외 — terminal 노드는 정상 케이스. `nodeDefs` 가 `BuildReviewChecklistInput` 으로 주입되어야 작동; 빈 배열이면 no-op. 상한 `MAX_DANGLING_PORTS=20`.
- **FAKE_STEP_COMPLETION** — `planStepId` 또는 `planStepIds` 가 붙은 호출들이 step 에 연결되어 있으나 모두 `ok: false`.
- **PENDING_USER_CONFIG_UNMENTIONED** — pendingUserConfig 있는 노드의 label 이 assistantText 에 포함되지 않음.

Non-blocking:
- **REQUEST_COVERAGE_LOW** — originalRequest 의미 토큰과 노드 label 겹침 비율 < 30%. 경고만.

### Port 해석 (resolve-dynamic-ports.ts)

`frontend/src/lib/node-definitions/resolve-dynamic-ports.ts` 의 로직을 backend 로 포팅한 `tools/resolve-dynamic-ports.ts` 가 SSOT. 6 종 `DynamicPortsSpec` (switch-cases, classifier-categories, ai-agent-conditional, info-extractor-mode, presentation-buttons, parallel-branches) 를 전부 지원. 반환 구조에 `isUserConfigured: boolean` 추가 — strong (user-authored) vs weak (framework-synthesized) 구분이 DANGLING_OUTPUT_PORTS 의 핵심 필터. Frontend 사본과 드리프트하지 않도록 `resolve-dynamic-ports.spec.ts` 에 kind 별 시나리오 미러 (16 테스트).

### 프롬프트 인젝션 방어

`WORKFLOW_REVIEW_REQUIRED` payload 의 `originalRequest` 필드는 `truncateReviewOriginalRequest()` 로 `REVIEW_ORIGINAL_REQUEST_MAX_LEN=200` 자로 잘라 싣는다. 전체 원문은 system prompt 의 Active plan context 에 XML fence 로 이미 중화되어 주입되므로 review 쪽에는 요약만.

### 프론트엔드 영향

`tool-call-badge.tsx` 는 `kind === 'edit' | 'explore'` 만 SSE 로 구독하므로 `finish` tool_result (`ok: false, error: 'WORKFLOW_REVIEW_REQUIRED'`) 는 UI 빨간 배지로 누출되지 않는다. 사용자는 review 라운드 중 LLM 이 추가로 부른 `get_current_workflow` / 수정 edit 배지 + Korean "검토 완료" 문장만 본다.

## 유지보수 체크리스트

- `SCHEMA_LOOKUP_HARD_STOP` 변경 시: 상수 정의부 + 인라인 주석 + 테스트 기대값 3곳 동시 수정.
- `ShadowResult` 필드 추가/제거 시: JSDoc 블록 + 테스트 fixture + 후속 `detectPendingUserConfig` / `toChatMessages` rehydration 경로 확인.
- Review skip 조건 변경 시: `prompts/system-prompt.ts` Self-review 섹션 문구 동기화 (테스트 `system-prompt.spec.ts` "teaches the 2-stage finish self-review routine..." 가 고정).
- `NODE_TYPE_ALIASES` 변경 시: alias 가 registry 에 존재하지 않으면 Levenshtein fallthrough 로 빠지는지 회귀 확인 (`shadow-workflow.spec.ts` "falls through to Levenshtein when alias exists but not in knownTypes").
- `resolveEffectiveOutputPorts` 변경 시: **frontend `resolveDynamicPorts` 와 동일 동작** 을 유지하는지 확인. 두 파일이 각자의 spec 을 가지므로 어느 한쪽만 업데이트하면 review false positive/negative 가 생긴다. 새로운 `DynamicPortsSpec.kind` 추가 시 양쪽에 동시에 branch 추가.
- DANGLING_OUTPUT_PORTS 의 weak/strong 경계 변경 시: `resolve-dynamic-ports.spec.ts` 의 `isUserConfigured` 단언 + `review-workflow.spec.ts` "does NOT flag weak ports" 케이스 모두 업데이트.

## Follow-up (스코프 밖, 별도 이슈)

- `ShadowResult` discriminated union 전환
- `ShadowWorkflow` SRP 분리 (`ShadowWorkflowErrorAdvisor`)
- `schemaCache` 응답 명시 구조 래핑 (`{ ok, data, cached, warning }`)
- CHANGELOG 정책 수립 후 본 변경 소급 반영
