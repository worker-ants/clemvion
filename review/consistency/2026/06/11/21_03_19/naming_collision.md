# 신규 식별자 충돌 검토 — `spec/4-nodes/5-data/2-code.md` (isolated-vm 전환 draft)

## 발견사항

### [WARNING] `CODE_MEMORY_LIMIT` — 기존 "로드맵" 식별자를 실제 코드로 격상, `error-codes.ts` 미등록

- **target 신규 식별자**: `CODE_MEMORY_LIMIT` (§7.2 리소스 제한 표, §5.3 에러 코드 매핑 표)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` line 288, 322 — 현재 baseline spec 에서 `EXECUTION_MEMORY_EXCEEDED (로드맵) → CODE_MEMORY_LIMIT` 와 `isolated-vm 전환 시 128MB 적용 예정 (CODE_MEMORY_LIMIT)` 로 **미래형(로드맵)** 으로만 언급.
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/core/error-codes.ts` — `CODE_MEMORY_LIMIT` 키 **미존재**.
  - `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` line 81, 224 — Code 노드 공식 에러 코드 목록이 `CODE_EXECUTION_FAILED · CODE_TIMEOUT` 두 개로 고정; `CODE_MEMORY_LIMIT` 미포함.
- **상세**: target draft 에서 `CODE_MEMORY_LIMIT` 는 `isolated-vm` 이 실제 128MB 하드 리밋을 강제하므로 즉시 live 코드가 된다. 그러나 `error-codes.ts` `ErrorCode` enum 에 미등록, `3-error-handling.md` §1.4 Code 노드 코드 목록과 §3.2 표에도 미반영, `conventions/chat-channel-adapter.md` 의 `executionFailedTimeout` 분류기 표에도 미포함. 클라이언트/통합 코드가 `CODE_TIMEOUT` 과 `CODE_MEMORY_LIMIT` 를 구분해 분기해야 하는데 spec·코드 양쪽에 정의가 없어 조용히 누락될 위험이 있다.
- **제안**: target 와 함께 다음을 병행 갱신한다.
  1. `error-codes.ts` `ErrorCode` 에 `CODE_MEMORY_LIMIT: 'CODE_MEMORY_LIMIT'` 추가.
  2. `spec/5-system/3-error-handling.md` §1.4 Code 노드 행과 §3.2 표에 `CODE_MEMORY_LIMIT` 추가.
  3. `spec/conventions/chat-channel-adapter.md` §3.2 분류 표의 `CODE_TIMEOUT` 행(또는 별도 행)에 `CODE_MEMORY_LIMIT` 추가.

---

### [WARNING] `EXECUTION_MEMORY_EXCEEDED` — 로드맵 한정 식별자를 실제 내부 legacy 코드로 격상, 기존 정의 없음

