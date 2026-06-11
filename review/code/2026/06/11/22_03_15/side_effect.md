# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `classifyError` 함수 `export` 추가 — 공개 API 범위 확장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` line 1407
- 상세: `classifyError` 가 모듈-내부 함수에서 `export function` 으로 승격되었다. 이 함수는 내부 legacy 코드(`EXECUTION_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED`, `CODE_RUNTIME_ERROR`)를 반환하며, 정규화된 공개 에러 코드(`CODE_TIMEOUT` 등)와는 다른 값이다. 테스트 목적의 export 이지만 외부에서 해당 함수를 직접 import 할 수 있는 surface 가 생겼다.
- 제안: 이 export 는 의도적이고(테스트 spec W9), 현재 테스트 파일에서만 사용 중이므로 실질적 위험은 없다. 그러나 장기적으로 내부 구현 함수를 테스트를 위해 export 하는 패턴은 내부 contract 를 public API 로 굳힐 수 있다. 향후 `@internal` JSDoc 마커나 테스트 전용 패키지 분리를 검토할 만하다. 현재 변경의 부작용 위험은 낮다.

### [INFO] 모듈 레벨 전역 상태 추가 — `RE_TIMED_OUT`, `RE_MEMORY_LIMIT`, `RE_ISOLATE_DISPOSED`, `LEGACY_TO_NORMALIZED`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` lines 1383–1393
- 상세: 네 개의 모듈-레벨 상수(`RE_TIMED_OUT`, `RE_MEMORY_LIMIT`, `RE_ISOLATE_DISPOSED`, `LEGACY_TO_NORMALIZED`)가 새로 추가되었다. 이 상수들은 immutable(`const`)이며 `RegExp` 리터럴과 `Record` 객체로, 의도적인 성능 최적화(W8/INFO#9 — GC 압력 감소)다. `RegExp` 는 stateful(`lastIndex`)할 수 있으나, `/i` 플래그만 사용하고 `g`/`y` 플래그가 없으므로 `lastIndex` 공유 문제가 발생하지 않는다. `LEGACY_TO_NORMALIZED` 는 읽기 전용 목적이지만 `const` + `Record<string, string>` 타입으로 선언되어 런타임 변이가 기술적으로 가능하다.
- 제안: `LEGACY_TO_NORMALIZED` 를 `Object.freeze(...)` 또는 `as const` (`satisfies Record<string, string>`) 로 불변화하면 안전성이 높아진다. 부작용 위험은 현재로서 낮다.

### [INFO] `syntaxIsolate` 모듈-레벨 전역 변수 — 재초기화 조건 확장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` line 1131
- 상세: 기존 `if (!syntaxIsolate)` 에서 `if (!syntaxIsolate || syntaxIsolate.isDisposed)` 로 변경되었다. 이는 W4/INFO#3 가드 — OOM 이후 disposed 된 isolate 를 재생성하는 의도적 수정이다. 모듈-레벨 전역 변수(`syntaxIsolate`)를 여전히 사용하고 있으므로, 테스트 환경에서 여러 테스트가 이 상태를 공유한다. 그러나 이 변경 자체가 기존 코드의 공유 패턴을 변경하는 것은 아니며 버그 수정이다.
- 제안: 현재 설계(주석: "JS is single-threaded so concurrent compiles serialize") 로 단일 스레드 환경에서는 안전하다. 변경으로 인한 추가 부작용 없음.

### [INFO] `classifyError` 시그니처 변경 — 선택적 두 번째 인자 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` line 1407–1410
- 상세: `classifyError(err: CodeExecutionError)` → `classifyError(err: CodeExecutionError, isolate?: ivm.Isolate)` 로 변경. 두 번째 인자는 optional(`?`)이므로 기존 호출 코드(인자 1개로 호출하는 경우)는 그대로 동작한다. 내부적으로 `execute()` 의 catch 블록에서 `classifyError(err, isolate)` 로 isolate 를 전달하도록 변경되었다(라인 1316). 기존 단일 인자 호출 패턴에 대한 하위 호환성은 완전히 유지된다.
- 제안: 부작용 없음. optional 파라미터이므로 기존 호출자 영향 없음.

### [INFO] `context.variables` 실패 시 처리 로직 변경 — 주석 정확화 + 실질 동작 동일
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` lines 1282–1289
- 상세: `$vars` copy-out 실패 시의 catch 블록 주석이 "mutated clone 유지"에서 "varsClone 으로 복원"으로 정정되었다. 코드 동작(`context.variables = varsClone`)은 변경 전후 동일하다. 주석만 수정된 것이며 실제 상태 변경 로직에는 영향이 없다.
- 제안: 부작용 없음.

### [INFO] `ERROR_KO` 딕셔너리에 신규 에러 코드 추가 — 기존 키와 충돌 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/frontend/src/lib/i18n/backend-labels.ts` lines 2039–2045
- 상세: `CODE_TIMEOUT`, `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT` 세 키가 `ERROR_KO` 에 추가되었다. 기존 키와 중복되지 않으며 순수 추가다. `translateBackendError()` 함수는 이 딕셔너리를 읽기 전용으로 조회하므로 부작용이 없다.
- 제안: 부작용 없음. i18n 동기화 가드 테스트(`backend-labels.test.ts`) 에서 검증될 것.

### [INFO] spec 문서 변경 — 런타임/빌드 부작용 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/spec/4-nodes/5-data/2-code.md`
- 상세: `CODE_MEMORY_LIMIT` 코드 및 `queueMicrotask` 차단 항목 추가, 오류 코드 표 업데이트. 순수 문서 변경이므로 런타임 부작용 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경의 핵심은 (1) `classifyError` 에 `isolate.isDisposed` 기반 우선순위 2 판별 경로 추가 및 export 승격, (2) 모듈 레벨 정규식·매핑 테이블 상수화, (3) `syntaxIsolate` OOM 후 재초기화 가드이다. 모든 시그니처 변경은 optional 파라미터로 하위 호환성을 유지하며, 기존 호출자에 대한 파괴적 변경은 없다. 새로 도입된 모듈-레벨 상수(`LEGACY_TO_NORMALIZED`)는 `const` 이지만 런타임 변이 가능성이 있어 `Object.freeze` 적용이 권장되나 실질적 부작용 위험은 낮다. `classifyError` 의 export 는 테스트 목적의 의도적 변경으로, 내부 legacy 코드 반환 계약이 외부 API 로 노출되는 것에 대한 관리가 필요하다. 전반적으로 의도하지 않은 부작용은 발견되지 않았다.

## 위험도

LOW
