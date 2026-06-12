# Documentation Review — refactor-04-security

## 발견사항

### **[INFO]** `ENABLE_SWAGGER_IN_PROD` 환경변수 `.env.example` 누락 가능성
- 위치: `codebase/backend/src/common/config/production-guards.ts` `isSwaggerEnabled` JSDoc, `codebase/backend/.env.example` (변경 외 파일)
- 상세: `ENABLE_SWAGGER_IN_PROD` 신규 환경변수가 코드 JSDoc과 plan에 기록되어 있으나, `.env.example`에 주석 플레이스홀더 항목이 추가됐는지 이번 변경 범위에서 확인되지 않는다. 운영자가 opt-in 방법을 인지하지 못할 수 있다. plan에는 "spec 갱신 필요 (planner)" 항목으로 미완료 표시(`⏳`)되어 있어 의도적 미완료임은 확인되나, `.env.example` 자체는 developer 쓰기 범위다.
- 제안: `codebase/backend/.env.example`에 `# ENABLE_SWAGGER_IN_PROD=true  # production 에서 Swagger UI 강제 노출 (opt-in, 기본 미노출)` 주석 행을 추가한다.

### **[INFO]** `MAX_REGEX_LENGTH` 상수 JSDoc이 실제 사용 범위를 과소 표현
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts`, `MAX_REGEX_LENGTH` 상수 JSDoc
- 상세: 기존 주석 `"Cap on user-authored regex pattern length to mitigate ReDoS exposure. Mirrored by {@link compileRegexCache}."`가 `compileRegexCache`만 언급하지만, 04 M-3 이후로는 `compileUserRegex`가 단일 chokepoint가 되어 `compileRegexCache`·filter `getRegex`·transform `safeCompileRegex` 모두 `compileUserRegex`를 통해 간접 경유한다. 주석이 변경된 코드와 불일치한다.
- 제안: `"Cap on user-authored regex pattern length. Enforced at the single chokepoint {@link compileUserRegex} — consumed by {@link compileRegexCache}, FilterHandler, and TransformHandler."` 으로 갱신한다.

### **[INFO]** `channelAuthorizers` `authorize` ctx 파라미터 설명 없음
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`, `channelAuthorizers` 필드 인라인 타입 선언 (`authorize` 시그니처)
- 상세: `authorize`의 두 번째 인자가 `workspaceId: string`에서 `ctx: { workspaceId: string; userId: string }` 로 확장됐다. 기존 `W-13` 인라인 주석이 배열 전략 패턴을 설명하지만, `ctx` 객체의 두 필드 의미(각각 JWT workspace, JWT sub)를 설명하는 주석이 없어 새 authorizer 추가 시 `userId`가 언제 필요한지 코드만으로 파악하기 어렵다.
- 제안: `authorize` 타입 선언 직전에 `// ctx.workspaceId: JWT workspace claim — required for all channel types. // ctx.userId: JWT sub — required for user-scoped channels (notifications:).` 수준의 한 줄 설명을 추가한다.

### **[INFO]** `safe-html.ts` `ALLOWED_URI_REGEXP` 세 번째 대안 설명 부족
- 위치: `codebase/channel-web-chat/src/lib/safe-html.ts`, `ALLOWED_URI_REGEXP` 상수
- 상세: 주석이 "DOMPurify 기본 정규식에서 tel/sms/ftp 등을 제거한 형태"라고만 설명하지만, `/^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i`의 세 번째 대안 `[a-z+.-]+(?:[^a-z+.:-]|$)`이 relative URL과 anchor(`#`)를 허용하기 위한 것임이 불분명하다. 이 패턴을 변경하면 의도치 않게 특정 scheme을 허용하거나 차단할 수 있다.
- 제안: 상수 주석에 `// 세 번째 대안: relative URL / anchor(# 시작) — non-letter 시작이거나 known-scheme 아닌 문자열 허용` 을 인라인으로 추가하거나, DOMPurify 소스 원본 참조 URL을 기록한다.

### **[INFO]** `plan/in-progress/refactor/04-security.md` 완료 항목 spec 갱신 의무 tracking
- 위치: `plan/in-progress/refactor/04-security.md`, M-1·M-3·M-6·m-1 완료 항목의 `⏳` spec 갱신 서브 항목
- 상세: 네 완료 항목 모두 "spec 갱신 (planner)" sub-item이 `⏳` 미완료 상태다. plan 자체는 잘 기록되어 있으나, 이 `⏳` 항목들이 별도 planner task로 이관되지 않으면 plan 완료 전환 시 누락될 수 있다. 문서화 관점에서는 spec이 갱신되기 전까지 spec과 구현 사이에 기술된 정책(예: "길이 200 = ReDoS 방지" 서술이 부정확)이 유지된다.
- 제안: spec 갱신 `⏳` 항목들을 planner에게 명시적으로 위임하거나 별도 plan task로 분리한다. 현 상태는 tracking 위치는 올바르나 완료 기준이 명시되지 않은 상태다.

---

## 요약

이번 변경(refactor-04-security)은 보안 하드닝 목적으로 `isSwaggerEnabled`·`compileUserRegex`·WebSocket channel authorizer·safe-html 화이트리스트 총 4개 영역을 다룬다. 각 공개 함수와 타입(`isSwaggerEnabled`, `RegexRejectReason`, `RegexCompileResult`, `compileUserRegex`, `renderTemplateHtml`)에 JSDoc이 충실하게 작성되어 있고, 인라인 주석도 보안 의도와 spec 참조(`04 M-1/M-3/M-6`, `OWASP`, `CWE-521`)를 잘 기록하고 있다. 테스트 파일의 `describe` 블록 상단 주석이 테스트 계약을 명확히 고정하는 점도 긍정적이다. CHANGELOG 역할은 plan 문서가 대체하고 있으며 M-1·M-3·M-6·m-1 항목이 plan에 완료로 기록되어 있다. 미비사항은 신규 환경변수 `ENABLE_SWAGGER_IN_PROD`의 `.env.example` 미추가 가능성, `MAX_REGEX_LENGTH` JSDoc의 범위 불일치, `channelAuthorizers` ctx 파라미터 설명 부재, `ALLOWED_URI_REGEXP` 세 번째 대안 설명 부족, spec 갱신 `⏳` 항목의 후속 tracking 부재 등 모두 INFO 수준이다.

## 위험도

LOW
