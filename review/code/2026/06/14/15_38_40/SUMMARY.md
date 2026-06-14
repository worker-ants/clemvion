# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — X-Forwarded-For 기반 IP 추출 신뢰 경로와 `ExecuteOptions` 유니온 타입 판별 구조 취약성이 주된 위험. 기능 정합성은 전 레이어에 걸쳐 spec §A.3과 완전히 일치하며, Critical 발견사항은 없음.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Security | X-Forwarded-For 헤더 조작 가능성 — `extractClientIp` 결과를 인증 IP Whitelist 검증과 호출 이력 로깅에 공용 재사용. 리버스 프록시 없이 직접 노출 시 조작된 IP로 whitelist 우회 가능 | `hooks.service.ts` L133, L238; `extractClientIp` | whitelist 검증용은 rightmost-trusted/고정 홉 offset 방식으로 분리. 로깅용과 인증용 IP 추출 로직 분리 검토 |
| W-2 | Security | `sourceIp` 형식 검증 없음 — `string \| undefined` 타입으로 검증 없이 DB에 저장. DB `VARCHAR(45)` 가 유일한 가드 | `execution-engine.service.ts` L776-791; `execution.entity.ts` L821-822 | `net.isIP()` 등으로 IPv4/IPv6 형식 검증 추가 또는 ExecuteOptions 레이어에서 길이·형식 체크 |
| W-3 | Security | `responseCode` 타입이 `string`으로 열려 있어 향후 임의 문자열 전달 가능성 | `execution-engine.service.ts` L778-781 | `'202' \| '400' \| '401' \| '410'` 등 리터럴 유니온으로 타입 제한 또는 `/^\d{3}$/` 형식 검증 추가 |
| W-4 | Architecture | `getUsage` 서비스 메서드 반환 타입이 인라인 익명 객체 — 서비스·프레젠테이션 레이어 간 계약 암묵적 | `auth-configs.service.ts` L391-406 | `AuthConfigUsageResult` 등 별도 인터페이스 선언. 컨트롤러에서 명시적 DTO 매핑 |
| W-5 | Architecture | `ExecuteOptions` 유니온 타입에서 `triggerId` variant 판별을 `'in'` 연산자에 의존 — 타입 안전성 경계 취약. 복잡도 누적 | `execution-engine.service.ts` L558-766 | discriminated union(`kind: 'trigger'\|'manual'\|'rerun'`) 패턴으로 전환 권장 |
| W-6 | Architecture | `authentication/page.tsx` God Component 문제 지속 심화 — 이번 PR에서 차트·컬럼 추가로 재확장 | `authentication/page.tsx` L931-1544 | `UsagePeriodChart`, `UsageCallRow` 컴포넌트 분리. God Component 분리 후속 우선순위 "저"→"중" 상향 검토 |
| W-7 | Performance | `totalCalls(getCount)`와 `periodCounts(getRawOne)` 두 쿼리가 동일 파티션 중복 스캔 | `auth-configs.service.ts` `getUsage()` Promise.all 블록 | `getRawOne`에 `COUNT(*) AS total` 추가 선택하여 `getCount` 쿼리 제거, DB 왕복 3→2회 절감 |
| W-8 | Performance | `recentCalls` 쿼리의 `innerJoinAndSelect`가 Trigger 전체 엔티티 로드 — 사용 필드는 `name` 하나뿐 | `auth-configs.service.ts` `getUsage()` recentQb | `innerJoin` + `addSelect('t.name', 't_name')`으로 필요 컬럼만 select |
| W-9 | Maintainability | `getUsage` 내 인라인 QB 체인 3개 — 트리거 조회·DB 쿼리 조립·결과 매핑 3개 책임 혼재 | `auth-configs.service.ts` L431-481 | `buildCountQuery`, `buildPeriodQuery`, `buildRecentQuery` private 메서드로 분리 |
| W-10 | Maintainability | `USAGE_PERIOD_WINDOWS_MS` 리터럴 산술 반복(`24*60*60*1000` 패턴 3회) — 의도 파악에 직접 계산 필요 | `auth-configs.service.ts` L351-355 | `const DAY_MS = 24 * 60 * 60 * 1000;` 기본 단위 상수 정의 후 `last7d: 7 * DAY_MS` 등으로 표기 |
| W-11 | Maintainability | 테스트의 `mockReturnValueOnce` 순서 의존성 — 주석은 "순서 비의존"이라 명시하나 실제로는 호출 순서에 의존(모순) | `auth-configs.service.spec.ts` L181-185 | 주석을 "Promise.all 인자 순서(count→period→recent)와 mockReturnValueOnce 순서를 일치시켜야 함"으로 수정 |
| W-12 | Maintainability | `BarChart` data prop에 인라인 배열 리터럴 — 렌더마다 새 배열 객체 생성 | `authentication/page.tsx` L1456-1469 | `useMemo(() => [...], [usageData.periodCounts, t])`로 추출 |
| W-13 | Testing | `hooks.service.spec`은 `sourceIp: undefined` 전달을 단언하나, `execution-engine.service.spec`의 NULL 케이스는 키 자체를 omit — 양 spec 간 shape 불일치 | `hooks.service.spec.ts` L900; `execution-engine.service.spec.ts` | `execution-engine.service.spec`에 `{ triggerId: 'trg-sched', sourceIp: undefined }` 케이스 추가하여 동등성 명시 커버 |
| W-14 | Testing | `getUsage` — `totalCalls`와 `recentCalls` 불일치(빈 배열) 시나리오 미테스트 | `auth-configs.service.spec.ts` `getUsage` describe 블록 | `recentCalls: []`, `totalCalls=5` 케이스 추가하여 독립 반환 검증 |
| W-15 | Documentation | `WEBHOOK_ACCEPTED_RESPONSE_CODE` 두 호출 지점에 인증 실패 시 row 미생성 제약 조건 미명시 — 향후 실패 경로 혼동 가능성 | `hooks.service.ts` `handleWebhook`, `handleChatChannelWebhook` 호출 지점 | "execute() 도달 = 인증/검증 성공 보장이므로 항상 202" 한 줄 인라인 주석 추가 |
| W-16 | Documentation | `AuthConfigUsageCallDto.responseCode` `@ApiProperty` description이 한국어 전용 — Swagger 영어 독자 혼란. 폴백 예시(`'failed'` 등) 없음 | `auth-config-response.dto.ts` L539-548 | description 영어 통일 또는 영·한 병기. `examples` 배열에 폴백 예시 추가 |
| W-17 | Side Effect | `getUsage` 반환 타입 확장 — 기존 API 소비자에 `periodCounts` 신규 필수 키 포함. 구형 클라이언트의 런타임 접근 에러 가능성 | `auth-configs.service.ts` `getUsage()` 반환; `AuthConfigUsageDto` | 프론트엔드 `usageData.periodCounts?.last24h ?? 0` 등 방어 코드 검토. 계약 변경을 체인지로그에 명시 |
| W-18 | Side Effect | `ExecuteOptions` `triggerId` variant 확장 — `hooks.service` 외 다른 호출자가 `sourceIp`/`responseCode` 누락 시 DB NULL 저장 인식 못할 가능성 | `execution-engine.service.ts` `ExecuteOptions` 타입 | `triggerId` variant 호출 경로(재실행·체인) 전수 조사하여 누락 없는지 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Security | `getUsage` 인가 검증 — `workspaceId`가 JWT 클레임에서 추출되는지 controller 레이어 확인 필요 | `auth-configs.service.ts` L407-408 | Controller에서 `workspaceId`를 인증된 세션에서만 읽도록 강제 여부 확인 |
| I-2 | Security | `source_ip` API 응답 노출 — GDPR/개인정보보호법 관점 PII 해당 가능성 | `auth-config-response.dto.ts` L534-536; `authentication/page.tsx` L1533-1534 | 개인정보 정책 검토 후 IP 마스킹(`203.0.113.xxx`) 또는 저장 시 해시 처리 고려 |
| I-3 | Security | `COUNT(*) FILTER` PostgreSQL 전용 문법 — 파라미터 바인딩 올바름, 보안 이슈 없음 | `auth-configs.service.ts` L440-452 | 추가 조치 불필요 |
| I-4 | Performance | `extractClientIp` 각 메서드 1회씩 호출 — 현재 구조 적절, 향후 외부 API 호출 시 캐싱 고려 | `hooks.service.ts` L133, L238 | 현행 유지 |
| I-5 | Performance | `USAGE_PERIOD_WINDOWS_MS` 상수 모듈 로드 시 단 한 번 평가 — 런타임 오버헤드 없음 | `auth-configs.service.ts` L351-356 | 없음 |
| I-6 | Performance | V096 파셜 인덱스 설계 — `WHERE trigger_id IS NOT NULL` 최적화 적절 | `V096__execution_source_ip_response_code.sql` | 없음 |
| I-7 | Performance | `safeUsageCount`의 `Number(raw ?? 0)` — 기능 영향 없는 스타일 이슈 | `auth-configs.service.ts` L361-364 | `Number(raw ?? '0')` 또는 `raw == null ? 0 : Number(raw)` 허용 |
| I-8 | Architecture | `safeUsageCount` 파일 로컬 함수 — 다른 서비스 재사용 시 별도 util로 이동 고려 | `auth-configs.service.ts` L361-364 | `shared/utils/db-utils.ts` 이동 중기 검토 |
| I-9 | Architecture | `response_code VARCHAR(10)` — webhook HTTP 코드 vs NULL 혼재, 의도된 설계 | `V096 migration` L57; `execution.entity.ts` L824-830 | 현행 유지. 확장 시 `source_type ENUM` 컬럼 추가 고려 |
| I-10 | Architecture | `WEBHOOK_ACCEPTED_RESPONSE_CODE` hooks.service 로컬 상수 — 향후 다른 서비스에서 재정의 가능성 | `hooks.service.ts` L1031 | 중기적으로 `shared/constants/webhook.constants.ts` 이동 검토 |
| I-11 | Architecture | `handleChatChannelWebhook` `clientIp` 추출 위치 — 인증 실패 조기 분기보다 앞에 위치 | `hooks.service.ts` L238 | IP 추출을 미들웨어/인터셉터로 올려 `WebhookInput`에 포함시키는 장기 개선 검토 |
| I-12 | Requirement | `safeUsageCount` 정수 절삭 미적용 — DB COUNT 한정 실용 무해 | `auth-configs.service.ts` L45-47 | `Math.floor(n)` 추가 또는 "DB COUNT 한정" 주석 명시 |
| I-13 | Requirement | `periodQb` `.where()` + `.setParameters()` 분리 호출 — 동작 올바름, 가독성 이슈 | `auth-configs.service.ts` L586-600 | 단일 `.where('...', { triggerIds, since24h, ... })` 통합 권장 |
| I-14 | Requirement | `clientIp ?? undefined` 중복 표현 — `sourceIp: clientIp`로 단순화 가능 | `hooks.service.ts` L183, L609 | `sourceIp: clientIp`로 변경 (동작 동일) |
| I-15 | Requirement | spec §A.3 전체 구현 완전 일치 확인 (totalCalls, periodCounts, recentCalls, sourceIp, responseCode, BarChart, i18n) | 전 레이어 | 없음 |
| I-16 | Database | COUNT FILTER 집계 PostgreSQL 전용 문법 — 현 코드베이스 단일 DB 기준 문제 없음 | `auth-configs.service.ts` periodQb | 향후 DB 교체 시 `SUM(CASE WHEN...)` 대체 |
| I-17 | Database | periodQb에 `started_at` 하한 WHERE 조건 없음 — 현재 INFO, 대용량 시 범위 스캔 비효율 | `auth-configs.service.ts` periodQb | `.andWhere('e.started_at >= :since30d', ...)` 추가로 인덱스 범위 최소화 (대용량 대비 선제 적용 권장) |
| I-18 | Database | nullable 컬럼 ADD COLUMN — PG11+ 무중단 안전, 기존 row NULL, 멱등 인덱스 생성 | `V096 migration` | 없음 |
| I-19 | Concurrency | Promise.all 독립 QB 분리, `now` 단일 캡처 — 설계 적절 | `auth-configs.service.ts` `getUsage()` | 없음 |
| I-20 | Testing | 마이그레이션 자체 단위 테스트 없음 — 프로젝트 관행상 허용 | `V096 migration` | 없음 |
| I-21 | Testing | `safeUsageCount` NaN/음수 경로 직접 커버 없음 | `auth-configs.service.ts` | `periodRaw.last24h = 'abc'` 시나리오 케이스 추가 선택적 권장 |
| I-22 | Testing | 프론트엔드 `periodCounts` 실제 숫자 렌더링 미검증 — recharts passthrough stub 한계 | `usage-drawer.test.tsx` L1239-1246 | recharts stub에서 `BarChart` data prop 캡처 또는 XAxis label 단언 추가 |
| I-23 | Testing | 프론트엔드 `recentCalls: []` 빈 배열 케이스 미테스트 | `usage-drawer.test.tsx` | `recentCalls: []`, `periodCounts: {0,0,0}` 케이스 추가 |
| I-24 | API Contract | `responseCode` semantic overloading — HTTP 코드 vs status enum 혼재. spec 명시 설계이나 클라이언트 혼동 가능 | `auth-config-response.dto.ts`; `auth-configs.service.ts` L482-483 | 중장기적으로 `responseCodeType: 'http' \| 'status'` 필드 추가 또는 OpenAPI `oneOf` 힌트 검토 |
| I-25 | API Contract | `recentCalls` 고정 20건 — 향후 "전체 이력" 기능 시 별도 엔드포인트 필요 | `auth-configs.service.ts` `USAGE_RECENT_CALLS_LIMIT` | Swagger 설명에 이미 기재됨. 추후 별도 pagination 엔드포인트 분리 |
| I-26 | Side Effect | `recharts` named import — tree-shaking 없이 authentication 페이지 번들에 포함 | `authentication/page.tsx` L1409-1417 | `dynamic import` + `ssr: false` 로 초기 번들 제외 고려 |
| I-27 | Maintainability | `clientIp ?? undefined` 패턴 — 의도 파악에 타입 선언 역추적 필요 | `hooks.service.ts` L1063, L1088 | 인라인 주석 한 줄 추가 |
| I-28 | Maintainability | `margin={{ top: 4, right: 4, left: -20, bottom: 0 }}` 매직 넘버 | `authentication/page.tsx` L1471 | `const CHART_MARGIN = ...` 명명 또는 `/* hide default YAxis gap */` 주석 |
| I-29 | User Guide | `GET /api/auth-configs/:id/usage` 응답 shape 확장 — 관련 user-guide MDX 페이지 PR 이전부터 미존재 (stale 아님) | `auth-config-response.dto.ts` | 향후 user-guide 신설 시 새 API shape·UI 동작 함께 문서화 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | X-Forwarded-For IP 조작 가능성, sourceIp/responseCode 형식 검증 부재 |
| architecture | MEDIUM | getUsage 반환 타입 익명 객체, ExecuteOptions 유니온 판별 취약, God Component 심화 |
| performance | LOW | totalCalls/periodCounts 중복 스캔, innerJoinAndSelect 과다 로드 |
| requirement | LOW | INFO 수준 코드 스타일 이슈만, spec §A.3 전 항목 일치 |
| side_effect | LOW | API 응답 확장 소비자 영향, ExecuteOptions 확장 호출자 누락 가능성 |
| maintainability | LOW | QB 체인 다중 책임, 테스트 순서 의존성 모순, BarChart 인라인 배열 |
| testing | LOW | hooks/engine spec 간 sourceIp shape 불일치, 빈 배열 케이스 누락 |
| documentation | LOW | WEBHOOK_ACCEPTED_RESPONSE_CODE 호출 지점 제약 조건 미명시, DTO description 한국어 전용 |
| database | LOW | periodQb started_at 하한 조건 없음(대용량 위험), PostgreSQL 전용 문법 |
| concurrency | NONE | Promise.all 독립 QB, now 단일 캡처 — 이슈 없음 |
| api_contract | LOW | responseCode semantic overloading, 입력 검증 부재 |
| scope | NONE | 의도를 벗어난 수정 없음, 전 변경 §A.3 목적 내 |
| user_guide_sync | NONE | i18n parity 완전 충족, user-guide 미존재는 pre-existing |

