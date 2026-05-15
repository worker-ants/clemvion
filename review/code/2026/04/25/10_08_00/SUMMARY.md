# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 프롬프트 인젝션 표면 노출(sanitization 누락)과 핵심 동적 포트 해석 로직의 단위 테스트 공백이 주요 위험 요인

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `resolveEffectiveOutputPorts` 직접 단위 테스트 부재 — `DANGLING_OUTPUT_PORTS` 검사의 핵심 로직이 위임된 함수이나, 통합 테스트 경로에서만 간접 검증됨. 동적 포트 판정 오류가 있어도 탐지 불가 | `review-workflow.ts` → `collectDanglingOutputPorts` | `resolve-dynamic-ports.spec.ts` 전용 spec 작성, 또는 `error`·`continue`·`fallback` 포트를 각각 명시 검증하는 케이스 추가 |
| 2 | Testing | `❌[\s\S]{0,400}` 슬라이딩 윈도우 정규식 — 프롬프트 성장 시 `❌`와 검증 패턴 사이 거리가 400자를 초과하면 테스트가 false negative를 내는 "조용한 회귀" 위험 | `system-prompt.spec.ts` — `Null-safe $node referencing` 테스트 | `❌` 이후 다음 섹션 헤더(`###`)까지만 추출하는 블록 범위 검증 패턴으로 교체 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | **`PENDING_USER_CONFIG_UNMENTIONED` 노드 라벨 sanitization 누락** — `p.label`·`f.label`을 `sanitizeLlmProvidedString` 없이 `details`에 직접 embed. 인접 블록(`DANGLING_OUTPUT_PORTS`, `NODE_CONFIG_WARNINGS`)은 동일 목적으로 이미 sanitize 적용 중. 악성 노드 라벨이 LLM 컨텍스트에 지시문으로 재주입 가능 | `review-workflow.ts` — `buildReviewChecklist` 내 `PENDING_USER_CONFIG_UNMENTIONED` 처리 블록 | `sanitizeLlmProvidedString(p.label, DANGLING_PORT_LABEL_MAX_LEN)` 및 `f.label\|f.field`에 동일 처리 적용; 회귀 방지 테스트 추가 |
| 2 | Architecture / Side-Effect / Concurrency | **`resetExpressionCacheForTesting` 프로덕션 API에 노출** — 모듈 수준 가변 캐시를 리셋하는 테스트 전용 함수가 `export`되어 프로덕션에서 실수로 호출 가능. 런타임 가드 없음 | `system-prompt.ts:35–38` | `process.env.NODE_ENV !== 'test'` 가드 추가, 또는 `system-prompt.test-utils.ts`로 분리해 프로덕션 API surface에서 제거 |
| 3 | Architecture | **`ReviewChecklistItem.data` 타입 소거** — `unknown` 선언으로 7가지 코드별 페이로드 계약이 타입 시스템 밖 주석으로만 유지됨. 소비 측에서 `as Array<...>` 반복 단언 필요 | `review-workflow.ts:82` | 코드별 페이로드를 명시한 discriminated union으로 선언 (`\| { code: 'ORPHAN_NODES'; data: OrphanEntry[] } \| ...`) |
| 4 | Documentation / Maintainability / Scope / Requirement | **`buildReviewChecklist` JSDoc 6→7 불일치** — `NODE_CONFIG_WARNINGS` 추가로 실제 7개 점검이 실행되나 JSDoc은 "여섯 개" 기재, 목록에서 `NODE_CONFIG_WARNINGS` 누락 | `review-workflow.ts` — `buildReviewChecklist` JSDoc | "일곱 개 점검"으로 수정, 목록에 `6) NODE_CONFIG_WARNINGS, 7) REQUEST_COVERAGE_LOW` 추가 |
| 5 | Documentation / Requirement | **`renderNodeCatalog` JSDoc 구식 (ED-AI-40 이전 동작 서술)** — JSDoc이 `add_edge` 전 `get_node_schema` 선행 호출 필요로 기술하나, 실제 프롬프트는 `result.ports`가 권위 있는 소스이며 선행 호출 불필요라고 정의 | `system-prompt.ts` — `renderNodeCatalog` JSDoc | "edit 결과의 `result.ports`가 1차 소스; 스냅샷에만 있는 노드에 엣지 연결 시에만 `get_node_schema` 사용"으로 교체 |
| 6 | Side-Effect / Testing | **테스트 간 캐시 격리 미흡** — `resetExpressionCacheForTesting` 호출 후 `afterEach` 복구가 없어 미래 mock 테스트 추가 시 캐시 오염 위험 | `system-prompt.spec.ts` — 캐시 리셋 테스트 | `describe` 블록 상단에 `afterEach(() => resetExpressionCacheForTesting())` 추가 |
| 7 | Testing | **`resetExpressionCacheForTesting` 실제 캐시 초기화 검증 부재** — 리셋 전후 동일 결과만 확인. `null` 초기화 후 lazy-init 경로 재실행 여부 미검증. no-op이어도 테스트 통과 | `system-prompt.spec.ts` — edge cases describe | `getAllFunctionNames`를 spy로 교체하여 리셋 후 두 번째 호출 시 재호출 검증 |
| 8 | Performance | **`collectOrphans` BFS에서 `queue.shift()` 사용** — O(n) 디큐로 전체 BFS가 O(N²+E)로 퇴화 | `review-workflow.ts` — `collectOrphans` BFS 루프 | 인덱스 포인터 방식(`let head = 0; const cur = queue[head++]`)으로 교체해 O(N+E) 회복 |
| 9 | Performance | **`renderNodeCatalog` 매 턴 재계산** — `nodeDefs`는 프로세스 수명 동안 불변이나 매 `buildSystemPrompt` 호출마다 `.map().join()` 전체 재실행. `expressionReferenceCache` 패턴이 이미 있어 일관성도 불일치 | `system-prompt.ts` — `buildSystemPrompt`, `renderNodeCatalog` | `let catalogCache: string \| null = null` 모듈 스코프 캐시 추가 |
| 10 | Performance | **`isRecoveredLater` O(n²) 최악 케이스** — 병렬 배치 tool call 패턴에서 실패 call k개마다 나머지 전체 선형 탐색 | `review-workflow.ts` — `collectUnresolvedFailures` + `isRecoveredLater` | 진입 시 성공 call을 `(name, key) → true` 맵으로 인덱싱하여 O(1) 조회로 개선 |
| 11 | Performance | **`checkRequestCoverage` 문자열 `includes()` — O(tokens × corpus_len)** | `review-workflow.ts` — `checkRequestCoverage` | 노드 라벨을 `tokenize()` → `Set<string>`으로 변환해 `labelTokenSet.has(t)` O(1) 조회 |
| 12 | Performance | **`defsByType` Map 매 호출 재생성** — `buildReviewChecklist` 호출마다 `nodeDefs` Map 재생성 | `review-workflow.ts` — `collectDanglingOutputPorts` 첫 두 줄 | 호출부에서 미리 구성해 주입하거나 lazy-init 캐시 추가 |
| 13 | Testing | **`remove_edge` 회복 경로 미검증** — `isRecoveredLater`에 `remove_edge` 매칭 분기 있으나 spec에서 검증 없음 | `review-workflow.spec.ts` — `UNRESOLVED_FAILED_CALLS` | `remove_edge` 실패 후 재시도 성공 케이스 테스트 추가 |
| 14 | Testing | **순환 `containerId` 방어 미검증** — `hasReachableAncestorContainer`의 `visited` Set 방어 코드가 있으나 순환 fixture로 검증 없음 | `review-workflow.ts` — `hasReachableAncestorContainer` | `containerId`가 순환(A→B→A)하는 fixture로 `collectOrphans` 정상 반환 확인 |
| 15 | Testing | **`getAllFunctionNames()` 실제 엔진 의존** — 엔진 함수 목록 변경 시 무관한 프롬프트 테스트 연쇄 실패 위험 | `system-prompt.spec.ts` 전반 | 특정 함수 목록을 고정한 mock을 사용하는 격리 describe 블록 추가 |
| 16 | Testing | **`configWarnings: []` vs 미존재 구분 미검증** — 명시적 빈 배열과 필드 부재가 동일 처리되는지 검증 없음 | `review-workflow.spec.ts` — `NODE_CONFIG_WARNINGS` describe | `result: { ok: true, configWarnings: [] }` 케이스 명시적 추가 |
| 17 | Testing | **`REQUEST_COVERAGE_LOW` 임계값 경계(30%) 미검증** — 임계값 변경 시 회귀 감지 불가 | `review-workflow.ts` — `REQUEST_COVERAGE_THRESHOLD = 0.3` | 토큰 10개 중 3개 매칭(= 정확히 30%) fixture로 경계값 테스트 추가 |
| 18 | Testing | **`PENDING_USER_CONFIG_UNMENTIONED` — `assistantText` null/빈 문자열 처리 미검증** | `review-workflow.ts` — `collectUnmentionedPendingUserConfig` | `assistantText: ''` 및 생략 케이스 각각 검증 |
| 19 | Scope | **`DANGLING_PORT_LABEL_MAX_LEN` 의미 오용** — dangling 포트 전용으로 명명된 상수를 `NODE_CONFIG_WARNINGS` truncation에도 재사용 | `review-workflow.ts` — `buildReviewChecklist` | `REVIEW_LABEL_MAX_LEN` 등 범용 이름으로 rename |
| 20 | Scope | **`workflow-assistant-stream.service.spec.ts` 미검토** — diff 크기 제한으로 내용 확인 불가 | 파일 5 전체 | diff를 별도 확인해 `NODE_CONFIG_WARNINGS` 관련 외 무관한 변경 혼입 여부 검증 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `REQUEST_COVERAGE_THRESHOLD = 0.3` 임계값 근거 미기술 | `review-workflow.ts` — 상수 선언부 | "토큰 30% 미만 일치 시 경고. 짧은 요청의 false positive 하한 실험치." 주석 추가 |
| 2 | Documentation / Requirement | `TODO(ED-AI-39)` 제거 조건 추상적 — 구체적 완료 기준(마이그레이션 완료, 티켓 번호 등) 불명확 | `review-workflow.ts` — `collectUnmentionedPendingUserConfig` | ED-AI-39 티켓에 `candidates` 필드 migrate 완료 기준 체크리스트 항목 추가 |
| 3 | Documentation | `buildSystemPrompt` 반환 템플릿에 블록 경계 주석 없음 — 5블록 구조가 JSDoc에만 설명됨 | `system-prompt.ts` — `buildSystemPrompt` 반환 리터럴 | `// BLOCK 4`, `// BLOCK 5` 마커 주석 한 줄씩 추가 |
| 4 | Architecture | `collectUnmentionedPendingUserConfig`가 전체 `BuildReviewChecklistInput` 수신 — 실제 사용 필드는 세 개뿐 | `review-workflow.ts:360` | 필요한 세 필드만 구조 분해하는 시그니처로 좁힘 |
| 5 | Architecture / Maintainability | 레이아웃 상수(`LAYOUT_FALLBACK_WIDTH` 등) 사용 위치 추적 불가 — 템플릿 리터럴 내 보간 여부 불명확 | `system-prompt.ts` — 상수 선언부 | `${LAYOUT_FALLBACK_WIDTH}` 보간으로 실제 사용하거나, 미사용 시 제거 |
| 6 | Dependency | `sanitizeLlmProvidedString`이 `shadow-workflow` 모듈에서 임포트 — cross-concern 결합 | `review-workflow.ts` — import 상단 | 중간 규모 개선. 유사 유틸리티 증가 시 `llm-security-utils.ts`로 분리 고려 |
| 7 | Maintainability | `collectOrphans` 내 과거 구현 설명 주석 — O(N×total_nodes) 퇴화 이력은 git commit이 적절한 위치 | `review-workflow.ts` — `collectOrphans` `byId` Map 직전 | 히스토리 주석 제거 또는 "Map을 한 번만 생성해 O(N) 조회 보장"으로 축약 |
| 8 | Maintainability | 테스트 이름 `'keeps the authoritative snapshot guidance that was added previously'` — 히스토리 참조로 맥락 없이 의미 불명 | `system-prompt.spec.ts` — 마지막 독립 `it` 블록 | `'includes authoritative currentWorkflow snapshot guidance and get_current_workflow reference'`로 교체 |
| 9 | Maintainability | spec 파일 내 복잡한 인라인 정규식 — 테스트 실패 시 의도 파악 어려움 | `system-prompt.spec.ts` — plan-only, null-safe 검사 등 | 의미 있는 이름의 상수로 추출 (`const PLAN_ONLY_NO_EMIT_PATTERN = /...`) |
| 10 | Testing | `checklistBlocks([])` 빈 배열 케이스 미검증 | `review-workflow.spec.ts` — `checklistBlocks` describe | `expect(checklistBlocks([])).toBe(false)` 1줄 추가 |
| 11 | Testing | `tokenize` 함수 직접 단위 테스트 부재 — 한국어 조사 제거·길이 필터 등 비자명 로직이 통합 경로에서만 검증 | `review-workflow.ts` — `tokenize` | `tokenize` export 후 경계 케이스 직접 테스트 추가 |
| 12 | Testing | 복수 trigger 노드에서의 orphan 판정 미검증 | `review-workflow.spec.ts` — `ORPHAN_NODES` | `manual_trigger` + `webhook_trigger` 두 개 + 각자 별도 서브그래프 fixture로 orphan 0개 케이스 추가 |
| 13 | Side-Effect | `data` 배열 필드가 원문 보존 — 미래 UI 렌더링 경로 진입 시 markdown/HTML 해석 위험 | `review-workflow.ts` — `collectDanglingOutputPorts` | `data` 배열이 UI 렌더링 경로에 진입하지 않는다는 계약을 API 레벨 타입 또는 주석으로 명시 |
| 14 | Requirement | 절단 시 `details` 카운트가 실제 문제 수 과소 표현 — 25개 고아 노드도 "20 node(s)" 표시 | `review-workflow.ts` — `collectOrphans`, `collectDanglingOutputPorts` | 절단 시 `"at least ${MAX_ORPHANS}"` 형태로 표기 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | MEDIUM | `PENDING_USER_CONFIG_UNMENTIONED` 노드 라벨 sanitization 누락으로 프롬프트 인젝션 표면 존재 |
| Testing | MEDIUM | `resolveEffectiveOutputPorts` 직접 테스트 부재, 슬라이딩 윈도우 정규식 취약성 등 다수 |
| Architecture | LOW | `resetExpressionCacheForTesting` 프로덕션 노출, `data: unknown` 타입 소거, OCP 위반 구조 |
| Side-Effect | LOW | 캐시 노출 + 테스트 간 격리 미흡 |
| Performance | LOW | `queue.shift()` O(n²), `renderNodeCatalog` 재계산 등 — 현 규모에서 체감 미미 |
| Documentation | LOW | JSDoc 불일치 2건 (6→7, ED-AI-40 구식 서술) |
| Maintainability | LOW | JSDoc 불일치, 역순 상수 배치, 복잡한 인라인 정규식 |
| Scope | LOW | JSDoc 불일치, `DANGLING_PORT_LABEL_MAX_LEN` 오용, 파일5 미검토 |
| Requirement | LOW | JSDoc 불일치 2건, sanitization 누락(security와 동일) |
| Concurrency | LOW | `resetExpressionCacheForTesting` Worker Thread 도입 시 위험 (단일 스레드 현재는 안전) |
| Dependency | NONE | 외부 패키지 추가 없음, cross-concern import 경미한 관찰 |
| Database | NONE | DB 접근 코드 없음 |
| API Contract | NONE | HTTP API 계약 관련 코드 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 이유 |
|----------|------|
| Database | 리뷰 대상이 순수 인메모리 연산 — DB 접근 코드 전혀 없음 |
| API Contract | LLM 에이전트 내부 로직만 포함 — HTTP API 계약 관련 코드 없음 |

