# Testing Review — ExecutionSeqAllocator 커버리지 보강 (C-1)

## 발견사항

### **[INFO]** sanitize private static 직접 호출 — 구현 변경 시 취약한 결합
- 위치: spec 파일 457-461행 (`sanitize` describe 블록 진입부)
- 상세: `(ExecutionSeqAllocator as unknown as { sanitize: (v: string) => string }).sanitize` 로 private static 을 강제 접근한다. TypeScript 컴파일 타깃이 class field 방식으로 재컴파일되거나 메서드명이 변경되면 런타임에 `undefined` 가 되어 테스트 자체가 `TypeError: sanitize is not a function` 으로 폭발한다 (테스트 실패 메시지가 assert 실패가 아닌 setup crash 로 표시). 현재 구현(`/Volumes/project/private/clemvion/.claude/worktrees/seq-allocator-test-cov-74e999/codebase/backend/src/modules/websocket/execution-seq-allocator.service.ts` 153행)이 `private static sanitize` 로 정의되어 있으므로 지금은 동작하나, `describe` 블록 상단의 `const sanitize = …` 호출이 `sanitize` 가 `undefined` 일 때 fail-fast 하지 않고 각 `it` 안에서 뒤늦게 실패한다는 점도 오해 소지다. 허용 범위 안의 절충이지만 주석에 "정적 메서드명 변경 시 이 라인도 함께 갱신" 명시를 권장.
- 제안: `const sanitize = (ExecutionSeqAllocator as …).sanitize; if (!sanitize) throw new Error('sanitize static not found — method renamed?');` 형태로 setup 시 fail-fast 가드 추가. 또는 `sanitize` 결과를 통합 경로(next warn 메시지)에서 간접 검증하는 테스트로 보완.

### **[INFO]** `sanitize` — 연속 CR+LF 시퀀스의 치환 결과 명세 공백 누락
- 위치: spec 87-89행 (`'a\r\nb\tc'` 케이스)
- 상세: `\r\n` 은 두 문자(\r, \n)이므로 `replace(/[\r\n\t]/g, ' ')` 적용 결과는 `'a  b c'` (공백 2개). 현재 기대값 `'a  b c'` (공백 2개)는 올바르다. 그러나 독자가 육안으로 공백 개수를 세기 어렵다. 주석이나 escape 표기(`'a  b c' // \r→' ', \n→' '`)를 보강하면 가독성이 향상된다.
- 제안: `expect(sanitize('a\r\nb\tc')).toBe('a  b c'); // \r→' ', \n→' ', \t→' '` 인라인 주석 추가.

### **[INFO]** `sanitize` — 128자 정확히 경계값 테스트 누락
- 위치: spec 91-93행 (`128자 초과는 cap` 케이스)
- 상세: 200자 입력 → `toHaveLength(128)` 만 검증한다. 경계값 테스트(입력 128자 → 128자 유지, 입력 129자 → 128자로 cap)가 없다. `slice(0, 128)` 구현 기준으로 현재 케이스는 off-by-one 버그를 잡지 못한다(예: `slice(0, 127)` 로 잘못 구현해도 200자 케이스는 127을 반환해 `toHaveLength(128)` 에서 실패하지만, 그보다 `slice(0, 129)` 로 잘못 구현하면 통과해버린다).
- 제안: `expect(sanitize('x'.repeat(128))).toHaveLength(128)` (정확히 128자 유지) 와 `expect(sanitize('x'.repeat(129))).toHaveLength(128)` (129→128 cap) 케이스 추가.

### **[INFO]** DEL reject 테스트 — `await Promise.resolve()` 단일 microtask flush 의존
- 위치: spec 69행
- 상세: `client.del().catch(handler)` 의 `catch` 는 이미 throw 된 Promise 의 rejection 핸들러이므로 microtask 1회(`await Promise.resolve()`) 후에 실행되는 것이 맞다. 그러나 `.catch` 내부에서 추가 비동기 작업(예: 미래 구현에서 외부 메트릭 전송 등)이 생기면 이 flush 가 부족해진다. 현재 구현은 `catch` 내부가 순수 동기(logger.warn 후 `return 0`)이므로 단일 flush 로 충분하다. 이 가정을 주석으로 명시하는 것이 좋다.
- 제안: `// del Promise reject → .catch microtask 1회로 충분 (catch body 가 동기이므로)` 주석 보강. 구현이 catch 내 비동기로 바뀌면 `await Promise.resolve()` 를 늘려야 함을 명시.

### **[INFO]** DEL reject 테스트 — `warn.mockRestore()` 위치
- 위치: spec 71행
- 상세: `warn.mockRestore()` 가 테스트 본문 마지막에 있어 `expect(warn)` 이 실패하면 restore 가 실행되지 않는다. NestJS Logger 의 `warn` 이 클래스 prototype 에 있으므로 다른 테스트의 logger.warn 호출이 영향받을 수 있다. 이미 나머지 테스트들이 logger 를 직접 spy 하지 않아 실질 영향은 낮으나, `afterEach`/`try…finally` 패턴이 더 견고하다.
- 제안: `afterEach(() => warn.mockRestore())` 또는 `try { … } finally { warn.mockRestore(); }` 로 변경.

## 요약

이번 변경은 `sanitize` private static 3케이스와 `release` DEL reject 경로 1케이스를 추가해 이전 리뷰(#740 INFO #3/#4)에서 지적된 미검증 경로를 정확히 타깃하고 있다. 프로덕션 코드 무변경이고, 기존 테스트 스위트(Redis 정상·degraded·동시성·TTL env·onModuleDestroy·provider 위임 등)와 구조적으로 분리되어 있어 격리성과 의도 가독성이 양호하다. 발견된 항목은 모두 INFO 등급으로, `sanitize` 경계값(정확히 128자 on-boundary) 케이스 누락과 mock.restore 위치가 가장 실용적인 개선점이나 머지를 차단하는 수준은 아니다.

## 위험도

LOW
