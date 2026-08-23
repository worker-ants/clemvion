# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 코드 변경은 신규 e2e 테스트 파일 1개(`terminal-duration-sql.e2e-spec.ts`)뿐이며, 프로덕션 코드 변경은 0줄. Critical/Warning 없음. 발견사항은 전부 INFO 수준(지식 중복, 명명, 경계 완전성 등)이며 다수가 이전 라운드에서 이미 검토·수용된 회색지대의 재확인이다. forced whitelist(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | `toPgSql()`과 `paramOccurrences()`가 동일한 `.split(`:${TERMINAL_FINISHED_AT_PARAM}`)` 계산을 각각 독립 수행 — 함수 분리로 형태는 개선됐으나 split 키 지식 자체는 여전히 두 곳에 중복 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:57,65` | split 결과를 한 곳(모듈 스코프 상수 또는 재사용)에서만 계산하도록 한 단계 더 좁힐 수 있음. 우선순위 낮음 |
| 2 | Maintainability | 로컬 헬퍼 `column()`이 실제로는 컬럼 데이터 타입(`{data_type} \| null`)을 반환하는데 이름이 이를 드러내지 않아 `entityColumn()`(컬럼 이름 반환)과 혼동 가능성 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:159` | `columnDataType()` 또는 `schemaColumnType()` 등으로 개명 검토. 지역 스코프라 실질 위험 낮음 |
| 3 | Testing | 클램프 경계 `it.each`가 상한 이상만 다루고 "상한 바로 아래"(클램프 미발동) 케이스가 별도로 명시되지 않음 — 다만 낮은 쪽 이탈 뮤턴트는 기존 "정확히 상한" 케이스가, 높은 쪽 이탈은 DB `integer out of range` 에러로 어차피 잡혀 실질 갭은 낮음 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:143-148` | 조치 불요. 완전성을 높이려면 `PG_INT4_MAX - 1ms` 케이스 추가 가능(우선순위 낮음) |
| 4 | Testing | `entityTable()`/`entityColumn()`의 fail-fast throw 경로가 별도 테스트되지 않음 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:20-24,27-34` | 조치 불요 — 테스트 자신을 위한 방어 코드라 throw 경로 자체 테스트는 배보다 배꼽 |
| 5 | Requirement | `durationMs()` 헬퍼가 `res.rows[0]`를 무가드 인덱싱(`column()`은 `?? null` 가드 있음) — 서브쿼리가 리터럴 단일 행이라 실질 위험 낮음. 이전 라운드(11_15_39)에서 이미 의도적으로 미반영 처리됨 | `codebase/backend/test/terminal-duration-sql.e2e-spec.ts:99` | 조치 불요. subquery 형태가 JOIN/필터로 바뀌면 그때 가드 추가 |
| 6 | Requirement | spec은 `durationMs`의 null 부재 표현·SQL 계산·RETURNING 동일값 보장까지는 명시하지만 int4 saturate 클램프 자체(순수 내부 구현 제약)는 언급하지 않음 — `spec_impact: none`과 일치 | `spec/5-system/14-external-interaction-api.md:592` | 조치 불요. 원한다면 §6 각주에 클램프 근거 한 줄 추가 검토 가능(필수 아님) |
| 7 | Documentation | `duration_ms` "필드 분리" plan 항목으로의 결속 참조가 여전히 편도(W10 항목 → 필드 분리 절 참조는 있으나 역방향 없음) — 새 결함이 아니라 이전 라운드(RESOLUTION.md 미반영 #6, plan_coherence INFO #2)가 "필드 분리 착수 시 처리"로 명시 유예한 항목 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (W10 blockquote 약 779~783행 vs "필드 분리" 절 약 486행) | 차단 사유 아님. "필드 분리" 항목 착수 시점에 그 절에도 이 e2e 로의 역참조 한 줄 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션 없음(전 쿼리 파라미터 바인딩), 시크릿·인증·의존성 이슈 없음 |
| requirement | NONE | 신규 e2e 9케이스 전부 정본 SQL·엔티티 메타데이터·프로덕션 5개 소비처와 line-level 일치 확인. INFO 2건은 재확인일 뿐 신규 결함 아님 |
| scope | NONE | 실질 코드 변경 1개 파일로 국한, plan 편집도 타겟 패치, 나머지는 강제 워크플로 산출물 |
| side_effect | NONE | 프로덕션 코드 변경 0줄, 신규 쿼리 전부 읽기 전용(SELECT), 전역 상태/공개 API/환경변수 변경 없음 |
| maintainability | LOW | INFO 2건(split 지식 중복, 함수명 모호성) — 경미 |
| testing | LOW | INFO 2건(경계 케이스 완전성, throw 경로 미테스트) — 판별력에 실질 구멍 없음. `tsc --noEmit` 클린 재확인 |
| documentation | NONE | INFO 1건(편도 결속 참조, 이미 의도적 유예) — plan 수치·상호참조 전부 실측 대조 일치 |

## 발견 없는 에이전트

security, scope, side_effect (Critical/Warning/INFO 모두 없음 — "없음"으로 명시 응답)

## 권장 조치사항

1. (선택) `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 "필드 분리" 항목이 실제 착수되는 시점에, 그 절에 `terminal-duration-sql.e2e-spec.ts`로의 역참조 한 줄을 추가해 결속을 양방향으로 만들 것.
2. (선택, 낮은 우선순위) `toPgSql()`/`paramOccurrences()`의 `.split()` 키 계산 중복을 한 곳으로 좁힐지 검토.
3. (선택, 낮은 우선순위) `column()` 헬퍼명을 `columnDataType()` 등으로 개명해 `entityColumn()`과의 역할 대비를 명확히 할지 검토.
4. 그 외 즉시 조치 불요 — Critical/Warning 없음, 병합 차단 사유 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — **전원 결과 확보됨** (forced 인데 결과 없는 항목 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(순수 읽기 전용 e2e 테스트 신설)와 무관 |
  | architecture | 프로덕션 아키텍처 변경 없음 |
  | dependency | 신규 의존성 추가 없음 |
  | database | 스키마/마이그레이션 변경 없음(읽기 전용 조회만) |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | 공개 API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 영향 없는 내부 테스트 변경 |