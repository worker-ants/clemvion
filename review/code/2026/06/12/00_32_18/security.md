# 보안(Security) 리뷰

## 발견사항

### **[INFO] SSRF 에러 메시지에 차단 호스트명/IP 노출 가능**
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — HTTP_BLOCKED 에러 경로 (변경된 라인 354~371)
- 상세: `err instanceof Error ? err.message : String(err)` 가 IntegrationError 의 message 로 그대로 전달된다. `http-safety.ts` 가 생성하는 메시지는 `SSRF_BLOCKED: hostname "X.X.X.X"` 형태로 차단된 내부 IP/호스트명을 포함할 수 있다. 이 메시지는 `output.error.message` 를 통해 클라이언트(워크플로 작성자 UI/채팅 채널)까지 전달될 수 있어, 내부 네트워크 토폴로지 정찰에 활용될 수 있는 정보 노출(OWASP A05 Security Misconfiguration / A01 Broken Access Control)이다. 이번 PR 이 이 경로를 직접 도입한 것은 아니나(선행 D4 변경 기인), `ErrorCode.HTTP_BLOCKED` 참조화 변경으로 인해 동일 코드 경로가 리뷰 범위에 포함되었다.
- 제안: `IntegrationError` 생성 시 message 를 `"Request blocked by SSRF policy"` 등 일반화된 문자열로 교체하고, 차단된 호스트/IP 는 서버 측 구조화 로그에만 기록한다. `http-ssrf-all-auth-followups.md` 의 미완료 항목(SSRF 에러 메시지 클라이언트 일반화)과 동일한 개선 사항으로 해당 follow-up 에서 처리 필요.

### **[INFO] `outputDetails.legacyCode` 가 클라이언트에 노출 가능**
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` — `failure()` 메서드 내 `outputDetails` 구성부
- 상세: `failure()` 는 `outputDetails: { legacyCode: errorCode }` 를 구성하고 이것이 `output.error.details.legacyCode` 로 노출된다. `legacyCode` 는 `'EXECUTION_TIMEOUT'`, `'EXECUTION_MEMORY_EXCEEDED'`, `'CODE_RUNTIME_ERROR'` 같은 내부 분류 문자열이다. 외부 공격자에게 직접적인 위협은 아니지만, 내부 실행 엔진 분류 체계가 클라이언트에 노출되면 구현 세부 정보 누수(OWASP A05)에 해당하며, 향후 더 민감한 내부 코드가 이 경로로 포함될 여지가 생긴다.
- 제안: `legacyCode` 를 `process.env.NODE_ENV !== 'production'` 조건으로 제한하거나, 프로덕션에서는 서버 로그에만 남기고 클라이언트 응답에서 제외한다.

### **[INFO] `extractStatusCode()` 에서 음수/0 정수 HTTP 상태 코드가 유효값으로 통과**
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — `extractStatusCode()` 함수 (변경 없는 기존 코드이나 새 테스트가 이 한계를 명시적으로 문서화함)
- 상세: `Number.isInteger(v)` 만 검사하므로 `statusCode: 0`, `statusCode: -200` 등 HTTP RFC 에서 유효하지 않은 값이 `placeholders.statusCode` 로 전달되어 i18n 템플릿에 렌더링될 수 있다. 사용자에게 "HTTP -200 오류" 같은 비정상 메시지가 표시될 수 있으며, 클라이언트 측 렌더링 로직이 음수를 예상하지 않아 UI 깨짐이 발생할 수 있다. 테스트 파일(`extractStatusCode boundary values` describe)에서 이를 "설계 의도로 문서화"했지만 실제 보안/UX 위험이 존재한다.
- 제안: `Number.isInteger(v) && v >= 100 && v <= 599` 범위 검사를 추가하거나, DTO 레이어(이벤트 수신 지점)에서 범위를 강제한다.

### **[INFO] `ALLOW_PRIVATE_HOST_TARGETS` env var 배포 문서화 부재 가능성**
- 위치: `codebase/backend/src/nodes/core/error-codes.ts` — `HTTP_BLOCKED` 주석 (신규 추가 라인)
- 상세: `ALLOW_PRIVATE_HOST_TARGETS=true` 로 SSRF 가드를 opt-out 할 수 있다는 정보가 코드 주석에만 존재하고, `.env.example` 이나 운영 가이드에 기재 여부가 불확실하다. 이 env var 는 SSRF 보호를 전면 해제하는 보안 임계 설정이므로, 운영자가 위험성을 인지하지 못한 채 설정할 경우 SSRF 취약점이 노출된다(OWASP A10 Server-Side Request Forgery).
- 제안: `.env.example` 에 `ALLOW_PRIVATE_HOST_TARGETS=false` 를 기본값으로 명시하고, 보안 위험 경고(SSRF 보호 해제)를 주석으로 포함시킨다. 운영 배포 가이드에도 동일 내용 추가 필요.

### **[INFO] redirect 재검증 루프가 `authentication === "integration"` 조건에만 활성화**
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — redirect while loop (이번 PR 이 직접 변경한 라인 근처의 기존 코드)
- 상세: SSRF 재검증이 `none`/`custom` 인증 모드에서 3xx 리다이렉트 후 재수행되지 않을 가능성이 있다. 공격자가 첫 요청에 허용된 URL 을 사용하고, 내부 IP 로 리다이렉트하는 서버를 제어한다면 `none`/`custom` 모드에서 SSRF 가드 우회가 가능할 수 있다. 단, 이미 SSRF 전 인증 공통 적용(refactor 04 C-3) 이 완료되어 있어 실제 가드 적용 범위 확인이 필요하다.
- 제안: 인증 방식과 무관하게 모든 3xx 리다이렉트 후에 SSRF 재검증을 수행하거나, `none`/`custom` 에서 3xx 를 따라가지 않는 동작을 코드 주석으로 명시한다.

---

## 요약

이번 PR 은 에러 코드 wiring 정리(classifier 등재, rename, 타입 안전성 강화)가 주 목적으로, 새로운 보안 취약점을 도입하지 않는다. 하드코딩된 시크릿, SQL/커맨드/경로 탐색 인젝션, 인증 우회, 안전하지 않은 암호화 알고리즘 등 주요 보안 문제는 발견되지 않는다. `ErrorCode.HTTP_BLOCKED` 상수 참조화는 오히려 오타로 인한 잘못된 코드 라우팅 위험을 줄이는 긍정적인 개선이다. `LEGACY_TO_NORMALIZED` 에 `Object.freeze` 와 `Readonly<Record<string, ErrorCodeValue>>` 타입 적용으로 미지의 내부 코드가 공개 API 로 노출되는 경로가 방어된 것도 보안 측면의 개선이다. 다만 기존 코드베이스에서 이어지는 INFO 수준 사항이 확인된다: SSRF 차단 메시지에 내부 호스트명/IP 노출 가능성(이미 follow-up 등재), 내부 legacyCode 클라이언트 포함, 음수/0 HTTP 상태 코드의 i18n 플레이스홀더 통과. 현재 머지를 차단할 Critical/Warning 수준의 보안 결함은 없다.

## 위험도

LOW
