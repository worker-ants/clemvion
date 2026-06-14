# Code Review 통합 보고서

대상 브랜치: `claude/config-call-history-929994`
검토 일시: 2026-06-14 15:02
검토 범위: §A.3 호출 이력 구현 — Execution.source_ip / response_code 컬럼 추가, getUsage periodCounts, 프론트엔드 BarChart

---

## 전체 위험도

**MEDIUM** — 기능 완성도는 높으나, X-Forwarded-For 무조건 신뢰(보안), DB 복합 인덱스 부재(성능), API 계약 혼재(responseCode 의미 이중성, sourceIp DTO optional 불일치), QB mock 공유(테스트 신뢰도) 등 다수 WARNING 이 존재한다. Critical 발견사항은 없다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | Security | `X-Forwarded-For` 헤더 첫 번째 값 무조건 신뢰 — IP Whitelist 인증 우회 및 감사 로그 위조 가능. 인증 IP whitelist 검증과 호출 이력 영속이 동일 `extractClientIp` 결과를 공용하므로 심각도 상승 | `hooks.service.ts` — `extractClientIp` 호출 경로; `hooks.service.spec.ts` L965 | (1) 신뢰 프록시 목록(`TRUSTED_PROXIES`) 기반으로 IP 체인을 역방향 검증. (2) 인증용 IP 추출과 로깅용 IP 추출 경계 분리. (3) 배포 가이드에 "앱 서버는 신뢰된 LB 뒤에만 노출" 요건 명시 |
| W-2 | Security | `source_ip` 컬럼에 IP 형식 검증 없음 — 비정상 헤더로 임의 문자열 저장 가능. React JSX 가 HTML 인젝션 기본 차단하나, 향후 CSV 내보내기·이메일 출력 경로 추가 시 XSS/주입 리스크 | `V096` 마이그레이션(VARCHAR(45) 제약만), `execution.entity.ts` (`length: 45`) | `extractClientIp` 반환값에 `ip-address` 라이브러리(`Address4`/`Address6`) 파싱 검증 추가, 실패 시 `null` 처리 |
| W-3 | Security / API Contract | `response_code` 에 비-HTTP 트리거의 status enum 값(`'completed'`, `'failed'` 등)이 폴백으로 노출 — DTO `@ApiProperty` 에는 HTTP 코드 문자열로 문서화되어 있어 계약 위반 및 내부 상태 정보 누출 | `auth-configs.service.ts` L358 — `e.responseCode ?? e.status`; `auth-config-response.dto.ts` | `responseCode: string \| null` (HTTP 코드 전용, nullable) + 별도 `status` 필드로 분리하거나, `@ApiProperty description` 에 폴백 동작 명시 |
| W-4 | Performance | `getUsage` 내 DB 쿼리 3개(`getCount` / `getRawOne` / `getMany`) 직렬 순차 실행 — 각 쿼리가 독립적이므로 불필요한 레이턴시 발생 | `auth-configs.service.ts` — `getUsage` 메서드 (~L521–590) | `Promise.all([getCount, getRawOne, getMany])` 병렬화 |
| W-5 | Performance / Database | `execution` 테이블에 `(trigger_id, started_at)` 복합 인덱스 부재 — `trigger_id IN (...)` + `started_at >=` 범위 스캔 비용 증가 우려. V096 마이그레이션에 인덱스 추가 없음 | `V096` 마이그레이션; `auth-configs.service.ts` periodCounts / recentCalls 쿼리 | `CREATE INDEX IF NOT EXISTS idx_execution_trigger_started ON execution (trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL;` 추가 |
| W-6 | Architecture | `AuthConfigsService` 가 `Execution` / `Trigger` 엔티티 리포지토리에 직접 의존 — 도메인 경계 위반. 이번 변경으로 결합도 추가 심화 | `auth-configs.service.ts` (`@InjectRepository(Execution)`) 전체 | `ExecutionsService` 또는 `UsageQueryService`에 `getUsageForAuthConfig` 위임. 단기 불가 시 QueryBuilder 로직을 private helper 로 분리 |
| W-7 | Architecture | `ExecuteOptions` 유니온의 `triggerId` variant 에 HTTP 전용 필드(`sourceIp?`, `responseCode?`)가 혼재 — ISP 위반. schedule·manual 트리거에서도 시야에 노출 | `execution-engine.service.ts` L558-685 | `WebhookTriggerOptions` / `ScheduleTriggerOptions` 로 분리하거나 `triggerType` 판별자 추가 |
| W-8 | Architecture | `authentication/page.tsx` (God Component)에 BarChart 로직 50+ 라인 인라인 추가 — SRP 추가 위반 | `authentication/page.tsx` L1426-1490 | `AuthConfigUsagePeriodChart` 컴포넌트로 추출, God Component 분리 후속 작업 시 함께 이동 |
| W-9 | Maintainability / Side Effect | `handleChatChannelWebhook` 에서 `extractClientIp` 인라인 재호출 — `handleWebhook` 의 `const clientIp` 공용 변수 패턴과 불일치. 향후 `extractClientIp` 에 부수효과 추가 시 회귀 위험 | `hooks.service.ts` L599 | `handleChatChannelWebhook` 상단에 `const clientIp = extractClientIp(input.headers)` 추출 후 `sourceIp: clientIp ?? undefined` 로 통일 |
| W-10 | API Contract | `sourceIp` DTO 가 `@ApiPropertyOptional` + `?` (optional) 이나 서비스는 항상 `string \| null` 반환 — OpenAPI 스키마와 런타임 동작 불일치 | `auth-config-response.dto.ts` L479-481; `auth-configs.service.ts` L356 | `@ApiProperty({ nullable: true })` + `sourceIp: string \| null` (non-optional) 으로 변경 |
| W-11 | Testing | `makeExecutionRepo` 가 단일 `qb` 객체를 3회 공유 — `getCount`/`getRawOne`/`getMany` 간 mock 구분 불가, 쿼리별 파라미터 혼용·순서 오류를 테스트가 검출 못 함 | `auth-configs.service.spec.ts` L763-775 | `createQueryBuilder` mock 을 `mockReturnValueOnce(countQb).mockReturnValueOnce(periodQb).mockReturnValueOnce(recentQb)` 로 분리 |
| W-12 | Testing | chat-channel 경로에서 XFF 헤더 있는 케이스 테스트 누락 — webhook 경로 대칭 테스트 없음 | `hooks.service.spec.ts` L580-612 (chat-channel §A.3 블록) | chat-channel 그룹에 `x-forwarded-for` 헤더 포함 케이스 1건 추가 |
| W-13 | Maintainability | `getUsage` 반환 타입이 메서드 시그니처에 복잡한 인라인 객체 리터럴로 선언 — DTO 클래스 이중 유지 필요 | `auth-configs.service.ts` getUsage 시그니처 | named interface 로 분리하거나 기존 DTO 타입 재사용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I-1 | Security | `triggerIds` 배열 크기 무제한 — 수천 개 트리거 시 대형 IN 절 가능 | `auth-configs.service.ts` — `WHERE e.trigger_id IN (:...triggerIds)` | 합리적 상한(예: 1000) 또는 JOIN 서브쿼리로 대체 |
| I-2 | Security | `Number(periodRaw?.last24h ?? 0)` 에 NaN 방어 없음 — DB 드라이버 비정상 반환 시 JSON `null` 직렬화 | `auth-configs.service.ts` — periodRaw 파싱 | `isNaN(n) \|\| n < 0 ? 0 : n` 방어 코드 추가 |
| I-3 | SPEC-DRIFT | [SPEC-DRIFT] `spec/1-data-model.md §2.13` Execution 테이블에 `source_ip`, `response_code` 컬럼 미등재 — V096 구현 완료, spec 반영 누락 | `spec/1-data-model.md §2.13` | 코드 유지 + spec에 두 컬럼 행 추가 (project-planner 위임) |
| I-4 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/6-config.md §A.3` 표가 "미구현(Planned)" 로 표기 — 이번 PR 구현 완료 | `spec/2-navigation/6-config.md §A.3` L101-102 | 코드 유지 + 기간별 호출 수·소스IP·응답코드 항목 ✅ 승격, Planned 설명 제거 (project-planner 위임) |
| I-5 | Performance | `totalCalls`(`getCount`)와 `periodCounts`(`getRawOne`)를 단일 `COUNT(*) FILTER` 쿼리로 병합 가능 — DB 왕복 1회 절감 | `auth-configs.service.ts` getUsage | `COUNT(*) AS total, COUNT(*) FILTER (WHERE ...) AS last24h ...` 단일 쿼리로 통합 |
| I-6 | Performance | 프론트엔드 BarChart `data` 배열 렌더링마다 새 객체 생성 | `authentication/page.tsx` L1432 | `useMemo` 로 메모이즈 (`[usageData.periodCounts, t]` 의존) |
| I-7 | Architecture | `response_code VARCHAR(10)` — status enum 폴백값 저장 경로 없으나, 향후 코드가 직접 저장 시 `WAITING_FOR_INPUT`(17자) 잘림 위험 | `V096` 마이그레이션 L57; `execution.entity.ts` L748 | 마이그레이션 주석에 "status enum 값은 이 컬럼에 저장되지 않음" 명시 또는 길이를 30자로 확장 |
| I-8 | Requirement | `AuthConfigUsageCallDto.sourceIp` — DTO `?` optional, 서비스 `string \| null` non-optional, 프론트엔드 `string \| null` — 세 지점 불일치 | `auth-config-response.dto.ts` L483; `auth-configs.service.ts` L302; `page.tsx` L404 | 세 지점 모두 `string \| null` (non-optional)로 통일 |
| I-9 | Requirement | 3개 분리 쿼리 간 `now` 시점 고정이지만 DB 서버 시간과 Node.js `Date.now()` 차이로 경쟁 조건 가능성 | `auth-configs.service.ts` getUsage | 현 구조 유지 시 "3 queries, not transactionally consistent" 주석 명시 |
| I-10 | Testing | `recentCalls` 에서 `trigger` 관계 null(orphan execution) 시 `'Unknown'` 폴백 테스트 누락 | `auth-configs.service.spec.ts` — getUsage 테스트 | `trigger: undefined` 케이스 추가, `triggerName === 'Unknown'` 단언 |
| I-11 | Testing | `USAGE_RECENT_CALLS_LIMIT(20)` limit 적용 여부 단언 없음 | `auth-configs.service.spec.ts` — makeExecutionRepo mock | W-11 수정 후 `recentQb.limit.toHaveBeenCalledWith(20)` 추가 |
| I-12 | Testing | 프론트엔드 BarChart 테스트가 섹션 헤더 존재만 확인 — 데이터 전달 여부 미검증 | `usage-drawer.test.tsx` L1221-1228 | BarChart stub을 `data` prop JSON 출력 형태로 교체해 `last24h: 2` 포함 단언 가능 |
| I-13 | Documentation | `getUsage` 공개 메서드에 JSDoc 없음 — 반환 shape 및 롤링 윈도 동작 미설명 | `auth-configs.service.ts` getUsage 선언부 | `/** §A.3 ... */` JSDoc 추가 (totalCalls, periodCounts 롤링 윈도, NULL 폴백) |
| I-14 | Documentation | `spec/1-data-model.md §2.13` 및 `spec/2-navigation/6-config.md §3 API` — consistency-check 완료 선언 대비 diff 에 미포함, 실제 반영 여부 확인 필요 | `spec/1-data-model.md`, `spec/2-navigation/6-config.md` | 누락 시 project-planner 위임 (I-3/I-4 와 동일 해소 경로) |
| I-15 | Side Effect | 프론트엔드 `useLocaleStore.setState` 테스트 픽스처 — afterEach 스토어 초기값 복원 없음, 파일 간 병렬 테스트 시 state leak 가능성 | `usage-drawer.test.tsx` L1189 | Vitest 파일 단위 격리 확인. 타 파일 공유 시 `afterEach` 에 스토어 초기값 복원 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | XFF 무조건 신뢰(인증 우회 가능), source_ip 형식 검증 없음, response_code 내부 enum 노출 |
| performance | MEDIUM | getUsage 쿼리 3개 직렬 실행, (trigger_id, started_at) 복합 인덱스 부재 |
| architecture | MEDIUM | AuthConfigsService→Execution 도메인 직접 의존, ExecuteOptions 타입 혼재, God Component 심화 |
| api_contract | MEDIUM | responseCode 의미 이중성(HTTP코드 vs enum), sourceIp DTO optional 불일치 |
| testing | MEDIUM | QB mock 단일 공유(쿼리 간 검증 불가), chat-channel XFF 케이스 누락 |
| requirement | LOW | extractClientIp 이중 호출 일관성 문제, SPEC-DRIFT(spec 갱신 누락) |
| maintainability | LOW | handleChatChannelWebhook 패턴 불일치, getUsage 반환 타입 인라인 선언 |
| documentation | LOW | getUsage JSDoc 누락, spec 동기화 diff 미포함 |
| side_effect | LOW | handleChatChannelWebhook 이중 추출(순수함수라 현재 무해), zustand 스토어 복원 미흡 |
| database | LOW | (trigger_id, started_at) 인덱스 부재(성능 reviewer 와 중복), ADD COLUMN NULL 안전 확인 |
| scope | NONE | 변경 파일 전체가 §A.3 단일 목적에 집중, 범위 이탈 없음 확인 |

---

## 발견 없는 에이전트

**scope** — 변경된 15개 파일 전체가 §A.3 구현 목적에 집중되어 있으며 불필요한 리팩토링, 무관한 파일 수정, 범위 이탈 없음 확인.

---

## 권장 조치사항

1. **(W-1) XFF 헤더 신뢰 정책 강화** — `extractClientIp` 에 신뢰 프록시 역방향 검증 적용. 인증용/로깅용 IP 추출 경계 분리. 즉시 수정 필요.
2. **(W-3 / W-10) API 계약 정리** — `responseCode` 필드를 HTTP 코드 전용(`nullable`)으로 명확히 하거나 `status` 와 분리. `sourceIp` DTO를 `@ApiProperty({ nullable: true })` + non-optional 로 변경.
3. **(W-5 / W-4) 인덱스 추가 + 쿼리 병렬화** — `(trigger_id, started_at DESC)` 복합 인덱스 마이그레이션 추가. `getUsage` 쿼리 3개 `Promise.all` 병렬화.
4. **(W-11 / W-12) 테스트 신뢰도 향상** — QB mock 을 쿼리별 독립 객체로 분리. chat-channel XFF 케이스 테스트 추가.
5. **(W-9) handleChatChannelWebhook 패턴 통일** — `extractClientIp` 를 로컬 변수로 추출 후 재사용.
6. **(W-2) source_ip 형식 검증 추가** — `ip-address` 라이브러리로 IPv4/IPv6 파싱 검증, 실패 시 null 처리.
7. **(I-3 / I-4) SPEC-DRIFT 해소** — `spec/1-data-model.md §2.13` 에 두 컬럼 추가, `spec/2-navigation/6-config.md §A.3` 표를 ✅ 승격 (project-planner 위임).
8. **(W-6) 도메인 경계 개선** — 단기 불가 시 ExecutionRepository 쿼리를 private helper 로 분리해 향후 이전 준비.
9. **(I-2) NaN 방어** — periodRaw 수치 파싱 시 `isNaN(n) || n < 0 ? 0 : n` 추가.
10. **(I-13) getUsage JSDoc 추가** — 반환 shape 및 롤링 윈도 동작 문서화.

---

## 라우터 결정

라우터 결과: `routing=done` (라우터가 선별 실행)

- **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `api_contract` (11명)
- **제외**: 3명

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | dependency | 라우터 제외 |
  | concurrency | 라우터 제외 |
  | user_guide_sync | 라우터 제외 |

- **강제 포함(router_safety)**: `database`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명)