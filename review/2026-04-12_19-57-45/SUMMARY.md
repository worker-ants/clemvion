# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 커넥션 풀링 부재(DB 고갈 위험), SSRF 취약점, SSL 인증서 검증 비활성화, 그리고 8개 에이전트가 공통 지적한 `SendEmailHandler` 아키텍처 불일치가 복합적으로 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database | `DatabaseQueryHandler`가 매 실행마다 `new PgClient()` + `client.connect()`로 새 TCP 연결을 생성·해제. 고빈도·동시 실행 시 PostgreSQL `max_connections` 한도를 초과하여 서비스 장애로 이어질 수 있음 | `database-query.handler.ts` — `execute()` | `pg.Pool`을 사용하고 `integrationId` 단위로 Pool 인스턴스를 캐싱하여 재사용. `pool.connect()` → `client.query()` → `client.release()` 패턴으로 전환 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Maintainability | **`SendEmailHandler`가 `IntegrationHandlerBase`를 상속하지 않음** — serviceType 검증, status 검증, logUsage 호출이 ~60줄 중복 구현됨. `DatabaseQueryHandler`, `SlackHandler`, `HttpRequestHandler`와 일관성 불일치. 향후 베이스 클래스 변경 시 이 파일만 누락될 위험 *(8개 에이전트 공통 지적)* | `send-email.handler.ts` 전체 | `SendEmailHandler extends IntegrationHandlerBase`로 변경, `safeLogUsage` → `this.logUsage`, 통합 검증 → `this.resolveIntegration()`으로 교체 |
| 2 | Security | **SSRF 방어 없음** — `url` 값을 사용자 제공 워크플로우 설정에서 직접 가져와 서버 측 fetch 수행. RFC1918/링크로컬 주소(`169.254.169.254`, `localhost`, `10.x.x.x` 등) 차단 로직 부재 | `http-request.handler.ts` — `execute()` | allowlist 기반 도메인 정책 또는 내부 네트워크 주소 차단 로직 추가 |
| 3 | Security | **SSL 인증서 검증 비활성화** — `ssl: 'require'`일 때 `{ rejectUnauthorized: false }` 사용으로 MITM 공격에 취약 | `database-query.handler.ts` — `buildPgConnection()` | `'require'`도 `{ rejectUnauthorized: true }`로 변경하거나 `'require'`와 `'verify-full'`의 구분 의미를 명확히 재정의 |
| 4 | Security | **에러 메시지를 통한 자격증명 노출** — `err.message`를 그대로 로그에 기록. pg, nodemailer 등은 에러 메시지에 연결 문자열(host, user, password 일부)을 포함하는 경우 있음 | `integration-handler-base.ts` — `toLogError()`, 각 핸들러 catch 블록 | catch 블록에서 외부 라이브러리 에러를 기록할 때 민감 필드(password, token 등)를 제거하는 sanitize 단계 추가 |
| 5 | Security | **HTTP 리다이렉트 제어 없음** — Node fetch가 기본적으로 리다이렉트를 따라가며 외부 URL → 내부 주소로 리다이렉트되는 SSRF 우회 가능 | `http-request.handler.ts` — fetch 호출 | `redirect: 'manual'` 또는 `redirect: 'error'` 옵션 추가 |
| 6 | Security | **Slack access_token 로그 포함 가능** — Slack SDK 에러 메시지에 token 정보가 포함될 수 있음 | `slack.handler.ts` — catch 블록, `toLogError()` | Slack API 에러는 `error.data?.error` 필드(에러 코드 문자열)만 추출하여 로그에 기록 |
| 7 | Database | **`connect()` 실패 시 `client.end()` 미호출** — `client.connect()`가 예외를 던지면 외부 catch에서 `logUsage`만 호출하고 `client.end()`는 호출되지 않는 경로 존재 | `database-query.handler.ts` — `await client.connect()` 직후 | connect 이후 즉시 `try/finally { await client.end() }`로 감싸서 항상 종료 보장 |
| 8 | Performance / Concurrency | **`SlackHandler` 매 실행마다 `new WebClient(token)` 생성** — 내부 `p-queue` rate-limit 큐가 인스턴스별로 독립 생성되어 동시 실행 시 Slack rate limit 조율 불가 | `slack.handler.ts` — `execute()` | `token`을 키로 하는 `Map<string, WebClient>` 캐시를 핸들러 인스턴스 수준에서 유지 |
| 9 | Performance | **`SendEmailHandler` 매 실행마다 SMTP Transporter 재생성** — TLS 핸드셰이크 비용이 수십~수백 ms에 달할 수 있음 | `send-email.handler.ts` — `buildTransport()` + `finally { transporter.close() }` | credential hash를 키로 transporter 인스턴스 캐시 또는 `pooling: true` 옵션 활용 |
| 10 | Architecture | **NestJS IoC를 우회하는 수동 핸들러 생성** — `new HttpRequestHandler(this.integrationsService)` 등 직접 인스턴스화로 DI 컨테이너 우회. 핸들러에 새 의존성 추가 시 `ExecutionEngineService`도 함께 수정 필요 (OCP 위반) | `execution-engine.service.ts:177–186` | 핸들러를 NestJS Provider로 등록하고 `NodeHandlerRegistry`가 DI로 주입받는 구조로 전환 |
| 11 | Frontend | **`IntegrationSelector` 로딩 중 `hasSavedButMissing` 오평가** — `isLoading` 상태에서 `integrations`가 빈 배열이므로 저장된 value가 있으면 항상 `(missing)` 옵션이 깜빡이며 표시됨 | `integration-selector.tsx` — `hasSavedButMissing` 계산 | `const hasSavedButMissing = !isLoading && value !== "" && !integrations.some((i) => i.id === value);` |
| 12 | Requirement | **`SlackHandler` `upload_file` — `file` 파라미터 무시** — validate에서 `file` 파라미터를 허용하면서 실제 `runAction`에서는 `content`만 처리하고 `config.file`은 완전히 무시됨 | `slack.handler.ts` — `runAction` `upload_file` case | `config.file` 처리 로직 추가, 또는 validate에서 `file` 파라미터 제거 |
| 13 | Frontend | **`paramsSerializer` 전역 변경** — 모든 API 호출의 배열 파라미터 직렬화 방식이 변경됨. 기존에 bracket 형식(`foo[]`)을 사용하던 엔드포인트가 있다면 breaking change | `frontend/src/lib/api/client.ts` | 배열 쿼리 파라미터를 사용하는 모든 엔드포인트 전수 확인 및 회귀 테스트 |
| 14 | Architecture | **`nodeExecutionId`가 optional이어서 로깅이 묵시적으로 스킵됨** — undefined이면 `logUsage`가 조용히 early-return하여 사용 로그 무음 유실 가능 | `node-handler.interface.ts`, `integration-handler-base.ts:69` | 런타임 체크 시 경고 로그를 남기거나, 실행 엔진에서 항상 주입함을 assertion으로 명시 |
| 15 | Security | **`getForExecution` — 복호화된 자격증명 반환 시 추가 인가 계층 없음** — workspaceId 범위 검증만 수행, 워크플로우가 해당 integration에 접근 가능한지 검사 없음 | `integrations.service.ts` — `getForExecution()` | 메서드 계약에 "caller is responsible for authorization" 명시 강화, 또는 실행 엔진 전용 guard 추가 |
| 16 | Database | **`IntegrationUsageLog` 테이블 인덱스 미확인** — `integrationId`, `workflowId`, `nodeExecutionId` 컬럼에 인덱스가 없으면 조회 쿼리가 full scan | `integrations.service.ts` — `logUsage()` | `IntegrationUsageLog` 엔티티/마이그레이션에 해당 컬럼 인덱스 존재 여부 확인 |
| 17 | Scope | **`http-request.handler.ts` 기존 동작 변경 포함** — `queryParams` 기본값 `undefined`→`{}`, `bodyType=raw` 처리(`String(body)` → `JSON.stringify`) 등 integration 인증과 무관한 동작 변경 포함 | `http-request.handler.ts` — `execute()` | 별도 PR로 분리하거나 스펙에서 의도적 변경임을 확인 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `getForExecution` DB 조회 캐싱 없음 — 동일 execution 내 같은 integrationId 참조 노드가 여럿이면 N+1 패턴 | `integrations.service.ts` | execution 단위 `Map<integrationId, Integration>` 캐시 관리 |
| 2 | Concurrency | catch 블록 내 `logUsage()` 오류가 원본 오류를 삼킴 — `logUsage`가 throw하면 이후 `throw err`에 도달하지 않음 | `database-query.handler.ts`, `slack.handler.ts`, `http-request.handler.ts` catch 블록 | `await this.logUsage(...).catch(() => {})` fire-and-forget 패턴 적용 |
| 3 | Testing | `IntegrationHandlerBase` 독립 단위 테스트 없음 — 핵심 공유 로직이 핸들러 테스트를 통해 간접 검증만 됨 | `integration-handler-base.ts` | `integration-handler-base.spec.ts` 별도 작성 |
| 4 | Testing | `SlackHandler` `upload_file` / `update_message` execute 경로 테스트 없음 — `filesUploadMock`이 정의됐으나 실제 execute 케이스 미검증 | `slack.handler.spec.ts` | `upload_file`, `update_message` execute 테스트 케이스 추가 |
| 5 | Testing | `http-request.handler.spec.ts` — integration 경로에서 fetch 자체가 throw되는 transport 실패 시 logUsage 호출 미검증 | `http-request.handler.spec.ts` | `global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))` 케이스 추가 |
| 6 | Testing | `database-query.handler.spec.ts` — `queryType: 'raw'` 허용 케이스 테스트 없음 | `database-query.handler.spec.ts` | `handler.validate({ ..., queryType: 'raw' }).valid === true` 케이스 추가 |
| 7 | Frontend | `IntegrationSelector` staleTime 30초가 짧음 — 에디터 패널 빈번한 클릭 시 불필요한 API 재호출 | `integration-selector.tsx` — `staleTime: 30_000` | `staleTime: 5 * 60 * 1000` (5분)으로 조정 또는 전역 쿼리 캐시 공유 |
| 8 | Requirement | `token_expires_at` 만료 시 status가 즉시 갱신되지 않으면 만료 토큰으로 API 호출 시도 가능 | `integration-handler-base.ts:50` | 실행 시점에 `tokenExpiresAt` 보조 체크 또는 허용된 설계임을 주석으로 명시 |
| 9 | Documentation | `resolveUrl` JSDoc과 실제 구현 불일치 — "strips duplicate slashes"라고 명시하나 실제로는 접합부 슬래시만 처리 | `http-request.handler.ts:220–225` | JSDoc을 실제 동작에 맞게 수정 |
| 10 | Architecture | `ExecutionEngineModule` → `IntegrationsModule` 단방향 의존성 추가 — 향후 역방향 참조 추가 시 순환 의존 위험 | `execution-engine.module.ts:28` | 의존 방향 문서화, `IntegrationsModule`이 `ExecutionEngineModule`을 import하지 않도록 아키텍처 제약 명시 |
| 11 | Dependency | `follow-redirects` 전이 의존성 — 과거 CVE-2024-28849 이력 존재 (`1.15.11`이 현재 최신 패치) | `package-lock.json` | `npm audit` 실행 후 취약점 없음 확인 |
| 12 | Maintainability | `serviceTypes[0]` 암묵적 단수 사용 — prop이 배열이나 실제로는 첫 번째 원소만 사용 | `integration-selector.tsx:33–35` | prop을 `serviceType: string` 단수로 변경하거나 다중 타입 필요성 명문화 |
| 13 | Maintainability | `ALLOWED_QUERY_TYPES` 상수 미추출 — validate와 실행 간 허용 목록이 분산되어 유지보수 시 불일치 위험 | `database-query.handler.ts` | `const ALLOWED_QUERY_TYPES = ['select', 'insert', 'update', 'delete', 'raw'] as const` 추출 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| database | **HIGH** | DatabaseQueryHandler 커넥션 풀링 부재 (CRITICAL), connect() 실패 시 end() 미호출 |
| security | **MEDIUM** | SSRF 방어 없음, SSL 인증서 검증 비활성화, 에러 메시지 자격증명 노출 |
| performance | **MEDIUM** | DB 연결·SMTP Transporter·SlackWebClient 매 실행마다 재생성 |
| maintainability | **MEDIUM** | SendEmailHandler 중복 구현, 수동 핸들러 생성 패턴 |
| requirement | **MEDIUM** | SlackHandler file 파라미터 무시, IntegrationSelector 로딩 중 missing 오표시 |
| concurrency | **MEDIUM** | SlackWebClient rate-limit 조율 불가, PgClient 동시 연결 고갈 |
| architecture | **MEDIUM** | SendEmailHandler 불일치, NestJS DI 우회, paramsSerializer 전역 변경 |
| api_contract | **LOW** | getForExecution 인가 계층 부재, SendEmailHandler logUsage 계약 이중화 |
| testing | **LOW** | IntegrationHandlerBase 독립 테스트 없음, Slack upload_file execute 미검증 |
| side_effect | **LOW** | devDependency→production 승격, SendEmailHandler 공통 로직 누락 위험 |
| scope | **LOW** | paramsSerializer 전역 변경, http-request 기존 동작 변경 |
| dependency | **LOW** | follow-redirects CVE 이력 확인 필요, eventemitter3 버전 중복 |
| documentation | **LOW** | resolveUrl JSDoc 불일치, sendEmailHandler 설계 의도 미문서화 |

