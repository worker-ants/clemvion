# 테스트(Testing) 리뷰 결과

리뷰 대상: `execution-engine.service.ts` — `waitForAiConversation` else-if 분기 추가 (`button_click` graceful degradation)
리뷰 일시: 2026-05-25

---

## 발견사항

### [INFO] 신규 테스트 존재 여부 — 핵심 회귀 케이스가 커버됨

- 위치: `execution-engine.service.spec.ts` diff 추가분 (line 36–102)
- 상세: 변경된 프로덕션 코드(`button_click` 분기 추가)에 대응하는 회귀 테스트가 동일 PR 에 포함되어 있다. 테스트는 MAX_UNKNOWN_SKIPS (=20) 를 충분히 초과하는 25회 `button_click` 이벤트를 시뮬레이션한 뒤 대화가 alive 상태를 유지하고 FAILED 로 종결되지 않음을 검증한다. 테스트 목적과 시나리오가 충분히 명확하다.
- 제안: 없음 (충족).

---

### [WARNING] 커버리지 갭 — `button_click` 직후 정상 `ai_message` 로 대화가 계속되는 경로 미검증

- 위치: `execution-engine.service.spec.ts` 신규 테스트 (line 84–102)
- 상세: 현재 테스트는 25회 `button_click` 후 `endAiConversation` 으로 종결하는 경로만 검증한다. 실제 운영 시나리오는 stale click 을 수신한 뒤 사용자가 정상 텍스트 메시지(`ai_message`)를 입력해 대화를 이어가는 흐름이다. 이 경로(button_click N 회 → ai_message → 정상 turn 처리 → ended)가 테스트되지 않으면 `button_click` 분기가 `pendingContinuations` Map 의 엔트리를 consume 하지 않는 구현(현재 설계: resolve 없이 loop 재진입)이 후속 `ai_message` 핸들링과 올바르게 인터리빙됨을 보장하기 어렵다.
- 제안: 다음 시나리오의 통합 케이스를 추가한다.
  ```
  button_click × 3 → ai_message("hello") → 정상 turn ended
  ```
  `warnSpy` 로 cap warn 부재를 확인하고, `ai_message` 에 대한 `endReturn` 이 반환된 뒤 `execPromise` 가 정상 resolve 됨을 검증한다.

---

### [WARNING] 커버리지 갭 — `buttonId` 문자열 64자 슬라이싱 경계값 미검증

- 위치: `execution-engine.service.ts` diff (신규 추가 코드, `buttonIdRaw.slice(0, 64)`)
- 상세: 프로덕션 코드에서 `buttonIdStr = typeof buttonIdRaw === 'string' ? buttonIdRaw.slice(0, 64) : ''` 로 길이를 제한한다. 그러나 테스트에서는 일반 문자열 `btn-0` ~ `btn-24` 만 사용해 경계값(64자 이상 buttonId, 빈 문자열, null, 숫자 타입)이 전혀 검증되지 않는다. 특히 `buttonIdRaw` 가 `null` 이나 숫자 타입일 때 `else ''` 분기로 올바르게 처리되는지 프로덕션 코드 동작을 단위 테스트로 pin 하지 않는다.
- 제안: `applyContinuation` 의 button_click 경로에서 다음 케이스를 단위 추가한다.
  - `buttonId: 'x'.repeat(100)` — warn 메시지에 64자로 truncate 된 buttonId 가 포함됨을 검증.
  - `buttonId: null` — `typeof` guard 가 `''` 로 fallback 됨을 검증.
  - `buttonId: 12345` (number) — 동일 fallback.

---

### [INFO] 엣지 케이스 — `button_click` 과 `cancel` 이 동시 도달하는 race 경로 미검증

- 위치: 신규 테스트 전반
- 상세: 텔레그램 stale click 이 누적되는 도중 사용자가 다른 채널에서 `cancelWaitingExecution` 을 트리거하는 시나리오를 테스트하지 않는다. 현재 `button_click` 분기는 단순 warn + loop 재진입이므로 `cancel` 이 뒤따를 경우 `pendingContinuations` Map 에서 reject 가 정상 호출되어야 한다. 이 인터리빙이 보장되지 않으면 `cancel` 이 button_click 루프 안에서 묻히는 잠재 회귀가 생긴다.
- 제안: `button_click × 3 → cancel → execPromise rejects(CANCELLED)` 케이스를 추가하여 cancel 이 루프를 정상 중단시킴을 검증한다.

---

### [INFO] Mock 적절성 — `ContinuationBusService` mock 의 `button_click` 분기가 `applyContinuation` 를 직접 호출

- 위치: `execution-engine.service.spec.ts` line 419–427 (기존 ContinuationBusService mock, 변경 없음)
- 상세: mock 의 `button_click` 핸들러는 `resolvedService.applyContinuation(executionId, nodeExecutionId, { type: 'button_click', buttonId })` 를 호출한다. 이는 실제 BullMQ Worker → `applyContinuation` 호출과 동등하며 round-trip 을 정확히 시뮬레이션한다. 단, mock 이 `nodeExecutionId` 로 `msg.nodeExecutionId ?? '__no_node_exec__'` 를 사용하는데, 신규 테스트의 `pendingEntry?.resolve(...)` 경로는 `pendingContinuations.get(executionId)` 로 직접 접근하므로 `nodeExecutionId` 매칭이 없다. 이는 현재 구현(executionId 기반 lookup)과 일치하므로 mock 자체의 문제는 없다.
- 제안: 없음. 현재 mock 설계가 적절하다.

