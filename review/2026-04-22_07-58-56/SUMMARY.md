# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 사이클 검출 BFS 수정 경로가 테스트로 커버되지 않고, 포트 미검증으로 인해 iteration 외 연결도 사이클 검사를 우회할 수 있음

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Architecture / Side Effect / Requirement | **포트 미검증 — back-edge 예외가 `emit` 포트에 한정되지 않음** (4개 에이전트 공통 지적): `isContainerAncestor`는 구조(자식→조상)만 검사하고 `targetPort`를 검증하지 않아, `child→container.in`, `child→container.body` 같은 비-iteration 경로도 사이클 검사를 우회한다. 실행 엔진이 `emit` 외 포트의 back-edge를 기대하지 않으면 런타임 무한루프 위험이 있음 | `shadow-workflow.ts:252-260`, `addEdge` | 예외 조건에 `targetPort === 'emit'` (또는 허용 포트 Set) 검사를 추가. 스펙 §4.4에 허용 포트 목록을 먼저 명시한 뒤 구현에 반영 |
| 2 | Security | **`containerId` 조작을 통한 사이클 감지 우회**: `currentWorkflow` 페이로드는 클라이언트가 직접 제출한다. 악의적 사용자가 `containerId`를 조작해 `isContainerAncestor(A, B) = true`를 만들면 `add_edge(A, B)` 호출 시 사이클 검사가 완전히 스킵됨 | `shadow-workflow.ts:252-258`, `isContainerAncestor` | 백엔드에서 `currentWorkflow` 수신 시 DB에 저장된 실제 `containerId` 관계와 교차 검증하거나, shadow 레이어 진입 전 서버 측에서 `containerId` 정합성을 별도 검증 |
| 3 | Testing | **`wouldCreateCycle` 내 BFS 수정 경로가 직접 검증되지 않음**: 기존 loopback 에지를 DFS에서 스킵하는 신규 로직이 있으나, 이 경로를 직접 테스트하는 케이스가 없음. `child→loop` back-edge가 이미 존재하는 상태에서 `external→loop` 추가 시 false를 반환하는지 미검증 | `shadow-workflow.ts:331-336`, `shadow-workflow.spec.ts` | `loopback 에지가 이미 존재하는 상태`에서 외부→컨테이너 에지 추가가 허용되는지 확인하는 테스트 케이스 추가 |
| 4 | Testing / Requirement | **중첩 조상 loopback 테스트에 pre-existing 에지 부재**: 두 번째 loopback 허용 테스트(`edges: []`)는 `wouldCreateCycle`이 어차피 false를 반환하는 구조라 `isContainerAncestor` 예외 없이도 동일 결과가 나옴. false-positive 방지 핵심 경로가 실제로 실행되지 않음 | `shadow-workflow.spec.ts:392–444` | `outer→inner`, `inner→grandchild` body 에지를 pre-existing 에지로 추가해 `wouldCreateCycle`이 실제로 cycle을 오판하는 상황을 만들어야 함 |
| 5 | Testing | **손상된 `containerId` 순환 체인 테스트 누락**: `A.containerId = B, B.containerId = A` 같은 순환 데이터에서 `visited` Set 방어 코드가 실제로 동작하는지 검증 없음 | `shadow-workflow.ts:344-355` | `containerId`가 서로를 가리키는 두 노드로 스냅샷 구성 후 `add_edge` 호출 시 예외 없이 종료되고 false 반환하는지 확인하는 테스트 추가 |
| 6 | Testing | **"allows" 케이스에서 스냅샷 상태 미검증**: 첫 번째·두 번째 loopback 허용 테스트가 `result.ok === true`만 검증하고 에지가 스냅샷에 실제로 추가되었는지(`sw.snapshot().edges`) 확인하지 않음. 기존 `add_edge` 테스트들은 스냅샷까지 검증하는 패턴 | `shadow-workflow.spec.ts:330-435` | `expect(sw.snapshot().edges).toHaveLength(N)` 및 추가된 에지의 속성 검증 추가 |
| 7 | Architecture / Maintainability | **컨테이너 우회 규칙이 두 곳에 분산**: "자식→조상 에지는 사이클 검사 우회" 규칙이 `addEdge`와 `wouldCreateCycle` 두 곳에 각각 구현됨. 우회 조건 변경 시(포트 한정 등) 두 곳 모두 일관되게 수정해야 하는 묵시적 결합 존재 | `shadow-workflow.ts:252-258`, `shadow-workflow.ts:331-337` | `shouldBypassCycleCheck(sourceId, targetId, targetPort)` 단일 술어 메서드로 추출해 양쪽에서 호출 |
| 8 | Performance | **루프 내 반복적인 `new Set<string>()` 생성**: `wouldCreateCycle` DFS 내부에서 방문 노드마다 전체 엣지를 순회하면서 `isContainerAncestor` 호출 시 매번 `new Set<string>()`이 생성됨. 최악 O(V×E)번의 Set 할당 발생 | `shadow-workflow.ts:331-343` | DFS 진입 전 back-edge를 한 번만 pre-filter해 `Map<string, Set<string>>`으로 캐싱하거나, `wouldCreateCycle` 내 skip 로직을 조상 집합 사전 계산으로 대체 |
| 9 | Maintainability | **`addEdge`의 이중 중첩 if**: `if (!isContainerAncestor(...)) { if (wouldCreateCycle(...)) { ... } }` 구조가 하나의 조건을 표현하는데 불필요한 중첩을 만듦 | `shadow-workflow.ts`, `addEdge` | `if (!this.isContainerAncestor(sourceId, targetId) && this.wouldCreateCycle(sourceId, targetId))` 로 단일 조건으로 합칠 것 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | **`isContainerAncestor` JSDoc에 `@param`/`@returns` 태그 누락**: 메서드 이름이 직관적이나 IDE 호버 시 인자 설명이 나타나지 않음 | `shadow-workflow.ts:352` | `@param nodeId`, `@param candidateAncestorId`, `@returns` 태그 추가 |
| 2 | Documentation / Scope | **`wouldCreateCycle` 주석 영한 혼용**: 기존 영문 주석에 한국어 설명이 이어붙여져 일관성 저하 | `shadow-workflow.ts:323-327` | 파일 전체 언어 정책을 통일하거나 이 블록 내에서 한 언어로 통일 |
| 3 | Documentation | **spec 표 §4.4 셀에 규칙+예외+구현이유가 혼재**: 약 140자 단일 셀로 가독성 저하 | `spec/3-workflow-editor/4-ai-assistant.md:229` | 셀 본문은 `CYCLE_DETECTED` 조건 요약만 남기고, 예외 설명은 표 아래 블록 인용 또는 각주로 분리 |
| 4 | Maintainability | **테스트 노드 픽스처 보일러플레이트 과다 반복**: 8줄짜리 노드 객체가 케이스마다 인라인 반복. `twoNodeSnap()` 같은 헬퍼 패턴이 이미 파일에 존재 | `shadow-workflow.spec.ts` 신규 케이스 전체 | `makeNode(id, type, opts?)` 팩토리 헬퍼 도입 |
| 5 | Maintainability | **`wouldCreateCycle` 내 `cur` 대신 `edge.sourceNodeId` 재참조**: guard-clause로 이미 `edge.sourceNodeId === cur`임을 보장했으나 아래에서 `edge.sourceNodeId`를 다시 사용해 독자가 위로 되짚어 확인해야 함 | `shadow-workflow.ts`, `wouldCreateCycle:331-337` | `this.isContainerAncestor(cur, edge.targetNodeId)` 로 변경 |
| 6 | Maintainability / API | **`isContainerAncestor` 파라미터명 방향 모호성**: 호출부에서 `(sourceId, targetId)` 형태로 읽으면 어느 쪽이 조상인지 즉시 파악 어려움 | `shadow-workflow.ts`, 메서드 시그니처 | `(descendantId, candidateAncestorId)` 로 파라미터명 변경 또는 `sourceHasAncestor(sourceId, ancestorId)` 로 이름 변경 고려 |
| 7 | API Contract | **spec §4.3 인자 네이밍 불일치 (기존 이슈)**: 스펙은 camelCase(`sourceId`), 구현은 snake_case(`source_id`) primary | `spec/3-workflow-editor/4-ai-assistant.md` §4.3 | spec §4.3을 `source_id`/`target_id`로 통일하거나 fallback 지원을 spec에 명시 |
| 8 | Architecture | **`addEdge` outer guard와 `wouldCreateCycle` 내부 skip의 역할 관계가 비명시적**: layering 구조가 주석 없이 파악하기 어려움 | `shadow-workflow.ts:252-258` | "early-exit — existing back-edges are also excluded inside wouldCreateCycle" 한 줄 주석 추가 |
| 9 | Architecture | **`containerId` 체인 깊이 무제한**: `visited` Set으로 무한루프는 방어하나 명시적 상한 없음. DoS 수준은 아님 | `shadow-workflow.ts`, `isContainerAncestor` | `MAX_CONTAINER_DEPTH = 50` 수준의 순회 횟수 상한 추가 고려 |
| 10 | Scope / Documentation | **멀티라인 JSDoc 블록이 CLAUDE.md 컨벤션("multi-line comment blocks 금지")과 불일치**: 설계 의도 전달에 실질적 가치는 있음 | `shadow-workflow.ts`, `isContainerAncestor` 상단 JSDoc | 한 줄로 압축(`// visited 보호: containerId 체인 자체가 순환된 손상 데이터 방어`) 고려 |
| 11 | Testing | **중간 컨테이너 노드가 조상 컨테이너로 loopback하는 케이스 미테스트** | `shadow-workflow.spec.ts` | `inner(containerId=outer) → outer` 에지 추가 허용 케이스 추가 |
| 12 | Documentation | **코드 주석 `(spec §4.4)` 참조에 절 제목/경로 누락**: spec 구조 변경 시 stale 될 수 있음 | `shadow-workflow.ts:259` | `(spec §4.4 Shadow 검증 규칙)` 또는 경로 포함 형태로 변경 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Security | **MEDIUM** | `containerId` 조작 우회 가능성, 포트 미검증으로 non-emit 경로 허용 |
| Testing | **MEDIUM** | BFS 수정 경로 미검증, 손상 데이터 방어 코드 미검증, 스냅샷 상태 미검증 |
| Architecture | **LOW** | 우회 규칙 2곳 분산, 포트 의미론 미반영 |
| Performance | **LOW** | DFS 내 반복적 Set 생성, 기존 O(E) 순회 구조 악화 |
| Maintainability | **LOW** | 이중 중첩 if, 픽스처 보일러플레이트, 파라미터명 모호성 |
| Requirement | **LOW** | 중첩 조상 loopback 테스트의 false-positive 방지 경로 미실행 |
| API Contract | **LOW** | `CYCLE_DETECTED` 반환 범위 축소(의도된 변경), spec 인자 네이밍 불일치 |
| Side Effect | **LOW** | 포트 미검증, 의도된 행동 변화 문서화 권고 |
| Documentation | **LOW** | JSDoc 태그 누락, 주석 언어 혼용, spec 표 가독성 |
| Scope | **LOW** | CLAUDE.md 멀티라인 주석 컨벤션 경미한 불일치 |
| Concurrency | **NONE** | 동기 로직만 변경, 실질적 동시성 위험 없음 |
| Dependency | **NONE** | 신규 외부 의존성 없음 |
| Database | **NONE** | DB 연관 없음 |

