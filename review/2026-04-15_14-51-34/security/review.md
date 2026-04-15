## 보안 코드 리뷰 결과

---

### 발견사항

---

**[WARNING] 헤더 키 정규화 없음 — HTTP 헤더 인젝션 위험**
- 위치: `http-request.handler.ts` — `toKeyValueEntries()` 함수, `toKeyValueRecord()`
- 상세: `key` 값에 대해 `trim()` 처리는 하지만 개행 문자(`\r`, `\n`) 포함 여부를 검증하지 않습니다. HTTP 헤더 이름이나 값에 CRLF 문자가 포함되면 헤더 인젝션 공격이 가능합니다. 예: `key: "X-Foo\r\nX-Injected"`, `value: "bar\r\nX-Evil: hacked"`.
- 제안:
  ```ts
  const key = stringifyScalar(rec.key).trim().replace(/[\r\n]/g, '');
  const val = stringifyScalar(rec.value).replace(/[\r\n]/g, '');
  ```

---

**[WARNING] 사용자 헤더가 인증 자격증명 헤더를 덮어쓸 수 있음**
- 위치: `http-request.handler.ts` — `mergedHeaders` 병합 순서 (L~130)
  ```ts
  const mergedHeaders = {
    ...(credentials.defaultHeaders ?? {}),
    ...(credentials.headers ?? {}),
    ...userHeaders,   // ← 사용자 입력이 마지막
  };
  ```
- 상세: 사용자가 `{ key: "Authorization", value: "Bearer attacker-token" }` 헤더를 제공하면 integration 자격증명의 `Authorization` 헤더를 덮어씁니다. integration 인증 모드에서 자격증명 헤더는 보호되어야 합니다.
- 제안: `authentication === 'integration'` 일 때는 credential 헤더를 사용자 헤더보다 나중에 적용하거나, credential 키와 중복되는 사용자 헤더를 거부:
  ```ts
  const mergedHeaders = {
    ...(credentials.defaultHeaders ?? {}),
    ...userHeaders,
    ...(credentials.headers ?? {}),  // credential 헤더가 항상 우선
  };
  ```

---

**[WARNING] SSRF 방어가 `authentication=none` 케이스에는 미적용**
- 위치: `http-request.handler.ts` — SSRF guard 블록
  ```ts
  if (authentication === 'integration') {
    assertSafeOutboundUrl(url);
  }
  ```
- 상세: 코드 주석에 "Un-authenticated HTTP requests may legitimately target internal services"라고 기술되어 있으나, 워크플로우 노드에서 사용자가 `authentication=none`으로 `http://169.254.169.254/` 등 내부 메타데이터 서버에 요청을 보낼 수 있습니다. 공격자가 워크플로우를 편집할 수 있는 권한을 가진 경우 SSRF로 내부 인프라를 탐색할 수 있습니다.
- 제안: `authentication=none` 케이스에도 SSRF 방어를 적용하거나, 이를 허용하는 경우 운영 환경 정책 문서화 및 별도의 rate limiting/audit log를 적용하세요.

---

**[WARNING] `stringifyScalar`에서 복잡한 객체를 JSON 직렬화하여 헤더/파라미터 값으로 사용**
- 위치: `http-request.handler.ts` — `stringifyScalar()` 함수
- 상세: 배열이나 중첩 객체가 입력되면 `JSON.stringify()` 결과(`[object]`, `{"a":1}`)가 헤더 값이나 쿼리 파라미터로 그대로 전송됩니다. 의도치 않은 정보 노출이나 예상 밖의 서버 동작을 유발할 수 있습니다.
- 제안: 스칼라가 아닌 타입은 빈 문자열로 처리하거나, 명시적으로 오류를 발생시키는 것이 더 안전합니다.

---

**[INFO] 리다이렉트 체인에서 `fetchOptions` 재사용 — Authorization 헤더 누출 가능**
- 위치: `http-request.handler.ts` — 리다이렉트 처리 while loop
  ```ts
  res = await fetch(url, fetchOptions);  // 동일한 fetchOptions (헤더 포함) 재사용
  ```
- 상세: `assertSafeOutboundUrl`로 내부 IP는 차단되지만, 외부 도메인으로의 리다이렉트 시에도 `Authorization` 헤더가 포함된 동일한 `fetchOptions`로 요청됩니다. `https://api.example.com` → `https://attacker.com`으로 리다이렉트될 경우 자격증명이 제3자에게 전송됩니다.
- 제안: 리다이렉트 도메인이 원본과 다른 경우 `Authorization` 등 민감 헤더를 제거하거나, 동일 origin 리다이렉트만 허용하세요.

---

**[INFO] `integrationId`가 에러 로그에 기록됨**
- 위치: `http-request.handler.ts` — `logUsage` 호출들
- 상세: `integrationId`는 내부 식별자로 에러 로그에 포함되는 것은 일반적으로 허용 범위이나, 로그가 외부에 노출되는 경우 공격자가 integration ID를 열거하는 데 활용될 수 있습니다.
- 제안: 로그 접근 권한이 충분히 제한되어 있는지 확인하세요.

---

**[INFO] `timeout` 검증 — 최대값 상한 없음 (백엔드)**
- 위치: `http-request.handler.ts` — `validate()`, L47~50
- 상세: 프론트엔드에서는 `max={300000}`을 강제하지만 백엔드 `validate()`는 양수(> 0)만 검증합니다. API를 직접 호출하면 수 시간짜리 타임아웃을 설정하여 연결 고갈 공격이 가능합니다.
- 제안:
  ```ts
  if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0 || config.timeout > 300000)) {
    errors.push('timeout must be between 1 and 300000');
  }
  ```

---

### 요약

이번 변경은 헤더/쿼리파라미터를 `Record<string, string>`에서 `Array<{key, value}>` 형식으로 전환하는 리팩터링으로, 전반적인 코드 구조는 양호합니다. SSRF 방어(assertSafeOutboundUrl, 리다이렉트 재검증)와 빈 키 필터링 등 보안적으로 긍정적인 개선이 포함되어 있습니다. 그러나 **헤더 인젝션 방어를 위한 CRLF 문자 검증 누락**(WARNING), **사용자 헤더가 integration 자격증명 헤더를 덮어쓸 수 있는 병합 순서**(WARNING), **`authentication=none` 시 SSRF 무방비 상태**(WARNING), **리다이렉트 체인에서 Authorization 헤더 유출 가능성**(INFO) 등의 이슈가 존재합니다. CRLF 인젝션과 자격증명 헤더 덮어쓰기 문제는 비교적 실제 악용 가능성이 있으므로 우선적으로 수정이 권장됩니다.

---

### 위험도

**MEDIUM**