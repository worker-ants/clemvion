# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 기존 운영 앱 즉시 장애를 유발하는 API 하위 호환성 파괴, 데이터 정합성을 손상시키는 비원자 상태 전이, 핵심 TTL 경계 로직의 테스트 공백이 복합적으로 존재함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | `GET /oauth/install/cafe24`를 즉시 410으로 전환 — Cafe24 Developers에 구 App URL을 등록한 모든 운영 앱이 배포 직후 장애 | `integrations.controller.ts` — `cafe24InstallLegacy()` | 410 전환 PR을 분리하고, 유예 기간 동안 301/302 redirect 또는 기존 등록자 재등록 안내를 선행 |
| 2 | 동시성 / DB | `expirePendingInstalls`의 find→mutate→save 비원자 패턴 — Cafe24 콜백이 `connected`로 변경한 row를 스캐너가 `expired`로 덮어쓸 수 있음 | `integration-expiry-scanner.service.ts` — `expirePendingInstalls()` | 단일 bulk `UPDATE ... WHERE status='pending_install' AND createdAt < cutoff`로 교체해 DB가 조건 검사·쓰기를 원자 단위로 처리 |
| 3 | 테스트 | `expirePendingInstalls`의 `find()` 호출 인수 미검증 — TTL 상수·LessThan 연산자가 잘못 바뀌어도 테스트 통과, 24h 경계 로직 무보증 | `integration-expiry-scanner.service.spec.ts` | `find`가 `{ status: 'pending_install', createdAt: LessThan(cutoff) }`로 호출됐는지, cutoff가 `now - 24h`인지 직접 검증하는 assertion 추가 |
| 4 | 테스트 | `process()`의 독립 에러 격리(spec §1.4) 미검증 — 한 패스가 throw해도 나머지가 실행되는 계약이 무보증 | `integration-expiry-scanner.service.spec.ts` | `expirePendingInstalls`가 throw해도 `pruneUsageLogs`가 실행됨을 검증하는 케이스 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DB / 인프라 | `CREATE UNIQUE INDEX`(비 CONCURRENT) — 인덱스 빌드 완료까지 운영 테이블 쓰기 블로킹 | `V043__cafe24_install_token_index.sql:18` | `-- flyway:executeInTransaction=false` + `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` |
| 2 | DB / 마이그레이션 | 기존 중복 `install_token` 값이 있으면 V043 마이그레이션 자체 실패 가능 | `V043__cafe24_install_token_index.sql` | 마이그레이션 전 `SELECT install_token, COUNT(*) ... HAVING COUNT(*) > 1` 사전 확인, 또는 중복 제거 구문 선행 |
| 3 | DB / 성능 | `expirePendingInstalls` — TypeORM `save(array)`가 실제로는 N회 개별 UPDATE 발행 | `integration-expiry-scanner.service.ts:94` | Critical #2 해소와 동시에 `QueryBuilder` bulk UPDATE로 단일 왕복 처리 |
| 4 | 동시성 / 보안 | `beginCafe24Private` TOCTOU 레이스 — 동일 workspace·mall_id 동시 요청 시 중복 `pending_install` row 생성 가능. V043의 `install_token` UNIQUE 인덱스로는 차단 불가 | `integration-oauth.service.ts` — `createPrivatePendingIntegration()` | `pg_advisory_xact_lock(hashtext(workspaceId \|\| mallId))` 적용 (plan 인지 항목이나 현재 미구현) |
| 5 | 요구사항 / 데이터 정합 | TTL 기준이 `createdAt`이어서 `existingPending` 재사용 시 신규 토큰 발급 직후에도 조기 만료 가능 — spec §6의 "발급 후 24시간" 요건과 불일치 | `integration-expiry-scanner.service.ts`, `integration-oauth.service.ts` — 재사용 분기 | `installTokenIssuedAt` 컬럼 추가 후 TTL 기준을 해당 컬럼으로 변경, 또는 reuse 시 `createdAt` 역할을 하는 별도 타임스탬프 갱신 |
| 6 | 프론트엔드 / 동시성 | 팝업 닫힘 감지 `useEffect`의 stale closure — OAuth 성공 후 `oauthWaiting`이 `false`로 바뀌어도 1500ms `setTimeout` 클로저가 `true`로 읽어 에러 토스트 이중 발화 가능 | `new/page.tsx` — `oauthWaiting` 폴링 `useEffect` | `oauthWaitingRef`를 `useRef`로 유지하거나 함수형 업데이터 사용; `setTimeout` id를 cleanup에서 `clearTimeout` |
| 7 | 사이드 이펙트 | `process()` 에러 삼킴 — `.catch(logger.error)` 처리로 job이 항상 성공 종료 → BullMQ 재시도·DLQ 라우팅 불가 | `integration-expiry-scanner.service.ts` — `process()` | 의도된 설계라면 spec §1.4에 "단일 패스 실패 시 재시도 없음" 정책 명기 + Sentry/Datadog 연동으로 가시성 보완 |
| 8 | API 계약 | `handleInstall` 에러 상태 코드 변경(403→404) — 컨트롤러 catch block이 `e.status === 403`만 특수 처리해 404가 다른 경로로 빠짐 | `integrations.controller.ts` — catch block, `integration-oauth.service.ts` | catch block을 404도 처리하도록 확장하거나 status 기반 → code 기반으로 전환 |
| 9 | API 계약 | `IntegrationDto.meta`가 `@ApiProperty`(required)로 추가 — OpenAPI codegen 클라이언트 스키마 불일치 | `integration-response.dto.ts` | `@ApiPropertyOptional`로 선언, 프론트엔드는 이미 `?.appType` optional chaining 사용 중 |
| 10 | API 계약 | `lastError` Swagger 스키마를 고정 구조로 교체 — 기존 응답에 `code/message/at` 외 필드 포함 시 strict 모드 클라이언트 검증 실패 | `integration-response.dto.ts` — `lastError` 필드 | DB에서 기존 `lastError` 기록 필드 구성 확인 후 포함 가능하면 `additionalProperties: true` 유지 |
| 11 | 보안 | `installToken`이 URL path segment에 평문 노출 — nginx/CDN 로그·브라우저 history·Referer에 기록 | `integrations.controller.ts` — `@Get('oauth/install/cafe24/:installToken')` | 단기: nginx path segment 마스킹; 중기: endpoint 진입 직후 즉시 NULL화로 재사용 창 최소화 |
| 12 | 보안 | `installToken` 입력 형식·길이 검증 누락 — 임의 길이 문자열이 DB 쿼리로 전달 | `integrations.controller.ts:216`, `integration-oauth.service.ts:857` | `if (!/^[a-f0-9]{64}$/.test(installToken)) throw NotFoundException(...)` 또는 NestJS `@IsHexadecimal()` + `@Length(64,64)` |
| 13 | 테스트 | 컨트롤러 신규·레거시 라우트 무테스트 — `:installToken` param 바인딩, 410 응답 body 형식 미검증 | `integrations.controller.ts` | 컨트롤러 spec에 `GET /oauth/install/cafe24` → 410, `GET /oauth/install/cafe24/token` → `handleInstall` 호출 케이스 추가 |
| 14 | 테스트 | `buildIntegrationMeta` 전용 단위 테스트 없음 — cafe24 외 serviceType, unreadable credentials 경계 케이스 미검증 | `integrations.service.ts` — `buildIntegrationMeta()` | `integrations.service.spec.ts`에 직접 describe 블록 추가 |
| 15 | 테스트 | 프론트엔드 폴링·팝업 감지 무테스트 — 10분 타임아웃, `connected` 전이 시 라우터 이동, `transitionedRef` 가드 미검증 | `new/page.tsx` — `Cafe24PrivatePendingStep` | RTL 테스트 추가: mock useQuery로 `pending_install → connected` 전이 시뮬레이션, `router.replace` 호출 검증 |
| 16 | 요구사항 / UX | 폴링 종료 후 UI 공백 — `status`가 `expired`/`error`로 전환되면 폴링만 조용히 멈추고 사용자 안내 없음 | `new/page.tsx` — `Cafe24PrivatePendingStep` | `poll?.status === 'expired'` / `'error'` 분기 추가해 적절한 안내 메시지 표시 |
| 17 | 사이드 이펙트 | `handleInstall` 시그니처 변경(`handleInstall(query)` → `handleInstall(installToken, query)`) — 컨트롤러 외 호출 지점 누락 가능 | `integration-oauth.service.ts:852` | `grep -r 'handleInstall' backend/src/`로 모든 호출 지점 확인 |
| 18 | 프론트엔드 | React hook 불완전 의존성 — `eslint-disable-next-line react-hooks/exhaustive-deps`로 4개 참조 누락, `previewToken` stale 읽기 위험 | `new/page.tsx` — popup close detection `useEffect` | `useCallback`으로 핸들러 감싸거나 `useRef`로 최신 값 포착 후 명시적 의존성 유지 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수 | `samMall` 오타 (`sameMall` 의도) | `integration-oauth.service.ts:771` | `sameMall`로 교정 |
| 2 | 유지보수 | `pickErrorMessage`와 동일한 `lastError` 파생 로직이 `new/page.tsx`에 중복 | `new/page.tsx:822-826`, `status-badge.tsx` | `pickErrorMessage`를 공유 유틸로 이동해 재사용 |
| 3 | 유지보수 | `expirePendingInstalls` 테스트에서 서비스 인스턴스를 두 `it` 블록이 각각 중복 생성 | `integration-expiry-scanner.service.spec.ts:218-270` | 기존 `run` 테스트 패턴처럼 `beforeEach`로 공유 |
| 4 | 유지보수 | `handleInstall`의 `!installToken \|\| installToken.length === 0` 중복 가드 (`!installToken`이 빈 문자열 포함) | `integration-oauth.service.ts:857-862` | `installToken.length === 0` 제거 |
| 5 | 아키텍처 | `buildIntegrationMeta`에 Cafe24 하드코딩 — 두 번째 provider 추가 시 OCP 위반 | `integrations.service.ts` — `buildIntegrationMeta()` | `Map<serviceType, (entity) => IntegrationMeta>` 레지스트리 패턴 검토 (두 번째 provider 추가 전) |
| 6 | 아키텍처 | `isReauthorizeDisabled` 도메인 로직이 badge UI 컴포넌트에서 export — 모듈 경계 역할 모호 | `status-badge.tsx` | `lib/integrations/utils.ts` 등으로 이동 |
| 7 | 아키텍처 | `Cafe24PrivatePendingStep`이 폴링·타임아웃·상태 전이·라우팅·캐시 무효화를 모두 담당 — presentational 컴포넌트에 오케스트레이션 과부하 | `new/page.tsx` | `useCafe24PendingPolling(integrationId)` 커스텀 훅으로 상태 기계 분리 |
| 8 | 아키텍처 | `staleTime: 0 + refetchOnWindowFocus: true` — 탭 포커스마다 목록 API 전체 재호출 | `integrations/page.tsx` | `staleTime: 5_000` 정도로 완화 |
| 9 | 성능 | `isUnreadableCredentials()` 이중 호출 — `toPublic()` 진입 직후 + `buildIntegrationMeta()` 내부에서 동일 엔티티에 N×2 실행 | `integrations.service.ts` — `toPublic()` | 결과를 변수에 저장해 재사용 |
| 10 | 성능 | `process()` 세 패스가 순차 실행 — `Promise.allSettled`로 병렬화 가능 (단, Critical #2 해소 선행 필요) | `integration-expiry-scanner.service.ts` — `process()` | Critical #2 bulk UPDATE 적용 후 병렬화 검토 |
| 11 | 문서 | `(변경 N)` 마커·review 아티팩트 경로(`review/2026-05-14_16-48-25`)가 프로덕션 코드·테스트 명칭에 잔류 | `integration-oauth.service.ts`, `*.spec.ts`, `status-badge.test.tsx` | `(변경 N)` 제거, review 경로 참조는 커밋 메시지·PR description으로 이동 |
| 12 | 문서 | `cafe24InstallLegacy` JSDoc에 `plan/in-progress/cafe24-pending-polish.md` 경로 하드코딩 — plan이 `complete/`로 이동하면 깨짐 | `integrations.controller.ts` | 해당 문장 제거, 폐기 일정은 PR description에 |
| 13 | 문서 | `spec/data-flow/integration.md` 경로 참조 — 프로젝트 spec 트리에 존재하지 않을 수 있음 | `integration-expiry-scanner.service.ts:72` | 실제 `spec/` 트리 확인 후 올바른 경로로 교정 |
| 14 | 보안 | `INVALID_TOKEN(404)` vs `INVALID_HMAC(403)` 분리로 토큰 존재 여부 oracle 가능 — 256-bit 엔트로피+rate limit으로 실질 위험 낮음 | `integration-oauth.service.ts:869-899` | 현행 유지 가능; 더 엄격한 은닉 필요 시 두 케이스 모두 403 통일 |
| 15 | 보안 | `verifyHmacWithMessage`의 timing-safe 구현 여부 이 diff에서 확인 불가 | `integration-oauth.service.ts:909` | `crypto.timingSafeEqual` 사용 여부 확인 |
| 16 | 보안 | `lastError.message` 길이 제한·민감 패턴 필터링 미적용 — plan Info 1-2 항목 미완 | `markIntegrationCallbackError` | 저장 시점에 `message.slice(0, 200)` + 민감 패턴 마스킹 |
| 17 | 타입 | `lastError` 유니온의 `Record<string, unknown>` 멤버가 앞 타입을 포함 — narrowing 실익 없음 | `frontend/src/lib/api/integrations.ts:37` | 백엔드 DTO가 고정 스키마만 반환함을 확정 후 `Record` 유니온 제거 |
| 18 | 요구사항 | `'install_timeout'` 문자열 리터럴이 3곳에 분산 — plan W10 cleanup 미완 | `integration-expiry-scanner.service.ts`, `status-badge.tsx`, `isReauthorizeDisabled` | 상수로 추출해 단일 출처 유지 |
| 19 | API 계약 | 신규 에러 코드 3종(`CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_LEGACY_PATH`, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED`)에 `@ApiResponse` 미문서화 | `integrations.controller.ts` | 각 에러 코드에 대응하는 `@ApiResponse` 데코레이터 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| API Contract | **HIGH** | 기존 앱 410 즉시 차단, catch block 404 누락, meta required 필드 추가 |
| Testing | **HIGH** | TTL 경계·독립 에러 격리 테스트 공백, 컨트롤러·FE 폴링 무테스트 |
| Concurrency | **MEDIUM** | expirePendingInstalls 비원자 상태 전이, TOCTOU 레이스, stale closure |
| Side Effect | **MEDIUM** | TTL createdAt 기준 조기 만료, stale closure 에러 토스트, 에러 삼킴 |
| Requirement | **MEDIUM** | TTL spec 불일치, 터미널 상태 UI 공백, stale closure |
| Database | **MEDIUM** | 비동시 인덱스 블로킹, N+1 UPDATE, TOCTOU 미보호 |
| Security | **LOW** | installToken 로그 노출, 형식 검증 누락, plan 인지 항목 미완 |
| Performance | **LOW** | bulk UPDATE 권고, isUnreadableCredentials 이중 호출 |
| Architecture | **LOW** | OCP 경향, 비즈니스 로직 위치, 오케스트레이션 과부하 |
| Documentation | **LOW** | 변경 N 마커, plan 경로 하드코딩, spec 경로 불확실 |
| Maintainability | **LOW** | samMall 오타, 로직 중복, 테스트 패턴 불일치 |
| Scope | **LOW** | hook 의존성 누락, 오타 |
| Dependency | **NONE** | 신규 외부 패키지 없음, 내부 의존 방향 단방향 |

---

## 발견 없는 에이전트
- **Dependency** — 신규 외부 패키지 0건, 내부 의존 방향 단방향, 순환 참조 없음

---

## 권장 조치사항

1. **[즉시 — 배포 차단]** `/oauth/install/cafe24` 410 전환을 별도 PR로 분리하고, 현 PR에서는 신규 경로만 활성화. 기존 등록자 마이그레이션 경로 수립 후 410 전환.
2. **[즉시 — 데이터 정합]** `expirePendingInstalls`를 `find→mutate→save` 3단계에서 단일 bulk `UPDATE ... WHERE status='pending_install' AND createdAt < :cutoff`로 교체 (Critical #2 + WARNING #3 동시 해소).
3. **[즉시 — 인프라]** V043 마이그레이션에 `CONCURRENTLY` + `flyway:executeInTransaction=false` 적용 (배포 전 중복 install_token 사전 확인 포함).
4. **[단기 — 테스트]** `find()` 호출 인수 + TTL cutoff 경계 + `process()` 에러 격리 검증 추가 (Critical #3, #4).
5. **[단기 — 버그 수정]** 팝업 닫힘 감지 stale closure → `oauthWaitingRef` 패턴 적용, `setTimeout` cleanup 추가.
6. **[단기 — 요구사항]** TTL 기준을 `createdAt` → `installTokenIssuedAt` 컬럼으로 분리해 spec §6 "발급 후 24시간" 요건 충족.
7. **[단기 — UX]** 폴링 종료 시 `expired`/`error` 상태 전환에 대한 사용자 안내 메시지 추가.
8. **[컨트롤러]** catch block을 404 포함하도록 확장 + `@ApiResponse` 3종 추가 + `handleInstall` 시그니처 변경 호출 지점 전수 확인.
9. **[보안 — 단기]** `installToken` 형식·길이 검증(`/^[a-f0-9]{64}$/`) 추가; nginx 로그 마스킹 적용 (plan W6).
10. **[문서 정리]** 프로덕션 코드·테스트 명칭에서 `(변경 N)` 마커·review 아티팩트 경로·plan 파일 경로 제거.