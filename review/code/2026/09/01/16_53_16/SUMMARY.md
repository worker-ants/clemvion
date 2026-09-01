# Code Review 통합 보고서

## 전체 위험도
**LOW** — 6라운드에 걸친 리뷰-fix 사이클이 이미 실질 결함을 모두 수렴시켰다. 이번(6R) 라운드는 신규 코드 변경 없이 재검증 위주였고, Critical 0건 · Warning 1건(문서 비대칭)만 남았다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `CHANGELOG.md` 의 가드 서술이 이 PR 자신이 5라운드에서 닫은 더 중요한 갭(`findMisboundHelpers` — "묶였지만 엉뚱한 리소스" 케이스)을 반영하지 않는다. 최초(1라운드) 시점의 "묶임 여부만 검사" 서술만 남아 있어, CHANGELOG 만 읽는 독자는 가드가 리소스 오귀속까지 잡는다는 사실을 모른다. `plan/in-progress/spec-sync-auth-gaps.md`에는 기록돼 있어 은폐는 아니나 CHANGELOG-plan 간 정보 비대칭이 존재. | `CHANGELOG.md:22-25` (`### recordAudit 공통 팩토리 → won't-do, 가드로 대체` 절) | 해당 절 끝에 "가드는 최초엔 '묶였는가' 만 봤으나, '엉뚱한 리소스에 묶인' 경우를 통과시킨다는 것이 리뷰에서 드러나 `findMisboundHelpers` 로 자기 리소스 일치까지 검사하도록 넓혔다" 한두 문장 추가 (이 파일에 이미 사후 addendum 선례 있음, `:103`) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/문서화/테스트 (3개 reviewer 중복 지적, 통합) | fixture 파일의 "형태" 번호 라벨이 5에서 중복된다 — `ARROW_FIELD_BARE_SOURCE`(5라운드 이전부터 존재)와 신규 `WRONG_RESOURCE_BOUND_SOURCE`(5라운드 추가)가 둘 다 "형태 5"로 라벨링됨. 판정 로직·테스트 커버리지엔 영향 없는 순수 주석 오기이나, 이 파일이 "형태 커버리지"를 카운트 근거로 쓰므로 다음 유지보수자가 형태 개수를 오인할 소지 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts:64,98` | `WRONG_RESOURCE_BOUND_SOURCE` 주석의 "형태 5"를 "형태 6"으로 정정 |
| 2 | 유지보수성 | `extractActionType` 과 `extractBoundResourceText` 가 "첫 파라미터 타입 리터럴에서 `action` 프로퍼티 찾기" 순회 로직을 거의 동일하게 중복 보유 — 이름이 달라 한쪽만 고치기 쉬움(다만 fixture 테스트가 divergence 를 잡을 가능성 높음) | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:162-178`(`extractActionType`), `:247-273`(`extractBoundResourceText`) | 공통 헬퍼(`findActionPropertyType`) 추출 후 두 함수를 얇은 래퍼로 재작성 — 급하지 않음 |
| 3 | 보안 | `AuditLogsService.record()` 경고 로그가 `action`/`resourceType`/`resourceId`/`workspaceId`를 이스케이핑 없이 결합(구조적 로그 위조 방어 부재). 현재 4개 producer(auth-configs) 는 전부 서버 생성 UUID·닫힌 상수만 사용해 악용 경로 없음 — 방어 심층화 성격 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` `record()` catch 블록 | 필수 아님 — 구조화 로깅(`logger.warn({ msg, action, ... })`)으로 향후 producer 대비 |
| 4 | 보안/데이터베이스 (중복) | `recordAuditWriteFailed(resourceType: string)` 라벨이 열린 `string` 타입이라 이론상 cardinality 무제한. `clampLabel()`(64자)로 방어, 현재 producer 전부 내부 상수(distinct 10종)만 전달해 실제 악용 경로 없음 | `codebase/backend/src/modules/metrics/business-metrics.service.ts` `recordAuditWriteFailed()`, `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel()` | 조치 불필요 — `record()` 시그니처가 닫힌 유니온으로 좁혀지면 함께 좁힐 것(코드 주석에 이미 명시) |
| 5 | 데이터베이스 | `audit_log` 적재는 여전히 본 트랜잭션과 분리된 단독 `save()`이며 실패는 삼켜진다 — 주 작업(회전·삭제) 커밋 성공 + 감사 행 유실이 이론상 가능. 사전에 의도된 설계(특권 작업이 감사 DB 장애로 실패하면 안 됨)이며 이번 PR 은 그 유실을 "보이게"만 함 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:76-121` `record()` | 조치 불필요(의도·문서화·테스트됨). 카운터를 알람에 연결하면 사후 인지 가능. 유실이 허용 불가로 판단되면 향후 outbox 패턴 고려(PR 범위 밖) |
| 6 | 부작용 | `record()` catch 내부 관측 호출 실패는 완전히 무로깅으로 삼켜짐(빈 catch) — swallow 계약을 관측 계층까지 확장한 의도된 설계, 이번 diff 가 새로 만든 결함 아님. 디버깅 단서가 전혀 안 남는 트레이드오프 | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-113` | 조치 불필요(의도·테스트됨). 선택적으로 최소 흔적(`console.debug`) 고려 가능 |
| 7 | 부작용 | 신규 정적 가드가 테스트 실행 시 `modules/` 전체를 재귀 스캔 — 매 러너 기동 비용 + 저장소 물리 구조에 결합. 형제 가드(`engine-error-code-anchor-guard.ts`)와 동일한 기존 패턴 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` `collectSourceFiles()` | 조치 불필요 — 기존 컨벤션 준수. 장기적으로 전수 스캔형 가드 누적 시 부팅 비용 모니터링 참고 |
| 8 | 아키텍처 | 가드의 helper 인식이 메서드/필드 이름이 정확히 `recordAudit`인지로만 판정 — 향후 다른 이름(`logAudit` 등)의 helper 는 인지 못 하고 조용히 "위반 0건"이 됨. 코드 주석이 이미 인지·수용한 트레이드오프이며 `sites.length >= 5` 전제 테스트가 오탈자 회귀는 잡음(단, 새 이름 helper 는 못 잡음) | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:16-21` | 조치 불필요(설계상 인지된 트레이드오프). 향후 새 리소스 도메인 추가 시 리뷰 체크리스트에 "가드가 이 helper 를 실제로 카운트했는가" 한 줄 추가 검토 |
| 9 | 범위(Scope) | 서로 독립된 두 plan 항목(`recordAudit` 팩토리→가드 대체, `audit_log` 적재 실패 관측성)이 한 changeset 에 번들됨 — 1~6라운드에 걸쳐 반복 확인된 항목, 은폐된 확장 아님 | `plan/in-progress/spec-sync-auth-gaps.md` | 조치 불필요 — 기록으로만 유지 |
| 10 | 범위(Scope) | 원래 계획된 처방("공통 팩토리 추출")이 새 정적 분석 인프라(AST 가드)로 대체됨 — 판별 프로브 근거가 plan·CHANGELOG·가드 헤더 3곳에 일관 기록, 기존 자매 가드와 동일 아키텍처 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts` | 조치 불필요 — 근거 충분히 문서화됨 |
| 11 | 범위(Scope) | `recordExecutionError` 클램핑 리팩터가 "감사" 범위 밖 카운터를 같은 changeset 에서 건드림 — 이 PR 자신이 만든 중복(신·구 카운터가 같은 리터럴을 따로 듦)을 같은 PR 안에서 닫은 것이라 drive-by 아님 | `codebase/backend/src/modules/metrics/business-metrics.service.ts`(`clampLabel`) | 조치 불필요 |
| 12 | 테스트 | `recordExecutionError` 에는 `recordAuditWriteFailed` 와 대칭인 65자 클램핑 경계 테스트가 없음 — plan 에 우선순위 판단으로 명시 이월, 공유 상수 자체 계약은 다른 뮤턴트가 이미 물고 있어 리팩터 근거는 무너지지 않음 | `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:54-60` vs `:75-83` | 추적된 대로 다음 세션 — 지금 차단 사유 아님 |
| 13 | 요구사항/테스트/문서화 (중복) | `login_history` 축의 실패 관측 비대칭(카운터 없음, `audit_log` 만 확장됨)은 spec·plan 양쪽에 의도된 비대칭으로 명시 등재되어 있고 재개 신호도 적혀 있음 | `spec/data-flow/1-audit.md:24-38`, `plan/in-progress/spec-sync-auth-gaps.md`(`login_history` 축) | 조치 불필요 — 등재 상태 정상 |
| 14 | 문서화 | `AuditLogsService.record()` JSDoc 이 이 PR 이 추가한 관측 동작(카운터·로그 4필드)을 서술하지 않음 — 1~5라운드 반복 지적·유예, plan 에 "우선순위 판단"으로 명시 등재. 부가로 이 JSDoc 은 영어(이 PR 이전부터 있던 것, 신규 불일치 아님) | `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75` | 조치 불요(기존 처분 유지) — 다음에 이 메서드를 건드릴 계기가 있으면 관측 동작 한 줄 + 한국어로 통일 |
| 15 | 문서화 | `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` — 이번 changeset 이 새로 등재한 별개 트래커. 문서 품질 양호(선재 확정 증거·선례 인용·체크리스트 완비), 이 changeset 의 실제 diff 와 정합 | 파일 전체(신규) | 없음 — 확인 목적 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음. 로그 위조·라벨 cardinality 는 방어 심층화 INFO, 실제 악용 경로 미확인. `findMisboundHelpers` 를 통한 감사 오귀속 방어 재확인 |
| architecture | NONE | 3중 방어 구조(타입 좁힘+캐너리+AST 가드) 견고, 5개 도메인 `recordAudit` 계약 통일(LSP 정합), 순환 의존 없음, 팩토리 대신 가드를 택한 설계 판단 타당 |
| requirement | NONE | 두 핵심 요구사항(관측성 추가, 액션 바인딩 봉쇄) 코드 레벨 재검증 완료. spec 정량 서술(12곳·10종) line-level 일치 재검산 |
| scope | LOW | 5R 이후 유일 커밋이 직전 라운드 WARNING 2건에 정확히 대응, 무관 변경 없음. 이월 INFO 4건은 반복 확인돼도 결론 불변 |
| side_effect | LOW | DI 시그니처 변경 하위호환 실측 확인(2개 호출부), swallow 계약 이중 격리, private 메서드 타입 좁힘은 런타임 무영향 |
| maintainability | NONE | 신규 AST 헬퍼 함수들 단일 책임·근거 문서화 양호. fixture 라벨 중복·헬퍼 함수 중복 로직 2건은 순수 가독성/DRY, 기능 영향 없음 |
| testing | NONE | 4 suites/86 tests 전부 GREEN 재확인. `findMisboundHelpers` 대조군 fixture(위반/일치/표기차이) 구조가 오탐·누락 방지를 구조적으로 보장 |
| documentation | LOW | CHANGELOG 가 5R 보강(`findMisboundHelpers`)을 반영 못 함(WARNING). fixture 라벨 중복 재확인. 나머지는 이월 항목 |
| database | NONE | 트랜잭션 경계·쿼리·인덱스·마이그레이션 변경 없음. `audit_log` best-effort 적재는 기존 의도된 트레이드오프, 이번 PR 은 관측성만 추가 |
| concurrency | NONE | 신규 공유 자원 접근·락·async 흐름 없음. 신규 카운터 호출은 동기·stateless, swallow 계약 안에 안전 격리 |

