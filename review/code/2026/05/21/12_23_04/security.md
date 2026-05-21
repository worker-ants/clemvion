# 보안(Security) 코드 리뷰

> 검토 대상: External Interaction API — SDK 패키지 + 프론트엔드 i18n + 일관성 검토 산출물  
> 파일 수: 15개 (codebase/packages/sdk/src/client.ts, signature.ts, index.ts, client.spec.ts, signature.spec.ts, package.json, tsconfig.json, README.md, frontend/triggers.ts(i18n), plan/complete/external-interaction-api.md, review/consistency/* 5개)

---

## 발견사항

### [INFO] SSE 토큰을 URL query string 에 노출
- 위치: `codebase/packages/sdk/src/client.ts` — `subscribeToExecution()` 메서드, query string 구성 부분
- 상세: SSE 연결 시 인증 토큰을 `?token=<value>` 형태로 URL query parameter 에 포함하여 전송한다. 이로 인해 해당 토큰이 서버 access log, 브라우저 히스토리, 리퍼러 헤더, CDN/프록시 로그 등에 평문으로 기록될 수 있다. SSE 의 특성상 EventSource 브라우저 API는 커스텀 헤더 설정이 불가능해 fetch 기반 구현에서도 관례적으로 query string 방식을 택하는 경우가 많으나, 보안 관점에서는 단기 토큰(1시간) 의 노출 위험이 존재한다.
- 제안: 현실적인 대안이 제한적이므로 허용 가능한 수준이나, 서버측에서 해당 query param 을 로그에서 필터링(redact)하고, 단기 토큰 수명(1h)과 blacklist 정책이 올바르게 구현되었는지 backend 리뷰 시 확인 필요. SSE 연결 전 별도 short-lived ticket 을 발급해 교환하는 방식도 장기 개선 옵션으로 고려할 수 있다.

---

### [INFO] 에러 응답 body 전체를 ClemvionApiError 에 포함
- 위치: `codebase/packages/sdk/src/client.ts` — `ClemvionApiError` 생성자 및 `safeText()` 호출부
- 상세: API 오류 시 서버 응답 body 전체를 `this.body: string` 필드에 저장하고 Error 객체로 전파한다. 만약 서버가 에러 응답에 민감 정보(스택 트레이스, 내부 쿼리, 개인정보 등)를 포함할 경우 호출 측 로그에 해당 내용이 그대로 노출될 수 있다. SDK 사용자가 `err.body` 를 무심코 로깅하는 상황이 발생할 수 있다.
- 제안: 서버측 에러 응답이 spec 의 정형화된 `{ error: { code, message } }` 형식만 반환하도록 강제되고, 스택 트레이스 등 민감 정보가 포함되지 않음이 backend 에서 보장된다면 현재 수준으로 허용 가능하다. SDK 문서에 `err.body` 를 외부로 노출하지 않도록 주의 문구를 추가하는 것을 권장한다.

---

### [INFO] `computeNotificationSignature` 공개 export — 비밀 정보 오용 가능성
- 위치: `codebase/packages/sdk/src/index.ts` 및 `codebase/packages/sdk/src/signature.ts`
- 상세: `computeNotificationSignature` 함수가 public API 로 export 된다. 이 함수는 secret 과 raw body, timestamp 를 받아 HMAC 서명을 계산한다. 목적은 테스트/목업용이라고 주석에 명시되어 있으나, 외부 개발자가 서버측 secret 을 클라이언트 코드에 하드코딩하거나 노출하는 계기가 될 수 있다.
- 제안: 주석과 README 에 "서버측 secret 을 클라이언트/브라우저 환경에 절대 포함하지 말 것" 경고를 추가한다. `verifyNotificationSignature` 만으로 webhook 수신 측 검증이 가능하며, `computeNotificationSignature` 는 테스트 전용임을 명확히 문서화한다.

---

### [WARNING] HMAC 서명 검증: 길이 불일치 candidate 를 조용히 skip
- 위치: `codebase/packages/sdk/src/signature.ts` — `verifyNotificationSignature()` 내부 for 루프
- 상세: `candidate.length === 0 || candidate.length !== expectedBuf.length` 조건을 만족하는 hexe 값은 `continue` 로 건너뛰어 mismatch 가 아닌 것처럼 처리된다. 서명 rotation 시나리오에서 여러 `v1=` 값 중 하나라도 길이가 다르면 조용히 무시하고 다음을 검사하는데, 이는 의도된 설계이지만 hex 디코딩 오류(예: non-hex 문자, 홀수 문자열)도 길이 0 버퍼로 처리되어 무시될 수 있다. 공격자가 유효한 hex 처럼 보이나 decode 시 길이가 다른 값을 삽입하면 검증을 우회하지는 않지만(expected 와 길이가 달라 `continue` 후 최종 `mismatch` 반환), 이 흐름이 명확히 문서화되지 않으면 혼란을 줄 수 있다.
- 제안: 현재 구현은 timing-safe 비교를 적용하고 길이 불일치 시 `timingSafeEqual` 을 호출하지 않으므로 timing attack 방어는 정상이다. 다만 비 hex 문자 입력에 대해 `Buffer.from(hex, 'hex')` 가 부분 디코딩(malformed bytes 를 0 으로 대체) 하는 Node.js 동작에 의존하는 것보다, hex 문자열 유효성을 명시적으로 검증(`/^[0-9a-f]+$/i.test(hex)`)하는 코드를 추가하면 더 방어적이다.

---

### [WARNING] `baseUrl` 검증 없음 — SSRF 가능성 (SDK 클라이언트 측)
- 위치: `codebase/packages/sdk/src/client.ts` — `ClemvionClient` 생성자
- 상세: `baseUrl` 은 생성자에서 trailing slash 제거만 할 뿐 URL 유효성이나 scheme 검증이 없다. 특히 Node.js 서버 환경에서 SDK 를 사용할 때 외부에서 주입된 `baseUrl` 값이 `http://169.254.169.254/` 같은 메타데이터 서버나 내부 IP 를 가리킬 경우 서버가 내부망에 요청을 전달하는 SSRF 가 발생할 수 있다. 브라우저 환경에서는 same-origin policy 로 어느 정도 방어되지만 Node.js 환경은 그렇지 않다.
- 제안: SDK 클라이언트 측이 직접 SSRF 방어를 구현하는 것은 책임 범위를 초과할 수 있으나, `baseUrl` 이 `https://` 스킴으로 시작하는지 최소한 검증하는 옵션을 추가하거나 문서에 "서버 환경에서 사용 시 `baseUrl` 을 신뢰할 수 없는 입력에서 구성하지 말 것"을 명시한다. 서버측 backend 에서 notification URL SSRF 차단을 구현하는 것(plan P1 SSRF validator)이 주된 방어선임을 확인한다.

---

### [WARNING] `endpointPath` / `executionId` 를 `encodeURIComponent` 로 인코딩하나 서버측 검증 의존
- 위치: `codebase/packages/sdk/src/client.ts` — `triggerWebhook`, `interact`, `cancel`, `refreshToken`, `getStatus`, `subscribeToExecution`
- 상세: URL 경로 파라미터에 `encodeURIComponent()` 를 적용하는 것은 올바른 처리이며 경로 탐색(path traversal) 공격을 클라이언트 측에서 방어한다. 그러나 SDK 는 클라이언트 라이브러리이므로 서버가 이 값들을 추가로 검증(형식 검사, 길이 제한)해야 한다. 현재 SDK 코드 자체에는 `executionId` 나 `endpointPath` 의 형식 제약이 없어, 공격적인 값이 인코딩된 채로 전달되더라도 SDK 수준에서 인지하지 못한다.
- 제안: SDK 자체에서 `executionId` 가 UUID 형식인지 간단히 검증하는 옵션을 추가하면 클라이언트 측 오용을 조기에 감지할 수 있다. 서버 측 backend route validation 이 1차 방어선이다.

---

### [INFO] 하드코딩된 시크릿 없음 (테스트 파일 포함)
- 위치: `codebase/packages/sdk/src/signature.spec.ts`
- 상세: 테스트 파일에서 `const SECRET = 'wsk_test'` 와 같이 명백히 테스트용임을 알 수 있는 값만 사용되며, 실제 운영 시크릿이 코드에 포함되어 있지 않다. `TS = 1_700_000_000` 은 고정 타임스탬프로 테스트 재현성을 위한 것이며 보안 위험 없다.
- 제안: 없음. 양호한 상태.

---

### [INFO] 의존성 보안 — production dependencies 없음
- 위치: `codebase/packages/sdk/package.json`
- 상세: `dependencies` 가 빈 객체(`{}`)이므로 production 의존성이 없다. Node.js 내장 `crypto` 모듈만 사용하며 알려진 취약점이 있는 외부 라이브러리를 사용하지 않는다. `devDependencies` 의 `jest@^30.0.0`, `typescript@^5.7.3` 은 빌드/테스트 전용이며 배포 번들에 포함되지 않는다.
- 제안: 없음. 외부 의존성 최소화는 보안 모범 사례를 따르고 있다.

---

### [INFO] SSE 스트림 버퍼 크기 제한 없음
- 위치: `codebase/packages/sdk/src/client.ts` — `subscribeToExecution()` 내부 SSE 파싱 루프
- 상세: `buf` 문자열에 수신된 SSE 데이터를 누적하는데, `\n\n` 구분자가 없는 대용량 청크가 계속 수신되면 메모리가 무제한으로 증가할 수 있다. 악의적인 서버나 중간자가 `\n\n` 없이 대용량 데이터를 지속 전송하면 Node.js 프로세스의 메모리를 고갈시킬 수 있다.
- 제안: `buf.length` 가 일정 크기(예: 1MB)를 초과하면 오류로 처리하고 연결을 종료하는 guard 를 추가한다. 또는 서버측에서 heartbeat 주기(15초)와 frame 크기를 제한하여 사전 방어한다.

---

### [INFO] `timingSafeEqual` 올바르게 적용됨
- 위치: `codebase/packages/sdk/src/signature.ts`
- 상세: Node.js `crypto.timingSafeEqual` 을 사용하여 HMAC 서명 비교를 수행하며, 비교 전 길이 검증을 통해 `timingSafeEqual` 에 길이가 다른 Buffer 가 전달되어 예외가 발생하는 상황을 방지한다. HMAC-SHA256 과 HMAC-SHA512 를 지원하며 알고리즘 테이블은 화이트리스트 방식으로 관리된다. ±5분 timestamp window 도 replay attack 방어로 적절하다.
- 제안: 없음. 암호화 구현이 보안 모범 사례를 따르고 있다.

---

### [INFO] CORS 미설정은 SDK 코드 외부에서 처리
- 위치: `codebase/packages/sdk/src/client.ts` 전반
- 상세: SDK 는 클라이언트 라이브러리이며 CORS 정책 설정은 서버(backend) 책임이다. plan §2.7 에 CORS 설정이 명시되어 있고(`interactionAllowedOrigins` 기반, 미설정 시 차단), SDK 코드에서 별도 처리가 필요하지 않다.
- 제안: 없음.

---

## 요약

이번 변경은 External Interaction API 클라이언트 SDK (`@workflow/sdk`) 신규 추가와 프론트엔드 i18n 문자열 확장이 주요 내용이다. 보안 측면에서 가장 주목할 사항은 두 가지다: 첫째, SSE 연결 시 인증 토큰이 URL query string 에 포함되는 구조적 한계는 EventSource API 제약으로 불가피하나 서버측 로그 redaction 과 단기 토큰 수명 정책으로 위험을 관리해야 한다. 둘째, HMAC 서명 검증(`signature.ts`)은 `timingSafeEqual` 을 올바르게 사용하고, timestamp window 와 secret rotation 을 지원하며 양호하다. 하드코딩된 시크릿이 없고, production 외부 의존성이 전혀 없으며, URL 파라미터에 `encodeURIComponent` 가 적용되어 있다. 중간 수준의 위험(WARNING)으로는 hex 입력 유효성 검증 미흡, `baseUrl` SSRF 가능성, SSE 버퍼 크기 무제한이 있으나 모두 서버측 방어나 간단한 코드 보강으로 해소 가능하다. 전체적으로 이 변경에서 즉각적인 CRITICAL 보안 취약점은 발견되지 않았다.

---

## 위험도

LOW

STATUS=success
