파일 저장 권한이 필요합니다. 허용하시겠습니까?

아래는 통합 보고서 내용입니다.

---

# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 보안(간접 프롬프트 인젝션), 아키텍처(ShadowResult 타입 안전성), 성능(루프 내 Map 재생성) 영역에서 구체적인 개선이 필요하나, 기능 정확성은 전반적으로 높고 운영 안정성에 즉각적인 위협은 없다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Maintainability / Requirement | `SCHEMA_LOOKUP_HARD_STOP = 3` 주석이 "4번째부터 error"라고 쓰여 있으나 실제로는 **3번째 호출**(hits=3 ≥ 3)에서 error. 3개 리뷰어 독립 지적. | `workflow-assistant-stream.service.ts` — 상수 선언부 | 주석을 `"3번째 호출(hits===3)부터 error 응답"` 으로 수정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `WORKFLOW_REVIEW_REQUIRED` 응답에 `originalRequest`(사용자 원문)가 그대로 LLM tool result로 재주입 → 간접 프롬프트 인젝션 경로 | `workflow-assistant-stream.service.ts` — `evaluateReviewGuard` | `originalRequest` 제외하거나 길이 상한 적용. 필요 시 `{ text: ... }` 구조 필드로 감싸기 |
| 2 | Security | 노드 `label`이 `ORPHAN_NODES`, `PENDING_USER_CONFIG_UNMENTIONED`, `NODE_NOT_FOUND` 힌트에 이스케이프 없이 포함 → 2차 프롬프트 인젝션 | `review-workflow.ts` — `collectOrphans` 등 / `shadow-workflow.ts` — `addEdge` 힌트 | `addEdge`의 `JSON.stringify` 패턴을 모든 경로에 일관 적용. label 길이 상한 적용 |
| 3 | Security | LLM 제공 `attemptedType`이 길이 검증 없이 힌트 문자열 템플릿에 삽입 | `shadow-workflow.ts` — `buildUnknownNodeTypeResult` | 길이 상한(64자) 및 제어 문자 제거 적용 |
| 4 | Architecture | `ShadowResult`에 `knownTypes`, `suggestedType`, `repeatCount`, `hint`가 모두 optional로 추가 → TypeScript가 에러 코드별 유효 필드를 강제 불가 | `shadow-workflow.ts` — `ShadowResult` 인터페이스 | Discriminated union으로 교체 |
| 5 | Architecture | `ShadowWorkflow`가 그래프 도메인 외 (1) 진단 상태 추적 (2) Levenshtein 제안 (3) 영어 힌트 생성 책임 흡수 → SRP 위반 | `shadow-workflow.ts` — `buildUnknownNodeTypeResult`, `closestKnownType` 등 | `ShadowWorkflowErrorAdvisor` 협력 클래스 분리 또는 힌트 문자열 모듈 상수 추출 |
| 6 | Architecture | `evaluateReviewGuard`가 5개 책임 담당 (~90줄) | `workflow-assistant-stream.service.ts` — `evaluateReviewGuard` | `shouldSkipReview()` 등 가드 판정 메서드 분리 |
| 7 | Performance / Maintainability | `hasReachableAncestorContainer`가 orphan 노드마다 `new Map(allNodes.map(...))` 재생성 → O(N×total_nodes) 잠재. 2개 리뷰어 독립 지적. | `review-workflow.ts` — `collectOrphans` → `hasReachableAncestorContainer` | `collectOrphans` 상단에서 `byId` Map 한 번 생성 후 인자로 주입 |
| 8 | Performance | `buildUnknownNodeTypeResult` 호출마다 `[...this.knownNodeTypes].sort()` 재실행 | `shadow-workflow.ts` | 생성자에서 `sortedKnownTypes` 필드에 한 번 저장 |
| 9 | Performance | `evaluateReviewGuard`에서 `shadow.snapshot()` 두 번 호출 (O(N+E) 할당 중복) | `workflow-assistant-stream.service.ts` — `evaluateReviewGuard` | 첫 번째 결과 변수 재사용 |
| 10 | Side Effect | `LABEL_CONFLICT` 케이스에서 `recordFailedAddNode` 호출 → 이후 `add_edge`의 `NODE_NOT_FOUND` hint가 "노드가 생성되지 않았다"고 오해 유발 | `shadow-workflow.ts` — `addNode()` LABEL_CONFLICT 분기 | LABEL_CONFLICT 분기에서 `recordFailedAddNode` 제외 또는 hint 문구 완화 |
| 11 | Side Effect | `isRecoveredLater`의 `add_edge` 분기가 `sourceId`/`targetId`(camelCase) 무시 → false positive `UNRESOLVED_FAILED_CALLS` | `review-workflow.ts` — `isRecoveredLater()` | `laterArgs.source_id ?? laterArgs.sourceId` 형태로 양쪽 처리 |
| 12 | API Contract | `finish` 에러 유니온에 `WORKFLOW_REVIEW_REQUIRED` 추가 → 기존 소비 레이어 누락 가능 | `workflow-assistant-stream.service.ts` — `FinishGuardError` union | 모든 소비 레이어에서 새 에러 코드 처리 여부 확인 |
| 13 | API Contract | `get_node_schema` 2회차 캐시 응답이 `{ ...cached.result, warning }` 스프레드 패턴 → 원본 구조에 따라 응답 형태 달라짐 | `workflow-assistant-stream.service.ts` — `schemaCache` 처리 블록 | 명시적 구조로 래핑 `{ ok: true, type, configSchema, warning, cached }` |
| 14 | Testing | alias는 있지만 `knownNodeTypes`에 없는 경우(alias-without-knownType) Levenshtein fallthrough 미테스트 | `shadow-workflow.spec.ts` | 해당 케이스 테스트 추가 |
| 15 | Testing | `collectFakeStepCompletion`의 `planStepIds`(배열) 경로 미테스트. 2개 리뷰어 지적. | `review-workflow.spec.ts` — `FAKE_STEP_COMPLETION` | `planStepIds: ['s1']` 케이스 추가 |
| 16 | Testing | `update_node`, `remove_node`, `remove_edge`의 id 기반 회복 감지 미테스트 | `review-workflow.spec.ts` — `UNRESOLVED_FAILED_CALLS` | 재시도 성공 케이스 추가 |
| 17 | Testing | `PLAN_NOT_COMPLETE` skip 테스트가 chatStream 횟수만 검증, 실제 guard 발동 여부 미검증 | `workflow-assistant-stream.service.spec.ts` | finish tool_result에 `{ error: 'PLAN_NOT_COMPLETE' }` assertion 추가 |
| 18 | Documentation | `ReviewChecklistItem` 필드 전체(`code`, `blocking`, `details`, `data`) JSDoc 없음. `data`가 `unknown` 타입 | `review-workflow.ts` — `ReviewChecklistItem` 인터페이스 | 필드 JSDoc 추가, code별 data 구조 예시 명시 |
| 19 | Documentation | 새 에러 코드(`WORKFLOW_REVIEW_REQUIRED`, `REDUNDANT_SCHEMA_LOOKUP`)와 2-stage finish guard에 대한 CHANGELOG/ADR 없음 | 변경 전체 | CHANGELOG에 breaking-ish 변경 항목 추가 |
| 20 | Maintainability | `recentFailedAddNodeLabels`가 `readonly` 없이 선언되어 `labelConflictCounts`(`private readonly`)와 불일치 | `shadow-workflow.ts` — 클래스 필드 선언부 | `private readonly recentFailedAddNodeLabels: string[] = [];` 로 통일 |
| 21 | Maintainability | `recordFailedAddNode(label)` 호출이 `addNode()` 내 5개 조기 return에 분산 → 신규 에러 케이스 추가 시 누락 위험 | `shadow-workflow.ts` — `addNode()` | 단일 exit 패턴으로 리팩터링 또는 호출 필수 주석 명시 |
| 22 | Documentation | `ShadowResult` JSDoc에서 `hint` 필드가 LABEL_CONFLICT/NODE_NOT_FOUND 두 케이스에서 사용됨이 모호 | `shadow-workflow.ts` — `ShadowResult` JSDoc | 각 필드 독립 JSDoc 배치, `hint` 필드 사용 케이스 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 매우 긴 `attemptedType`으로 Levenshtein 반복 시 LLM 루프 비용 증가 가능 | `shadow-workflow.ts` — `levenshtein` | `type` 길이 상한(128자) 검증 추가 |
| 2 | Security | 단일 턴 내 `schemaCache` 크기 명시적 상한 없음 | `workflow-assistant-stream.service.ts` — `schemaCache` | `SCHEMA_CACHE_MAX_TYPES` 조건으로 항목 수 제한 |
| 3 | Performance | `checkRequestCoverage`의 join+includes 패턴 → 부분 문자열 오탐 가능 | `review-workflow.ts` — `checkRequestCoverage` | Set 교집합 방식으로 교체 |
| 4 | Performance | `levenshtein` early termination 없음 | `shadow-workflow.ts` | 행 단위 early exit 추가(선택적) |
| 5 | Performance | `recordFailedAddNode`의 `while` 루프가 최대 1회 실행 | `shadow-workflow.ts` | `if`로 교체하여 의도 명확화 |
| 6 | Requirement | `REDUNDANT_SCHEMA_LOOKUP` 에러가 `UNRESOLVED_FAILED_CALLS` 점검에서 오탐 가능 | `review-workflow.ts` — `collectUnresolvedFailures` | explore 계열 호출 제외 조건 추가 |
| 7 | Requirement | 시스템 프롬프트 "single node, no plan" skip 조건 설명이 구현("plan 유무 무관")과 불일치 | `system-prompt.ts` — Self-review 섹션 | "single non-trigger node regardless of plan presence"로 수정 |
| 8 | Testing | `system-prompt.spec.ts` 정규식이 사소한 문구 변경에 취약 | `system-prompt.spec.ts` | 핵심 의미 단어만 개별 체크 |
| 9 | Testing | `PENDING_USER_CONFIG_UNMENTIONED` 대소문자 구분 동작 미문서화 | `review-workflow.spec.ts` | 대소문자 구분 동작 테스트로 명시 또는 case-insensitive 비교 |
| 10 | Testing | `levenshtein` 동률 처리 직접 검증 없음 | `shadow-workflow.spec.ts` | 단위 테스트 추가 |
| 11 | Testing | `schemaCache` 빈 `typeArg` 캐시 bypass 경로 미테스트 | `workflow-assistant-stream.service.ts:461` | 빈 typeArg 케이스 추가 |
| 12 | Testing | `MAX_ORPHANS = 20` 상한 캡 테스트 없음 | `review-workflow.spec.ts` | orphan 21개 케이스 추가 |
| 13 | Documentation | `hasReachableAncestorContainer`, `checkRequestCoverage`, `collectUnmentionedPendingUserConfig` JSDoc 없음 | `review-workflow.ts` | 단일 행 JSDoc 추가 |
| 14 | Documentation | 내부 주석 한국어/영어 혼용 원칙 미명문화 | 전체 파일 | CLAUDE.md에 원칙 추가 |
| 15 | Maintainability | 테스트 내 매직 UUID 리터럴 직접 사용 | `shadow-workflow.spec.ts` | `NONEXISTENT_UUID` 상수 추출 |
| 16 | Maintainability | `isRecoveredLater` 미지원 tool name 확장 취약점. `false` 반환으로 false positive 누적 가능 | `review-workflow.ts` | switch-case + exhaustive check 또는 TODO 주석 추가 |
| 17 | Architecture | `NODE_TYPE_ALIASES` 하드코딩 → 카탈로그 변경 시 두 곳 수정 | `shadow-workflow.ts` | 노드 타입 정의 파일에서 import |
| 18 | Architecture | `schemaCache` 에스컬레이션 정책이 tool 처리 분기 중간에 ~30줄 인라인 | `workflow-assistant-stream.service.ts` | `SchemaCacheGuard` 소형 클래스 추출 |
| 19 | Architecture | `FinishGuardState` guard 상태 누적 패턴 → 단계 추가 시 비대화 위험 | `workflow-assistant-stream.service.ts` — `FinishGuardState` | guard 단계 증가 시 서브 타입화 검토 |
| 20 | Side Effect | 한국어 조사 포함 어절 단일 토큰 처리 → `REQUEST_COVERAGE_LOW` 과다 경고 (`blocking: false`이므로 운영 영향 없음) | `review-workflow.ts` — `tokenize()` | 임계값 조정 또는 partial match 보완 |
| 21 | Concurrency | `ShadowWorkflow` 단일 async 컨텍스트 암묵적 의존 | `shadow-workflow.ts` | 클래스 JSDoc에 "멀티스레드 이관 금지" 제약 명시 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | `originalRequest`/노드 label 간접 프롬프트 인젝션; `attemptedType` 미검증 반사 |
| Performance | MEDIUM | `hasReachableAncestorContainer` 루프 내 Map 재생성; 이중 `snapshot()` 클론 |
| Architecture | MEDIUM | `ShadowResult` 암묵적 유니온 팽창; `ShadowWorkflow` SRP 위반 |
| Documentation | MEDIUM | `SCHEMA_LOOKUP_HARD_STOP` 주석-구현 불일치(Critical); CHANGELOG 부재 |
| API Contract | LOW | `finish` 에러 코드 추가 breaking-ish; 캐시 응답 스프레드 비일관성 |
| Concurrency | LOW | `ShadowWorkflow` 단일 async 컨텍스트 암묵적 의존 |
| Maintainability | LOW | `recordFailedAddNode` 호출 분산; `SCHEMA_LOOKUP_HARD_STOP` 주석; `readonly` 불일치 |
| Requirement | LOW | `REDUNDANT_SCHEMA_LOOKUP` 오탐 가능성; 시스템 프롬프트 skip 조건 불일치 |
| Side Effect | LOW | `LABEL_CONFLICT` misleading hint; `add_edge` camelCase 미처리 false positive |
| Testing | LOW | `planStepIds` 배열 경로; `update_node`/`remove_node` 회복 감지; alias-without-knownType 미테스트 |
| Scope | NONE | 3개 서브피처 번들 — 동일 메타 목표로 수용 가능 |
| Dependency | NONE | 외부 패키지 추가 없음; 순환 의존 없음 |
| Database | NONE | 인메모리 전용, DB 접근 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 이유 |
|----------|------|
| Database | 변경된 코드 전체가 in-memory 레이어에서 동작. DB 접근 없음 |
| Dependency | 외부 패키지 추가 없음. `review-workflow.ts` 내부 의존 그래프에 순환 없음 |
| Scope | 8개 파일 변경 모두 단일 기능 목표에 직접 기여. 무관한 리팩토링 없음 |

