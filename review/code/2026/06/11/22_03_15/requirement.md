# Requirement Review

## 발견사항

---

### **[WARNING]** `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts` 의 INTERNAL_CODES 에 미등록
- **위치**: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — `INTERNAL_CODES` Set (line 54-68)
- **상세**: `spec/conventions/chat-channel-adapter.md §3.1` 분류 표 (line 388) 는 `CODE_MEMORY_LIMIT` 를 `executionFailedInternal` 로 분류할 것을 명시한다. 그러나 실제 구현(`execution-failure-classifier.ts`)의 `TIMEOUT_CODES` / `THIRD_PARTY_CODES` / `INTERNAL_CODES` 세 Set 어디에도 `CODE_MEMORY_LIMIT` 가 없다. 결과적으로 메모리 초과 이벤트가 발생하면 `CODE_MEMORY_LIMIT` 코드는 unknown-fallback 경로(`executionFailedInternal` 반환 + backend `warn` 로그)로 처리된다. 기능적 결과(키 반환값)는 우연히 같지만, spec 의 "명시 등록" 요건을 충족하지 않으며 `warn` 로그가 불필요하게 발화된다.
- **제안**: `INTERNAL_CODES` 에 `'CODE_MEMORY_LIMIT'` 를 추가한다.

---

### **[INFO]** W14 코멘트의 라인 오프셋 수치 오류 (±1)
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — `wrapUserCode` 함수 JSDoc W14 코멘트 (line ~163-168)
- **상세**: W14 코멘트는 "wrapper 가 4-line header 를 prepend 하므로 에러 라인 번호는 +4 오프셋"이라고 설명한다. 실제 `wrapUserCode` 반환값을 보면 `${code}` 이전에 삽입되는 줄은 3개다: `(async () => {` (line 1), `"use strict";` (line 2), `const __user = async () => {` (line 3). 사용자 코드는 line 4 에서 시작하므로 오프셋은 +3 이지 +4 가 아니다. spec 문서에는 라인 오프셋 명세가 없으므로 코드 동작에는 영향이 없으나, 주석이 오해를 유발한다. spec (`spec/4-nodes/5-data/2-code.md`)에는 해당 오프셋이 명시되지 않으므로 spec 불일치는 아니다.
- **제안**: W14 코멘트의 "4-line header" / "+4" 를 "3-line header" / "+3" 으로 정정한다.

---

