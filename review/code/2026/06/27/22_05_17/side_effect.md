# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `saveMemories` 런타임 가드 — 기존 무음 no-op에서 명시적 Promise 거부로 동작 변경
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts` — `saveMemories` 메서드 첫 줄
- 상세: `if (typeof args !== 'object' || args === null) throw new Error(...)` 가드가 추가됐다. 이전에는 포지셔널 오용(예: 문자열 전달) 시 destructure 후 `workspaceId === undefined` → `if (!workspaceId || !scopeKey) return`으로 무음 no-op이 발생했다. 이제는 해당 경로에서 Error가 throw되어 async 함수이므로 반환된 Promise가 reject 상태가 된다. 동작 변경은 의도된 것이며, 전 review 세션(21_40_18)의 W-1 FIX다. 호출자 관점에서는 이전에 조용히 통과하던 잘못된 호출이 이제 unhandled rejection 또는 catch된 에러로 드러난다.
- 제안: 없음. 가드 위치(destructure 이전 첫 줄)가 적절하며 부분 상태 변이 위험이 없다. `saveMemories`가 `async` 함수이므로 동기 `throw`가 자동으로 Promise reject로 변환되는 동작이 올바르다. 테스트의 `rejects.toThrow` 패턴과 일치한다.

---

### [INFO] `readExtractionWatermark` 원시값 memoryState 폴백 — 생산 코드 변경 없음, 테스트만 추가
- 위치: `/codebase/backend/src/nodes/ai/shared/agent-memory-injection.spec.ts` — 신규 테스트 3개 assert
- 상세: `memoryState`가 `'invalid'`(문자열)이거나 `42`(숫자)인 경우의 폴백 동작 테스트가 추가됐다. 해당 동작은 기존 구현(`const ns = resumeState.memoryState as ... | undefined; if (ns && ...)` falsy 체크)으로 이미 보장되어 있었으며, 이번 커밋은 생산 코드를 변경하지 않고 테스트 커버리지만 추가했다. 부작용 없음.
- 제안: 없음.

---

### [INFO] plan 파일 갱신 — 파일시스템 의도적 수정
- 위치: `/plan/in-progress/ai-context-memory-followup-v2.md`
- 상세: Batch 2 후속 spec PR 항목(IE spec watermark 경로 정정, node-output.md meta.memory 정정) 2건이 plan에 추가됐다. 파일 수정은 의도적이며 리뷰 워크플로우의 정상적인 lifecycle 단계다. 추적되지 않는 파일 생성·삭제 없음.
- 제안: 없음.

---

### [INFO] review 아티팩트 파일 신규 생성 — 예상된 파일시스템 변경
- 위치: `review/code/2026/06/27/21_40_18/RESOLUTION.md`, `review/code/2026/06/27/21_40_18/SUMMARY.md`, 기타 `_retry_state.json`, 각 reviewer `.md` 파일
- 상세: review 세션 디렉토리 하위에 신규 파일들이 생성됐다. 이는 `/ai-review` 워크플로우가 생성하는 아티팩트이며 정상적인 파일시스템 부작용이다. 모두 `review/code/` 하위에 격리되어 있다.
- 제안: 없음.

---

## 요약

이번 커밋(W-1 resolution)은 부작용 관점에서 매우 좁은 변경이다. 생산 코드 변경은 `saveMemories` 첫 줄에 `typeof args !== 'object' || args === null` 가드 추가 1건뿐으로, 기존 무음 no-op을 명시적 Promise reject으로 전환한다. 이 동작 변경은 의도된 것이며 전 review에서 FIX로 결정됐다. 전역 변수 도입, 예상치 못한 외부 상태 변경, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 없다. 나머지 변경은 테스트 추가 2건(부작용 없음)과 review/plan 아티팩트 파일(예상된 파일시스템 변경)로 구성된다. 시그니처 및 인터페이스 변경은 이번 커밋에 없으며, `saveMemories` 옵션 객체화는 이전 batch 2에서 이미 완료됐다.

## 위험도

LOW

STATUS: SUCCESS
