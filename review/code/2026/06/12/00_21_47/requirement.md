# Requirement Review

## 발견사항

### [INFO] `SSRF_BLOCKED: redirect chain exceeded 5 hops` 예외가 `HTTP_TRANSPORT_FAILED` 로 노출 (선행 변경 기인, 본 PR 범위 외)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/errcode-wiring-92dc2c/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` 라인 417
- **상세**: 리디렉트 5홉 초과 시 `throw new Error('SSRF_BLOCKED: ...')` 가 내부 fetch `try/catch` (라인 492~) 에 잡혀 `HTTP_TRANSPORT_FAILED` 코드로 라우팅된다. 그러나 spec(`spec/4-nodes/4-integration/1-http-request.md §4 step8` 및 §5.4 분류 표)은 "redirect 한도 초과 → `HTTP_BLOCKED`" 로 문서화한다. 이 불일치는 이번 PR 이 도입한 것이 아니라 선행 D4 변경에서 기인했으며, 본 PR 은 literal `'HTTP_BLOCKED'` → `ErrorCode.HTTP_BLOCKED` 참조화만 수행했으므로 본 PR 책임은 없다.
- **제안**: `http-ssrf-all-auth-followups.md` 의 open 항목("SSRF 에러 메시지 클라이언트 일반화")과 연계해 별도 계획으로 처리 권장. 리디렉트 초과 오류를 외부 catch 블록으로 분리하거나 별도 `buildPreflightErrorOutput` 경로로 라우팅하면 spec 과 정합.

### [INFO] `classifyCodeNodeError` rename — spec 문서에 원래 함수명 미수록
- **위치**: 관련 spec: `spec/4-nodes/5-data/2-code.md`
- **상세**: `code.handler.ts` 의 `classifyError` → `classifyCodeNodeError` rename 은 의도적·합리적인 개선(grep 충돌 방지, `@internal` JSDoc 명시)이다. spec 내에 이 내부 helper 의 이름이 원래 명시되어 있지 않아 spec 위반이 없다. plan 체크리스트(W2)에서 "spec 호출처 10곳 갱신"을 언급했으나 해당 함수명은 spec 이 아닌 코드베이스 내 test/handler 파일이 대상이었던 것으로 보인다.
- **제안**: 현행 유지. spec 에 이 내부 함수 이름을 명시할 필요 없음.

---

## 요약

이번 PR 의 핵심 변경 네 가지 — (1) `CODE_MEMORY_LIMIT` · `HTTP_BLOCKED` 를 `INTERNAL_CODES` Set 에 등재해 CCH-ERR-04 warn 로그 노이즈 제거, (2) `classifyError` → `classifyCodeNodeError` rename + `@internal` JSDoc 추가, (3) `LEGACY_TO_NORMALIZED` 에 `Object.freeze` + `Readonly<Record<string, ErrorCodeValue>>` 타입 고정 + `?? errorCode` → `?? ErrorCode.CODE_EXECUTION_FAILED` 기본값 강화, (4) `http-request.handler.ts` 의 `'HTTP_BLOCKED'` literal → `ErrorCode.HTTP_BLOCKED` 참조화 — 은 모두 plan 체크리스트(W1, W2, INFO 항목, `http-ssrf-all-auth-followups.md`) 와 완전히 일치한다. `spec/conventions/chat-channel-adapter.md §3.1` 매핑 표(라인 388)는 이미 `CODE_MEMORY_LIMIT` · `HTTP_BLOCKED` 를 `executionFailedInternal` 행에 열거하고 있으므로 코드가 spec 을 따라잡은 것이며 spec 변경은 불필요하다. `LEGACY_TO_NORMALIZED` 세 항목(`EXECUTION_TIMEOUT`/`EXECUTION_MEMORY_EXCEEDED`/`CODE_RUNTIME_ERROR`)은 `spec/4-nodes/5-data/2-code.md §5.3` 정규화 매핑 표와 field-level 로 정합한다. CCH-ERR-04 warn spy 테스트가 no-call 을 단언하며, it.each 의 enum 리스트에 두 신규 코드가 중복 없이 추가됐다. CRITICAL/WARNING 발견사항 없음.

## 위험도

LOW
