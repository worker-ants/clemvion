# 요구사항(Requirement) 리뷰

## 발견사항

### **[INFO] spec fidelity — `CODE_MEMORY_LIMIT` / `HTTP_BLOCKED` INTERNAL_CODES 등재**
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` `INTERNAL_CODES` Set
- 상세: spec/conventions/chat-channel-adapter.md §3.1 매핑 표는 `CODE_MEMORY_LIMIT`(isolate 128MB 초과)과 `HTTP_BLOCKED`(SSRF 차단)를 `executionFailedInternal` 행에 명시적으로 열거하고 있다. 이번 변경으로 코드가 spec 표와 일치하게 됐다. 이전에는 두 코드가 unknown fallback 경로를 거쳐 결과적으로 동일한 `executionFailedInternal`을 반환했으나 CCH-ERR-04 warn 로그가 발생했다. 코드 변경은 spec 요구사항을 정확히 이행하는 것이므로 문제 없음.
- 제안: 없음. spec 대비 구현 정합 완료.

### **[INFO] spec fidelity — `classifyCodeNodeError` rename**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts`, 테스트 파일
- 상세: plan W2 항목이 요구한 `classifyError` → `classifyCodeNodeError` rename이 완료되었다. 함수 시그니처와 동작은 완전히 동일하고 호출 위치도 정확히 갱신되어 있다. spec/5-system/3-error-handling.md 및 관련 spec이 함수명을 직접 명시하지 않으므로 spec fidelity 측면에서는 중립적이나, plan W2 요구사항은 충족한다.
- 제안: 없음.

### **[INFO] spec fidelity — `LEGACY_TO_NORMALIZED` fallthrough 방어**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` `failure()` 내부
- 상세: `?? errorCode` → `?? ErrorCode.CODE_EXECUTION_FAILED` 로 변경하여 미등록 내부 코드가 공개 API에 노출되지 않도록 했다. plan INFO 항목 요구사항이 충족되었다. `Object.freeze`와 `Readonly<Record<string, ErrorCodeValue>>` 타입 적용으로 값이 실제 `ErrorCode` 멤버로 고정됨. 기능 완전성 관점에서 적절.
- 제안: 없음.

