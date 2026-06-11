# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done`, scope: `spec/conventions/` / codebase 변경
diff 기준: HEAD~2 (커밋 2건 — `refactor(error-codes)` + `refactor(code-node)`)

## 검토 대상 신규 식별자

| 식별자 | 종류 | 도입 위치 |
|--------|------|-----------|
| `HTTP_BLOCKED` → `INTERNAL_CODES` 등재 | 분류기 Set 항목 | `execution-failure-classifier.ts` L61 |
| `CODE_MEMORY_LIMIT` → `INTERNAL_CODES` 등재 | 분류기 Set 항목 | `execution-failure-classifier.ts` L58 |
| `classifyCodeNodeError` (renamed from `classifyError`) | 공개 함수명 | `code.handler.ts` L243 |
| `LEGACY_TO_NORMALIZED` (타입 강화 + freeze) | 모듈 상수 | `code.handler.ts` L220 |

---

## 발견사항

### 충돌 없음 — `HTTP_BLOCKED` INTERNAL_CODES 등재

- target 신규 식별자: `'HTTP_BLOCKED'` 를 `INTERNAL_CODES` Set 에 추가
- 기존 사용처:
  - `spec/conventions/chat-channel-adapter.md` L388: `HTTP_BLOCKED`(SSRF 차단) 가 이미 `executionFailedInternal` 행에 열거됨
  - `spec/5-system/3-error-handling.md` L79, L222: HTTP 에러코드 표에 등재
  - `spec/4-nodes/4-integration/1-http-request.md` L96, L354: `HTTP_BLOCKED` 정의 및 라우팅 명세
  - `ErrorCode.HTTP_BLOCKED` (`error-codes.ts` L18): 선행 커밋(PR #549)에서 이미 선언
- 상세: `HTTP_BLOCKED` 는 기존 spec 과 `ErrorCode` enum 에 이미 정의된 식별자이며, 분류기 등재는 spec `chat-channel-adapter.md §3.1` 의 기존 매핑 표와 정확히 일치한다. 의미 충돌 없음.
- 제안: 없음. 일치.

---

### 충돌 없음 — `CODE_MEMORY_LIMIT` INTERNAL_CODES 등재

- target 신규 식별자: `'CODE_MEMORY_LIMIT'` 를 `INTERNAL_CODES` Set 에 추가
- 기존 사용처:
  - `spec/conventions/chat-channel-adapter.md` L388: `CODE_MEMORY_LIMIT` 가 이미 `executionFailedInternal` 행에 열거됨
  - `spec/5-system/3-error-handling.md` L83, L226: Code 노드 에러코드 표에 등재
  - `spec/4-nodes/5-data/2-code.md` L276, L289, L319: `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 정규화 표 및 설명
  - `ErrorCode.CODE_MEMORY_LIMIT` (`error-codes.ts` L45): 선행 커밋에서 이미 선언
- 상세: `CODE_MEMORY_LIMIT` 는 기존 spec 과 `ErrorCode` enum 에 이미 정의된 식별자이며, 분류기 등재는 spec 매핑 표와 일치한다. 의미 충돌 없음.
- 제안: 없음. 일치.

---

### [INFO] `classifyCodeNodeError` — 기존 `classifyError` 이름과 중복 맥락 정리 완료

- target 신규 식별자: `export function classifyCodeNodeError(...)` (`code.handler.ts` L243)
- 기존 사용처 (private, 별개 클래스):
  - `cafe24-mcp-tool-provider.ts` L726: `private classifyError(err: unknown)`
  - `makeshop-mcp-tool-provider.ts` L714: `private classifyError(err: unknown)`
- 상세: 이전 커밋까지 `code.handler.ts` 에는 `export function classifyError(...)` 가 있었다. 같은 모듈 밖 `private classifyError` 와 스코프는 다르지만, grep 시 오판 여지가 있었다. 이번 커밋에서 `classifyCodeNodeError` 로 개명하면서 새 JSDoc 에 "cafe24/makeshop MCP tool providers 의 private classifyError 와 의도적으로 구분" 을 명시해 혼동 가능성을 제거했다.
- 제안: 추가 조치 불필요. 이미 JSDoc 에 명시됨. spec 에는 함수 이름 단위 언급 없으므로 spec 업데이트 대상 아님.

---

### 충돌 없음 — `LEGACY_TO_NORMALIZED` 타입 강화

- target 신규 식별자: `const LEGACY_TO_NORMALIZED: Readonly<Record<string, ErrorCodeValue>>` + `Object.freeze(...)` (`code.handler.ts` L220)
- 기존 사용처: 이전 커밋의 동일 상수(`Record<string, string>`, 비-frozen)가 동일 파일에 존재하다가 이번 커밋에서 재선언됨 (module-level hoisting 수정 포함).
- 상세: 상수 이름 `LEGACY_TO_NORMALIZED` 는 타 파일에서 사용하지 않으며, spec 에도 해당 식별자 언급 없다. 타입 강화(`Readonly` + `ErrorCodeValue`) 및 `freeze` 는 기존 의미와 완전히 동일하고 인터페이스 변경이 없다. 충돌 없음.
- 제안: 없음.

---

### [INFO] 내부 legacy 코드 문자열 (`EXECUTION_MEMORY_EXCEEDED`, `CODE_RUNTIME_ERROR`) spec 언급과 일치

- target 신규 식별자: `classifyCodeNodeError` 가 반환하는 내부 문자열 `'EXECUTION_MEMORY_EXCEEDED'`, `'EXECUTION_TIMEOUT'`, `'CODE_RUNTIME_ERROR'`
- 기존 사용처:
  - `spec/4-nodes/5-data/2-code.md` L276~319: legacyCode 값으로 `CODE_RUNTIME_ERROR`, `EXECUTION_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED` 명시
  - `execution-failure-classifier.ts` L41: `'EXECUTION_TIMEOUT'` 이 `TIMEOUT_CODES` Set 에 별도 등재 (classifier 는 public 코드 처리, legacyCode 는 처리 대상 아님 — 정상)
- 상세: 세 내부 코드는 `ErrorCode` enum 멤버가 아닌 handler 내부 분류 전용 문자열로 spec 에도 "legacyCode" 맥락으로만 등재되어 있다. 외부 누출 경로가 없고(`output.error.details.legacyCode` 로만 echo), `LEGACY_TO_NORMALIZED` 테이블에 명확히 매핑됨. 의미 충돌 없음.
- 제안: 없음.

---

## 요약

이번 구현(`refactor(error-codes)` + `refactor(code-node)`)이 도입한 신규 식별자는 모두 기존 spec(`chat-channel-adapter.md §3.1`, `error-handling.md`, `code.md`, `error-codes.ts`)에 이미 명시된 코드들이다. `HTTP_BLOCKED` 와 `CODE_MEMORY_LIMIT` 의 분류기 등재는 spec 매핑 표와 완전히 일치하고, `classifyCodeNodeError` 개명은 기존 private `classifyError` 와의 혼동 가능성을 JSDoc 으로 명시하며 제거했다. 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 파일 경로 어느 관점에서도 기존 식별자와의 의미 충돌은 발견되지 않았다.

## 위험도

NONE
