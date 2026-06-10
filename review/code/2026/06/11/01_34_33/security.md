# Security Review

## 발견사항

### [INFO] credentials 필드를 `as Record<string, unknown>` 타입 캐스팅으로 접근
- 위치: `integration-expiry-scanner.service.ts` — `isRefreshCapable` 함수 (diff 기준 라인 475–478)
- 상세: `integration.credentials as Record<string, unknown> | null` 캐스팅 후 `refresh_token` 유무를 판별한다. 이 패턴은 기존 코드에서도 동일하게 사용되어 있으며, 런타임에 credentials 객체가 null 이거나 예상치 못한 형태일 때 방어 분기가 있는지 확인이 필요하다. 그러나 실제 코드는 `&& typeof creds.refresh_token === 'string'` 등의 타입 가드를 포함하고 있을 가능성이 높으며, 이 diff만으로는 전체 함수 바디가 보이지 않는다.
- 제안: `isRefreshCapable` 함수 바디에서 `creds` null-check와 `refresh_token` 존재·타입 검사를 명시적으로 수행하고 있음을 코드 리뷰 시 확인할 것. 기존 `isCafe24RefreshCapable` 패턴을 그대로 계승하는 것이면 추가 위험 없음.

### [INFO] 테스트 픽스처에 하드코딩된 크레덴셜 유사 문자열
- 위치: `integration-expiry-scanner.service.spec.ts` — 테스트 픽스처 `credentials: { access_token: 'a', refresh_token: 'mk-refresh', mall_id: 'myshop' }` 등
- 상세: 단위 테스트 픽스처에 `access_token: 'a'`, `refresh_token: 'mk-refresh'` 등의 짧은 플레이스홀더 문자열이 사용된다. 실제 API 키·토큰이 아닌 명백한 테스트 더미 값이므로 시크릿 노출로 간주할 수 없다. 다만 실수로 실 토큰이 혼입될 경우 탐지가 어려울 수 있으므로 관행적으로 `fake-token`, `test-only-*` 등의 명시적 프리픽스를 사용하면 더 안전하다.
- 제안: 현재 값은 충분히 명백한 더미이므로 즉각적인 위험 없음. 향후 픽스처 작성 시 `test-access-token`, `test-refresh-token` 형식으로 명칭을 표준화하는 것을 권장.

### [INFO] `statusReason = 'token_expired'` — 네임스페이스 충돌 위험 문서화 확인
- 위치: `integration-status-reason.ts` — 신규 추가 `'token_expired'` 슬러그; `spec/1-data-model.md` diff
- 상세: `token_expired` 슬러그가 JWT REST 에러 코드 `TOKEN_EXPIRED` 및 WebSocket 이벤트 `auth.token_expired` 와 표기가 유사하지만 별개 네임스페이스임을 코드 주석과 spec 양쪽에서 명시하고 있다. 이는 보안 관점에서 클라이언트가 이 값을 JWT 인증 오류로 오해하여 로그아웃 처리 등 불필요한 동작을 트리거할 가능성을 낮추기 위한 중요한 구분이다. 현재 주석은 충분하나, API 응답에서 이 값이 노출될 때 클라이언트 파싱 로직이 `TOKEN_EXPIRED`(대문자)와 `token_expired`(소문자)를 정확히 구분하는지 별도로 확인이 필요하다.
- 제안: API 응답 DTO 또는 클라이언트 타입 정의에서 `statusReason` 값의 케이스 처리가 명확히 구분됨을 확인할 것. `normalizeStatusReason` 헬퍼가 union 밖 값을 `unknown_error`로 fallback하는 메커니즘이 이미 존재하므로 방어 수준은 적절하다.

### [INFO] 에러 로그에 `integration.id` 노출
- 위치: `integration-expiry-scanner.service.ts` diff — `this.logger.warn(\`connected-expiry 0d cafe24 refresh enqueue failed for ${integration.id}: ...\`)`
- 상세: 서버 측 로그에 `integration.id`(UUID)와 에러 메시지가 기록된다. 이는 내부 운영 로그이며 외부 API 응답에 노출되지 않는다. 에러 메시지 자체도 `err instanceof Error ? err.message : String(err)` 패턴으로 안전하게 처리된다.
- 제안: 현재 패턴은 운영 가시성과 보안 균형이 적절하다. 로그 집계 시스템에서 integration ID가 PII와 결합되지 않도록 로그 접근 권한을 제한할 것.

### [INFO] e2e 테스트에서 `accessToken`을 Authorization 헤더로 전달
- 위치: `system-status.e2e-spec.ts` — `.set('Authorization', \`Bearer ${owner.accessToken}\`)`
- 상세: e2e 테스트가 실제 JWT 토큰을 생성하여 API를 호출하는 표준 패턴이다. `registerAndLogin` 헬퍼를 통해 테스트 전용 계정을 생성하고, `afterAll`에서 DB 연결을 닫는다. 테스트 토큰이 실제 환경에서 유효하지 않도록 격리된 e2e 환경을 사용한다.
- 제안: e2e 환경이 프로덕션 DB/Redis와 완전히 격리되어 있음을 인프라 수준에서 보장할 것. 현재 코드에서는 문제 없음.

## 요약

이번 변경은 integration 만료 스캐너의 refresh-capable provider 판별 로직을 cafe24 전용에서 makeshop까지 일반화하고(`isCafe24RefreshCapable` → `isRefreshCapable`), `statusReason` 값으로 새로운 `token_expired` 슬러그를 도입하며, 모니터링 대상 큐 레지스트리에 `makeshop-token-refresh` 큐를 추가하는 내용이다. 보안 관점에서 심각한 취약점은 발견되지 않았다. 하드코딩된 시크릿이 없고, 인증/인가 로직의 변경이 없으며, 사용자 입력을 직접 처리하는 코드가 포함되지 않는다. `credentials` 필드 접근은 기존 패턴을 유지하며, 에러 처리는 민감 정보를 외부로 노출하지 않는다. `token_expired` 슬러그가 JWT 에러 코드와 유사한 네임스페이스에 있다는 점은 클라이언트 파싱 로직에서 혼동을 방지하기 위해 주석 및 spec에 명시되어 있어 적절히 문서화되었다. 전반적으로 보안 관점에서 양호한 변경이다.

## 위험도

NONE