### **[INFO] spec fidelity — `HTTP_BLOCKED` ErrorCode 참조화**
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` L354, L363
- 상세: `new IntegrationError('HTTP_BLOCKED', ...)` literal → `ErrorCode.HTTP_BLOCKED` 참조화. 사용 로그 `error.code` 양쪽 모두 갱신됨. plan http-ssrf-all-auth-followups.md의 `HTTP_BLOCKED` enum 참조화 항목이 정확히 이행되었다. 런타임 값은 변경 없이 동일(`'HTTP_BLOCKED'`).
- 제안: 없음.

### **[WARNING] spec fidelity — `statusCode` placeholder 범위 검사 미이행**
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` `extractStatusCode()` 함수, 테스트 파일 W#4 경계값 케이스
- 상세: spec/conventions/chat-channel-adapter.md §3.1 매핑 표는 HTTP_4XX 행에 `details.statusCode ∈ [400, 499]` (있으면), HTTP_5XX 행에 `details.statusCode ∈ [500, 599]` (있으면) 범위 조건을 명시한다. 현재 `extractStatusCode()`는 `Number.isInteger(v)` 만 검사하므로 `statusCode: 0`, `statusCode: -200` 같이 유효하지 않은 값이 통과된다. 테스트(W#4)는 이를 "현재 구현 동작 문서화"로 처리하고 있다. spec의 "있으면" 문언이 단순 presence를 의미하는지 아니면 범위 조건을 포함하는지 해석이 모호하다. 범위 조건이 의도라면 코드 fix 대상이고, presence만의 의미라면 spec 표현 개선 대상이다.
- 제안: spec §3.1 표의 범위 조건 의도를 planner에게 확인. 범위 검사가 spec 의도라면 `extractStatusCode`에 `v >= 100 && v <= 599` 조건 추가 필요. 회색지대이므로 사람 판단이 필요하다.

### **[INFO] 기능 완전성 — no-warn 회귀 테스트**
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` L202-212
- 상세: `CODE_MEMORY_LIMIT`/`HTTP_BLOCKED`에 대해 `warnSpy.not.toHaveBeenCalled()` 단언으로 CCH-ERR-04 warn 로그가 발생하지 않음을 명시적으로 검증한다. W1 요구사항(warn 로그 제거)의 핵심 의도를 직접 회귀 검증하므로 기능 완전성 측면에서 적절하다. `result.key` 단언은 상위 `it.each` 블록(L177-194)과 중복이지만 동작에 영향 없음.
- 제안: 중복 단언 제거는 선택적 개선이며 필수 아님.

### **[INFO] 에러 시나리오 — `event.error` undefined 방어 경로**
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` L325-344
- 상세: `event.error`가 runtime에서 `undefined`일 때 optional chaining(`event.error?.code ?? ''`)이 빈 문자열로 fallback하여 `executionFailedInternal`을 반환하는 방어 경로가 명시적으로 테스트됨. 런타임 방어가 정상 동작하고 테스트로 검증됨.
- 제안: 없음.

### **[INFO] 비즈니스 로직 — `classifyCodeNodeError` + `LEGACY_TO_NORMALIZED` 2단계 체인**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts`
- 상세: `classifyCodeNodeError`는 내부 legacy 코드(`EXECUTION_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED`, `CODE_RUNTIME_ERROR`)를 반환하고, `LEGACY_TO_NORMALIZED`가 각각을 공개 `ErrorCode`(`CODE_TIMEOUT`, `CODE_MEMORY_LIMIT`, `CODE_EXECUTION_FAILED`)로 변환한다. spec/5-system/3-error-handling.md §1.4의 `EXECUTION_TIMEOUT`(Code 노드 스크립트 타임아웃, public `CODE_TIMEOUT`)과 코드 열거표(`CODE_MEMORY_LIMIT`, `CODE_EXECUTION_FAILED`)와 정합한다.
- 제안: 없음.

### **[INFO] TODO/FIXME 검사**
- 위치: 변경된 모든 파일
- 상세: 변경된 파일에 미완성을 시사하는 TODO, FIXME, HACK, XXX 주석은 없다. `code.handler.ts`의 `W15` 주석("Currently hardcoded. Can be extracted to env var")은 후속 개선 가능성을 언급하지만 현재 동작을 블로킹하지 않으며 plan에 등재된 항목이다.
- 제안: 없음.

### **[INFO] spec fidelity — `error-codes.ts` 주석 갱신**
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` `HTTP_BLOCKED` 항목
- 상세: `HTTP_BLOCKED` 주석에 `http-safety.ts` SoT 참조와 `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 정보가 추가됨. `EMAIL_HOST_BLOCKED` 주석과 대칭적 서술로 일관성 있음. spec/5-system/3-error-handling.md §1.4 표의 `HTTP_BLOCKED (SSRF 차단 — 전 인증 방식 공통)` 기술과 정합한다.
- 제안: 없음.

---

## 요약

이번 errcode-wiring PR은 plan `code-node-isolated-vm-followups.md`의 W1(CODE_MEMORY_LIMIT/HTTP_BLOCKED classifier 등재), W2(classifyError rename), INFO(LEGACY_TO_NORMALIZED 안전화)와 `http-ssrf-all-auth-followups.md`의 HTTP_BLOCKED enum 참조화 항목을 모두 이행한다. spec/conventions/chat-channel-adapter.md §3.1 매핑 표에 이미 명시된 두 코드(`CODE_MEMORY_LIMIT`, `HTTP_BLOCKED`)가 `INTERNAL_CODES` Set에 등재되어 spec-impl 불일치가 해소되었다. `extractStatusCode()`의 정수 범위 검사가 spec §3.1 표의 범위 조건(`[400,499]`/`[500,599]`)과 잠재적으로 불일치할 수 있어 WARNING으로 플래깅했으나, spec 문언의 해석에 따라 INFO 수준으로 낮아질 수 있다. 나머지 발견사항은 모두 INFO 수준이며 기능 완전성, 비즈니스 로직, 에러 시나리오 측면에서 요구사항을 충족한다.

## 위험도

LOW