---

### [INFO] 테스트 격리 — `warnSpy.mockRestore()` 가 finally 없이 호출됨

- 위치: `execution-engine.service.spec.ts` 신규 테스트 line 101
- 상세: `warnSpy.mockRestore()` 가 `execPromise` await 이후 직렬로 호출된다. `execPromise` 가 reject 되면 (예: 테스트 중간 예기치 않은 실패) `mockRestore` 가 호출되지 않아 이후 `it` 블록의 `warn` 카운트에 영향을 줄 수 있다. 기존 유사 테스트(line 33 의 `warnSpy.mockRestore()` 패턴)도 동일 패턴을 사용하므로 프로젝트 전반의 일관된 관례이기는 하나, 격리 측면에서 취약하다.
- 제안: `try { await execPromise; } finally { warnSpy.mockRestore(); }` 패턴으로 변경하여 실패 시에도 spy 가 복원되도록 한다. 또는 `afterEach` 에서 `jest.restoreAllMocks()` 를 호출하는 방안도 가능하다.

---

### [INFO] 테스트 가독성 — `pendingContinuations` 접근 시 타입 단언 중복

- 위치: `execution-engine.service.spec.ts` 신규 테스트 line 67–74
- 상세: 기존 describe `continuation entry points` 에는 `getPendings` 헬퍼(line 973–983)가 이미 정의되어 있는데, 신규 테스트는 이 헬퍼를 사용하지 않고 동일한 `(service as unknown as {...}).pendingContinuations` 인라인 단언을 사용한다. 신규 테스트가 다른 `describe` 블록(`waitForAiConversation` 블록) 안에 추가되어 `getPendings` 헬퍼가 scope 밖이라는 이유가 있을 수 있으나, 헬퍼를 최상위 함수로 격상하면 중복을 줄일 수 있다.
- 제안: `getPendings` 를 describe 블록 외부로 이동하거나, 신규 테스트 블록 내에 로컬 헬퍼로 추가하여 타입 단언 중복을 제거한다.

---

### [INFO] 회귀 테스트 유효성 — 기존 `unknown skip limit` warn 테스트 와의 관계

- 위치: `execution-engine.service.spec.ts` 내 `waitForAiConversation` describe 블록 기존 테스트 (diff 이전 코드, line 3094 컨텍스트)
- 상세: 기존 테스트가 `unknownSkipCount >= MAX_UNKNOWN_SKIPS` 일 때 warn 및 FAILED 종결이 발생하는 경로를 검증하고 있을 것으로 추정된다. 신규 `button_click` 분기가 `unknownSkipCount` 증가를 건너뛰므로, 기존 cap 테스트는 영향을 받지 않는다(button_click 은 cap 대상 외). 변경 후에도 기존 테스트가 여전히 unknown type (예: 'bogus') 에 대해 cap 을 정상 발동시킴을 확인하는 것이 바람직하다. 기존 테스트가 이 경로를 다루고 있다면 회귀 가드가 충분하다.
- 제안: 기존 `MAX_UNKNOWN_SKIPS` 테스트가 `button_click` 이 아닌 진짜 unknown type 으로 cap 이 발동됨을 명시적으로 `buttonId` 없는 임의 type 으로 검증하는지 확인한다. 현재 변경으로 인해 기존 테스트가 무효화되지 않는다면 추가 조치 불필요.

---

### [INFO] 테스트 용이성 — `waitForAiConversation` 내부 로직의 직접 단위 테스트 불가

- 위치: `execution-engine.service.ts` 신규 `else if (action.type === 'button_click')` 분기
- 상세: 신규 분기는 private 루프(`waitForAiConversation`) 내부에 있어 외부에서 직접 호출할 수 없다. 테스트는 전체 `service.execute` → flushPromises → pendingContinuations resolve 루프를 경유해야만 이 분기를 도달할 수 있다. 이 구조는 현재 코드베이스의 일반적인 패턴이므로 특별한 설계 결함은 아니지만, 분리 테스트가 어렵다는 제약은 남아 있다. 의존성 주입 가능한 `onButtonClickDuringAiConversation` 같은 별도 메서드로 추출하면 단위 테스트가 용이해질 수 있다.
- 제안: 즉각 리팩터링보다는, 향후 `waitForAiConversation` 로직이 복잡해질 경우 helper 분리를 고려하는 기술 부채로 기록한다.

---

## 요약

변경된 `button_click` graceful degradation 로직에 대응하는 회귀 테스트가 동일 PR 에 포함되어 있으며, 핵심 시나리오(MAX_UNKNOWN_SKIPS 초과에도 대화 alive 유지)를 올바르게 검증한다. 테스트 의도와 시나리오 설명이 명확하고 mock 설계도 실제 BullMQ round-trip 과 동등하다. 다만 두 가지 WARNING 이 존재한다. 첫째, stale click 이후 정상 `ai_message` 로 대화가 계속되는 경로가 미검증되어 `pendingContinuations` 인터리빙의 정확성이 보장되지 않는다. 둘째, `buttonId` 길이 슬라이싱 경계값(64자 이상, null, 비문자열)을 검증하는 단위 테스트가 없어 warn 메시지 포맷 회귀 시 탐지가 늦어질 수 있다. INFO 수준으로는 `warnSpy.mockRestore()` 의 finally 미사용, `getPendings` 헬퍼 scope 외부 타입 단언 중복, cancel race 경로 미검증 등이 있다.

---

## 위험도

LOW
