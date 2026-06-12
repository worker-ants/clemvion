# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: codebase/backend/.env.example

- **[INFO]** 의도에 부합하는 신규 설정 항목 추가
  - 위치: 파일 말미 3줄 추가
  - 상세: `CODE_NODE_MEMORY_LIMIT_MB=128` 환경변수와 설명 주석이 추가됐다. plan(code-node-isolated-vm-followups)의 메모리 한도 env 항목(W4) 구현에 직접 대응한다. 파일 앞부분에 대한 터치는 전혀 없으며 기존 구조(섹션 헤더·포맷)와 일관성이 있다.
  - 제안: 없음.

---

### 파일 2: codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts

- **[INFO]** 주석 변경 — 범위 내 정보 갱신
  - 위치: `INTERNAL_CODES` Set 의 `CODE_MEMORY_LIMIT` 항목 상단 주석 (2줄 → 3줄)
  - 상세: 기존 "128MB 한도 초과"의 고정 수치를 "기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` env 조정 가능"으로 동기화했다. 실제 로직 변경 없이 env 도입에 따라 주석만 일관성 있게 갱신했으므로 범위 내 변경이다.
  - 제안: 없음.

---

### 파일 3: codebase/backend/src/nodes/core/error-codes.ts

- **[INFO]** 주석 변경 — 범위 내 정보 갱신
  - 위치: `CODE_MEMORY_LIMIT` 상단 주석 (2줄 → 3줄)
  - 상세: 파일 2와 동일한 이유 — 고정 수치 128MB를 env-tunable임을 반영하는 설명으로 갱신. 로직 변경 없음.
  - 제안: 없음.

---

### 파일 4: codebase/backend/src/nodes/data/code/code.handler.spec.ts

- **[INFO]** 테스트 추가 및 기존 테스트 수정 — 모두 범위 내
  - 위치: 여러 describe 블록
  - 상세:
    1. `$helpers.base64.encode/decode` 비문자열 TypeError 가드 테스트(4 케이스 `it.each`) — plan의 base64 TypeError 가드 항목에 직접 대응.
    2. `resolveMemoryLimitMb` 단위 테스트 describe 블록 신규 추가 — `CODE_NODE_MEMORY_LIMIT_MB` env 항목 구현에 대응.
    3. 기존 메모리 한도 describe 블록에 `beforeAll(() => jest.retryTimes(2))` / `afterAll(() => jest.retryTimes(0))` 추가 — plan W10(CI flakiness 완화)에 직접 대응.
    4. 기존 주석 갱신(W10 CI 경고 문구, invalid base64 설명) — 범위 내 정보 갱신.
    5. `resolveMemoryLimitMb` 임포트 추가 — 신규 테스트에 필요한 항목이므로 범위 내.
  - 제안: 없음.

---

### 파일 5: codebase/backend/src/nodes/data/code/code.handler.ts

- **[INFO]** `resolveMemoryLimitMb` 함수 추출 및 `export` — 범위 내
  - 위치: 모듈 상단 상수 정의 영역
  - 상세: 기존 `const ISOLATE_MEMORY_LIMIT_MB = 128` 하드코딩을 `resolveMemoryLimitMb()` 함수로 교체했다. plan의 "메모리 한도 env 추출" 항목에 정확히 대응하며 `@internal` JSDoc 으로 테스트 전용 export 임을 명시했다.

- **[INFO]** `_buildIsolateContext` / `_runWithTimeout` private 메서드 분리 — 범위 내
  - 위치: `CodeHandler.execute()` 내부 코드를 두 private 메서드로 이동
  - 상세: plan W4(execute() 헬퍼 분리)에 정확히 대응한다. 로직의 이동·재구성이지 새로운 기능 추가가 아니다. 기능 동일성:
    - `_buildIsolateContext`: 기존 execute() 내부의 컨텍스트 초기화 코드 블록 그대로.
    - `_runWithTimeout`: 기존 execute() 내부의 `Promise.race` + `setTimeout` 블록 그대로. `timeoutHandle` 스코프가 `_runWithTimeout` 내부 `try/finally` 로 정확히 이동됐으며 finally에서 `clearTimeout` 처리됨(기존과 동일 효과).
  - 제안: 없음.