## 발견 없는 에이전트

concurrency (동시성 관점 Critical/Warning/INFO 발견 0건 — 신규 위험 없음 확인만 수행)

## 권장 조치사항

1. `CHANGELOG.md` 의 `### recordAudit 공통 팩토리 → won't-do, 가드로 대체` 절에 5라운드 `findMisboundHelpers` 보강("묶였지만 엉뚱한 리소스" 케이스 방어) 한두 문장 addendum 추가 — CHANGELOG-plan 간 정보 비대칭 해소 (WARNING #1)
2. (선택, 낮은 우선순위) `audit-action-binding-fixture.ts:98` 의 "형태 5" → "형태 6"으로 정정
3. (선택, 낮은 우선순위) `extractActionType`/`extractBoundResourceText` 의 중복 순회 로직을 공통 헬퍼로 추출
4. 나머지 INFO(로그 구조화·라벨 클램핑·클램핑 대칭 테스트·JSDoc 관측 서술)는 이미 `plan/in-progress/spec-sync-auth-gaps.md`에 우선순위 판단으로 명시 이월돼 있어 이번 병합을 막지 않음

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (10명)
  - **제외**: 표 (아래, 4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 changeset 은 성능 특성 변경 없음(동기 카운터 호출·타입 좁힘) |
  | dependency | router 판단 — 신규 외부 의존성 추가 없음 |
  | api_contract | router 판단 — public API 계약 변경 없음(private 메서드 타입 좁힘, 내부 관측 추가) |
  | user_guide_sync | router 판단 — 사용자 가이드 대상 변경 없음(내부 관측성·정적 가드) |