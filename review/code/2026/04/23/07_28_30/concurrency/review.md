### 발견사항

- **[INFO]** `isPlanPendingApproval` 헬퍼 및 `planPending` 가드 — 로컬 변수 전용, 안전
  - 위치: `stream.service.ts` — `isPlanPendingApproval`, `planPending` 선언 블록
  - 상세: `isPlanPendingApproval`은 순수 함수(입력만 읽고, 공유 상태 미접촉). `planPending`·`finishReason` 덮어쓰기는 단일 `streamMessage` 호출의 스택 프레임에 속한 로컬 변수이며, `for await...of` 루프는 JavaScript의 협력적 스케줄링 안에서 순차 실행된다. 두 `await` 포인트 사이 동기 블록에는 다른 코루틴이 끼어들 여지가 없으므로 경쟁 조건 없음.
  - 제안: 없음

- **[INFO]** `collectDanglingOutputPorts` — 전달된 불변 데이터 전용, 안전
  - 위치: `review-workflow.ts` — `collectDanglingOutputPorts`
  - 상세: `snapshot`(입력 DTO)과 `nodeDefs`(레지스트리 스냅샷) 모두 함수 호출 시점에 값으로 전달되며, 함수 내부에서 생성하는 `defsByType`, `outgoingPortsByNode`는 로컬 Map이다. 공유 가변 상태에 대한 접근이 없으며 완전한 동기 함수다.
  - 제안: 없음

- **[INFO]** `resolveEffectiveOutputPorts` — 순수 함수, 동시성 이슈 없음
  - 위치: `resolve-dynamic-ports.ts` 전체
  - 상세: 전역 변수·싱글톤 참조가 없고 모든 상태가 함수 인자에서 파생된다. 스레드 안전성 개념 자체가 적용될 여지가 없다.
  - 제안: 없음

- **[INFO]** `this.nodeRegistry.listDefinitions()` 호출 시점 — 이론적 TOCTOU
  - 위치: `stream.service.ts` — `evaluateReviewGuard` 내 `nodeDefs: this.nodeRegistry.listDefinitions()`
  - 상세: 레지스트리가 런타임 hot-reload를 지원하는 경우, snapshot 시점과 review 실행 시점 사이에 노드 정의가 변경되면 `collectDanglingOutputPorts`가 스냅샷에 존재하지 않는 타입의 정의를 참조하지 못하고 `def` 조회에서 `continue`로 건너뛸 수 있다(false negative). 단, `def`가 없으면 판정을 스킵하도록 방어 코드가 있어 크래시나 잘못된 blocking은 발생하지 않는다. 프로덕션에서 레지스트리가 정적이라면 무시 가능.
  - 제안: 레지스트리가 동적 등록을 지원할 경우, `listDefinitions()`를 review 함수 진입 직전 한 번만 호출하고 결과를 local const로 고정하는 현재 방식이 이미 최선. 추가 조치 불필요.

- **[WARNING]** 동일 `sessionId` 동시 요청 시 `appendMessage` 경쟁 조건 — 기존 아키텍처 이슈, 이번 변경으로 심화되지 않음
  - 위치: `persistAssistantTurn` → `sessionService.appendMessage`
  - 상세: 이번 diff의 `DANGLING_OUTPUT_PORTS` 체크 및 `isPlanPendingApproval` 가드는 모두 로컬 변수 기반이므로 기존 race에 추가 노출되지 않는다. 단, `buildReviewChecklist`가 `nodeDefs`를 추가 인자로 받음으로써 review 경로가 하나 늘었고, 두 concurrent 요청이 각자의 `nodeDefs` 스냅샷을 가지고 독립적으로 `DANGLING_OUTPUT_PORTS`를 판정하는 시나리오는 안전하다(각자 독립 로컬). `appendMessage` 이중 persist 가능성은 이전부터 존재하며 이번 변경과 무관하다.
  - 제안: 별도 이슈로 분리(세션 레벨 락 또는 클라이언트 단일 요청 보장) — 이번 diff 범위 밖.

---

### 요약

이번 변경(DANGLING_OUTPUT_PORTS 체크 추가, `isPlanPendingApproval` 헬퍼 추출, `planPending` round-trip 차단 가드)은 동시성 관점에서 **신규 위험을 도입하지 않는다**. 추가된 모든 함수(`isPlanPendingApproval`, `collectDanglingOutputPorts`, `resolveEffectiveOutputPorts`)는 공유 가변 상태에 접근하지 않는 순수·동기 함수이며, `finishReason` 덮어쓰기와 `shouldContinueLoop` 계산은 단일 코루틴 스택 내 직렬 실행이 보장된다. 유일한 잠재적 동시성 위험은 이번 diff 이전부터 존재하는 동일 세션 동시 요청 시 `appendMessage` 경쟁 조건이며, 신규 코드는 이를 악화시키지 않는다.

### 위험도
**LOW** — 기존 `appendMessage` race condition이 사전 이슈로 남아 있으나, 이번 변경으로 인한 신규 동시성 위험은 없음