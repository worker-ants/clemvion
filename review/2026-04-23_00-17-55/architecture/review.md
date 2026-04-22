### 발견사항

---

**[WARNING] `ShadowResult` 인터페이스가 암묵적 유니온 타입으로 팽창**
- 위치: `shadow-workflow.ts` — `ShadowResult` 인터페이스
- 상세: `knownTypes`, `suggestedType`, `repeatCount`, `hint` 가 모두 선택적으로 추가되었으나, 어떤 error code 에서 어떤 필드가 유효한지를 TypeScript 가 강제하지 못한다. 예를 들어 `LABEL_CONFLICT` 응답에 `knownTypes` 를 실수로 넣어도 컴파일 에러가 없다. 에러 코드가 늘수록 이 interface 는 계속 비대해진다.
- 제안: Discriminated union 으로 교체.
```ts
type ShadowResult =
  | { ok: true; id: string; removedEdgeIds?: string[] }
  | { ok: false; error: 'UNKNOWN_NODE_TYPE'; knownTypes: string[]; suggestedType?: string; hint: string }
  | { ok: false; error: 'LABEL_CONFLICT'; suggested: string; repeatCount?: number; hint?: string }
  | { ok: false; error: Exclude<ShadowErrorCode, 'UNKNOWN_NODE_TYPE' | 'LABEL_CONFLICT'>; ... }
```

---

**[WARNING] `ShadowWorkflow` 의 단일 책임 위반 — 진단 상태·힌트 생성이 그래프 도메인에 혼재**
- 위치: `shadow-workflow.ts` — `labelConflictCounts`, `recentFailedAddNodeLabels`, `buildUnknownNodeTypeResult`, `closestKnownType`, `recordFailedAddNode`, `forgetFailedAddNode`
- 상세: `ShadowWorkflow` 의 핵심 책임은 워크플로우 그래프 상태 복제·검증이다. 그러나 이번 변경으로 (1) 턴 범위 진단 상태(`labelConflictCounts`, `recentFailedAddNodeLabels`), (2) Levenshtein 기반 타입 제안 로직, (3) 영어 힌트 문자열 생성이라는 세 가지 추가 책임이 생겼다. 이는 변경 이유가 세 가지로 늘어나는 전형적인 SRP 위반이다. 특히 힌트 문자열은 프레젠테이션 계층 관심사가 도메인 클래스에 내려온 것이다.
- 제안: `ShadowWorkflowErrorAdvisor` 같은 협력 클래스를 분리해 진단 상태 추적과 힌트 구성을 담당하게 하거나, 최소한 힌트 문자열을 모듈 상수로 분리해 도메인 메서드가 문자열을 조립하지 않도록 한다.

---

**[WARNING] `WorkflowAssistantStreamService.evaluateReviewGuard` 에 혼합된 책임**
- 위치: `workflow-assistant-stream.service.ts` — `evaluateReviewGuard` (~60 lines)
- 상세: 이 메서드는 (1) 가드 발동 조건 판별 (`reviewCompleted`, `planClearedThisTurn`, `finishBlockCount`), (2) 플랜 컨텍스트 해결 (`findActivePlanContext`), (3) 스냅샷 기반 trivial 판별 (`nonTriggerCount <= 1`), (4) 체크리스트 위임 (`buildReviewChecklist`), (5) 응답 객체 구성 이라는 다섯 가지를 한 메서드가 담당한다. `buildReviewChecklist` 는 `review-workflow.ts` 로 올바르게 분리됐지만, 가드 오케스트레이션 자체는 여전히 서비스 내부에 깊이 매립되어 있다.
- 제안: `ReviewGuardPolicy` 혹은 `FinishGuardEvaluator` 계층을 만들어 가드 활성화 로직을 캡슐화하고, 서비스는 호출만 하도록 역할을 좁힌다.

---

**[INFO] 턴 범위 `schemaCache` 가 `streamMessage` 내부에 인라인 관리**
- 위치: `workflow-assistant-stream.service.ts` — `const schemaCache = new Map(...)` 와 `get_node_schema` 분기
- 상세: 캐시 히트 카운팅·에스컬레이션 정책이 tool 처리 분기 중간에 약 30줄로 인라인으로 구현되어 있다. 기능적으로 올바르나, `get_node_schema` 브랜치만 유독 복잡해져 가독성을 저하시킨다. 또한 `schemaCache` 의 라이프사이클(턴 범위)이 `ShadowWorkflow` 의 라이프사이클과 암묵적으로 결합된다는 사실이 문서화되지 않았다.
- 제안: `SchemaCacheGuard` 소형 클래스를 추출해 `get(type)`, `record(type, result)` 인터페이스와 에스컬레이션 정책을 캡슐화한다.

---

**[INFO] `NODE_TYPE_ALIASES` — 비즈니스 지식이 도메인 모듈에 하드코딩**
- 위치: `shadow-workflow.ts` — `NODE_TYPE_ALIASES` 상수
- 상세: LLM 이 자주 오해하는 타입 별칭("LLM 오탐 패턴")은 노드 카탈로그가 바뀔 때마다 수동으로 유지해야 한다. 현재는 6개로 작지만, 노드 카탈로그가 성장할수록 이 맵도 커진다. 변경 이유가 카탈로그 변경과 LLM 행동 패턴 변경 두 가지로 분리된다.
- 제안: 노드 타입 정의 파일 또는 별도 설정 파일에서 가져오도록 하여 카탈로그 변경 시 한 곳만 수정하면 되도록 한다.

---

**[INFO] `review-workflow.ts` — 모듈 경계와 응집도 양호**
- 위치: `review-workflow.ts` 전체
- 상세: 순수 함수 모듈로 설계되었고, `collectPendingUserConfig` 를 함수 주입으로 받아 서비스 계층에 역방향 의존하지 않는다. 5개 점검이 독립적으로 테스트 가능하며, 인터페이스(`BuildReviewChecklistInput`, `ReviewChecklistItem`)도 명확하다. 이번 변경에서 가장 잘 분리된 모듈이다.

---

**[INFO] `FinishGuardState` 의 guard 상태 누적 성장**
- 위치: `workflow-assistant-stream.service.ts` — `FinishGuardState` 인터페이스
- 상세: `reviewCompleted`, `reviewRoundCount` 가 추가되어 단계별 가드 상태가 하나의 상태 백(state bag)에 혼합되고 있다. guard 단계가 하나 더 추가되면 이 패턴이 반복된다.
- 제안: 현재 규모에서는 허용 가능하나, guard 단계가 늘어날 경우 `{ planGuard: PlanGuardState; reviewGuard: ReviewGuardState }` 형태로 서브 타입화를 검토한다.

---

### 요약

이번 변경은 LLM 의 반복 실수를 서버 측에서 선제 차단하는 "Self-Healing Loop" 아키텍처를 구현한다. `review-workflow.ts` 의 순수 함수 분리, 의존성 역전(`collectPendingUserConfig` 주입), 테스트 커버리지는 모두 수준 이상이다. 그러나 세 가지 구조적 문제가 눈에 띈다: `ShadowResult` 가 암묵적 유니온으로 팽창해 타입 안전성을 잃어가고 있고, `ShadowWorkflow` 가 그래프 도메인 외에 진단·힌트 생성 책임을 흡수해 SRP 를 위반하며, 영어 힌트 문자열이 도메인 클래스에 직접 박혀 있어 프레젠테이션 계층이 도메인을 침범하는 구조다. 기능 확장보다 앞서 `ShadowResult` 를 discriminated union 으로 교체하는 것이 가장 시급한 아키텍처 부채 상환 과제다.

### 위험도

**MEDIUM**