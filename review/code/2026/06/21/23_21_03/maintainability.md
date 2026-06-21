# 유지보수성(Maintainability) 리뷰

리뷰 대상 커밋: `c82b4a03` — test(ai-agent): M-1 3단계 ai-review 보강 (capFormDataBytes·form_submitted resume 직접 테스트)

변경 파일: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.spec.ts` (테스트 보강),
`review/code/2026/06/21/23_06_04/RESOLUTION.md` (신규), 기타 review/ 산출물 다수.

---

## 발견사항

### [INFO] `formResumeState` 팩토리 함수의 인라인 상수 — `workspaceId`·`executionId` 등 테스트 픽스처 값이 분산
- 위치: `ai-turn-executor.spec.ts` L186~214 (`formResumeState` 함수 내부)
- 상세: `llmConfigId: 'cfg-1'`, `model: 'gpt-4o'`, `workspaceId: 'ws-1'`, `executionId: 'exec-1'` 등 픽스처 문자열이 `formResumeState` 지역 객체 리터럴에만 존재하고, 파일 상단 `beforeEach`의 `mockLlmService.resolveConfig` 가 반환하는 `id: 'config-1'`과 별개의 값을 사용한다. `llmConfigId: 'cfg-1'`과 mock 의 `id: 'config-1'` 사이의 불일치가 의도적인지 실수인지 코드만으로 판단하기 어렵다. 향후 픽스처 조합이 늘어나면 값이 흩어져 일관성 유지가 어려워진다.
- 제안: 파일 최상단에 `TEST_CFG_ID = 'config-1'`, `TEST_WS_ID = 'ws-1'` 등 모듈 레벨 상수로 추출하거나, `buildExecutor`·`formResumeState`가 같은 id 를 공유하도록 정렬. 적어도 `llmConfigId` vs mock `id` 가 다른 이유를 인라인 주석으로 명시.

---

### [INFO] `formResumeState`가 화살표 함수로 선언되었으나 `describe` 블록 상단 `const` — 재사용 범위·스코프 명확성
- 위치: `ai-turn-executor.spec.ts` L185 (`const formResumeState = (): Record<string, unknown> => ({...})`)
- 상세: `formResumeState`는 `describe('processMultiTurnMessage — form_submitted resume', ...)` 블록 내 `const` 로 선언되어 있어, 단일 `it` 블록에서만 쓰이더라도 블록 최상단에 위치한다. 이 자체는 패턴상 문제가 없고, 향후 `it` 블록이 추가될 때 공유 팩토리로 확장되는 설계를 미리 준비한 것으로 읽힌다. 그러나 현재 `it` 가 하나뿐이라 인라인 객체로도 충분하며, 팩토리 계층이 오버엔지니어링처럼 보일 수 있다.
- 제안: `it` 가 하나 이상으로 늘어날 것이 확실하다면 현 구조 유지. 단일 케이스로 고정될 가능성이 높다면 객체 리터럴 인라인으로 단순화.

---

### [INFO] `capFormDataBytes` 테스트의 비-string-only 케이스 — `FORM_SUBMITTED_MAX_BYTES` 의존이 미묘하게 brittle
- 위치: `ai-turn-executor.spec.ts` L172~178 (`'attaches truncation meta even when no string field is truncatable'`)
- 상세: `Array.from({ length: 4000 }, (_, i) => i)` 로 4000개의 정수 배열을 생성해 cap 초과를 유도한다. `FORM_SUBMITTED_MAX_BYTES` 의 실제 byte 크기가 변경되면 이 배열이 cap 미만이 되어 테스트 의도가 깨질 수 있다. 테스트 코드 내에 `// FORM_SUBMITTED_MAX_BYTES(10KB) 대비 충분히 큰 배열` 같은 설명 주석이 없어, 4000이라는 숫자의 근거가 불분명하다.
- 제안: 주석으로 `// 4000개 × ~5 bytes(JSON 숫자) ≈ 20KB > FORM_SUBMITTED_MAX_BYTES(10KB)` 처럼 크기 근거를 명시. 또는 `Math.ceil(FORM_SUBMITTED_MAX_BYTES / 5) + 100` 처럼 상수 기반으로 배열 크기를 표현.

---

### [INFO] `buildMultiTurnFinalOutput` `it.each` 의 `as const` 타입 단언 — 이미 있는 타입 컨텍스트와 이중 명시
- 위치: `ai-turn-executor.spec.ts` L76~92
- 상세: `it.each([...] as const)` 의 `as const` 사용은 TypeScript 에서 리터럴 타입 추론을 강제해 `endReason`·`port` 파라미터 타입을 정밀하게 제어하는 올바른 패턴이다. 이 자체는 문제가 없으나, 별도의 타입 주석이나 JSDoc 없이 `'maps endReason=%s to port %s'` 제목만으로 케이스가 충분히 자기설명적이다. 기존 파일 내 다른 `it.each` 패턴과의 일관성 측면에서도 현 사용이 적절하다.
- 제안: 현 상태 유지.

---

### [INFO] 테스트 describe 블록 도입부 주석의 스타일 — 일부 블록은 spec 참조가 있고 일부는 없음
- 위치: `ai-turn-executor.spec.ts` L74 (`// spec §3.2 — …`), L95 (`// spec §12.7 — …`), L182 (`// spec §6.2 step 2.c — …`)
- 상세: 세 `describe` 블록 모두 spec 섹션 참조가 포함되어 있어 일관성은 좋다. 다만 `buildMultiTurnFinalOutput` 블록의 주석(L74~75)은 `condition` 방어 로직 설명까지 포함해 `it.each` 케이스와 중복된 정보를 제공하는 반면, `capFormDataBytes`(L95~96)와 `processMultiTurnMessage`(L182~183) 블록 주석은 더 간결하게 "왜 직접 테스트하는가" 동기를 설명한다. 스타일이 약간 불균형하나 가독성에 실질 지장은 없다.
- 제안: 큰 조정은 불필요. 향후 블록 추가 시 "spec 참조 + 직접 테스트 동기" 패턴을 `capFormDataBytes` 수준의 간결함으로 통일.

---

## 요약

이번 커밋은 production 코드 무변경 원칙 하에 테스트만 추가하는 additive 변경이다. `it.each` 기반 포트 매핑 분리, `capFormDataBytes` 4건 직접 단위 테스트, `form_submitted` resume 경로 통합 테스트가 새로 추가되었으며, 각 블록에 spec 참조 주석이 일관되게 달려 있어 가독성 측면의 유지보수성은 양호하다. 발견된 항목은 모두 INFO 수준이며, 픽스처 픽스처 상수(`llmConfigId` vs mock `id` 불일치) 명확화와 4000 배열 크기의 근거 주석 보강이 가장 실용적인 개선 포인트다. 전반적으로 코드 복잡도가 낮고 describe 계층 구조가 명확하여, 유지보수성 관점에서 별도 수정이 필요한 Critical/Warning 사항은 없다.

## 위험도

LOW
