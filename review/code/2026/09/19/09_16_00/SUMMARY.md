# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(스코프: 무관한 i18n spec 정정이 같은 브랜치에 번들). forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | 서로 다른 두 단위 작업(backend 엔티티 DB drift 정정 vs frontend i18n spec §13 표 정정)이 한 브랜치에 번들됨. 원인은 추적 가능 — `--impl-prep spec/3-workflow-editor/` 게이트가 이 작업과 무관한 기존 글로서리 Critical 을 만나 BLOCK:YES 를 냈고, CLAUDE.md 규약대로 같은 worktree 안에서 planner 턴이 그 표를 고쳐 게이트를 풀었다. 절차는 정상이고 근거도 plan 에 충실히 남아 있으나, 결과적으로 무관한 두 도메인 변경이 한 diff 에 실림. naming_collision 체커도 별도로 이 스코프 불일치를 INFO 로 지적함(자기 확인) | `spec/3-workflow-editor/4-ai-assistant.md`(커밋 `ff530fc8a`), `plan/complete/spec-draft-assistant-i18n-table-sync.md`, `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 | 되돌릴 필요는 없음(절차상 필요했던 정정). 향후 impl-prep 게이트가 무관한 Critical 을 만나면 그 spec 정정을 별도 브랜치/PR 로 먼저 병합해 작업 브랜치를 그 위에 rebase 하는 방식 고려 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / DB | 신규 e2e 가드(`normalizedPredicate`/`normalizedCheck`)가 엔티티 메타데이터 문자열(CHECK 식·부분 인덱스 조건)을 이스케이프 없이 SQL 에 직접 이어 붙인다. 입력이 TypeORM 데코레이터의 컴파일타임 리터럴뿐이라 외부 입력 경로가 없고, 파일 주석이 "외부 입력을 넘기지 말 것"이라 명시. ROLLBACK 트랜잭션 안에서만 실행되는 테스트 전용 코드라 실질 위험 없음 (security·side_effect·database 3개 reviewer 공통 지적, 통합) | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` `normalizedPredicate`(약 205~224행), `normalizedCheck`(227~243행) | 현재 스코프는 조치 불요. 이 헬퍼를 공용 helper 로 승격하거나 외부 입력이 섞이는 용도로 재사용할 때만 이스케이프/화이트리스트 가드 추가 |
| 2 | Security | e2e 테스트 DB 자격증명 하드코딩 폴백(`clemvion-e2e`) — 기존 e2e 스펙 전반의 기존 컨벤션과 동일, 신규 위험 아님 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:129` | 조치 불요 |
| 3 | Requirement / DB | `spec/1-data-model.md` §2 Workspace 표(`owner_id`)가 삭제 동작(`onDelete: CASCADE`)을 여전히 명시하지 않아 신규 엔티티 선언과 비대칭 — spec 위반이 아니라 spec 의 침묵(코드가 spec 보다 상세해짐). 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 항목으로 등재됨 | `spec/1-data-model.md` §2, `workspace.entity.ts:38` | 이미 올바른 채널로 인계됨, 추가 조치 불요 |
| 4 | Documentation | e2e 가드 JSDoc(15행)이 아직 없는 `plan/complete/entity-schema-declaration-drift.md` 경로를 선인용(현재 `plan/in-progress/`). 이 plan 자체 체크리스트가 이 상태를 인지 중이며 마무리 커밋에서 이동으로 자기 해소될 예정 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:15`, `plan/in-progress/entity-schema-declaration-drift.md` | 마무리 커밋에서 plan `complete/` 이동 체크리스트 항목을 빠뜨리지 말 것 |
| 5 | Maintainability | `@Index`/`@Unique` 판정을 한 `it` 블록에 담아 최대 5단계 중첩 + 두 책임(인덱스/유니크) 혼재. 직전 라운드에서 이미 INFO 로 확인·비긴급 처리된 항목으로 이번 fix 대상 아니었음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:299-359` | (선택) 인덱스/유니크를 별도 `it` 로 분리하면 실패 귀인이 테스트 이름 수준에서 바로 드러남. 급하지 않음 |
| 6 | Maintainability | `reportMatch` 헬퍼가 5개 위치 인자를 받아 호출부 3곳 모두 순서를 맞춰야 함. 지금은 호출부가 적어 실수 위험 낮음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:101-114`, 호출부 `:332,:347,:382` | 인자가 늘어날 계획이 있다면 객체 인자(`{label, matches, givenName, missing}`)로 전환 고려 |
| 7 | Documentation | 리팩터로 추출된 6개 포맷 헬퍼 중 `reportMatch` 만 JSDoc 을 갖추고 나머지 5개(`nameOrNone`·`describeDbIndex`·`describeIndexDecl`·`fkActions`·`describeForeignKeyDecl`·`describeDbForeignKey`)는 문서화 수준이 비대칭. 테스트 전용 private 한 줄 순수 함수라 실질 위험은 낮음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:55-95` | 조치 불요에 가까움. 필요 시 "무엇을 반환하는 라벨인지" 한 줄만 추가 |
| 8 | Testing | `checked > 0` 하한 검증이 완전한 커버리지 소실만 잡고 부분 축소는 못 잡음(1차 리뷰 INFO 이월, 리팩터 후에도 미해소) | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 인덱스/유니크/CHECK/FK 테스트 공통 | 하한을 실측치(104, 또는 인덱스24·유니크14·CHECK2·FK64 개별)로 상향하거나 `ds.entityMetadatas.length` 카디널리티 단언 추가. 급하지 않음 |
| 9 | Testing | 개발 중 검증한 뮤턴트 10개 중 다수(판별력 대조군 제외)가 회귀 테스트로 영속화되지 않아, 향후 헬퍼를 다시 건드릴 때 사람 손을 다시 거쳐야 함 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 일반 순회 루프 3곳 | 대표 뮤턴트 1~2개씩을 판별력 대조군 `it()` 에 영구 케이스로 추가 고려. 급하지 않음 |
| 10 | Testing | 리팩터 후 "실패 메시지" 조립 문자열(`others`)이 매치 성공 시에도 매번 계산됨(리팩터 전엔 실패 분기에서만). 배열이 작아 실질 성능 영향 없음 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 인덱스 루프 307행 근방, CHECK 루프 381행 근방 | 조치 불요. 원한다면 `missing` 을 thunk 로 지연 평가 가능하나 이득 작음 |
| 11 | Scope | naming_collision 컨시스턴시 체커가 이 impl-prep 게이트 스코프 불일치를 스스로 INFO 로 지적(WARNING #1 의 근거 자료) | `review/consistency/2026/09/19/08_07_50/naming_collision.md` | 조치 불요(이미 plan 에 기록됨) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | e2e SQL 조립·DB 자격증명 폴백 모두 스코프가 좁혀진 기존 패턴, 신규 공격 표면 없음 |
| requirement | NONE | 8곳 정정이 마이그레이션(V001·V002·V009·V019·V095·V109)·spec 과 line-level 전수 일치, 리팩터도 판정 문구 동일 |
| scope | LOW | entity drift 정정과 무관한 i18n spec 정정이 같은 브랜치에 번들(원인·근거는 문서화됨) |
| side_effect | NONE | `synchronize:false` 로 런타임/DB 부작용 없음을 TypeORM 소스로 직접 확인 |
| maintainability | NONE | 1라운드 WARNING 2건(판정 골격 반복·240자 라벨) 헬퍼 추출로 해소 확인 |
| testing | LOW | 뮤턴트 예측/실측 일치·판별력 대조군 존재, 이월 INFO(하한 약한 카운터·뮤턴트 미영속화)만 잔존 |
| documentation | LOW | 리팩터가 신규 결함 없음, 신규 헬퍼 JSDoc 비대칭만 |
| database | LOW | 마이그레이션 없음·선언 정합화뿐, 스키마/성능/무중단 배포 리스크 없음 |

## 발견 없는 에이전트

없음 — 8개 에이전트 모두 최소 INFO 이상의 관찰을 보고했다(대부분 "조치 불요" 확인성 기록).

## 권장 조치사항

1. (선택, 급하지 않음) 향후 impl-prep 게이트가 작업과 무관한 Critical 을 만나면, spec 정정을 별도 PR 로 먼저 병합 후 rebase 하는 절차를 고려 — 리뷰·머지 단위 명확화 (scope WARNING #1).
2. (선택) e2e 가드의 `checked > 0` 하한을 실측 카디널리티로 상향하고, 판별력 대조군에 대표 뮤턴트 1~2개를 영구 케이스로 추가 (testing INFO #8, #9).
3. (선택) 신규 포맷 헬퍼 5개에 `reportMatch` 수준의 한 줄 JSDoc 추가 (documentation INFO #7).
4. 마무리 커밋에서 `plan/in-progress/entity-schema-declaration-drift.md` 를 `plan/complete/` 로 이동하는 체크리스트 항목을 빠뜨리지 말 것 (requirement/documentation INFO #4).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(success)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(엔티티 데코레이터 정정·e2e 가드 리팩터)와 낮은 관련성으로 제외 |
  | architecture | 동상 |
  | dependency | 동상 — 의존성 변경 없음 |
  | concurrency | 동상 — 동시성 로직 변경 없음 |
  | api_contract | 동상 — API 계약 변경 없음 |
  | user_guide_sync | 동상 — 사용자 가이드 영향 없음 |
