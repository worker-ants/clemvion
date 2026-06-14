# Code Review 통합 보고서

리뷰 일시: 2026-06-14 15:22:11  
브랜치: claude/config-call-history-929994  
대상: §A.3 호출 이력 (execution source_ip/response_code 영속 + getUsage periodCounts + 프론트엔드 드로어)

---

## 전체 위험도

**MEDIUM** — TypeORM `setParameters()` 덮어쓰기 버그(데이터 오염 위험)와 X-Forwarded-For IP 스푸핑(인증 whitelist 우회 가능)이 런타임에서 실질 위험을 초래할 수 있다. 나머지는 WARNING/INFO 수준으로 즉각적인 서비스 장애 위험은 없다.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 데이터 오염 | `periodQb`에서 TypeORM `setParameters()`가 `.where()`에 바인딩된 `triggerIds` 파라미터를 덮어쓸 수 있음 — 기간 집계가 전체 테이블을 스캔해 타 워크스페이스 데이터를 포함할 수 있음. 테스트 mock이 이를 검출하지 못함 | `auth-configs.service.ts` 줄 577–591 (`periodQb`) | `setParameters` 대신 `.where` 두 번째 인자에 모든 파라미터를 한 번에 전달하거나 `setParameter`(단수) 사용 |
| W-2 | 보안 | `X-Forwarded-For` 첫 번째 IP를 신뢰하는 `extractClientIp`가 클라이언트 스푸핑에 취약 — 인증 IP whitelist 검증과 호출 이력 영속이 같은 값을 공유하므로 whitelist 우회 공격 가능 | `hooks.service.ts` — `extractClientIp(input.headers)` 사용 경로 | 배포 환경의 신뢰 프록시 홉 수 설정 후 오른쪽에서 역산한 IP 사용; 두 경로 공유 사실을 문서화 |
| W-3 | 보안 | `extractClientIp` 반환값을 IPv4/IPv6 형식 검증 없이 `Execution.source_ip`(VARCHAR 45)에 직접 영속 | `hooks.service.ts` — `sourceIp: clientIp ?? undefined` 전달 경로 | 정규표현식으로 IPv4/IPv6 형식 검증 추가; 유효하지 않으면 `null` 처리 |
| W-4 | 테스트 | `usage-drawer.test.tsx` — 비-HTTP 트리거의 `responseCode: 'failed'` 폴백값이 화면에 렌더됐는지 단언 누락 (§A.3 핵심 동작) | `usage-drawer.test.tsx` lines 1224–1240 | `expect(screen.getByText("failed")).toBeInTheDocument()` 단언 추가 (Status 배지 중복 시 `within` 스코핑 사용) |
| W-5 | 테스트 | `auth-configs.service.spec.ts` — `createQueryBuilder` mock이 `mockReturnValueOnce` 호출 순서에 강하게 결합되어 Promise.all 순서 변경 시 false-positive 통과 위험 | `auth-configs.service.spec.ts` lines 181–186 | 주석을 "현재 구현 순서 count→period→recent에 대응"으로 정정; 엄격 분리 원하면 QB별 terminal 메서드 식별 방식으로 mock 구성 |
| W-6 | 유지보수성 | `clientIp ?? undefined` 변환 패턴이 `handleWebhook`·`handleChatChannelWebhook` 두 메서드에 중복 — 변환 규칙 변경 시 양쪽 수정 필요 | `hooks.service.ts` diff line +1071, +1096 | `extractClientIp` 반환 타입을 `string \| undefined`로 통일하거나 소형 변환 함수 `toSourceIp()` 추출 |
| W-7 | 유지보수성 | `safeCount` 헬퍼가 `getUsage` 메서드 본문에 중첩 선언되어 재사용성·독립 테스트 불가 | `auth-configs.service.ts` — `getUsage` 내 `const safeCount` | 파일 상단 모듈 스코프(`USAGE_PERIOD_WINDOWS_MS` 근처)로 끌어올림 |
| W-8 | 유지보수성 | `BarChart` 데이터 배열 변환 로직이 JSX 트리 인라인에 위치해 가독성 저하, 매 렌더마다 새 배열 생성 | `authentication/page.tsx` BarChart `data={[...]}` | `useMemo`로 `periodChartData` 추출 |
| W-9 | 부작용 | `@ApiPropertyOptional` → `@ApiProperty` 변경으로 OpenAPI 스키마의 `lastUsedAt` `required` 여부 변경 — 자동 생성 클라이언트 regenerate 시 타입 변경 발생 가능 | `auth-config-response.dto.ts` — `AuthConfigDto.lastUsedAt`, `AuthConfigUsageDto.lastUsedAt` | `@ApiProperty({ nullable: true, required: false })` 명시 또는 TS 타입 `?` 제거로 선언과 문서 일치 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | 보안 | `response_code`는 서버 사이드 고정 상수 `"202"` 할당 — 인젝션 위험 없음 | `hooks.service.ts` — `WEBHOOK_ACCEPTED_RESPONSE_CODE` | 해당 없음 |
| I-2 | 보안 | TypeORM 파라미터 바인딩 사용 — SQL 인젝션 방어 적절 | `auth-configs.service.ts` QueryBuilder 전체 | 해당 없음 |
| I-3 | 보안 | `source_ip`가 API 응답·프론트엔드 UI에 노출 — 역할 기반 접근 제어 및 보존 정책 명문화 필요 | `auth-config-response.dto.ts`, `authentication/page.tsx` | `GET /api/auth-configs/:id/usage` 컨트롤러에 Admin+ 역할 가드 적용 여부 확인; 로그 보존 정책 spec 명시 |
| I-4 | 성능 | `getCount`(trigger_id IN + COUNT)와 `getRawOne`(COUNT FILTER 3종)이 같은 테이블을 별도 쿼리로 스캔 — `totalCalls`를 `getRawOne`에 통합하면 쿼리 1회 절감 (현재 Promise.all 병렬 실행이므로 레이턴시 영향 없음) | `auth-configs.service.ts` 변경 라인 422–452 | `getRawOne`에 `COUNT(*) AS total` 추가 통합 (우선순위 낮음) |
| I-5 | 성능 | `idx_execution_trigger_started`가 `(trigger_id, started_at DESC)` 순서라 `getCount`/`getRawOne` 집계 쿼리가 이 인덱스를 타지 않을 수 있음 | `V096__execution_source_ip_response_code.sql` 라인 67–69 | `trigger_id` 단독 인덱스 존재 여부 확인; 없으면 추가 또는 `EXPLAIN ANALYZE`로 검증 |
| I-6 | 성능 | `BarChart` `data` prop에 인라인 배열 리터럴 전달 — 배열 크기 3개 고정이라 성능 영향 미미 | `authentication/page.tsx` BarChart | `useMemo` memoize (W-8과 동일 조치) |
| I-7 | 데이터베이스 | `CREATE INDEX IF NOT EXISTS`에 `CONCURRENTLY` 없음 — execution 고빈도 write 환경에서 ShareLock으로 순간 write 차단 가능 | `V096__execution_source_ip_response_code.sql` 라인 70–72 | 무중단 배포 요구 시 `CREATE INDEX CONCURRENTLY`; Flyway 트랜잭션 내 불가이므로 별도 non-transactional 마이그레이션 분리 |
| I-8 | 요구사항 | `periodCounts` 집계가 `cancelled`/`failed`/`pending` 상태 실행 포함 — spec §A.3에 "호출 수" 기준 미정의 | `auth-configs.service.ts` 줄 576–591 | spec에 "호출 수" 기준(모든 status vs 특정 subset) 명확히 기술 권장 |
| I-9 | API 계약 | `responseCode` 필드가 HTTP 코드(`'202'`)와 status enum(`'failed'` 등) 폴백을 혼용 — 타입이 `string`으로만 선언되어 소비자 혼란 소지 | `auth-config-response.dto.ts` lines 549–554 | 가능한 값 enum을 `@ApiProperty`에 명시하거나 프론트엔드 레이어에서 폴백 변환 처리 |
| I-10 | API 계약 | `recentCalls` 최대 20건 제한이 Swagger description에 미기술 — 소비자가 페이지네이션 여부 오해 가능 | `auth-config-response.dto.ts` `AuthConfigUsageDto.recentCalls` | `@ApiProperty({ description: 'Up to 20 most recent executions, ordered by startedAt DESC.' })` 추가 |
| I-11 | 문서화 | `AuthConfigUsagePeriodCountsDto` 필드에 롤링 윈도 vs 캘린더 버킷 구분 Swagger description 미기술 | `auth-config-response.dto.ts` `AuthConfigUsagePeriodCountsDto` | `@ApiProperty({ description: 'Rolling 24-hour window count (not calendar day).' })` 등 추가 |
| I-12 | 문서화 | `Execution` 엔티티 `sourceIp`/`responseCode` 프로퍼티와 `ExecuteOptions` 필드의 `//` 주석이 `/** */` JSDoc이 아니라 IDE hover 미표시 | `execution.entity.ts`, `execution-engine.service.ts` | `//` → `/** */` 변환 |
| I-13 | 테스트 | `safeCount` 음수 방어(`n < 0`) 및 `NaN` 방어 경로의 직접 단위 테스트 부재 | `auth-configs.service.ts` — `safeCount` 함수 | `period: { last24h: '-1', last7d: 'NaN', last30d: '0' }` 픽스처 추가로 방어 분기 단언 |
| I-14 | 테스트 | 프론트엔드 recharts stub 사용으로 BarChart `data` prop의 숫자 값(2, 5, 7) 바인딩 검증 불가 | `usage-drawer.test.tsx` lines 1242–1249 | stub의 `BarChart`가 `data` prop을 JSON으로 렌더하도록 변경해 숫자 값 단언 (현재 수준도 crash 방지로는 충분) |
| I-15 | 테스트 | e2e 레벨에서 source_ip/response_code 컬럼이 브라우저에 렌더되는지 시나리오 없음 | plan — `TEST WORKFLOW` 체크박스 미완 | authentication e2e에 usage drawer 열고 컬럼 헤더 존재 단언 1건 추가 권장 |
| I-16 | 유저 가이드 | 인증 설정 호출 이력(§A.3) 전용 유저 가이드 MDX 페이지 미존재 (신규 문서 미작성) | `codebase/frontend/src/content/docs/06-integrations-and-config/` | `authentication.mdx` + `authentication.en.mdx` 신설해 §A.3 사용법 기술; plan에 후속 항목 추가 |
| I-17 | 범위 | `recharts` import 추가 — `package.json` dependencies 포함 여부 확인 필요 | `authentication/page.tsx` | `package.json` 확인; 없으면 런타임 오류 |
| I-18 | 부작용 | `usageData.periodCounts` 접근이 조건 가드 없이 직접 참조될 경우 런타임 오류 가능성 | `authentication/page.tsx` diff line +1456–1468 | `usageData?.periodCounts?.last24h ?? 0` 형태로 optional chaining 적용 권장 |