---

## 권장 조치사항

1. **[즉시] `SCHEMA_LOOKUP_HARD_STOP` 주석 수정** — 코드 수정 없이 주석 한 줄로 해결. 3개 리뷰어 공통 지적.
2. **[즉시] `originalRequest` 프롬프트 인젝션 방어** — `WORKFLOW_REVIEW_REQUIRED` 응답에서 원문 제거하거나 길이 상한 적용.
3. **[단기] `hasReachableAncestorContainer` Map 재생성 제거** — `byId` Map을 `collectOrphans` 상단에서 한 번만 생성. 수정 난이도 낮고 노드 수 증가 시 선형 악화.
4. **[단기] `REDUNDANT_SCHEMA_LOOKUP` 오탐 방지** — `collectUnresolvedFailures`에서 explore 계열 호출 제외.
5. **[단기] `isRecoveredLater` camelCase 인수 처리** — `source_id ?? sourceId` 패턴으로 false positive 방지.
6. **[중기] `ShadowResult` Discriminated Union 교체** — 아키텍처 부채 중 가장 시급. 에러 코드별 필드를 TypeScript 수준에서 보장.
7. **[중기] 성능 수정 2건** — `buildUnknownNodeTypeResult` sort 캐싱 + `evaluateReviewGuard` 이중 snapshot 제거. 수정 난이도 낮음.
8. **[중기] 테스트 커버리지 보강** — `planStepIds` 배열 경로, alias-without-knownType, `update_node`/`remove_node` 회복 감지 케이스 추가.
9. **[장기] `ShadowWorkflow` SRP 분리 + `evaluateReviewGuard` 책임 분리** — `ShadowWorkflowErrorAdvisor`, `ReviewGuardPolicy` 계층 도입.
10. **[장기] 시스템 프롬프트 수정 + CHANGELOG 추가** — skip 조건 설명 수정, 새 에러 코드 계약 변경 문서화.