# Security Review

## 발견사항

### **[INFO]** `isRefreshCapable` 의 `credentials` 필드 캐스트 — 타입 안전성 확인
- 위치: `integration-expiry-scanner.service.ts` — `isRefreshCapable` 함수 내 `credentials` 캐스트
- 상세: `integration.credentials as Record<string, unknown> | null` 로 캐스팅 후 `typeof creds['refresh_token'] === 'string'` 으로 검사한다. 이 패턴은 DB에서 이미 JSON 파싱된 JSONB 값이므로 런타임 인젝션 위험은 없다. TypeORM 이 DB에서 읽은 값이므로 사용자 입력 경로가 아니다.
- 제안: 현재 패턴으로 충분. 필요 시 `zod` 스키마 파싱으로 강화 가능하나 현재 코드에선 보안 위험 없음.

### **[INFO]** BullMQ jobId 에 통합 UUID 직접 사용 — 열거(enumeration) 리스크
- 위치: `integration-expiry-scanner.service.ts` `run()` 및 `enqueueCafe24BackgroundRefresh()` — `jobId: integration.id`
- 상세: `jobId = integrationId` (UUID) 를 사용한 dedup. BullMQ 큐에 직접 접근할 수 있는 내부 운영자가 jobId 로부터 통합 UUID 를 유추할 수 있다. 그러나 BullMQ 큐는 Redis 내부에 있고, 외부 사용자에게 노출되지 않는 백엔드 내부 경로다. 따라서 실질적 인젝션·열거 위험은 없다.
- 제안: 현 구조로 충분. 외부 API 에서 jobId 를 노출하지 않는 설계를 유지할 것.

### **[INFO]** 에러 메시지에 `integration.id` (UUID) 포함
- 위치: `integration-expiry-scanner.service.ts` 라인 약 412: `connected-expiry 0d cafe24 refresh enqueue failed for ${integration.id}: ${err.message}`
- 상세: `this.logger.warn(...)` 으로 내부 UUID 와 error message 를 로그에 기록한다. 로그는 운영자 전용 내부 시스템이므로 외부 노출 위험은 없다. `err.message` 가 Redis 연결 정보를 포함할 수 있으나, 이 역시 내부 로그이므로 허용 범위.
- 제안: 만약 로그가 외부 모니터링 서비스(예: 외부 로그 집계)로 전송된다면 `integration.id` 를 해시하거나 마스킹하는 추가 정책 검토 권장. 현재 구조에선 INFO 수준.

### **[INFO]** `expirePendingInstalls` — `createQueryBuilder` 직접 UPDATE
- 위치: `integration-expiry-scanner.service.ts` `expirePendingInstalls()` — `.where('status = :status', { status: 'pending_install' })` 및 `.andWhere('COALESCE(install_token_issued_at, created_at) < :cutoff', { cutoff })`
- 상세: TypeORM parameterized query 를 올바르게 사용하고 있다. `:status` 와 `:cutoff` 는 파라미터 바인딩이므로 SQL 인젝션 위험 없음.
- 제안: 이상 없음.

### **[INFO]** `normalizeStatusReason` — fallback 보장
- 위치: `integration-status-reason.ts` `normalizeStatusReason()`
- 상세: `STATUS_REASON_SET` 에 없는 임의 문자열은 `unknown_error` 로 정규화하여 API/UI 에 예상치 못한 값이 노출되지 않도록 설계됨. 이는 보안 관점에서 올바른 방어적 설계.
- 제안: 이상 없음. 향후 `status_reason` 이 외부 에러코드로부터 유래할 경우에도 본 normalize 가 첫 방어선으로 작동함을 유지할 것.

### **[INFO]** 테스트 픽스처에 mock 자격증명 사용
- 위치: `integration-expiry-scanner.service.spec.ts` 신규 테스트 픽스처 — `access_token: 'a'`, `refresh_token: 'mk-refresh'`, `refresh_token: 'r-valid'`
- 상세: 테스트 픽스처의 자격증명은 단일 문자열(`'a'`, `'mk-refresh'`) 로 명백한 dummy 값이다. 실제 API 키나 비밀 토큰이 하드코딩된 것이 아니다.
- 제안: 이상 없음.

### **[INFO]** e2e 테스트 — `owner.accessToken` Bearer 사용 패턴
- 위치: `test/system-status.e2e-spec.ts` — `registerAndLogin` 에서 취득한 `owner.accessToken` 을 Authorization 헤더에 사용
- 상세: e2e 테스트에서 동적으로 생성된 테스트 계정의 JWT 를 사용하므로, 하드코딩된 토큰 없음. 보안 이슈 없음.
- 제안: 이상 없음.

---

## 요약

이번 변경은 주로 통합 만료 스캐너의 refresh-capable provider 로직 일반화(cafe24 → cafe24·makeshop), `statusReason='token_expired'` 추가, 큐 레지스트리 동기, 그리고 관련 스펙 갱신으로 구성된다. 보안 관점에서 모든 DB 쿼리는 TypeORM parameterized binding 을 올바르게 사용하고 있고, SQL 인젝션·커맨드 인젝션·XSS 취약점은 발견되지 않는다. 하드코딩된 시크릿은 없으며, 테스트 픽스처의 자격증명은 명백한 dummy 값이다. `normalizeStatusReason` 의 whitelist 기반 정규화는 올바른 방어적 설계이고, `isRefreshCapable` 의 credentials 접근은 내부 JSONB 값을 안전하게 캐스팅한다. 에러 메시지의 내부 UUID 로깅은 내부 운영자 전용 경로이므로 현재 아키텍처에서는 위험하지 않다. 전체적으로 보안 관점에서 중대한 취약점이 없는 안전한 변경이다.

## 위험도

NONE
