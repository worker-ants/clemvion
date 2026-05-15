# Resolution — 2026-04-12_19-57-45 code review

리뷰 발견사항(Critical 1, Warning 17, Info 13)을 순차 조치했다. 전체 위험도를 **MEDIUM → LOW**로 완화.

## 테스트 상태 (최종)

- Backend: 62 suites / 843 tests ✓ · `npm run build` OK · integration 영역 lint 에러 0
- Frontend: 26 files / 419 tests ✓ · lint clean · typecheck · build OK

## Critical

### C1. DB 커넥션 풀링 부재
- `DatabaseQueryHandler`에 `integrationId` 단위 `pg.Pool` 캐시 도입
- `POOL_MAX_CONNECTIONS = 5`, `POOL_IDLE_TIMEOUT_MS = 30_000`
- credential 변경 감지를 위해 SHA-256 fingerprint를 함께 저장, 해시 변경 시 이전 pool 폐기
- `pool.on('error', () => {})`로 idle client 에러가 프로세스를 죽이지 않도록 보장
- `shutdown()` / `invalidatePool()` 공개 API 제공 (테스트 cleanup, 배포 graceful shutdown 용)
- 관련 테스트: Pool 재사용(Pool 생성 1회 + connect/release 2회), release 보장, invalid params, incomplete creds 등 13건

## Warning

### W1 · W9 SendEmailHandler 일관성 + Transporter 캐싱
- `SendEmailHandler extends IntegrationHandlerBase` 상속으로 변경. `safeLogUsage` 제거, `resolveIntegration`/`logUsage` 재사용으로 ~60 줄 중복 삭제
- 나머지 핸들러와 동일한 에러 분류 체계 정렬
- nodemailer transporter도 integrationId 단위 캐싱 + `pool: true, maxConnections: 3, maxMessages: 100`. credential hash로 invalidation
- 기존 테스트가 call당 `close()`를 기대했으므로 `handler.shutdown()` 후 확인하도록 수정

### W2 · W5 HTTP SSRF 방어 + redirect 제어
- 신규 `http-safety.ts`에 `assertSafeOutboundUrl()` — RFC1918 / 169.254/16 (클라우드 메타데이터 포함) / 127/8 / 100.64/10 / fe80::/10 / fc00::/7 / localhost 차단
- `authentication === 'integration'` 경로에서만 검사 (none/custom은 내부 서비스 호출 의도가 있을 수 있음)
- fetch `redirect: 'manual'`로 전환, 3xx 응답 시 Location 헤더 재검증 후 수동 따라가기, 최대 5 hop 제한
- 차단 시 `HTTP_BLOCKED` usage log 기록 후 throw
- 관련 테스트: 169.254.169.254, localhost, transport 실패 3건 추가

### W3 PostgreSQL SSL 검증 강화
- `ssl='require'` 매핑을 `{ rejectUnauthorized: false }` → `{ rejectUnauthorized: true }`로 변경
- 코드 주석으로 자가 서명 인증서가 필요한 경우의 안내 명시 (운영자가 명시적으로 plan해야 함)

### W4 · W6 에러 sanitize + Slack 에러 코드 추출
- `integration-handler-base.ts`의 `toLogError()`를 전면 개편:
  - Slack `@slack/web-api` 에러는 `err.data.error`를 우선 추출 → `SLACK_<CODE>` 형태로 기록
  - 나머지 메시지는 `sanitizeMessage()`로 세탁: `password=`/`token=` 등 쿼리 문법, `Bearer`/`Basic` 헤더, Slack `xox[abpers]-...` 토큰, 32자+ 고엔트로피 블롭을 `***`로 치환
- SendEmail의 SMTP 에러도 동일 sanitizer 경유

### W7 `connect()` 실패 시 리소스 누수
- Pool 모델로 바뀌어 자연스럽게 해소 — `client?.release()` finally 블록에서 호출되며, 연결 획득 실패 시 release 스킵(없는 client로 호출 안 됨)

### W8 Slack WebClient 캐싱
- `SlackHandler`에 `access_token` 키 `Map<string, WebClient>` 추가
- SDK의 내부 rate-limit 큐가 인스턴스별로 생성되므로, 동일 토큰 호출들이 같은 큐를 공유하도록 보장
- `invalidateClient(token)` 제공

### W10 NestJS DI 우회
- 전면 리팩터링은 이번 라운드에서 보류 — 변경 규모가 엔진 전체 생명주기에 영향
- 대신 현재 패턴을 명시적 제약으로 문서화해야 하므로 핸들러 생성 위치(`execution-engine.service.ts:168~199`)에 JSDoc 설명 추가 여부는 후속 과제로 남김. RESOLUTION에 "기존 컨벤션 유지" 기록
- 완화 근거: 각 핸들러가 생성자로 `IntegrationsService` 1개만 받는 단순한 의존성 주입 — 추가 의존성 생기면 재방문

### W11 IntegrationSelector 로딩 중 `(missing)` 오표시
- `hasSavedButMissing`에 `!isLoading` 가드 추가 → 초기 fetch 중에는 항상 false

### W12 Slack upload_file `file` 파라미터 무시
- `coerceFile()` 도입 — Buffer / `base64:...` 프리픽스 문자열 / `{base64}` 객체 3형식 허용
- `file` 제공 시 `file: Buffer`로 SDK에 전달, 없으면 `content`로 fallback
- 관련 테스트: content 경로, base64 file 경로 2건 추가

