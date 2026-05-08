## 발견사항

---

### [HIGH] Integration API Key (query 파라미터 방식) 가 에러 출력에 노출

**위치:** `http-request.handler.ts` — 비-2xx 분기 (~line 330) 및 transport 에러 분기 (~line 380)

**상세:**

`authentication=integration` + `api_key` + `location=query` 조합일 때, `credentials.queryParams` 가 URL에 append 된 이후의 완전한 URL이 `url` 변수에 저장된다. 이 변수는 에러 분기에서 그대로 `output.error.details.url` 에 노출된다.

```typescript
// credentials.queryParams 적용 후 url = "https://api.example.com/data?token=SECRET"
url = `${url}${separator}${params.toString()}`;

// 에러 분기에서:
details: { url: sanitizeUrlCredentials(url), method }
//                ^^^^ user:password@ 만 제거, ?token=SECRET 은 그대로
```

`sanitizeUrlCredentials` 는 `user:password@` 형식의 Basic Auth 자격증명만 제거하고, query string에 포함된 API 키는 건드리지 않는다. 결과적으로 HTTP 4xx/5xx 응답이나 transport 실패 시 integration에 저장된 API 키가 `NodeExecution` row, WebSocket 이벤트, expression auto-complete 데이터 등에 노출된다.

**제안:**
- `sanitizeUrlCredentials` 를 확장하여 query string 내 민감 파라미터 이름(`isSensitiveHeaderName` 에 준하는 패턴)의 값도 `[REDACTED]` 처리
- 또는 에러 details에 URL 전체 대신 origin+path 만 echo (`parsed.origin + parsed.pathname`)

---

### [WARNING] 평가된 request body가 NodeExecution 행에 비제한 저장

**위치:** `http-request.handler.ts` — `requestBodyOutput()` 함수

**상세:**

`output.requestBody` 에는 expression이 완전히 평가된(evaluated) 요청 본문이 저장된다. 256KB 크기 제한이 있지만, 비밀번호·토큰·PII 등 민감한 런타임 데이터가 그대로 포함될 수 있다. 이 값은 `NodeExecution.output` 컬럼, WebSocket 이벤트, 디버거 UI에 모두 노출된다. `sanitizeResponseHeaders` 에 해당하는 **request body sanitizer** 가 없다.

**제안:**
- 이 동작이 의도적이라면 spec에 "request body는 비밀번호 등 민감 데이터를 포함할 수 있으며 암호화되지 않은 채로 저장됨" 을 명시하고 UX 경고 제공
- 필드명 기반 heuristic sanitizer 추가 고려 (예: body 내 `password`, `secret`, `token` 키의 값 자동 redact)

---

### [WARNING] SSRF 보호가 integration 인증 전용으로 한정

**위치:** `http-request.handler.ts` — `assertSafeOutboundUrl` 호출 블록

**상세:**

```typescript
if (authentication === 'integration') {
  assertSafeOutboundUrl(url);
}
```

`authentication=none` 또는 `authentication=custom` 인 경우 SSRF 검사가 완전히 생략된다. 워크플로 작성 권한이 있는 사용자는 내부 메타데이터 서비스(예: `http://169.254.169.254/`, `http://10.0.0.x/`) 에 요청을 보낼 수 있다.

코드 주석에 "일부 배포 환경에서는 내부 서비스를 의도적으로 타겟할 수 있음"이라고 설명되어 있어 의도적 설계 결정임을 알 수 있으나, 멀티테넌트 환경에서는 위험하다.

**제안:**
- 배포 환경 변수(`ALLOW_INTERNAL_HTTP_REQUEST`)로 제어할 수 있는 optional SSRF guard 추가
- spec에 이 제한사항 명시, 운영 환경에서는 기본적으로 활성화 권장

---

### [WARNING] 리다이렉트 Location 헤더가 `responseHeaders` 에 노출될 수 있음

**위치:** `http-request.handler.ts` — `sanitizeResponseHeaders` 적용 지점

**상세:**

`fetchOptions.redirect = 'manual'` 설정 시 3xx 응답은 그대로 반환된다. `sanitizeResponseHeaders` 는 응답 헤더를 처리하지만, `location` 헤더는 blacklist에 포함되어 있지 않아 내부 redirect 대상 URL이 `output.responseHeaders.location` 에 노출될 수 있다. integration 인증 콜에서는 redirect가 SSRF 재검사와 함께 수동 처리되지만, 비인증 콜은 3xx 응답 자체가 error 포트로 라우팅되어 `responseHeaders` 에 Location이 포함된다.

**제안:** `EXACT_BLACKLIST` 또는 별도 조건에 `location` 헤더를 추가하거나, 3xx 응답 처리 시 Location을 sanitize

---

### [INFO] `Object.freeze` 가 shallow freeze임 (테스트 코드)

**위치:** `http-request.handler.spec.ts` — `makeContext` 함수

**상세:**

```typescript
rawConfig: Object.freeze({ ...rawConfig })
```

shallow freeze이므로 rawConfig 내 중첩 객체(예: `body: { user: '{{ $input.name }}' }`)는 변경 가능하다. 프로덕션 코드가 아닌 테스트 코드이므로 직접적 보안 위험은 없으나, 테스트의 불변성 보장 의도와 불일치한다.

**제안:** `structuredClone` 후 `Object.freeze` 적용, 또는 deep freeze 유틸 사용

---

### [INFO] `sanitizeResponseHeaders` 의 silent empty-object fallback

**위치:** `sanitize-response-headers.util.ts` — `iterateHeaders` 반환값이 `null` 인 경우

**상세:**

입력이 `null/undefined` 이거나 iterable/object 프로토콜이 없는 값이면 빈 객체를 반환한다. 핸들러가 실제 `Headers` 대신 부분 mock을 전달하는 경우 모든 응답 헤더가 조용히 누락된다. 보안 취약점은 아니지만, 헤더 누락이 감지되지 않을 수 있다.

---

## 요약

전반적으로 코드는 응답 헤더의 자격증명 redaction, request body 크기 제한, URL 자격증명 sanitization 등 보안을 의식한 설계를 보인다. 그러나 **Integration API Key의 query 파라미터 방식 누출**이 가장 중요한 취약점이다: `sanitizeUrlCredentials` 가 `user:password@` 형식만 처리하여 `?api_key=SECRET` 형태의 query string 자격증명이 에러 포트의 `output.error.details.url` 을 통해 NodeExecution DB 행 및 WebSocket 이벤트에 노출된다. 추가로 평가된 request body가 민감 데이터 필터링 없이 저장되는 점과 비인증 HTTP 호출에 SSRF 보호가 적용되지 않는 점은 배포 컨텍스트에 따라 위험 수준이 달라지므로 운영 정책 검토가 필요하다.

## 위험도

**HIGH** (API key query parameter 누출 항목 기준)