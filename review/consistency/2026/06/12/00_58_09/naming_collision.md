# 신규 식별자 충돌 검토 결과

검토 범위: `spec/conventions/error-codes.md` 신규 `§3.1` (내부 전용 legacy 분류 코드 레지스트리),
`spec/5-system/3-error-handling.md` (`HTTP_TIMEOUT` 미발행 주석·분류표),
`spec/4-nodes/5-data/2-code.md` (2단 래퍼·메모리 케이스 주석),
`spec/conventions/node-output.md` (링크 anchor 수정),
`spec/4-nodes/4-integration/1-http-request.md` (주석·Deprecated 태그).

---

## 발견사항

### **[WARNING]** `EXECUTION_TIMEOUT` — 내부 분류 코드로 등재되었으나 동시에 public-facing 코드로도 사용 중

- **target 신규 식별자**: `spec/conventions/error-codes.md §3.1` 표의 "내부 분류 코드 (legacy)" 열에 `EXECUTION_TIMEOUT` 등재. 섹션 도입문이 "직접 발행되지 않으며 … 구현 내부 명칭"으로 서술.
- **기존 사용처**:
  - `spec/5-system/14-external-interaction-api.md` line 547: `"code": "EXECUTION_TIMEOUT" | "EXECUTION_TIME_LIMIT_EXCEEDED" | ...` — EIA `execution.failed` SSE/webhook payload 의 `error.code` 필드 예시로 명시. "Code 노드 스크립트 타임아웃"이라고 주석.
  - `spec/conventions/chat-channel-adapter.md` line 387: `EXECUTION_TIMEOUT (Code 노드 스크립트)` 가 `executionFailedTimeout` 분류 행에 열거 — 채널 어댑터가 이 값으로 **분기**.
  - 프론트엔드 docs `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` 및 `run-results.en.mdx`: `EXECUTION_TIMEOUT` 을 공개 에러 코드로 사용자에게 노출.
  - `codebase/backend/src/nodes/core/error-codes.ts` 에는 `EXECUTION_TIMEOUT` enum 항목이 **없다** — 실제로 `code.handler.ts` 내부에서만 인스턴스로 쓰이고, `LEGACY_TO_NORMALIZED` 로 `CODE_TIMEOUT` 으로 정규화된 후 `output.error.code` 에 발행된다.
- **상세**: `code.handler.ts` 의 `EXECUTION_TIMEOUT` 은 handler 내부 분류 string 이며 `ErrorCode` enum 에 없고, 외부로는 `CODE_TIMEOUT` 으로 변환된다. 그러나 `spec/5-system/14-external-interaction-api.md §6.4` 와 `chat-channel-adapter.md §3.1` 은 `EXECUTION_TIMEOUT` 을 **관측 가능한 public 코드**로 다루고 있어, `error-codes.md §3.1` 이 "직접 발행되지 않음"으로 서술하는 것과 의미 혼선이 있다. 이는 레이어 구분 부재에서 기인한다: Code 노드 handler 내부에서 `output.error.code` 로 발행되는 경로는 없지만, 엔진 레벨에서 노드 실행 실패 컨텍스트로 전파되는 `EXECUTION_TIMEOUT` 이 별도로 존재하며 EIA 에서 관측된다.
- **제안**: `§3.1` 의 `EXECUTION_TIMEOUT` 행에 주석 추가: "Code 노드 handler 내부 전용 분류 코드. 엔진이 EIA `execution.failed.error.code` 로 발행하는 동명의 엔진 레벨 `EXECUTION_TIMEOUT` (spec/5-system/14-external-interaction-api.md §6.4 · chat-channel-adapter.md §3.1 참조)과 **별개의 레이어** 임을 명시." 또는 도입문에 "Code 노드 `output.error.code` 로 직접 발행되지 않음 — 엔진 레벨 EIA payload 의 `error.code` 와 혼동 주의" 한 문장 추가.

---

### **[INFO]** `§3.1` 섹션 번호 신설 — `error-codes.md` 에 `§3.1` anchor 가 추가되나 기존 cross-reference 없음

- **target 신규 식별자**: `spec/conventions/error-codes.md` 에 `### 3.1 내부 전용 legacy 분류 코드 (정규화 후 발행)` 섹션 신설.
- **기존 사용처**: 기존에 `error-codes.md §3.1` 을 직접 링크하는 cross-reference 없음. `§3` 레벨 링크는 `spec/5-system/1-auth.md`, `spec/2-navigation/10-auth-flow.md` 등에 존재하지만 `§3.1` 앵커는 미사용.
- **상세**: 충돌 없음. 신규 앵커 도입이 기존 참조를 깨지 않는다.
- **제안**: 없음.

---

### **[INFO]** `legacyCode` 필드명 — spec 신규 등록이나 codebase 와 정합

- **target 신규 식별자**: `error-codes.md §3.1` 이 `output.error.details.legacyCode` 를 공식 spec 필드로 등록.
- **기존 사용처**: `codebase/backend/src/nodes/data/code/code.handler.ts` line 421: `const outputDetails: Record<string, unknown> = { legacyCode: errorCode };` — 동일 이름. `spec/4-nodes/5-data/2-code.md §5.3` 공통 필드 표에도 기술됨.
- **상세**: 충돌 없음. Spec 과 구현이 동일 이름·의미를 사용.
- **제안**: 없음.

---

### **[INFO]** `HTTP_TIMEOUT` 미발행 주석 — 기존 chat-channel-adapter.md 와 일치

- **target 신규 식별자**: `spec/5-system/3-error-handling.md §1.4` 표에 `HTTP_TIMEOUT(미발행 — 아래 註)` 주석 추가.
- **기존 사용처**: `spec/conventions/chat-channel-adapter.md` line 381·391 에 `HTTP_TIMEOUT(미발행)` 이미 동일하게 기술. `ErrorCode` enum 에도 보존.
- **상세**: 충돌 없음. 기존 SoT 와 일치.
- **제안**: 없음.

---

## 요약

이번 diff 에서 신규 도입된 식별자(`EXECUTION_TIMEOUT` / `EXECUTION_MEMORY_EXCEEDED` / `CODE_RUNTIME_ERROR` 내부 분류 코드 레지스트리, `legacyCode` 필드, `HTTP_TIMEOUT` 미발행 주석)는 대부분 기존 codebase·spec 과 정합하며 의미 충돌이 없다. 단 `error-codes.md §3.1` 이 `EXECUTION_TIMEOUT` 을 "직접 발행되지 않는 내부 명칭"으로 규정하는 반면, `spec/5-system/14-external-interaction-api.md §6.4` 와 `spec/conventions/chat-channel-adapter.md §3.1` 은 동일 문자열을 관측 가능한 public 코드로 열거해 reader 혼선이 발생한다. Code 노드 handler 내부 레이어와 엔진 레벨 EIA payload 레이어의 구분이 `§3.1` 에서 명시되지 않은 것이 핵심 WARNING 이며, 간단한 주석 보강으로 해소 가능하다.

## 위험도

LOW