---

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| SD-1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/6-config.md §A.3` 표가 `기간별 호출 수`, `소스 IP`, `응답 코드`를 여전히 `🚧 미구현 (Planned)`으로 표기 — 코드는 완전 구현됨 | `spec/2-navigation/6-config.md §A.3` 줄 101–102 | 코드 유지 + spec 반영: 표 3행 구현 열을 ✅로 갱신 + `/usage` 응답 shape 추가. `project-planner` 위임 |
| SD-2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/1-data-model.md §2.13 Execution` 필드 표에 `source_ip VARCHAR(45)`·`response_code VARCHAR(10)` 컬럼 미등재 — V096 마이그레이션 및 엔티티에는 반영됨 | `spec/1-data-model.md §2.13` 줄 453–475 | 코드 유지 + spec 반영: 두 컬럼 행 추가 + AuthConfig 호출 집계 경로 절 추가. `project-planner` 위임 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | TypeORM `setParameters()` 덮어쓰기 버그(W-1); SPEC-DRIFT 2건(SD-1, SD-2) |
| security | MEDIUM | X-Forwarded-For IP 스푸핑(W-2); source_ip 입력 검증 부재(W-3) |
| testing | LOW | `responseCode: 'failed'` 폴백 렌더 단언 누락(W-4); QB mock 순서 결합(W-5) |
| maintainability | LOW | `clientIp ?? undefined` 중복(W-6); `safeCount` 인라인 선언(W-7); BarChart 인라인 배열(W-8) |
| side_effect | LOW | `@ApiPropertyOptional` → `@ApiProperty` OpenAPI 스키마 변경(W-9); `periodCounts` 필드 추가는 additive |
| performance | LOW | `totalCalls`/`periodCounts` 별도 쿼리 중복 스캔(I-4); 인덱스 적용 범위 확인(I-5) |
| api_contract | LOW | `responseCode` 의미 혼합(I-9); `recentCalls` 페이지네이션 부재 문서화(I-10) |
| database | LOW | `CREATE INDEX CONCURRENTLY` 미사용 — 고빈도 write 환경 ShareLock 주의(I-7) |
| documentation | LOW | Swagger description 미흡 2건(I-10, I-11); JSDoc vs `//` 불일치(I-12) |
| user_guide_sync | LOW | §A.3 전용 유저 가이드 MDX 페이지 미작성(I-16); i18n ko/en parity 완전 충족 |
| scope | NONE | 범위 이탈 없음 |
| concurrency | NONE | 동시성 문제 없음; `Promise.all` 패턴 올바름 |

