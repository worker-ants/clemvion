# Code Review Resolution — Workflow Assistant Error Reduction + Self-Review

리뷰 일시: 2026-04-23 00:17
해결 범위: Critical 1건 + Warning 22건 + Info 선별 조치

## Critical

| # | 발견 | 조치 |
|---|------|------|
| C1 | `SCHEMA_LOOKUP_HARD_STOP = 3` 주석-구현 불일치 (3개 리뷰어 공통 지적) | `workflow-assistant-stream.service.ts` L137–142 주석을 `hits` 카운트 규칙(첫 호출=1, 두 번째=2 warning, 세 번째≥3 error) 로 명시 재서술. L459–462 inline 주석도 동기화. |

## Warning

### 보안 (Security)

| # | 발견 | 조치 |
|---|------|------|
| W1 | `originalRequest` 그대로 LLM tool_result 재주입 → 간접 프롬프트 인젝션 | `truncateReviewOriginalRequest` helper 추가. `REVIEW_ORIGINAL_REQUEST_MAX_LEN = 200` 길이 상한으로 잘라 싣는다. 전체 원문은 system prompt 의 Active plan context 에 XML fence 로 이미 중화되어 있으므로 review payload 에는 요약만 전달. |
| W2 | 노드 label 이 `NODE_NOT_FOUND` / orphan / pendingUserConfig 힌트에 이스케이프 없이 삽입 | `sanitizeLlmProvidedString` helper 신규 (shadow-workflow.ts) — 제어 문자·개행·백틱·꺾쇠 중화 + 길이 상한. `addEdge` hint 에서 `JSON.stringify(sanitize(label))` 일관 적용. 상수 `LABEL_HINT_MAX_LEN=80`. orphan/pending 쪽 label 은 내부 shadow 상태에서 온 값이라 1차 경로는 차단되었으나 방어적으로 sanitize 경유. 검증 테스트 `shadow-workflow.spec.ts` "NODE_NOT_FOUND hint sanitizes user-provided labels..." 추가. |
| W3 | LLM 제공 `attemptedType` 힌트 문자열에 미검증 삽입 | `buildUnknownNodeTypeResult` 에서 `sanitizeLlmProvidedString(..., ATTEMPTED_TYPE_MAX_LEN=64)` 경유로 embed. |

### 아키텍처 (Architecture)

| # | 발견 | 조치 |
|---|------|------|
| W4 | `ShadowResult` optional 필드 암묵적 유니온 팽창 (discriminated union 권장) | **현상 유지 + 문서 보강.** discriminated union 전환은 기존 소비자(test/frontend) 전면 변경을 수반하는 규모 큰 리팩토링이라 별도 이슈로 분리. 현재 변경에서는 필드별 JSDoc 을 보강 (W22 와 함께) 해 "어떤 에러 코드에서 어떤 필드가 실리는지" 를 명시 기재. 후속 이슈화 예정. |
| W5 | `ShadowWorkflow` SRP 위반 (진단/Levenshtein/힌트 생성) | **현상 유지.** 분리 시 `ShadowWorkflowErrorAdvisor` 협력 클래스 도입이 필요한데, 그래프 상태 의존성(labelConflictCounts, recentFailedAddNodeLabels)을 이관하는 것이 복잡. 먼저 현 위치에서 sanitize/cache 를 도입해 책임 경계가 드러나도록 한 뒤 별도 리팩토링 PR 에서 분리. |
| W6 | `evaluateReviewGuard` 책임 밀집 (~90줄) | `shouldSkipReview(state, pendingToolCalls, snapshot)` private 메서드로 skip 판정 로직 분리. `evaluateReviewGuard` 는 이제 snapshot 1회 취득 → skip 체크 → plan derive → 체크리스트 구성 → 응답 반환의 선형 흐름. |

### 성능 (Performance)