### W13 axios paramsSerializer 회귀
- 배열 파라미터 사용처 전수 조사: `integrationsApi.list({ serviceType: … })` 1개 경로만 해당 (page.tsx · integration-selector.tsx)
- 두 경로 모두 테스트 green. 그 외 API는 단일값이라 변경 없음

### W14 `nodeExecutionId` optional → 경고
- `IntegrationHandlerBase.logUsage`가 context에 `nodeExecutionId`가 없을 때 NestJS Logger.warn으로 1회 경고 후 skip
- 엔진이 항상 주입하지만 계약 위반 시 조용히 사라지지 않도록 감지 가능

### W15 `getForExecution` 인가 계층 명문화
- JSDoc을 전면 재작성 — "caller MUST already have established permission", "credentials are NOT masked", "use exclusively from trusted execution-engine code paths" 명시

### W16 IntegrationUsageLog 인덱스
- V008 마이그레이션이 이미 `(integration_id, at DESC)` + `(at)` 인덱스 보유 확인
- 현재 조회 패턴(`WHERE integration_id = :id AND at >= :since`)은 첫 번째 인덱스로 완전 커버 — 추가 인덱스 불필요
- `workflow_id`, `node_execution_id` 단독 조회는 현 스펙에 없음 — 필요 시 후속

### W17 http-request 기존 동작 변경 scope
- 리뷰가 지적한 `bodyType=raw` 시 `String(body)` → `JSON.stringify(body)` 변경은 이전 lint(no-base-to-string error) 대응이었음 — 의도적 변경
- 스펙 `spec/4-nodes/4-integration-nodes.md §2` raw bodyType 문서에 "object body는 JSON으로 직렬화됨"을 주석으로 추가할 여지는 있으나 기존 raw는 "사용자 책임 영역"이라 이번 round에서는 코드 의도를 유지

## Info

| # | 조치 |
|---|------|
| I1 | execution 단위 캐시는 복잡도 대비 효용 낮음(파이프라인 대부분 integration 1회/실행) — 보류 |
| I2 | 모든 catch 블록의 `logUsage` 호출에 `.catch(() => {})` 부착 (DB/Slack/HTTP/SendEmail) |
| I3 | `integration-handler-base.spec.ts` 신규 — resolveIntegration 5케이스 + logUsage 3케이스 + toLogError 3케이스 + sanitizeMessage 4케이스 |
| I4 | Slack `update_message`, `upload_file` (content/base64 file) execute 테스트 추가 |
| I5 | HTTP transport 실패 시 `HTTP_TRANSPORT_FAILED` 기록 테스트 추가 |
| I6 | DB `queryType: 'raw'` 허용 테스트 추가 |
| I7 | IntegrationSelector `staleTime` 30초 → 5분 |
| I8 | 허용된 설계 — `tokenExpiresAt` 실시간 체크는 만료 스캐너가 담당 (CRON) |
| I9 | `resolveUrl` JSDoc을 실제 동작에 맞게 수정 (중복 슬래시 정규화는 join 경계만) |
| I10 | ExecutionEngineModule → IntegrationsModule 단방향 의존 유지. 역방향 금지를 모듈 주석으로 명시 |
| I11 | `npm audit --audit-level=high` → 0 vulnerabilities 확인 |
| I12 | 현 프로덕트에서 모든 호출처가 단일 serviceType만 전달하지만 배열 API는 유지 — 향후 "복수 타입 필터" 요구가 있을 가능성 대비 |
| I13 | `ALLOWED_QUERY_TYPES` 상수 추출 완료 (DatabaseQueryHandler) |

## 해소하지 않은 항목

- **W10 (NestJS DI 우회)**: 엔진 전체 핸들러 등록 패턴 변경은 범위가 커서 후속 PR로 분리. 각 핸들러가 동일 인자(`IntegrationsService`)만 받는 현 패턴은 유지 가능.
- **MySQL 지원**: 여전히 TODO. `mysql2` 추가 + driver 분기는 별도 작업.

## 산출물

- 수정된 소스:
  - `backend/src/modules/execution-engine/handlers/integration/database-query.handler.ts` (Pool 도입)
  - `backend/src/modules/execution-engine/handlers/integration/send-email.handler.ts` (Base 상속, transporter 캐시)
  - `backend/src/modules/execution-engine/handlers/integration/slack.handler.ts` (WebClient 캐시, file 처리)
  - `backend/src/modules/execution-engine/handlers/integration/http-request.handler.ts` (SSRF 가드, redirect 수동)
  - `backend/src/modules/execution-engine/handlers/integration/integration-handler-base.ts` (sanitize, warn)
  - `backend/src/modules/integrations/integrations.service.ts` (getForExecution JSDoc)
  - `frontend/src/components/editor/settings-panel/node-configs/integration-selector.tsx` (hasSavedButMissing 가드, staleTime)
- 신규 파일:
  - `backend/src/modules/execution-engine/handlers/integration/http-safety.ts`
  - `backend/src/modules/execution-engine/handlers/integration/integration-handler-base.spec.ts`
- 갱신 테스트: 5개 핸들러 spec + base spec — 총 83건의 integration 영역 테스트
