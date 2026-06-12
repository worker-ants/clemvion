# 유지보수성(Maintainability) Review

## 발견사항

### 파일 5: codebase/backend/src/nodes/data/code/code.handler.ts

- **[INFO]** `_buildIsolateContext` 내 ivm.Callback wrapping 중복 패턴
  - 위치: `_buildIsolateContext` 메서드, `__host_b64encode` / `__host_b64decode` 주입 라인
  - 상세: `new ivm.Callback((data: unknown) => hostB64Encode(data))` 처럼 단일 인수를 그대로 전달하는 화살표 래퍼가 `__host_hash` 패턴과 일관되지 않음. `hostB64Encode` / `hostB64Decode` 는 `(data: unknown) => string` 시그니처이므로 `new ivm.Callback(hostB64Encode)` 로 직접 참조해도 동작하고 가독성이 향상됨. `__host_hash` 는 인수가 2개라 래퍼가 필요하지만 단일 인수 함수는 다름.
  - 제안: `new ivm.Callback(hostB64Encode)` / `new ivm.Callback(hostB64Decode)` 로 축약. 혹은 전체 콜백 등록 패턴을 일관되게 통일(래퍼 사용하거나 직접 참조 사용).

- **[INFO]** `_buildIsolateContext` 와 `execute` 메서드 간 `isolateOptions` 구성 위치
  - 위치: `execute` 메서드 (라인 1794-1798)
  - 상세: isolate 생성 옵션(`memoryLimit`, `snapshot`)은 `execute`에 남고 context 구성은 `_buildIsolateContext`로 분리됐다. 분리 경계가 "context 생성" 이 아닌 "isolate 구성 후 context 구성"이라 의미 구분이 약간 불명확하지만, 현재 구조도 스냅샷 성능 주석으로 충분히 설명됨. 중요도는 낮음.
  - 제안: 현 구조 유지 가능. 만약 추후 리팩터링 시 isolate 생성까지 포함하는 `_buildIsolate` + `_buildContext` 분리를 고려.

- **[INFO]** `resolveMemoryLimitMb` 함수가 `export`이지만 `@internal` 주석만으로 표기
  - 위치: `resolveMemoryLimitMb` 함수 선언 (라인 1413)
  - 상세: TypeScript 에는 `@internal` 이 컴파일러 수준의 접근 제어를 제공하지 않음. 현재는 JSDoc 주석으로만 "테스트 전용"임을 표기. 테스트가 `code.handler.js` 를 직접 import하므로 현 방식이 실용적이나, 향후 barrel export 등에서 실수로 re-export 될 위험이 있음.
  - 제안: 허용 가능한 수준. `/* @internal */` 주석 외에 `_resolveMemoryLimitMb` 처럼 언더스코어 prefix 컨벤션을 택해 내부 심볼임을 명시적으로 표기하는 방안을 팀 컨벤션으로 논의.

### 파일 4: codebase/backend/src/nodes/data/code/code.handler.spec.ts

- **[INFO]** `beforeAll(() => jest.retryTimes(2))` / `afterAll(() => jest.retryTimes(0))` 패턴 — 전역 상태 변이
  - 위치: `describe('execute — memory limit (spec §7.2)')` 내 `beforeAll`/`afterAll`
  - 상세: `jest.retryTimes`는 전역 jest 상태를 변경함. `afterAll`에서 0으로 복원하는 패턴은 올바르나, 이 describe 블록이 중첩된 형태로 다른 파일에서 재사용되거나 병렬 실행될 경우 충돌 가능성이 있음. 현재 단일 파일 내 사용이므로 실용적. 주석에 이미 W10 flakiness 배경이 명확히 설명됨.
  - 제안: 현 구조 수용 가능. 주석은 충분히 설명적임.

- **[INFO]** `it.each` 테스트 파라미터에서 사용하지 않는 `_op` 변수
  - 위치: `code.handler.spec.ts` 내 `it.each(['encode', ...])` 블록, `async (_op, code) =>` 파라미터
  - 상세: `_op` 는 테스트 이름 포맷 문자열 `'should route non-string $helpers.base64.%s input...'` 에서 `%s` 치환에 쓰이지만 실제 테스트 바디에서는 사용되지 않음. 언더스코어 prefix 로 "의도적 미사용"을 표기한 점은 좋음.
  - 제안: 현 방식 유지. 의도가 명확함.

### 파일 1: codebase/backend/.env.example