- **[INFO]** `hostB64Encode` / `hostB64Decode` 함수 추가 + `__host_b64encode/decode` 콜백 수정 — 범위 내
  - 위치: `hostHash` 아래 신규 함수 + `_buildIsolateContext` 내 콜백 등록
  - 상세: plan의 "base64 비문자열 TypeError 가드" 항목에 대응한다. 기존 `String(data)` silent coercion을 `TypeError` throw로 교체하는 것이 의도된 변경이다. 범위 내.

- **[INFO]** `ctx.global` 참조 방식 변경 — 범위 내
  - 위치: execute() 내 `$vars` copy-out 라인
  - 상세: 기존 `jail.get(...)` → `ctx.global.get(...)`. `jail`은 `_buildIsolateContext`로 이동되었으므로 execute()에서는 `ctx.global`로 접근해야 한다. 로직 동일.

---

### 파일 6: codebase/frontend/src/content/docs/02-nodes/data.en.mdx

- **[INFO]** 사용자 가이드 동기화 — 범위 내
  - 위치: Sandbox rules 테이블 Memory 행, Error codes 테이블 CODE_MEMORY_LIMIT 행
  - 상세: Memory 행의 type을 `"128MB"` → `"128MB default"` 로, description을 env-tunable 설명 포함으로 갱신. CODE_MEMORY_LIMIT description에서 "128MB" 고정 수치를 제거해 "memory limit"로 일반화. plan의 "frontend 사용자 가이드/라벨 동기화" 항목에 직접 대응. 타 섹션(Transform 등) 무변경.

---

### 파일 7: codebase/frontend/src/content/docs/02-nodes/data.mdx

- **[INFO]** 한국어 가이드 동기화 — 범위 내
  - 위치: 샌드박싱 규칙 테이블 메모리 행, 에러 코드 테이블 CODE_MEMORY_LIMIT 행
  - 상세: 파일 6의 한국어 대응 파일. 변경 내용과 범위 동일. 타 섹션 무변경.

---

### 파일 8: codebase/frontend/src/lib/i18n/backend-labels.ts

- **[INFO]** ERROR_KO 테이블 `CODE_MEMORY_LIMIT` 항목 갱신 — 범위 내
  - 위치: `ERROR_KO` Record, `CODE_MEMORY_LIMIT` 키
  - 상세: `"코드 실행 중 메모리 한도(128MB)를 초과했어요."` → `"코드 실행 중 메모리 한도를 초과했어요."` 로 수치를 제거. env-tunable 이 되면서 고정 수치 128MB를 박히지 않도록 일관성을 맞춘 것이며, 나머지 번역 항목(수백 개)은 전혀 변경되지 않았다. plan의 "frontend 사용자 가이드/라벨 동기화" 항목에 대응.

---

## 요약

8개 파일 전체에 걸쳐 변경된 내용은 plan(code-node-isolated-vm-followups)에 명시된 항목들(base64 TypeError 가드, `CODE_NODE_MEMORY_LIMIT_MB` env 도입, `_buildIsolateContext`/`_runWithTimeout` 헬퍼 분리, CI flakiness 완화 retry, frontend 가이드·라벨 동기화)에 1:1로 대응한다. 의도와 무관한 로직 변경, 불필요한 리팩토링, 범위 외 파일 수정, 포맷팅 노이즈, 임포트 정리 등은 발견되지 않았다. 주석 변경은 모두 env 도입으로 인해 내용을 갱신해야 하는 정당한 범위 내 변경이다. 범위 일탈 사항 없음.

## 위험도

NONE