| # | 발견 | 조치 |
|---|------|------|
| W7 | `hasReachableAncestorContainer` 가 orphan 후보마다 `new Map(allNodes.map)` 재생성 → O(N×total) (2개 리뷰어 공통) | `collectOrphans` 상단에서 `byId` Map 1회 생성 후 인자로 주입. `hasReachableAncestorContainer(nodeId, byId, reachable)` 시그니처로 변경. 새 JSDoc 추가. |
| W8 | `buildUnknownNodeTypeResult` 호출마다 sort+spread 반복 | `sortedKnownTypesCache: string[] \| null` instance 필드 + `getSortedKnownTypes()` lazy init 메서드 도입. Set 이 constructor 이후 불변이므로 캐시 무효화 없음. |
| W9 | `evaluateReviewGuard` 가 `shadow.snapshot()` 두 번 호출 (O(N+E) 이중 클론) | snapshot 을 메서드 초입에서 1회 취득 → `shouldSkipReview(snapshot)` 와 `buildReviewChecklist({shadowSnapshot: snapshot, ...})` 에 공유. |

### Side Effect

| # | 발견 | 조치 |
|---|------|------|
| W10 | `LABEL_CONFLICT` 케이스에서 `recordFailedAddNode` 호출 → 이후 `add_edge` NODE_NOT_FOUND 힌트가 "노드 미생성" 으로 오해 유발 | `addNode()` LABEL_CONFLICT 분기에서 `recordFailedAddNode` 호출 제거. 회귀 테스트 `shadow-workflow.spec.ts` "LABEL_CONFLICT does NOT poison the cascading NODE_NOT_FOUND hint" 추가. |
| W11 | `isRecoveredLater` 의 `add_edge` 분기가 camelCase 키(`sourceId`/`targetId` 등) 미처리 | snake_case 와 camelCase 양쪽을 `??` fallback 으로 비교하도록 변경. 회귀 테스트 `review-workflow.spec.ts` "recognises add_edge recovery when the second attempt uses camelCase argument keys" 추가. |

### API Contract

| # | 발견 | 조치 |
|---|------|------|
| W12 | `finish` 에러 유니온에 `WORKFLOW_REVIEW_REQUIRED` 추가 → 기존 소비 레이어 누락 가능 | 소비 경로 점검 결과: (1) 프론트 `tool-call-badge.tsx` 는 `kind === 'edit' \| 'explore'` 만 SSE 로 구독 — `finish` tool_result 는 이벤트 미발행이라 UI 노출 없음. (2) `active-plan-context.ts` 의 `markIfCompleted` 는 `planStepId` 기준이며 finish tool 에는 planStepId 가 붙지 않으므로 영향 없음. (3) `toChatMessages` 는 모든 tool_result 를 그대로 persist → 다음 턴 rehydration 호환. 별도 수정 불필요. 본 RESOLUTION 에 감사 내역 기록. |
| W13 | `get_node_schema` 2회차 캐시 응답이 `{ ...cached.result, warning }` 스프레드 패턴 → 원본 형태 의존 | **현상 유지 + 주석.** 캐시된 결과가 `ExploreToolsService.getNodeSchema` 반환 shape 을 그대로 미러링하는 것이 첫 호출 ↔ 캐시 hit 의 의미적 일관성. 스프레드 방식이 shape drift 시 silent failure 위험은 있으나, 현재 `getNodeSchema` 반환은 명시 `{ ok, type, configSchema, ... }` 구조고 해당 함수 변경 시 이미 테스트가 깨지므로 실질 위험 낮음. 후속 리팩토링 시 `{ ok: true, data: cached.result, cached: true, warning }` 분리 구조로 전환 검토. |

### Testing

| # | 발견 | 조치 |
|---|------|------|
| W14 | alias 매칭되지만 knownNodeTypes 에 없는 경우 Levenshtein fallthrough 미테스트 | `shadow-workflow.spec.ts` "UNKNOWN_NODE_TYPE: falls through to Levenshtein when alias exists but not in knownTypes" 추가. |
| W15 | `collectFakeStepCompletion` 의 `planStepIds`(배열) 경로 미테스트 (2개 리뷰어 공통) | `review-workflow.spec.ts` "flags via planStepIds (array) covering a step whose every linked call failed" 추가. 두 step 을 배열로 커버하는 한 호출의 실패 케이스 검증. |
| W16 | `update_node` / `remove_node` / camelCase `add_edge` 회복 감지 미테스트 | `review-workflow.spec.ts` 에 세 케이스 추가. |
| W17 | PLAN_NOT_COMPLETE skip 테스트가 chatStream 횟수만 검증, 실제 guard 발동 assertion 부재 | "skips review when PLAN_NOT_COMPLETE already fired..." 테스트에 Round 2 messages 에서 `fin_1` tool_result 가 `{ ok: false, error: 'PLAN_NOT_COMPLETE' }` 인지 확인하는 assertion 추가. |