- **target 신규 식별자**: `EXECUTION_MEMORY_EXCEEDED` (§5.3 에러 코드 매핑 표의 `legacyCode` 열, `(로드맵)` 한정자 제거)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` line 288 — `EXECUTION_MEMORY_EXCEEDED (로드맵)` 로만 등장, 실제 handler 코드에 미존재.
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.ts` — `EXECUTION_MEMORY_EXCEEDED` 문자열 **미사용**. 현재 handler 는 `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` 두 내부 legacy code 만 사용.
- **상세**: target §5.3 매핑 표는 `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 를 `(로드맵)` 없이 기재한다. 이는 isolated-vm 의 `Isolate memoryLimit` 초과 시 실제로 던지는 오류를 handler 가 이 내부 코드로 포착·분류한다는 계약을 선언한다. 그러나 handler 구현에 아직 이 분기가 없으면 mapping 이 `CODE_EXECUTION_FAILED` fallback 으로 흡수돼 `CODE_MEMORY_LIMIT` 가 실제로는 발행되지 않는 상황이 발생할 수 있다. 또한 `EXECUTION_TIMEOUT` 이 execution-engine 레벨 코드와 이름이 유사해 혼동 위험이 있음 (`spec/5-system/4-execution-engine.md` line 1018, `spec/5-system/3-error-handling.md` line 62 에 명시적으로 Code 노드 전용 이름임을 기록하고 있으나 신규 `EXECUTION_MEMORY_EXCEEDED` 에는 그런 스코프 명시가 없음).
- **제안**: handler 구현에서 isolated-vm 이 메모리 초과 시 던지는 오류 타입(예: `err.code === 'ERR_MEM_LIMIT'` 등 실제 isolated-vm 에러 코드)을 확인한 뒤, 해당 분기를 `EXECUTION_MEMORY_EXCEEDED` 내부 코드로 캡처하는 코드를 추가하고 spec 과 동기화한다. 코드 주석에 "Code 노드 메모리 초과 전용" 스코프를 명시한다.

---

### [INFO] `ivm.Isolate` / `ivm.Callback` / `Reference` / `ExternalCopy` — spec 본문 인라인 API 식별자, 기존 충돌 없음

- **target 신규 식별자**: `ivm.Isolate`, `ivm.Callback`, `ExternalCopy`, `Reference`, `compileScript`, `script.run(…, { promise: true, timeout })` 등 §4 실행 로직·§7.1 격리 방식에서 isolated-vm 라이브러리 API 명칭 직접 사용.
- **기존 사용처**: spec 내 기타 문서에서 이 식별자들은 미사용. 충돌 없음.
- **상세**: spec 본문이 외부 라이브러리 API 를 직접 인용하는 것은 관용적 패턴이나, 라이브러리 메이저 버전 업 시 API 변경이 spec 오염으로 이어질 수 있다. 현재는 충돌 없음.
- **제안**: 라이브러리 버전 pin 을 인접 Rationale 에 명시 (이미 §Rationale "isolated-vm 버전은 `node>=22` 를 지원하는 `6.x` 라인" 으로 기재됨 — 적절).

---

### [INFO] `memoryLimit: 128` — 설정 키, 기존 사용처 없음

- **target 신규 식별자**: `new ivm.Isolate({ memoryLimit: 128 })` 의 `memoryLimit` (§4, §7.1, §7.2)
- **기존 사용처**: 기존 spec 에서 128MB 는 "예정" 값으로만 언급 (baseline §7.2). 충돌 없음.
- **상세**: `memoryLimit` 은 isolated-vm 라이브러리 고유 속성명. spec 에서 ENV var 나 설정 키로 노출되지 않으므로 환경변수·설정키 충돌 없음.
- **제안**: 현재 하드코딩(`128`). 향후 운영 환경 튜닝이 필요하면 `CODE_NODE_MEMORY_LIMIT_MB` 같은 환경변수로 추출할 여지를 Rationale 에 기록하는 것을 고려.

---

### [INFO] `id: code` frontmatter, 파일 경로 `spec/4-nodes/5-data/2-code.md` — 기존과 동일, 충돌 없음

- **target 신규 식별자**: 없음 (기존 파일 갱신). frontmatter `id: code`, 파일 경로 모두 기존과 동일.
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` — 동일 파일의 새 버전.
- **상세**: 충돌 없음.

---

## 요약

target draft 가 도입하는 주요 신규 식별자는 `CODE_MEMORY_LIMIT`(정규화 에러 코드)과 `EXECUTION_MEMORY_EXCEEDED`(내부 legacy 코드)이다. 두 코드는 기존 baseline spec 에서 `(로드맵)` 한정자로 묶여 있던 식별자를 `isolated-vm` 전환에 맞춰 즉시 live 로 격상한 것이다. 그러나 `error-codes.ts` `ErrorCode` enum 에 `CODE_MEMORY_LIMIT` 가 미등록이고, `spec/5-system/3-error-handling.md` §1.4·§3.2 와 `conventions/chat-channel-adapter.md` 분류 표에도 반영되지 않아 코드가 실제로 발행되어도 다운스트림(chat-channel 분류기, 클라이언트 분기)이 인식하지 못하는 조용한 충돌이 발생할 수 있다. 나머지 식별자(`ivm.*` API, `memoryLimit` 설정)는 기존 네임스페이스와 충돌하지 않는다.

## 위험도

MEDIUM
