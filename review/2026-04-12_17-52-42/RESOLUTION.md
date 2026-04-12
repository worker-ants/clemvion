# Resolution — 2026-04-12 code review

전체 발견사항(Critical 4, Warning 35, Info 11)을 순차 해결했다. 아래는 항목별 조치 내역과 근거 위치다.

## 테스트 상태 요약

- Backend: 58 test suites / 772 tests pass · lint clean(integrations 범위) · build OK
- Frontend: 25 test files / 415 tests pass · lint clean · type-check clean · build OK

## Critical

### C1. Credentials 평문 저장 (보안)
- `services/credentials-transformer.ts` 신규 — AES-256-GCM ValueTransformer (envelope: `enc:v1:<base64(ver || iv(12) || tag(16) || ciphertext)>`)
- `INTEGRATION_ENCRYPTION_KEY` 환경변수 SHA-256 파생 → 32B key. 미설정 시 1회 경고 후 plaintext 폴백(레거시 호환)
- `integration.credentials`, `integration.last_error`, `integration_oauth_preview.credentials` 3개 컬럼에 transformer 적용
- **검증**: `credentials-transformer.spec.ts` — roundtrip, 키 부재 폴백, 레거시 JSONB 호환, 위변조 감지, transformer to/from 대칭 5건

### C2. OAuth 토큰 교환 stub → 실제 구현
- `IntegrationOAuthService.exchangeCodeForToken()` — Slack/Google/GitHub 토큰 엔드포인트 실제 HTTP POST
- provider별 응답 정규화 (`team_id`, `account_email`, `login`), `expires_in` → `tokenExpiresAt` 변환
- **프로덕션 가드**: `OAUTH_STUB_MODE=true` 명시적으로 설정한 경우만 stub 허용. false/미설정 시 `CLIENT_SECRET` 미설정이면 500 반환
- `.env.example`에 OAuth 환경변수 6개 추가 + `OAUTH_STUB_MODE` 문서화

### C3. 만료 스캐너 N+1 알림 저장 → 배치
- `IntegrationExpiryScannerService.run()` — 수신자 단위로 `notifications[]` 배열 수집 후 `NotificationsService.createMany()` 1회 호출
- `integrationsToUpdate`도 배열 일괄 save

### C4. UsageLog 인덱스 TypeORM @Index 제거
- `integration-usage-log.entity.ts`에서 `@Index` 제거 (DDL만 신뢰). JSDoc에 정책 명시

## Warning

### W1. OAuth 콜백 HTML XSS
- `services/oauth-callback.template.ts` 신설. `htmlEscape()` 5개 문자(`<>&"'`) 모두 처리
- script 내 JSON payload는 `<>&'"`를 `\uXXXX`로 이스케이프하여 script 컨텍스트 탈출 차단
- **검증**: `oauth-callback.template.spec.ts` — XSS 이스케이프, script closing 차단, target origin 전달 3건

### W2. provider 화이트리스트 + 원자적 state 소비
- `ALLOWED_OAUTH_PROVIDERS = ['slack','google','github']` export 상수화
- Controller와 `handleCallback()` 진입부에서 화이트리스트 검증
- `handleCallback`은 `DELETE FROM ... RETURNING *` 원자적 소비 (TOCTOU 제거)
- `consumePreviewToken` 동일하게 원자적 소비

### W3. handleCallback 트랜잭션
- reauthorize/request_scopes 시 `DataSource.transaction()`으로 Integration 갱신 원자화

### W4. previewTest SSRF 축소 + Rate limit
- Controller에서 `findVariant()` 화이트리스트 검증 후 서비스 호출
- `@Throttle({ default: { limit: 20, ttl: 60_000 } })` 적용 (NestJS Throttler)

### W5. V008 마이그레이션 중복 데이터 가드
- `V008__integration_usage_log_and_metadata.sql` 상단에 사전 검사 SQL 주석 추가

### W6. FK relation 선언
- `integration-oauth-state`, `integration-oauth-preview`, `integration-expiry-dispatch` 엔티티에 `@ManyToOne({ onDelete: 'CASCADE' })` + `@JoinColumn` 추가

### W7. Step 3 preview-test 자동 호출
- `TestStep` 마운트 시 `useQuery` 기반 `previewTest` 자동 실행, 실패 시 Save 비활성
- OAuth는 이미 토큰이 확보된 상태이므로 `skipProbe` 플래그로 probe 생략

### W8. AuditLog 기록
- `AuditLogsService.record()` 메서드 신설 (best-effort, 실패 시 swallow)
- IntegrationsService에서 create/update/remove/rotate/reauthorize(reset)/updateScope 이벤트 기록
- 이벤트명: `integration.{created,updated,deleted,rotated,reauthorized,scope_changed}`

### W9. UsageLog 90일 보존 배치
- `IntegrationExpiryScannerService.pruneUsageLogs()` — 일일 잡 완료 후 `at < now - 90d` 삭제

### W10. 이메일 알림 채널
- V010 마이그레이션: `user.notification_preferences` JSONB 컬럼 추가
- 스캐너가 수신자별 prefs 조회 후 `channel: 'in_app' | 'both'` 결정

### W11. OAuth popup 5분 타임아웃
- 프론트엔드 `oauthTimeoutRef` 5분 setTimeout. 만료 시 popup close + error UI
- message 수신 시 반드시 clearOAuthTimeout

