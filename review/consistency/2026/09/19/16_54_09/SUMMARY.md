# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(재실행), Critical 발견 없음.

## 전체 위험도
**LOW** — Critical/차단 사유 없음. WARNING 1건(plan 파일명 유사) + INFO 다수는 모두 기존 관행·범위 밖 사안이거나 강제성 없는 보강 제안.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 완료 플랜과 진행 중 플랜의 파일명이 한 단어(`column`↔`schema`)만 달라 grep·대화에서 혼동 가능 | `plan/in-progress/entity-column-declaration-drift.md` | `plan/complete/entity-schema-declaration-drift.md` (#1354, 인덱스·제약 층) | 리네임 불필요(문서 내부는 이미 전체 경로로 교차 참조해 혼동 낮음). `complete/` 이동 시 트래커·커밋 메시지에 "인덱스·제약 층(#1354)" / "컬럼 층(이 작업)" 층 이름을 붙여 구분 표기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | e2e 가드 방향성 반전("컬럼 정의는 가드 밖" → "컬럼 층은 양방향")은 트래커 미해결 질문 + 사용자 결정(2026-09-19)으로 근거를 갖춰 무근거 번복 아님. 다만 spec Rationale 에 방향성 차이(인덱스·제약=단방향, 컬럼=양방향) 미러링 안 됨 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 헤더 주석 / `spec/1-data-model.md` Rationale "`code:` 에 전용 e2e 가드 셋" | 여유 있으면 Rationale 항목에 방향성 한 줄 보강(강제 아님, 선례상 필수 아님) |
| 2 | rationale_continuity | `spec/0-overview.md` Rationale 의 DB 마이그레이션 배경이 "Prisma" 를 전제하나 실제 코드베이스는 TypeORM(`prisma` 의존성·`schema.prisma` 없음) — 이번 diff 와 무관한 기존 drift | `spec/0-overview.md` `## Rationale` "DB 마이그레이션 도구로 Flyway 채택 (§2.8)" | 별도 planner 턴에서 "Prisma" → "TypeORM 엔티티 데코레이터" 정정(트래커 등재 권장). 이번 plan `spec_impact: none` 판정과 무관 |
| 3 | convention_compliance | `spec/2-navigation/` 18개 중 13개 화면 spec 이 명시적 `## Overview` 헤딩 없이 번호 섹션으로 바로 시작(저장소 전역의 기존 관행, 이번 diff 가 만든 이탈 아님) | `1-workflow-list.md`·`2-trigger-list.md`·`4-integration.md` 등 13개 파일 | CLAUDE.md 에 "화면-레벨 spec 은 구조 섹션이 Overview 를 겸한다" 예외 명문화 검토(선택) |
| 4 | convention_compliance | 글로서리 금지어 "엣지" 가 사용자 가이드 본문이 아닌 spec 디렉터리 트리 주석에 잔존 — `i18n-userguide.md` 규약의 명시 적용 범위(가이드 본문·UI 문자열) 밖이라 엄밀히 위반은 아니나, 최근(`4157bc557`) 동일 단어를 다른 곳에서 정정한 선례와 표기상 상충하는 인상 | `spec/2-navigation/13-user-guide.md:52` | 조치 의무 없음. 일관성 원하면 "연결선" 으로 교체 |
| 5 | convention_compliance | `IntegrationTestResult.code` 신규 코드 5종(`DB_AUTH_FAILED` 등)이 `error-codes.md` 명명 규약(의미 기반·도메인 prefix·UPPER_SNAKE_CASE) 준수 확인, 카탈로그 미등재는 `EMAIL_*` 계열과 동일한 기존 패턴이라 결함 아님 | `spec/2-navigation/4-integration.md` §5.3·§5.4·§11 | 조치 불요 — 위반 없음 확인 기록 |
| 6 | plan_coherence | 트래커(`spec-draft-nullable-notation-followups.md:4659-4660`)가 요구한 세 번째 하위 결정("선언 생략 vs 거짓 선언 기준")이 이번 plan 의 가드 설계(미선언 컬럼만 예외, 나머지는 전부 양방향 위반)로 논리적으로는 답해졌으나 "이게 그 결정이다" 라는 명시 문장이 없음 | `plan/in-progress/entity-column-declaration-drift.md` "가드" 섹션(100-106행) | `complete/` 이동 전 해당 섹션 또는 트래커 해소 문구에 "이것이 트래커가 요구한 생략 vs 거짓 선언 기준이다" 한 문장 추가 |
| 7 | plan_coherence | `--impl-done` 체크리스트 항목이 `spec/1-data-model.md` 를 직접 Read 로 첨부해야 한다는 우회 사실을 산문에만 의존(체크리스트 문장 자체엔 없음) | `plan/in-progress/entity-column-declaration-drift.md` "체크리스트" 132-137행 | 체크리스트 항목에 "(+ `spec/1-data-model.md` Read 블록 첨부)" 인라인 추가로 자기완결화 |
| 8 | naming_collision | 신규 module-local 상수 `UNDECLARED_COLUMNS`·`COLUMN_LEVEL` — 저장소 전체 grep 0건 외 충돌, 기존 `FK_ACTION` 명명 규약과 일관 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (미커밋 초안) | 조치 불요 — 충돌 없음 확인 기록 |
| 9 | naming_collision | `enumName: 'node_category'`·`'edge_type'` 은 신규 식별자가 아니라 `V001__initial_schema.sql`/`V003__add_trigger_category.sql` 부터 있던 기존 DB 타입 이름을 뒤늦게 엔티티에 반영한 것 | `nodes/entities/node.entity.ts`, `edges/entities/edge.entity.ts` | 조치 불요 |
| 10 | naming_collision | 신규 spec/e2e 파일 경로 없음 — `entity-schema-declarations.e2e-spec.ts` 는 선행 PR(#1354)에서 이미 frontmatter `code:` 등재됨 | `spec/1-data-model.md` frontmatter | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 8개 엔티티 컬럼 데코레이터 정정은 `spec/1-data-model.md` 가 이미 서술한 DB 사실을 뒤늦게 반영 — 새 모순 없음. 1차 `--impl-prep` Critical(§5.4 소문자 코드)은 `#1357`로 이미 해소 확인 |
| rationale_continuity | LOW | 가드 방향성 번복은 근거 있음(트래커+사용자 결정). INFO 2건(spec Rationale 미러링 제안, `spec/0-overview.md` Prisma/TypeORM 서술 drift — scope 밖) |
| convention_compliance | NONE | 신규 에러 코드 5종·감사 액션·API 엔드포인트·frontmatter 전수 준수 확인. INFO 3건은 기존 관행 또는 규약 범위 밖 |
| plan_coherence | LOW | 트래커 결정 두 가지 모두 명시적으로 해소, 선행 Critical 실제 머지 확인. INFO 2건은 plan 자기완결성 보강 제안 |
| naming_collision | LOW | WARNING 1건(plan 파일명 유사, 실질 위험 낮음). 신규 식별자(module-local 상수, enum 이름) 충돌 없음 확인 |

## 권장 조치사항
1. (선택, 비차단) `plan/in-progress/entity-column-declaration-drift.md` 를 `complete/` 로 이동할 때 트래커·커밋 메시지에 "인덱스·제약 층(#1354)" / "컬럼 층(이 작업)" 으로 층을 구분해 표기 — WARNING #1 해소.
2. (선택) 같은 plan 문서에 "이것이 트래커가 요구한 생략 vs 거짓 선언 기준이다" 한 문장과 `--impl-done` 체크리스트에 `spec/1-data-model.md` Read 첨부 사실을 인라인으로 보강 — INFO #6·#7.
3. (선택, 별도 planner 턴) `spec/0-overview.md` Rationale 의 Flyway 채택 배경 서술을 "Prisma" → "TypeORM 엔티티 데코레이터" 로 정정 — INFO #2, 이번 작업과 무관하므로 급하지 않음.
4. 위 세 항목 모두 BLOCK 사유가 아니므로 이번 target(`spec/1-data-model.md` 실질 대상 + 8개 엔티티 + e2e 가드 확장)은 머지/진행에 걸림돌 없음.
