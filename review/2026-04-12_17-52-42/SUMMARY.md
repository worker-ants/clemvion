파일 쓰기 권한이 필요합니다. 승인해 주시면 SUMMARY.md를 저장하겠습니다.

그 전에 통합 보고서 내용을 직접 출력하겠습니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — OAuth 토큰 교환 미구현(stub), credentials 평문 저장, N+1 알림 쓰기, 다수의 보안·요구사항 누락이 복합적으로 존재. 프로덕션 배포 전 Critical·Warning 항목 해소 필수.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항·보안 | **OAuth 토큰 교환 미구현(stub)** — `stub-{hex}` 가짜 토큰이 DB에 저장되어 실제 Slack/Google/GitHub 연동 불가. 프로덕션 배포 시 연결된 것처럼 보이나 모든 API 호출 401 실패 | `integration-oauth.service.ts` `handleCallback()` | 각 provider 토큰 엔드포인트 실제 HTTP 교환 구현. 미구현이라면 프로덕션 빌드 가드 추가 |
| 2 | 요구사항·보안 | **credentials 평문 저장** — `access_token`, `refresh_token`, `password` 등 시크릿이 JSONB 평문 저장. 스펙 §2.10 "암호화 저장" 명시 위반 | `integration.entity.ts` credentials, `integration-oauth-preview.entity.ts`, V008 | TypeORM Transformer 또는 pgcrypto `pgp_sym_encrypt` 암호화 적용 |
| 3 | 성능·데이터베이스 | **N+1 알림 저장** — 만료 스캐너에서 수신자별 `notificationRepository.save()` 단건 INSERT 직렬 반복. 예: 10개 × 10명 = 100회 개별 쓰기 | `integration-expiry-scanner.service.ts` `run()` for 루프 | `notificationRepository.save(notifications[])` 배열 일괄 저장 |
| 4 | 데이터베이스 | **UsageLog 인덱스 방향 불일치** — SQL DDL은 `(integration_id, at DESC)`, TypeORM `@Index`는 방향 없이 ASC. synchronize 시 불일치 발생 | `integration-usage-log.entity.ts:18`, `V008` | TypeORM `@Index` 제거 후 마이그레이션 DDL만 신뢰 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | **OAuth 콜백 HTML XSS** — `input.error`·`input.provider`가 HTML 본문에 직접 삽입. `<`만 이스케이프, `>` `"` `'` `&` 미처리 | `integrations.controller.ts` `renderCallbackHtml()` | `htmlEscape()` 유틸리티로 모든 HTML 특수문자 이스케이프 |
| 2 | 보안 | **provider 화이트리스트 검증 누락** — `@Public()` 엔드포인트에서 `provider` 파라미터 검증 없이 DB 조회 | `integrations.controller.ts` `oauthCallback()` | `ALLOWED_PROVIDERS = new Set(['slack', 'google', 'github'])` 진입 시 검증 |
| 3 | 보안·성능 | **previewTest SSRF 위험·Rate limit 없음** — 임의 serviceType/credentials로 내부 네트워크 탐색 가능 | `integrations.controller.ts` `previewTest()` | SERVICE_REGISTRY 화이트리스트 검증 + Rate limiting 적용 |
| 4 | 동시성 | **handleCallback TOCTOU 경쟁 조건** — `findOne` → 검증 → `delete` 비원자적. 동시 요청 시 preview 토큰 이중 생성 가능 | `integration-oauth.service.ts` `handleCallback()` | `SELECT FOR UPDATE` 비관적 락 또는 `DELETE RETURNING` 원자적 패턴 |
| 5 | 동시성 | **previewToken 비원자적 소비** — 동시 요청 시 중복 credentials 저장 가능 | `integration-oauth.service.ts` `consumePreviewToken()` | `DELETE WHERE ... RETURNING *` 원자적 패턴 |
| 6 | 데이터베이스 | **handleCallback 트랜잭션 없음** — preview 저장 후 state 삭제 실패 시 preview 토큰 중복 생성 위험 | `integration-oauth.service.ts` `handleCallback()` | `queryRunner` 트랜잭션으로 원자성 보장 |
| 7 | 데이터베이스 | **V008 UNIQUE 제약 — 기존 중복 데이터 시 마이그레이션 실패** | `V008__integration_usage_log_and_metadata.sql` | 사전 중복 확인 쿼리 주석 추가 |
| 8 | 데이터베이스 | **FK 선언 불일치** — SQL DDL에는 `ON DELETE CASCADE` 있으나 TypeORM 엔티티에 `@ManyToOne` 없이 단순 `@Column` | `integration-expiry-dispatch.entity.ts`, `integration-oauth-state.entity.ts`, `integration-oauth-preview.entity.ts` | `@ManyToOne(..., { onDelete: 'CASCADE' }) @JoinColumn()` 추가 또는 `synchronize: false` 명시 |
| 9 | 데이터베이스 | **node_execution CASCADE DELETE — audit 데이터 손실** — node_execution 삭제 시 usage_log도 cascade 삭제 | `V008` `node_execution_id` FK | audit log라면 `ON DELETE SET NULL` 또는 소프트 참조 검토 |
| 10 | 요구사항 | **Step 3 preview-test 자동 호출 누락** — 스펙 §3.3 요구. TestStep이 정적 UI만 표시 | `frontend/integrations/new/page.tsx` `TestStep` | 마운트 시 `integrationsApi.previewTest()` 자동 호출 |
| 11 | 요구사항 | **AuditLog 기록 미구현** — 스펙 §14 생성·삭제·회전·재인증·scope 전환 이벤트 기록 요구 | `integrations.service.ts`, `integration-oauth.service.ts` | 각 메서드에 AuditLog 기록 추가 |
| 12 | 요구사항 | **UsageLog 90일 보존 정책 미구현** — 스펙 §2.10.1 일일 배치 정리 요구 | `integration-expiry-scanner.service.ts` | 90일 초과 레코드 DELETE 로직 추가 |
| 13 | 요구사항 | **이메일 알림 채널 미구현** — 스펙 §11.3 `notifyIntegrationExpiryByEmail` 활성 시 `channel: 'both'` 요구. 현재 `in_app` 고정 | `integration-expiry-scanner.service.ts` `run()` | 수신자 프로필 설정 조회 후 channel 결정 |
| 14 | 요구사항 | **OAuth popup 타임아웃 미처리** — 스펙 §3.5 5분 타임아웃 에러 표시 요구 | `frontend/integrations/new/page.tsx` OAuth message handler | OAuth begin 후 5분 타이머, 만료 시 에러 + 재시도 UI |
| 15 | 요구사항 | **beforeunload 이탈 경고 미구현** — 스펙 §3.6 요구 | `frontend/integrations/new/page.tsx` | credentials 입력 중 `beforeunload` 이벤트 리스너 추가 |
| 16 | 요구사항 | **Activity query 최대값 검증 누락** — 스펙 §9.3 `limit` 최대 100, `days` 최대 30. `limit=99999` 허용 | `integrations.controller.ts` `activity()` | `Math.min(limit, 100)`, `Math.min(days, 30)` 또는 `@Max()` 데코레이터 |
| 17 | 요구사항 | **OAUTH_CONFIG_MISSING 상태코드 불일치** — 스펙 §9.4는 500, 구현은 400 | `integration-oauth.service.ts` `begin()` | `InternalServerErrorException`으로 변경 |
| 18 | 요구사항 | **OAuth mode 값 불일치** — 스펙은 `'request-scopes'`(하이픈), 코드는 `'request_scopes'`(언더스코어) | `dto/integration.dto.ts` `OAuthBeginDto.mode` | 스펙 또는 DTO 중 하나로 통일 |
| 19 | 아키텍처·의존성 | **모듈 경계 침범** — `Node`, `WorkspaceMember`, `Notification` 엔티티를 소유 모듈 우회하여 직접 등록 | `integrations.module.ts` | 각 모듈의 공개 Service 인터페이스 사용 |
| 20 | 아키텍처·유지보수성 | **resolveRole 컨트롤러 반복 호출** — 4개 핸들러에서 동일 패턴 중복 | `integrations.controller.ts` | `WorkspaceRoleGuard` + `@CurrentRole()` 또는 서비스 내부로 이동 |
| 21 | 아키텍처 | **React 렌더 단계 상태 변이** — `setSyncedVariant`, `setCredentials` 렌더 본문 직접 호출 | `frontend/integrations/new/page.tsx` `syncedVariant` | `useEffect([variant])` 또는 `useMemo`로 리팩터링 |
| 22 | 아키텍처·유지보수성 | **renderCallbackHtml 컨트롤러 혼재** — HTML 렌더링이 컨트롤러 파일에 위치, 관심사 분리 위반 | `integrations.controller.ts:229~277` | `oauth-callback.template.ts` 분리 |
| 23 | 보안 | **postMessage cross-origin 처리 미비** — 백엔드·프론트엔드 도메인 다를 경우 postMessage 전달 불가 | `integrations.controller.ts` `renderCallbackHtml()` | `FRONTEND_URL` 환경변수 기반 target origin 명시 |
| 24 | 테스트 | **IntegrationOAuthService 분기 커버리지 갭** — 만료 state, provider mismatch, request_scopes 모드, 만료 preview token, purgeExpired 에러 케이스 미검증 | `integration-oauth.service.spec.ts` | 각 분기 단위 테스트 추가 |
| 25 | 테스트 | **IntegrationsService 핵심 메서드 테스트 누락** — `findAll()`, `getActivity()`, `previewTest()` 전무 | `integrations.service.spec.ts` | 검색·필터·페이지네이션 포함 테스트 추가 |
| 26 | 테스트 | **IntegrationExpiryScannerService 분기 테스트 누락** — `tokenExpiresAt` 없는 항목 skip, admin 없는 케이스 미검증 | `integration-expiry-scanner.service.spec.ts` | 해당 분기 테스트 추가 |
| 27 | API 계약 | **ActivityQueryDto 숫자 파라미터 타입 검증 미흡** — 음수·극대값 허용 | `dto/integration.dto.ts` `ActivityQueryDto` | `@Type(() => Number) @IsInt() @Min(1) @Max(100)` 적용 |
| 28 | API 계약 | **Breaking change: create() 시그니처 변경** — 외부 사용처 런타임 오류 위험 | `integrations.service.ts` `create()` | 외부 사용처 전수 확인 및 API 변경 로그 문서화 |
| 29 | API 계약·부작용 | **`expiring` 상태 필터 처리 미확인** — 서비스 레이어 변환 없으면 빈 결과 | `integrations.service.ts` `findAll()` | `tokenExpiresAt <= NOW() + 7d AND status = 'connected'` 변환 구현 여부 검증 |
| 30 | 성능 | **resolveRecipients 전체 멤버 JS 필터링** | `integration-expiry-scanner.service.ts` `resolveRecipients()` | `where: { role: In(['owner', 'admin']) }` DB 레벨 필터링 |
| 31 | 성능 | **purgeExpired 직렬 DELETE + 매 begin 호출 실행** | `integration-oauth.service.ts` `begin()` | `Promise.all` 병렬화 또는 별도 스케줄러 분리 |
| 32 | 문서화 | **신규 환경변수 문서화 누락** — `SLACK_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `APP_URL` | `README.md`, `.env.example` | `.env.example`에 OAuth 환경변수 목록 추가 |
| 33 | 부작용 | **status `Not('error')` 필터가 `expired` 상태 포함** — 불필요한 DB 조회·저장 시도 | `integration-expiry-scanner.service.ts` `run()` | `status: 'connected'`로 제한 |
| 34 | 아키텍처 | **purgeExpired await vs fire-and-forget 불일치** — JSDoc "Fire-and-forget" 이나 `await`로 호출 | `integration-oauth.service.ts` `begin()` | JSDoc 수정 또는 `void this.purgeExpired()`로 변경 |
| 35 | 범위 | **기능 무관 포맷팅 변경 혼입** — 7개 파일에 줄바꿈 전용 변경 포함 | `execution-engine.service.ts`, `hooks.controller.ts` 외 5개 | 포맷팅 전용 커밋 분리 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | **serviceType 단일 선택** — 스펙 §2.3 다중 선택 요구 | `integrations/page.tsx` | `serviceType[]` 배열 파라미터 지원 |
| 2 | 요구사항 | **키보드 단축키 `N` 미구현** — 스펙 §2.5 요구 | `integrations/page.tsx` | `keydown` 이벤트 리스너 추가 |
| 3 | 요구사항 | **스캐너 쿼리 `tokenExpiresAt IS NOT NULL` 미적용** — NULL 레코드도 fetch 후 코드 필터링 | `integration-expiry-scanner.service.ts` `run()` | `tokenExpiresAt: Not(IsNull())` 조건 추가 |
| 4 | 데이터베이스 | **purgeExpired begin마다 실행 — 고트래픽 lock 경합 가능성** | `integration-oauth.service.ts` `begin()` | 별도 cron 배치 분리 권장 |
| 5 | 성능 | **프론트엔드 `limit: 100` 하드코딩** | `frontend/integrations/page.tsx` | `limit: 30~50` + 페이지네이션 |
| 6 | 테스트 | **renderCallbackHtml XSS 방어 단위 테스트 없음** | `integrations.controller.ts` | 이스케이프 로직 단위 테스트 추가 |
| 7 | 아키텍처 | **ServiceDefinition.scopes 타입 불일치** — 백엔드 선택, 프론트엔드 필수로 간주 | `service-registry.ts`, `new/page.tsx` | `service.scopes?.filter(...)` 옵셔널 체이닝 |
| 8 | 문서화 | **service-registry.ts 공개 함수 JSDoc 없음** | `services/service-registry.ts` | `validateCredentials` 등 JSDoc 추가 |
| 9 | 문서화 | **OAuth stub 코드 TODO 이슈 참조 없음** | `integration-oauth.service.ts:144~160` | TODO 이슈 번호 또는 스펙 섹션 참조 |
| 10 | 보안 | **OAuthBeginDto scopes 값 길이 검증 없음** | `dto/integration.dto.ts` `OAuthBeginDto` | `@MaxLength(128, { each: true })` 추가 |
| 11 | 유지보수성 | **expiry scanner 이중 null 체크 중복** — DB 쿼리가 이미 NULL 제외하나 코드에도 방어 로직 존재 | `integration-expiry-scanner.service.ts` | 방어 코드 제거 또는 주석 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | OAuth stub, credentials 평문(CRITICAL), AuditLog 미구현, preview-test 자동 호출 누락 등 다수 미이행 |
| database | HIGH | UsageLog 인덱스 불일치, N+1 알림 저장(CRITICAL), handleCallback 트랜잭션 없음, V008 마이그레이션 위험 |
| security | MEDIUM | XSS, provider 화이트리스트 없음, credentials 평문 저장, SSRF 위험 |
| performance | MEDIUM | N+1 알림 저장(CRITICAL), 전체 멤버 JS 필터링, purgeExpired 직렬 실행 |
| concurrency | MEDIUM | handleCallback TOCTOU, previewToken 비원자적 소비 |
| architecture | MEDIUM | 모듈 경계 침범, 컨트롤러 권한 로직, React 렌더 상태 변이 |
| api_contract | MEDIUM | previewTest 컨텍스트 부재, postMessage cross-origin, Breaking change |
| side_effect | MEDIUM | XSS, create() 시그니처 변경 파급, stub 토큰 프로덕션 위험 |
| testing | MEDIUM | OAuth 분기 커버리지 갭, findAll·getActivity·previewTest 테스트 전무 |
| maintainability | MEDIUM | resolveRole 중복, renderCallbackHtml 혼재, authorizeUrls 하드코딩 |
| documentation | MEDIUM | 신규 환경변수 문서 누락, OAuth stub 미문서화 |
| dependency | MEDIUM | Node, Notification, WorkspaceMember 엔티티 직접 주입 |
| scope | LOW | 기능 무관 포맷팅 변경 혼입(7개 파일) |

---

## 발견 없는 에이전트

없음 — 모든 13개 에이전트가 1개 이상의 발견사항 보고.

---

## 권장 조치사항

1. **[CRITICAL] OAuth 토큰 교환 구현** — Slack/Google/GitHub 토큰 엔드포인트 실제 HTTP 교환. 미완료 시 프로덕션 빌드 가드 필수.
2. **[CRITICAL] Credentials 암호화** — TypeORM Transformer 또는 pgcrypto AES-256-GCM 적용.
3. **[CRITICAL] N+1 알림 저장 → 배열 일괄 저장**
4. **[CRITICAL] UsageLog 인덱스 TypeORM `@Index` 제거** — 마이그레이션 DDL만 신뢰.
5. **[SECURITY] OAuth 콜백 HTML XSS 수정** — `htmlEscape()` 모든 특수문자 처리.
6. **[SECURITY] provider 화이트리스트 검증** + **TOCTOU 원자적 state 소비** + **previewToken 원자적 소비**
7. **[DATABASE] handleCallback 트랜잭션** + **V008 중복 데이터 사전 확인 쿼리**
8. **[REQUIREMENT] AuditLog 기록** + **90일 UsageLog 보존** + **Activity query 최대값 클램핑**
9. **[REQUIREMENT] Step 3 preview-test 자동 호출** + **OAUTH_CONFIG_MISSING 500** + **popup 타임아웃** + **beforeunload 경고**
10. **[TESTING] OAuth 분기 테스트** + **findAll/getActivity/previewTest 테스트**
11. **[PERFORMANCE] resolveRecipients DB 레벨 필터링** + **purgeExpired Promise.all 병렬화**
12. **[ARCHITECTURE] 모듈 경계 정리** (Node, WorkspaceMember, Notification 직접 주입 제거)
13. **[DOCS] .env.example OAuth 환경변수 추가** + **service-registry.ts JSDoc**
14. **[SCOPE] 포맷팅 전용 변경 별도 커밋 분리**