### **[INFO]** `classifyError` W2 spoofing 테스트 — 기댓값 해석이 주석과 일치하나 동작이 미묘
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` — line 72-84 (spoofing prevention W2 테스트)
- **상세**: 테스트 설명은 "isDisposed priority 가 NOT taken" 임을 검증한다고 하면서, 실제 assert 는 `expect(result).toBe('EXECUTION_MEMORY_EXCEEDED')` 로 동일 결과를 확인한다. 이 케이스(`isDisposed = false`, 메시지 = `'Isolate was disposed'`)는 priority-2 가 skip 되고 priority-3 regex 가 `RE_ISOLATE_DISPOSED` 패턴으로 매치되어 동일한 `EXECUTION_MEMORY_EXCEEDED` 를 반환한다. 테스트 의도(priority-2 미트리거)와 assert 는 올바르다. 단, 주석 "no structural spoofing of priority-2 is possible" 의 근거를 단순 반환값 동등으로만 검증하므로, priority-2 가 실제로 skip 됐음(vs 우연히 같은 결과)을 구분하는 어서션이 없다. 기능 자체는 올바르게 구현돼 있으므로 INFO.
- **제안**: 필요하다면 `fakeIsolate.isDisposed = true` 일 때와 `false` 일 때를 동일 메시지로 비교하거나, `spy` 를 사용해 priority-2 분기가 실행됐는지/않았는지를 명시적으로 확인하는 방식으로 테스트 의도를 강화할 수 있다. 현재 구현에 버그가 없으므로 선택 사항.

---

### **[INFO]** `SPEC-DRIFT` — spec §4 실행 로직 step 2 의 래핑 패턴이 현재 구현과 불일치
- **위치**: `spec/4-nodes/5-data/2-code.md §4` step 2 (line ~2348): `"(async () => { \"use strict\"; <code> })()"` 로 래핑한다고 명시
- **상세**: 실제 `wrapUserCode` 는 outer `async IIFE` + inner `async () => {}` 의 2-단 비동기 래핑이다. spec step 2 는 1-단 구조를 설명하므로 구현과 다르다. 이는 코드 버그가 아니라 spec 문서가 리팩토링 후 업데이트되지 않은 경우다.
- **제안**: `[SPEC-DRIFT]` — 코드 유지, spec 갱신 필요. `spec/4-nodes/5-data/2-code.md §4` step 2 의 래핑 구조 설명을 실제 2-단 패턴으로 갱신한다.

---

### **[INFO]** `syntaxIsolate.isDisposed` 재생성 로직 — spec 에 명세 없음
- **위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — `syntaxCheck` 함수 (line ~1131)
- **상세**: `syntaxIsolate` 가 disposed 된 경우 재생성하는 로직(W4/INFO#3)이 추가됐다. `spec/4-nodes/5-data/2-code.md` 에는 syntax check isolate 수명 관리에 대한 명세가 없으므로 spec 침묵 영역이다. 코드 동작은 합리적이다.
- **제안**: spec 명시가 필요하다고 판단되면 `spec/4-nodes/5-data/2-code.md §6` 또는 §4 에 "syntax-check isolate disposed 후 재생성" 동작을 추가한다 (선택).

---

### **[INFO]** `SPEC-DRIFT` — W14 라인 오프셋 정보가 spec 에 없음
- **위치**: `spec/4-nodes/5-data/2-code.md` — 전체 (라인 오프셋 명세 없음)
- **상세**: W14 코멘트가 기술하는 "런타임 에러 라인 번호 오프셋" 은 UI/디버깅에 영향을 주는 동작이지만 spec 에 정의가 없다.
- **제안**: `[SPEC-DRIFT]` — 코드 유지, spec §4 또는 §2(에디터 설명)에 "런타임 에러 라인 번호는 래퍼 헤더 3줄 오프셋" 을 추가한다.

---

## 요약

주요 3개 변경(code.handler.ts 리팩토링, code.handler.spec.ts classifyError 단위 테스트 추가, backend-labels.ts 에러 코드 i18n, spec/4-nodes/5-data/2-code.md 갱신)은 isolated-vm 전환 후 의도된 기능을 대체로 올바르게 구현하고 있다. classifyError 의 3단계 우선순위 분류(trusted host 코드 > isDisposed 플래그 > message regex)와 LEGACY_TO_NORMALIZED 테이블, syntaxIsolate 재생성, $vars copy-out 실패 시 varsClone 복원, i18n 3개 코드 등록은 spec §5.3·§7.2·§4.5 요건을 충족한다. 단, `CODE_MEMORY_LIMIT` 가 `execution-failure-classifier.ts` 의 `INTERNAL_CODES` Set 에 미등록돼 있어 spec(chat-channel-adapter.md §3.1)과 불일치하며, 메모리 초과 이벤트 발생 시 불필요한 backend warn 로그가 발화된다(기능 결과는 우연히 동일). 이 항목이 유일한 실질적 수정 대상이다. 나머지 INFO 항목(W14 오프셋 주석 오류, spec 갱신 누락 2건)은 동작에 영향이 없다.

## 위험도

LOW

> CODE_MEMORY_LIMIT 미등록 (WARNING): 채팅 채널 어댑터가 메모리 초과를 unknown fallback으로 처리해 warn 로그를 발화하나, 사용자에게 노출되는 분류 키(`executionFailedInternal`)는 동일하다. 기능 회귀는 없으나 spec 계약 위반 + 노이즈 로그.
