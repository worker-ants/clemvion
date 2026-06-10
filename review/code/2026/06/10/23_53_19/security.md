# Security Review

## 발견사항

### [INFO] 테스트 픽스처에 평문 자격증명 형태의 더미 데이터 사용
- 위치: `integration-expiry-scanner.service.spec.ts` — 테스트 픽스처 credentials 객체
- 상세: 테스트 픽스처에 `access_token: 'a'`, `refresh_token: 'r-valid'`, `refresh_token: 'mk-refresh'` 등 평문 형태의 더미 값이 사용된다. 이는 실제 시크릿이 아닌 명백한 테스트 더미이고 spec 파일도 아닌 `.spec.ts` 파일이므로 하드코딩된 시크릿에 해당하지 않는다. 그러나 향후 실수로 실제 토큰이 픽스처에 혼입될 가능성의 패턴 레퍼런스가 될 수 있다는 점에서 정보성으로 기록한다.
- 제안: 현 상태 유지(테스트 더미로 충분). CI secret scanning 룰셋이 실제 토큰 패턴(예: `Bearer eyJ...`, `sk-...`)을 커버하는지 별도 점검.

### [INFO] `isRefreshCapable` 에서 `credentials` 를 `as` 캐스트 후 런타임 필드 접근
- 위치: `integration-expiry-scanner.service.ts` — `isRefreshCapable` 함수, 라인 1549~1554
- 상세: `integration.credentials as Record<string, unknown> | null | undefined` 로 타입 단언 후 `creds?.refresh_token` 을 추출하는 패턴이다. 이 패턴 자체는 안전하지만, DB 에서 읽어온 credentials JSON 컬럼이 암호화되어 있지 않다면 refresh_token 을 포함한 OAuth 자격증명 전체가 평문으로 읽혀 메모리에 상주한다. 스캐너 잡이 `credentials.refresh_token` 의 존재 여부만 확인하고 값을 로그에 출력하거나 큐 payload 에 포함하지 않는 점은 긍정적이다. `cafe24-token-refresh` 큐 enqueue 시 payload 는 `{ integrationId, source: 'background' }` 만 포함하며 credentials 를 직접 전달하지 않는다 — 올바른 패턴.
- 제안: credentials 컬럼이 DB 레벨 또는 애플리케이션 레벨에서 암호화되어 있는지 별도 확인 권장 (이번 diff 범위 밖).

### [INFO] 에러 메시지에 `integration.id` 노출
- 위치: `integration-expiry-scanner.service.ts` — `logger.warn(...)` 라인
- 상세: `connected-expiry 0d cafe24 refresh enqueue failed for ${integration.id}` 형태로 integration 내부 ID 가 로그에 노출된다. 이는 내부 운영 로그(서버 사이드)이며 사용자에게 직접 전달되지 않는다. 또한 err.message 를 그대로 출력하나, `err instanceof Error ? err.message : String(err)` 패턴으로 Error 가 아닌 경우에도 String() 으로 안전하게 처리한다. 민감 정보(credentials, token 값)는 로그에 포함되지 않는다.
- 제안: 현 상태 적절. 운영 로그 접근 권한 관리가 별도로 되어 있는지 확인 권장.

### [INFO] BullMQ jobId dedup 에 `integration.id` 사용
- 위치: `integration-expiry-scanner.service.ts` — cafe24RefreshQueue.add 옵션 `jobId: integration.id`
- 상세: Redis BullMQ 큐에 jobId 로 integration UUID 를 그대로 사용한다. BullMQ Redis key 가 외부에 노출될 경우 통합 ID 가 유추 가능하다. 그러나 Redis 는 내부 인프라이며 외부 API 응답에는 노출되지 않으므로 실질적 위험은 낮다. 의도적 dedup 설계이고 UUID 자체는 민감 데이터가 아니다.
- 제안: 현 상태 적절.

## 요약

이번 변경은 `integration-expiry-scanner.service.ts` 의 `isCafe24RefreshCapable` → `isRefreshCapable` 일반화, `statusReason = 'token_expired'` 추가, makeshop 포함 refresh-capable provider 격하·passive 알림 제외 로직, 그리고 `MONITORED_QUEUES` 에 makeshop 큐 추가가 주 내용이다. 보안 관점에서 SQL 인젝션·XSS·커맨드 인젝션 가능성은 없고, 하드코딩된 실제 시크릿도 발견되지 않는다. credentials 필드에서 `refresh_token` 존재 여부만 확인하고 토큰 값을 큐 payload 나 외부 응답에 전달하지 않는 설계는 올바르다. 에러 핸들링도 Error vs non-Error 분기를 일관되게 처리하며 민감 정보 노출이 없다. 인증/인가 로직은 이번 diff 범위에서 변경되지 않았으며, 시스템 상태 API e2e 테스트에서 미인증 401 검증이 유지된다. 전반적으로 보안상 문제가 없는 변경이다.

## 위험도

NONE