---

## 발견 없는 에이전트

- **Database** — 순수 인메모리 로직으로 DB 관련 요소 없음
- **Dependency** — 신규 외부 패키지 없음, 내부 모듈만 사용
- **Concurrency** — 전체 변경이 동기 로직, Node.js 단일 스레드 하에서 경쟁 조건 없음

---

## 권장 조치사항

1. **[MEDIUM] 포트 검증 추가** — `isContainerAncestor` 예외 적용 조건에 `targetPort === 'emit'` (또는 허용 포트 Set) 검사 추가. 스펙 §4.4에 허용 포트 목록 명시가 선행되어야 함 (Security + Architecture + Side Effect + Requirement 공통)

2. **[MEDIUM] `wouldCreateCycle` BFS 수정 경로 테스트 추가** — 기존 loopback 에지가 존재하는 상태에서 외부→컨테이너 에지 추가가 올바르게 허용되는지 직접 검증하는 테스트 케이스 작성

3. **[MEDIUM] 중첩 조상 loopback 테스트에 pre-existing 에지 추가** — `edges: []` 초기화를 body 에지 포함으로 수정해 false-positive 방지 경로가 실제로 실행되도록 개선

4. **[LOW] 우회 규칙 단일 출처로 추출** — `shouldBypassCycleCheck(sourceId, targetId, targetPort)` 술어 메서드 추출로 `addEdge`와 `wouldCreateCycle` 양쪽의 규칙을 통일

5. **[LOW] 손상된 `containerId` 순환 체인 테스트 추가** — `A.containerId = B, B.containerId = A` 데이터에서 무한루프 없이 false를 반환하는지 검증

6. **[LOW] "allows" 케이스 스냅샷 검증 추가** — `result.ok === true` 외에 `sw.snapshot().edges` 길이 및 추가된 에지 속성 검증

7. **[LOW] `addEdge` 이중 중첩 if 단순화** — `&&` 조건으로 합치고, `cur` vs `edge.sourceNodeId` 일관성 수정

8. **[INFO] 보안 권고** — `currentWorkflow` 입력 수신 지점에서 DB의 실제 `containerId` 관계와 교차 검증하는 서버 측 방어 로직 장기 검토 (현재 ShadowWorkflow가 영구 저장 전 검증 레이어임을 감안하면 즉각 대응 필수는 아님)