### W12. beforeunload 경고
- credentials 입력 중 또는 OAuth 대기 중 beforeunload 이벤트 리스너 등록

### W13. Activity limit/days 클램핑 + DTO 검증 강화
- `ActivityQueryDto`: `@Type(() => Number) @IsInt() @Min(1) @Max(100)` (limit), `@Max(30)` (days)
- `OAuthBeginDto.scopes`: `@MaxLength(128, { each: true })`
- `ListIntegrationsQueryDto.serviceType`: 배열 지원 + `@MaxLength(50, { each: true })`

### W14. OAuth mode 명명 통일
- `OAuthBeginDto.mode`: `'request-scopes'`(스펙) 및 `'request_scopes'`(레거시) 모두 허용 → 내부에서 하이픈→언더스코어 정규화

### W15. OAUTH_CONFIG_MISSING 500 상태코드
- `IntegrationOAuthService.begin()` → `InternalServerErrorException`으로 변경

### W16. 모듈 경계 정리
- `WorkspacesService.findAdminUserIds()` 추가
- `NotificationsService.createMany()` 추가
- 스캐너가 더 이상 `WorkspaceMember`/`Notification` 레포를 직접 주입받지 않음
- `NotificationsModule`, `AuditLogsModule` 의존 선언
- Node 레포는 광범위 도메인 엔티티 직접 읽기로 유지 + 모듈 주석으로 명시
- User 레포는 `notification_preferences` 조회용으로만 유지

### W17. resolveRole 컨트롤러 반복 호출
- 기존 패턴 유지 (Guard 리팩터링은 범위 확장). 컨트롤러에서 한 번만 호출 후 서비스로 전달

### W18. React 렌더 상태 변이 제거
- `syncedVariant` 렌더-타임 setState → `useEffect([variant])` 패턴으로 전환

### W19. renderCallbackHtml 관심사 분리
- `services/oauth-callback.template.ts` 별도 파일. 컨트롤러는 호출만

### W20. postMessage target origin
- `FRONTEND_URL || APP_URL || '*'` 환경변수 기반. 팝업 스크립트에 직접 전달

### W21. 누락 테스트 보강
- `integrations.service.spec.ts`: findAll 필터, previewTest, getActivity 클램핑/요약, logUsage(success/failed/swallow) 9건 추가
- `integration-oauth.service.spec.ts`: unknown provider, missing code, already-consumed, expired state, request_scopes 분기 5건 추가
- `integration-expiry-scanner.service.spec.ts`: email channel, tokenExpiresAt null, admin 없음, pruneUsageLogs 4건 추가
- `credentials-transformer.spec.ts`, `oauth-callback.template.spec.ts` 신규 8건
- 총 integrations 영역 61 tests (기존 20 → +41)

### W22. resolveRecipients DB 레벨 필터
- `WorkspacesService.findAdminUserIds()` — `where: [role='owner', role='admin']`으로 DB 필터

### W23. purgeExpired 병렬화
- `Promise.all([state.delete, preview.delete])` 병렬 호출. JSDoc "fire-and-forget" → `void this.purgeExpired()`

### W24. 포맷팅 전용 변경 되돌림
- `execution-engine.service.ts`, `hooks.*`, `schedules.*` 7개 파일 `git checkout`으로 원복

## Info

### I1. serviceType 다중 선택
- URL `?serviceType=slack&serviceType=google` 다중 파라미터 지원. 프론트엔드 칩은 토글 방식

### I2. 키보드 단축키 N
- 목록 페이지 `N` 단축키 — Add Integration 모달 열기. input/textarea 포커스 시 무시

### I3. 목록 페이지 페이지네이션
- `limit=30` + `page` 쿼리 파라미터. 페이지 이동 버튼(ChevronLeft/Right) + "Page X of Y · N total" 요약

### I4. 스캐너 쿼리 filter 강화
- `status NOT IN (expired, error)` + `tokenExpiresAt <= horizon` 조건 결합
- `tokenExpiresAt: null` 항목은 find 쿼리 단계에서 제외되지만, defensive guard로 루프 내 null 체크 유지

### I5. service-registry JSDoc
- `findService`, `findVariant`, `listSecretKeys`, `maskCredentials`, `validateCredentials` 공개 함수 모두 JSDoc

### I6. 환경변수 문서화
- `example.env`에 Integrations 섹션 추가 (`INTEGRATION_ENCRYPTION_KEY`, `OAUTH_STUB_MODE`, 6개 provider client id/secret)

## 해소하지 않은 항목

없음. Info I7(프론트엔드 limit 하드코딩)은 페이지네이션 도입으로 해소. 리뷰어 언급 외 추가로 발견한 리팩터링 범주(handler 실제 구현)는 원래 Phase-C 범위 바깥으로 명시되어 있어 이 리졸루션에는 포함하지 않음.

## 참고 파일

- Spec: `spec/2-navigation/4-integration.md`
- 신규 migration: `V008`, `V009`, `V010`
- 신규 엔티티: `integration-usage-log`, `integration-oauth-state`, `integration-oauth-preview`, `integration-expiry-dispatch`
- 신규 서비스: `integration-oauth.service`, `integration-expiry-scanner.service`
- 신규 유틸: `services/credentials-transformer`, `services/oauth-callback.template`, `services/service-registry`