---

## 발견 없는 에이전트

- **scope**: 16개 파일 변경 전체가 §A.3 호출 이력 구현 범위 내. 범위 이탈 없음.
- **concurrency**: `Promise.all` 병렬 쿼리, `Date.now()` 단일 캡처, async/await 패턴 모두 올바름. 동시성 문제 없음.

---

## 권장 조치사항

1. **[즉시 필수]** `periodQb`의 `setParameters()` 호출을 `.where()` 인자 통합 방식으로 교체 (W-1) — 데이터 오염 버그, 테스트 mock이 감지 못함
2. **[즉시 필수]** `extractClientIp`의 신뢰 프록시 홉 수 설정 및 마지막 신뢰 IP 사용 방식으로 개선 (W-2) — 인증 whitelist 우회 가능
3. **[권장]** `source_ip` 저장 전 IPv4/IPv6 형식 정규표현식 검증 추가 (W-3)
4. **[권장]** `usage-drawer.test.tsx`에 `responseCode: 'failed'` 렌더 단언 추가 (W-4)
5. **[권장]** `auth-configs.service.spec.ts` `createQueryBuilder` mock 주석 정정 — 순서 의존성 명시 (W-5)
6. **[권장]** `clientIp ?? undefined` 중복 패턴 공통 함수로 추출 (W-6); `safeCount` 모듈 스코프로 이동 (W-7); BarChart 데이터 `useMemo` 처리 (W-8)
7. **[후속]** SPEC-DRIFT 2건(SD-1, SD-2) — `spec/2-navigation/6-config.md §A.3` 표·`spec/1-data-model.md §2.13` 갱신. `project-planner` 위임
8. **[후속]** `@ApiPropertyOptional` → `@ApiProperty` 변경으로 인한 OpenAPI 스키마 `required` 불일치 해소 (W-9)
9. **[후속]** Swagger description 보완: `periodCounts` 롤링 윈도 명시, `recentCalls` 20건 제한 명시 (I-10, I-11)
10. **[후속]** §A.3 전용 유저 가이드 MDX 페이지 신설 (I-16); e2e 시나리오 1건 추가 (I-15)

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (12명): `security`, `performance`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `concurrency`, `api_contract`, `user_guide_sync`
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 선별 제외 |
  | dependency | 라우터 선별 제외 |

- **강제 포함 (router_safety)** (8명): `database`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`