- **[INFO]** 새 변수 `CODE_NODE_MEMORY_LIMIT_MB`의 섹션 배치
  - 위치: 파일 하단 (line 363-366)
  - 상세: 이 변수는 실행 엔진 관련 변수(`MAX_NODE_ITERATIONS`, `EXECUTION_MAX_ACTIVE_RUNNING_MS` 등)가 있는 "Execution Engine" 섹션과 의미상 연관성이 높으나, 파일 맨 끝 "System Status" 섹션 다음에 섹션 헤더 없이 추가됨. 논리적 그루핑이 흐트러짐.
  - 제안: `# Execution Engine` 섹션 끝(`PARALLEL_ENGINE=v1` 아래)에 배치하거나, 별도 `# Code Node` 서브섹션 헤더를 추가.

### 파일 2: codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts

- **[INFO]** 코드 주석 업데이트는 적절
  - 위치: `INTERNAL_CODES` Set, `CODE_MEMORY_LIMIT` 항목 주석
  - 상세: 이전 "128MB 한도 초과"에서 "`CODE_NODE_MEMORY_LIMIT_MB` env 조정 가능"을 언급하는 방향으로 주석이 개선됨. 변경 범위는 최소이며 의도가 명확함.
  - 제안: 없음.

### 파일 3: codebase/backend/src/nodes/core/error-codes.ts

- **[INFO]** 에러 코드 주석 업데이트는 적절
  - 위치: `CODE_MEMORY_LIMIT` 항목 주석
  - 상세: `DEFAULT_MEMORY_LIMIT_MB` / `MAX_MEMORY_LIMIT_MB` 상수가 `code.handler.ts` 에 있고 `error-codes.ts` 는 그 값을 주석에만 언급함(128MB 기본값). 파일 간 의존성 없이 정보가 텍스트로만 동기화됨. 기본값이 바뀌면 두 곳의 주석을 따로 업데이트해야 한다는 점에서 잠재적 표류(drift) 위험 존재. 단, 코드 상수는 `code.handler.ts` 에 명확히 있고 주석은 "기본"이라는 단어를 명시해 고정된 계약이 아님을 암시함.
  - 제안: 낮은 우선순위. 주석 내 기본값을 명시하는 대신 "see `CODE_NODE_MEMORY_LIMIT_MB` env" 참조만 남기는 방안을 고려.

### 파일 6-7: 문서 (.en.mdx / .mdx)

- **[INFO]** 하드코딩된 기본값 "128MB" 제거 및 동적 설정 언급으로의 개선
  - 위치: 두 문서의 Memory 행 description
  - 상세: 기존 `"128MB"` 고정 표현에서 `"128MB by default, tunable via CODE_NODE_MEMORY_LIMIT_MB"` 로 변경. 운영자가 값을 바꿨을 때 문서와 실제가 불일치하는 문제를 예방. 한/영 문서가 동일한 방향으로 일관되게 수정됨.
  - 제안: 없음.

### 파일 8: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** `CODE_MEMORY_LIMIT` 한국어 메시지에서 하드코딩된 "128MB" 제거
  - 위치: `ERROR_KO` 맵 `CODE_MEMORY_LIMIT` 항목
  - 상세: "메모리 한도(128MB)를 초과했어요" → "메모리 한도를 초과했어요"로 변경. 동일한 메시지가 `code.handler.spec.ts` 내 실제 구현 설명 주석과도 일관됨.
  - 제안: 없음.

---

## 요약

이번 변경은 Code 노드의 메모리 한도를 하드코딩된 128MB 상수에서 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수로 추출하는 리팩터링이다. 유지보수성 관점에서 핵심 개선 — `DEFAULT_MEMORY_LIMIT_MB` / `MAX_MEMORY_LIMIT_MB` 상수 명명, `resolveMemoryLimitMb` 함수 분리, 매직 넘버 "128"의 제거 — 이 일관되게 수행됐다. `_buildIsolateContext` / `_runWithTimeout` 추출로 `execute` 메서드의 책임이 명확히 분리돼 가독성이 개선됐다. 주목할 점은 `.env.example`의 새 변수가 논리적 섹션("Execution Engine")이 아닌 파일 말미에 섹션 헤더 없이 위치한다는 것으로, 장기적으로 파일 탐색성을 저하시킬 수 있다. 나머지 발견사항은 대부분 INFO 수준의 스타일·일관성 관련이며 심각도 높은 문제는 없다.

## 위험도

LOW
