# 성능(Performance) 리뷰 결과

## 발견사항

### 발견사항 없음 — 성능 관점 긍정 평가 항목

- **[INFO]** `ISOLATE_MEMORY_LIMIT_MB` 모듈 로드 시 1회 결정 (지연 없는 상수화)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/nodes/data/code/code.handler.ts` — `const ISOLATE_MEMORY_LIMIT_MB = resolveMemoryLimitMb();`
  - 상세: `resolveMemoryLimitMb()`는 `process.env` 파싱을 매 실행마다 하지 않고 모듈 임포트 시 단 1회 평가하여 상수로 고정한다. isolate 생성 핫 패스에서 반복 파싱 오버헤드가 없다. 설계 선택이 올바르다.
  - 제안: 현재 구조 유지.

- **[INFO]** `DAYJS_SNAPSHOT` 프로세스 단위 1회 생성으로 per-exec dayjs 재컴파일 제거
  - 위치: 동일 파일 — `DAYJS_SNAPSHOT` IIFE 블록
  - 상세: `ivm.Isolate.createSnapshot`으로 dayjs UMD를 미리 직렬화하고, 각 코드 노드 실행 시 `new ivm.Isolate({ snapshot })` 으로 복원한다. 코드에 명시된 대로 per-exec 재파싱/재컴파일 비용이 제거된다. 동시 실행 부하에서 유의미한 개선이다.

- **[INFO]** `classifyExecutionFailure` — Set 기반 O(1) 분류
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-followups-impl-afebb8/codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts`
  - 상세: `TIMEOUT_CODES`, `THIRD_PARTY_CODES`, `INTERNAL_CODES` 모두 `Set`으로 선언되어 `.has()` 조회가 O(1)이다. 분류 함수 자체도 순수 함수로 heap 할당이 없다.

- **[INFO]** `_buildIsolateContext` 리팩터링 — 코드 복잡도 감소, 성능 중립
  - 위치: 동일 `code.handler.ts` — `_buildIsolateContext`, `_runWithTimeout` 메서드
  - 상세: 기능을 private 메서드로 분리했을 뿐이며, V8 인라이닝 관점에서 실질적 성능 변화는 없다. `timeoutHandle` 선언이 `_runWithTimeout` 내 `try` 블록으로 스코프를 좁힌 것은 미묘하지만 의도적인 개선이다.

### 개선 의견

- **[INFO]** `resolveMemoryLimitMb` — `Number.parseInt` 대신 `Number()` 사용 고려
  - 위치: `code.handler.ts` — `resolveMemoryLimitMb()` 내 `Number.parseInt(raw, 10)`
  - 상세: `'256abc'` 같은 혼합 입력을 `parseInt`는 `256`으로 파싱하고 `Number()`는 `NaN`으로 처리한다. 현재 구현은 `'256abc'`를 유효한 값 256으로 받아들인다. 이는 성능 문제는 아니지만 잘못된 env 값을 조용히 허용하는 의미론적 허점이다. 성능 영향은 무시할 수준(모듈 로드 시 1회)이므로 LOW 등급.
  - 제안: `const parsed = Number(raw.trim());` 또는 `parseFloat`로 교체하면 `'256abc'`를 기본값 128로 폴백시킬 수 있다. 단, 기존 테스트(`'abc'`, `'0'`, `'-5'`, `''`, `'   '` 케이스)는 이미 커버되어 있으므로 `'256abc'` 케이스만 추가 검증 필요.

- **[INFO]** `_buildIsolateContext` 내 순차 `await jail.set(...)` 호출
  - 위치: `code.handler.ts` — `_buildIsolateContext` 메서드, `jail.set` 4개 + callback 5개
  - 상세: `$input`, `$vars`, `$execution`, `$node`, `__host_hash`, `__host_uuid`, `__host_b64encode`, `__host_b64decode`, `__host_log` 를 순차적으로 `await`한다. isolated-vm의 `Reference.set`은 내부적으로 동기에 가깝지만 Promise를 반환하므로 9개의 microtask 체인이 형성된다. `Promise.all`로 독립 세트들을 병렬화하면 이론적으로 microtask 큐 라운드트립을 줄일 수 있다. 단, isolated-vm이 단일 V8 isolate에 스레드 직렬 접근을 강제하므로 실제 병렬 실행은 불가하고 overhead 절감도 제한적이다. 고빈도 실행 환경에서 측정해보고 적용 여부를 결정하는 것이 적절하다.
  - 제안: 현재 수준에서 회귀 위험 없이 유지해도 무방하다.

- **[INFO]** `deepClone` — `JSON.parse(JSON.stringify(...))` 패턴
  - 위치: `code.handler.ts` — `deepClone<T>` 함수
  - 상세: 이번 변경 diff에는 포함되지 않은 기존 함수이지만, 컨텍스트상 언급한다. 대용량 `context.variables` 객체에서 직렬화-역직렬화 비용이 발생한다. 이 패턴은 `structuredClone`(Node 17+) 대비 느리고, `undefined` 값을 탈락시키는 부작용이 있다. 성능과 정확성 모두 개선 여지가 있으나 본 diff 범위 외이므로 INFO로만 기록.

## 요약

이번 변경의 핵심은 Code 노드의 메모리 한도를 하드코딩 128MB에서 `CODE_NODE_MEMORY_LIMIT_MB` 환경 변수로 런타임 튜닝 가능하게 한 것이다. 성능 관점에서 이 변경은 모범 사례를 따른다. `resolveMemoryLimitMb()`를 모듈 로드 시 1회만 호출하여 상수로 고정함으로써 핫 패스에 파싱 오버헤드가 없고, `DAYJS_SNAPSHOT` 기반 per-exec 재컴파일 제거라는 기존 최적화와 일관된 방향이다. `classifyExecutionFailure`의 `Set` 기반 분류, `_buildIsolateContext`/`_runWithTimeout` 분리 리팩터링도 성능 중립 또는 소폭 긍정적이다. `parseInt` 의미론 이슈와 순차 `await` 패턴은 이론적 개선 여지가 있으나 실제 영향은 미미하다.

## 위험도

NONE
