# Architecture Review

## 발견사항

### 발견사항 1
- **[INFO]** `saveMemories` 런타임 계약 가드 — 적절한 Fail-Fast 패턴 적용
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` 메서드 최상단
  - 상세: `if (typeof args !== 'object' || args === null) throw` 가드는 포지셔널 인자 오용(문자열 전달 등)을 구조분해 이전에 조기 차단한다. `null` 체크(`args === null`)와 `typeof !== 'object'` 체크를 병렬 적용해 JavaScript의 `typeof null === 'object'` 함정까지 정확히 방어한다. 이 가드는 기존 `if (!workspaceId || !scopeKey) return`이라는 무음 no-op 경로를 보완하며, API 계약 강제를 서비스 레이어 경계에 배치하는 것은 레이어 책임 관점에서 적절하다.
  - 제안: 없음. 패턴 선택과 배치 모두 적절하다.

### 발견사항 2
- **[INFO]** `AgentMemoryService` SRP 미분리 — 잔존 기술 부채 (이월 확인)
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` (전체)
  - 상세: 이번 변경(W-1 가드 추가)으로 서비스 클래스에 방어 코드가 한 줄 더 추가됐으나 아키텍처 구조에는 영향 없다. 이전 리뷰(21_40_18) W-4로 명시된 런타임·admin·SQL 빌더 책임 혼재 문제가 Batch 3으로 이월된 상태이며, 이번 커밋은 그 이월 결정을 변경하지 않는다.
  - 제안: Batch 3 진행 시 `AgentMemoryAdminService` 분리와 함께 `buildCosineMatch`의 귀속 설계를 사전 결정할 것. 현 상태는 이월된 기존 부채이며 이번 변경으로 악화되지 않았다.

### 발견사항 3
- **[INFO]** `readExtractionWatermark` 원시값 폴백 테스트 — 공유 유틸리티 방어성 증명
  - 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts`
  - 상세: `memoryState`가 문자열(`'invalid'`) 또는 숫자(`42`)일 때 `undefined`를 반환하고, 원시값과 구 평면 키가 동시에 존재할 경우 구 평면 키로 폴백하는 시나리오를 검증한다. 이 테스트는 `nodes/ai/shared` 공유 레이어의 유틸리티가 오염된 resume state에 대해 아키텍처적으로 안전한 방어 경계를 제공함을 확인한다. 모듈 배치(`shared` 레이어) 및 테스트 위치 모두 적절하다.
  - 제안: 없음.

### 발견사항 4
- **[INFO]** 에러 메시지 네임스페이스 접두사 — 디버그 가시성 우수
  - 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `throw new Error('saveMemories: args must be an options object')`
  - 상세: 에러 메시지에 메서드명(`saveMemories:`)을 접두사로 포함해 스택 트레이스 없이도 오류 발생 위치를 즉시 특정할 수 있다. 테스트에서 부분 문자열 매칭(`'args must be an options object'`)을 사용하므로 접두사 포함 에러가 정상적으로 감지된다. 서비스 레이어 에러 식별 패턴으로 일관성 있게 적용 권장.
  - 제안: 없음. 현재 패턴 적절.

---

## 요약

이번 변경(22_05_17)은 직전 fresh ai-review(21_40_18) W-1 수용 결과물로, `saveMemories` 서비스 메서드에 런타임 계약 가드를 추가하고 두 가지 방어 테스트를 보강한 최소 범위의 하드닝 커밋이다. 아키텍처 관점에서 새로운 의존성·순환 참조·레이어 경계 위반은 일절 없다. 런타임 가드는 서비스 레이어 경계에서 포지셔널 인자 오용을 조기 차단하는 Fail-Fast 패턴의 교과서적 적용이며, `null` 판별까지 정확히 처리된 점이 견고하다. `AgentMemoryService` SRP 미분리 부채(W-4)는 Batch 3 이월이 유지되며 이번 변경으로 악화되지 않았다. 순환 의존성 유입 없음, 레이어 방향(nodes → modules → data) 유지 확인, 추상화 수준 변동 없음.

## 위험도

NONE

STATUS: SUCCESS