---

## 권장 조치사항

1. **[즉시 — Security]** `PENDING_USER_CONFIG_UNMENTIONED` 블록의 `p.label`·`f.label`·`f.field`에 `sanitizeLlmProvidedString` 적용 + 회귀 테스트 추가. 인접 블록에 이미 동일 패턴이 있어 수정 비용 낮음.

2. **[즉시 — Testing]** `resolve-dynamic-ports.ts` 전용 spec 작성 또는 `DANGLING_OUTPUT_PORTS` describe에 동적 포트 유형별 케이스 추가.

3. **[단기 — Testing]** `❌[\s\S]{0,400}` 정규식을 블록 범위 기반 패턴으로 교체해 프롬프트 성장에 강건한 테스트로 전환.

4. **[단기 — Architecture]** `resetExpressionCacheForTesting`에 `process.env.NODE_ENV !== 'test'` 런타임 가드 추가 또는 test-utils 파일로 분리.

5. **[단기 — Documentation]** `buildReviewChecklist` JSDoc "여섯 개" → "일곱 개" 수정 및 `renderNodeCatalog` JSDoc을 ED-AI-40 이후 동작으로 갱신.

6. **[단기 — Testing]** `remove_edge` 회복 경로, 순환 `containerId` 방어, 캐시 재초기화, 임계값 경계(30%) 테스트 추가.

7. **[중기 — Performance]** `collectOrphans` BFS의 `queue.shift()` → 인덱스 포인터 교체; `renderNodeCatalog` 결과 모듈 스코프 캐싱.

8. **[중기 — Architecture]** `ReviewChecklistItem.data: unknown` → discriminated union으로 전환하여 소비 측 타입 단언 제거.

9. **[장기 — Architecture]** 체크리스트 점검 함수를 레지스트리 배열 패턴으로 전환해 OCP 확보 (현재 7개 규모에서는 선택적).