---

## 발견 없는 에이전트
없음 — 13개 에이전트 모두 발견사항을 보고함

---

## 권장 조치사항

1. **[즉시] `DatabaseQueryHandler` 커넥션 풀링 도입** — `pg.Pool`로 교체하고 `integrationId` 단위 캐싱 적용. `connect()` 실패 시 `end()` 누락 경로도 함께 수정
2. **[즉시] `SendEmailHandler`를 `IntegrationHandlerBase` 상속으로 리팩터링** — `safeLogUsage` 제거, `resolveIntegration()` / `this.logUsage()` 활용
3. **[긴급] HTTP Request Handler SSRF 방어 로직 추가** — RFC1918·링크로컬 주소 차단 및 리다이렉트 제어(`redirect: 'manual'`) 적용
4. **[긴급] PostgreSQL SSL 인증서 검증 활성화** — `ssl: 'require'` 시 `rejectUnauthorized: true` 설정
5. **[긴급] 에러 메시지 자격증명 sanitize** — catch 블록에서 외부 라이브러리 에러의 민감 필드(password, token) 제거 처리 추가
6. **[높음] `SlackHandler` WebClient 인스턴스 캐싱** — token을 키로 하는 Map 캐시로 rate-limit 조율 및 메모리 효율 개선
7. **[높음] `SlackHandler` `upload_file` file 파라미터 처리 구현** — validate에서 허용하는 `config.file` 실제 실행 로직 추가
8. **[높음] `IntegrationSelector` 로딩 중 `hasSavedButMissing` 오평가 수정** — `!isLoading` 조건 추가
9. **[중간] catch 블록 logUsage fire-and-forget 패턴 적용** — 원본 에러가 logUsage 실패에 삼켜지지 않도록 `.catch(() => {})` 처리
10. **[중간] `paramsSerializer` 전역 변경 회귀 검증** — 배열 파라미터를 사용하는 모든 엔드포인트 E2E 테스트 확인
11. **[중간] 핸들러 DI 구조 개선** — `NodeHandlerRegistry`에 핸들러 등록 위임 또는 NestJS Provider 등록으로 수동 인스턴스화 제거
12. **[낮음] `IntegrationUsageLog` 인덱스 존재 여부 확인** — `integrationId`, `workflowId` 컬럼 인덱스 마이그레이션 확인
13. **[낮음] 누락 테스트 추가** — `IntegrationHandlerBase` 독립 spec, SlackHandler `upload_file`/`update_message` execute 케이스, HTTP transport 실패 logUsage 케이스, DB `queryType: 'raw'` 허용 케이스
14. **[낮음] `npm audit` 실행** — `follow-redirects` CVE 이력 확인 및 취약점 없음 검증