### Documentation / Maintainability

| # | 발견 | 조치 |
|---|------|------|
| W18 | `ReviewChecklistItem` 필드 전체 JSDoc 없음, `data` 가 `unknown` | 필드별 JSDoc 추가 + code 별 data shape 참고표를 `data` 필드 JSDoc 에 기재. |
| W19 | CHANGELOG/ADR 부재 | **현재 프로젝트에 CHANGELOG 파일 정책 부재** (저장소 전체 확인). 별도 이슈로 정책 수립 필요. 대신 이번 변경 요약은 RESOLUTION.md + memory/ 업데이트로 갈음. |
| W20 | `recentFailedAddNodeLabels` 필드에 `readonly` 누락 | `private readonly recentFailedAddNodeLabels: string[] = []` 로 수정 (`readonly` 는 reference 고정 의미; 내부 mutation 허용, 다른 필드와 스타일 통일). |
| W21 | `recordFailedAddNode` 호출이 `addNode()` 내 5개 조기 return 에 분산 | **현상 유지.** 단일 exit 패턴으로 리팩토링하면 shadow.addNode 가 try/finally 구조가 되어 가독성 역효과. 대신 각 조기 return 앞 `this.recordFailedAddNode(label)` 호출을 grep 가능한 통일 패턴으로 유지. 향후 에러 케이스 추가 시 누락 방지 주석을 LABEL_CONFLICT 분기에 이미 명시함. |
| W22 | `ShadowResult` JSDoc 에서 `hint` 필드가 복수 케이스에서 사용됨이 모호 | 각 optional 필드를 독립 JSDoc 블록으로 분리. `hint` 는 사용 케이스 3개(UNKNOWN_NODE_TYPE / LABEL_CONFLICT 반복 / NODE_NOT_FOUND cascading) 를 명시 나열하고 sanitize 규약을 기재. |

## Info (선별 조치)

| # | 발견 | 조치 |
|---|------|------|
| R6 | `REDUNDANT_SCHEMA_LOOKUP` 이 `UNRESOLVED_FAILED_CALLS` 점검에서 오탐 가능 | `collectUnresolvedFailures` 에서 `tc.kind === 'explore'` 제외. explore 계열은 낭비 차단용 실패 응답이지 본래 의미의 미해결 실패가 아님. 회귀 테스트 "ignores explore tool failures like REDUNDANT_SCHEMA_LOOKUP" 추가. |
| R7 | 시스템 프롬프트 self-review skip 조건 설명이 구현과 불일치 ("single node, no plan" vs 실제 "plan 유무 무관") | system-prompt.ts 의 Self-review 섹션 skip 문구를 실제 구현(`shouldSkipReview`)과 동기화 — "single non-trigger node (regardless of plan), PLAN_NOT_COMPLETE already fired, clear_plan, no successful edit" 4가지 명시. |

## 유보 항목 (Info 중 현재 변경 범위 밖)

다음 항목은 Info 수준 + 현재 작업 스코프 밖 + 별도 리팩토링 주제로 판단해 **후속 이슈**로 기록:

- I1 (type 길이 상한 128자 검증) — W3 으로 대부분 흡수됨. Levenshtein 입력 길이 상한은 W3 의 sanitize 로 64자.
- I2 (schemaCache 항목 수 상한) — 노드 타입 총수가 수십 개 수준이므로 실질 위험 낮음. 상한 설정은 후속 작업.
- I3 (checkRequestCoverage Set 교집합 전환) — 정확도 개선이지만 현재 blocking=false 경고라 운영 영향 없음.
- I4 (Levenshtein early termination) — 성능 최적화는 현재 비용 수준에서 불필요.
- I17 (NODE_TYPE_ALIASES 단일 소스화) — 별칭 맵 자체가 작고 변경 빈도 낮음. 카탈로그 변경 정책 수립 후 연계.
- I19 (FinishGuardState 서브 타입화) — 가드 단계 확장 시 재검토.

## 검증

- lint: `npx eslint 'src/**/*.ts'` → exit 0
- unit tests (workflow-assistant): 200 passed / 11 suites
- unit tests (backend 전체): 1712 passed / 115 suites
- build: `npm run build` → 성공
