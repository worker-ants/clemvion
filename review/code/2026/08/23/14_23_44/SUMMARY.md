# Code Review 통합 보고서

## 전체 위험도
**LOW** — egress 마스킹 게이트 4곳을 헬퍼 2개로 통합한 순수 리팩터. 기능적 동등성은 9개 reviewer(보안·성능·요구사항 포함) 전원이 확인했고 CRITICAL 은 0건. 유일하게 실질적인 지적은 (1) 신설 SoT 헬퍼 자체의 co-located 유닛 테스트 부재, (2) developer 역할이 `spec/` 을 직접 수정한 절차 위반(CLAUDE.md 권한표) 두 갈래 WARNING. forced reviewer 7명(`documentation`·`maintainability`·`requirement`·`scope`·`security`·`side_effect`·`testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/Maintainability | 신설 SoT 헬퍼 `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 를 직접 겨눈 co-located 유닛 테스트가 `redact-stored-error.spec.ts` 에 없다 — 같은 파일의 기존 자매 함수(`redactStoredErrorForResponse`/`redactStoredDataForResponse`)는 전용 `describe` 블록이 있는데 신설 헬퍼만 없어, 이번 통합이 없애려던 "회귀가 여러 호출부에 흩어진 테스트를 거쳐야만 드러난다"는 문제가 테스트 레이어에는 그대로 남는다. (부수: `maskIfPresent` 의 JSDoc 이 명시한 `undefined` 방어 분기도 어떤 테스트로도 실행되지 않음 — 기존 갭이나 헬퍼가 공유 유틸로 승격된 지금이 메꿀 시점) | `codebase/backend/src/shared/utils/redact-stored-error.ts:97`(`redactStoredFieldsForResponse`), `:144`(`redactNodeExecutionRow`), `:113-131`(`maskIfPresent`) / `codebase/backend/src/shared/utils/redact-stored-error.spec.ts`(대응 describe 없음) | `redact-stored-error.spec.ts` 에 `describe('redactStoredFieldsForResponse', ...)`/`describe('redactNodeExecutionRow', ...)` 추가 — (a) 3필드 마스킹, (b) 무변화 시 copy-on-change 참조 보존, (c) `undefined` 방어 분기 캐너리. plan 이 기록한 뮤테이션 실측(M1/M2)을 그대로 케이스로 옮기면 비용 낮음. 머지 차단 사안 아님 |
| 2 | Scope | `developer` 역할이 `spec/conventions/egress-masking.md` §3 을 직접 수정 — CLAUDE.md Skill 체계 표는 developer 쓰기 권한을 `codebase/**, plan/**, review/**/RESOLUTION.md` 로 한정하고 `spec/` 는 read-only 로 명시(+"구현 중 spec 변경 필요 시 project-planner 위임" 별도 강조). 내용(자기 예고를 실측으로 반증하는 취소선+정정)은 사실관계상 정확하고 위험도는 낮지만 절차상 권한 밖 | `spec/conventions/egress-masking.md:83`(취소선), `:85`~`92`(신규 정정 문단) | 다음 라운드에서 `project-planner` 턴으로 이관하거나, developer 의 자기-예측 반증형 소정정을 CLAUDE.md 에 예외로 명문화해 경계 모호성 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 마스킹 게이트 통합이 기능적으로 완전히 동등 — 신규 취약점 없음. 인가 로직·SQL 파라미터 바인딩도 diff 범위 밖에서 그대로 보존 확인 | `redact-stored-error.ts`(`redactStoredFieldsForResponse`/`redactNodeExecutionRow`), 3개 호출부 | 조치 불요(양성 확인) |
| 2 | Performance | 마스킹 스프레드 도입으로 호출당 소형 중간 객체 1개 추가 할당되나 응답당/최대 200행 유계라 무시할 수준. copy-on-change 최적화·제네릭 런타임 비용도 퇴행 없음 | `redact-stored-error.ts:97,144` | 조치 불요 |
| 3 | Requirement | EIA §R17 이 정본으로 규정한 6표면·2컬럼 좌표계와 line-level 로 정확히 일치, copy-on-change·엔티티 non-null 타입 계약 보존, TODO/FIXME 없음 | `executions.service.ts:1038-1045`, `spec/5-system/14-external-interaction-api.md:1532-1536` | 조치 불요(정합 확인) |
| 4 | Side Effect | `redactNodeExecutionRow` 가 제네릭 공개 export 로 승격돼 재사용 표면 확장 — 설계 의도는 docstring 에 문서화됨, 시그니처 breaking change 없음, 스프레드 순서 3곳 전부 이상 없음 | `redact-stored-error.ts:97,144`, 3개 호출부 | 향후 3번째 소비처 생기면 "왜 헬퍼가 둘인가" 표 갱신 |
| 5 | Maintainability | `redactNodeExecutionRow` 만 "…ForResponse" 네이밍 접미사 컨벤션 불일치. 반환 타입이 `ResponseExecution`/`ResponseNodeExecution` 부분집합과 구조적으로 동일하나 별도 인라인 선언(타입 레이어 손동기화) | `redact-stored-error.ts:144`, `:97-105` vs `executions.service.ts:90-99,108-115` | 우선순위 낮음 — 접미사 통일 또는 docstring 예외 명시, `Pick<>` 파생 고려 |
| 6 | Documentation | 신설 함수 2개가 같은 파일 기존 함수와 달리 `@param`/`@returns` 태그 없이 산문 docstring만 사용(스타일 불일치). 단, 이전 consistency-check(13:55:36) 지적사항(트래커 반증 근거 미기록·JSDoc 심볼명 stale)은 이번 diff 에서 이미 자체 해소됨 확인 | `redact-stored-error.ts`(게이트 73-111, 134-159) | 급하지 않음 — 다음 편집 시 태그 보완 |
| 7 | User Guide Sync | `run-debug-flow-change`/`spec-major-change` 두 매트릭스 행이 changeset 과 매칭되나 조사 결과 실질 갭 없음(동작 무변경 리팩터라 `05-run-and-debug` 문서 그대로 유효, spec frontmatter 무손상) | `spec/conventions/egress-masking.md`, `codebase/frontend/src/content/docs/05-run-and-debug/*.mdx` | 갱신 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마스킹 통합 기능 동등성 확인, 인가/SQL 인젝션 영향 없음 |
| performance | NONE | 알고리즘 복잡도·쿼리 횟수 무변화, 소형 객체 할당만 추가 |
| requirement | NONE | spec §R17 좌표계와 line-level 일치, 계약 보존 |
| scope | LOW | `developer` 의 `spec/` 직접 수정(권한표 위반) |
| side_effect | NONE | 순수 변환 함수, breaking change 없음 |
| maintainability | LOW | 신설 헬퍼 co-located 테스트 부재, 네이밍/타입 사소 불일치 |
| testing | LOW | 신설 헬퍼 직접 유닛테스트 부재, `undefined` 방어 분기 미검증(서비스 레벨 간접 커버리지는 두터움) |
| documentation | LOW | JSDoc 태그 스타일 사소 불일치, 이전 라운드 지적사항은 자체 해소 확인 |
| user_guide_sync | NONE | 매칭 매트릭스 2행 모두 실질 갭 없음 |

## 발견 없는 에이전트

없음 (실행된 9개 reviewer 전원이 최소 INFO 이상 발견사항을 기록함).

## 권장 조치사항
1. `redact-stored-error.spec.ts` 에 `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 전용 테스트(3필드 마스킹, copy-on-change 참조 보존, `undefined` 방어 분기)를 추가해 이 PR 의 SoT 통합 취지를 테스트 레이어에도 반영한다 (WARNING #1).
2. `spec/conventions/egress-masking.md` §3 정정을 project-planner 턴으로 이관하거나, developer 의 자기-반증형 소정정 예외를 CLAUDE.md 에 명문화한다 (WARNING #2). 내용 자체는 정확하므로 revert 불필요, 절차만 정리.
3. (낮은 우선순위) `redactNodeExecutionRow` 네이밍 접미사 통일, `@param`/`@returns` JSDoc 태그 보완.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 강제 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단 — 이번 changeset 은 기존 아키텍처(레이어링·모듈 경계) 변경 없는 국소 헬퍼 추출로 낮은 관련성 |
  | dependency | 신규 패키지/의존성 도입 없음 |
  | database | SQL/스키마/마이그레이션 변경 없음 (기존 쿼리 무변경) |
  | concurrency | 동시성 제어 로직(락·트랜잭션·큐) 변경 없는 순수 데이터 변환 리팩터 |
  | api_contract | 응답 스키마(DTO shape) 무변경 — 마스킹 값 자체만 동일 로직으로 재배선 |