## 발견 없는 에이전트

- **concurrency** — Node.js 단일 스레드 환경에서 경쟁 조건·데드락·이벤트 루프 블로킹 없음. Promise.all 설계 적절.
- **scope** — 의도치 않은 리팩토링·무관 파일 수정·포맷팅 오염 전혀 없음.
- **user_guide_sync** — 신규 i18n 7개 키 ko/en parity 완전 충족. user-guide MDX 미존재는 PR 이전부터의 pre-existing 상태.

## 권장 조치사항

1. **[W-1] X-Forwarded-For IP 신뢰 경로 검증** — `extractClientIp` 구현이 리버스 프록시 환경(trusted proxy CIDR, 홉 수)을 올바르게 처리하는지 확인. 인증 whitelist 검증용과 로깅용 IP 추출 로직 분리 여부 검토.
2. **[W-2, W-3] sourceIp / responseCode 형식 검증 추가** — `net.isIP()`로 IPv4/IPv6 형식 검증, responseCode는 3자리 숫자 문자열 형식 검증 추가. DB VARCHAR 제약에만 의존하지 않는 명시적 400 응답 처리.
3. **[W-13] hooks.service / execution-engine.service spec 간 sourceIp shape 불일치 해소** — `{ triggerId, sourceIp: undefined }` 케이스를 execution-engine spec에 추가하거나, hooks.service가 키 자체를 omit하도록 통일.
4. **[W-18] ExecuteOptions triggerId variant 다른 호출자 전수 조사** — `hooks.service` 외 재실행·체인 실행 경로에서 `sourceIp`/`responseCode` 누락 없는지 확인.
5. **[W-4] getUsage 반환 타입 명시** — `AuthConfigUsageResult` 인터페이스 선언으로 서비스·프레젠테이션 레이어 간 계약 명시화.
6. **[W-7] totalCalls + periodCounts 쿼리 통합** — `getRawOne`에 `COUNT(*) AS total` 추가 선택하여 DB 왕복 1회 절감.
7. **[W-15, W-16] 문서 보완** — `WEBHOOK_ACCEPTED_RESPONSE_CODE` 호출 지점에 "인증 실패 = row 미생성" 제약 주석. `@ApiProperty` description 영어 통일 및 폴백 예시 추가.
8. **[W-6] God Component 분리 우선순위 상향 검토** — `UsagePeriodChart`, `UsageCallRow` 컴포넌트 추출. plan 후속 항목 "저"→"중" 재검토.
9. **[W-10, W-12] 유지보수성 개선** — `DAY_MS` 기본 단위 상수 정의, `BarChart` data `useMemo` 추출.
10. **[I-17] periodQb started_at 하한 WHERE 조건 추가** — 대용량 테이블 대비 선제 적용 권장 (`e.started_at >= since30d`).

## 라우터 결정

라우터가 선별 실행 (`routing_status=done`):

- **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (13명)
- **제외**: `dependency` (1명)
- **강제 포함(router_safety)**: `database`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명)

| 제외된 reviewer | 이유 |
|------------------|------|
| dependency | 라우터에 의해 생략 (이번 변경에 외부 패키지 신규 추가·버전 변경 없음으로 판단) |