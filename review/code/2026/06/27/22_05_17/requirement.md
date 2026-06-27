# 요구사항(Requirement) Review

## 발견사항

### [INFO] saveMemories 런타임 가드 — 에러 메시지 부분 일치 검증 (정상)

- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.spec.ts` L677
- 상세: 테스트는 `toThrow('args must be an options object')` 로 검증하지만, 실제 throw 메시지는 `'saveMemories: args must be an options object'` 다. Jest의 `toThrow(string)` 는 부분 일치를 검사하므로 이 어설션은 올바르게 통과한다. 에러 메시지에 접두사(`saveMemories:`)가 포함되어 있어 오탐 우려가 없다.
- 제안: 없음. 현재 구조 안전.

---

### [INFO] saveMemories 가드 — null 처리 경로 확인

- 위치: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` L395–396
- 상세: `if (typeof args !== 'object' || args === null)` 조건은 (1) 문자열·숫자 등 비객체(`typeof args !== 'object'`) 와 (2) `null`(`typeof null === 'object'` 인 JS 특성 회피용 `args === null`)을 모두 차단한다. 두 분기 모두 `throw new Error('saveMemories: args must be an options object')` 로 귀결되어 silent no-op 위험이 제거된다. Array 도 typeof 'object' 이므로 배열을 넘기면 throw 하지 않고 destructure 후 `workspaceId/scopeKey` 가 undefined → 조기 return 경로로 흐른다 — 이는 실제 오용 시나리오(구 포지셔널 문자열 전달)와 다르고, 배열 전달 오용은 TypeScript 컴파일로 이미 차단되므로 런타임 추가 가드 불필요.
- 제안: 없음. 대상 오용 시나리오(구 포지셔널 문자열)에 대한 보호가 충분하다.

---

### [INFO] readExtractionWatermark 원시값 memoryState 테스트 — 구현 일치 확인

- 위치: `codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` L1163–1170
- 상세: 추가된 세 어설션을 구현(`agent-memory-injection.ts` L598–605)과 대조했다. (1) `{ memoryState: 'invalid' }` — `ns = 'invalid'`, truthy 이지만 `('invalid' as any).lastExtractionTurnSeq` 가 `undefined` 이므로 `typeof undefined === 'number'` 가 false → flat key fallback → undefined 반환. (2) `{ memoryState: 42 }` — 동일 경로, undefined 반환. (3) `{ memoryState: 'x', lastExtractionTurnSeq: 5 }` — namespace 분기 실패 → flat key `5` 가 `typeof number` → `5` 반환. 세 케이스 모두 구현과 정확히 일치한다.
- 제안: 없음.

---

### [INFO] Spec fidelity — 이번 커밋 변경분에 spec 추가 불일치 없음

- 위치: `spec/5-system/17-agent-memory.md`
- 상세: 이번 커밋(W-1 가드 + I-10 테스트)은 비즈니스 규칙(AGM-08/09/10/11)의 동작을 변경하지 않는다. 직전 review(21_40_18)에서 이미 17-agent-memory.md §3 L80(`_resumeState.memoryState.lastExtractionTurnSeq` + in-flight 폴백 병기), §7 L141·L171 등 4개소 갱신 완료가 확인됐다. 런타임 가드 자체는 spec 명시 요구사항이 아니라 프로그래밍 오류 방어(defensive programming) 조치이므로 spec 기술 대상이 아님 — INFO 수준.
- 제안: 없음.

---

## 요약

이번 커밋은 이전 리뷰(21_40_18) W-1 항목의 최종 해소 조치로, `saveMemories` 에 `typeof args !== 'object' || args === null` 런타임 가드를 추가하고 대응 테스트를 추가했으며, `readExtractionWatermark` 에 대한 원시값 memoryState 방어 테스트를 보강했다. 기능 완전성 관점에서 구 포지셔널 오용 시 무음 no-op 삼킴이 즉각적인 에러 throw 로 전환되어 오용 추적이 가능해졌다. 가드 로직·에러 메시지·테스트 어설션 3자가 모두 일관되고 정확하다. TODO/FIXME/HACK 주석 없음. 모든 반환 경로가 적절하다(throw 또는 기존 로직 계속). spec 불일치 신규 유입 없음. Critical·Warning 발견사항 없음.

## 위험도

NONE

STATUS: SUCCESS
