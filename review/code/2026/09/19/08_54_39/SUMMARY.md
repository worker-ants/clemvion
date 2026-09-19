# Code Review 통합 보고서

## 전체 위험도

**LOW** — TypeORM 엔티티 8곳의 인덱스·제약·CHECK·FK 선언을 실제 DB(Flyway V001~V132)와 맞추는 순수 메타데이터 정정(`synchronize: false`, 동작 불변)이며, 신규 e2e 가드가 RED-먼저 작성→8건 재현→10개 뮤턴트 검증→원복의 엄격한 워크플로를 거쳤다. Critical 발견은 없고, WARNING 3건은 전부 가독성/문서 정합성 수준(동작 결함 없음)이다. **forced(router_safety) 화이트리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원의 결과가 확보되었음을 확인** — 누락된 forced reviewer 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | e2e 가드의 "매치 없음/이름 불일치" 판정 로직(`if matches.length===0 { push(...) } else if givenName && !matches.some(...) { push(...) }`)이 인덱스·유니크·CHECK 세 곳에서 거의 동일하게 반복된다. 판정 규칙이 바뀌면 세 곳을 모두 손대야 하고 하나를 놓치기 쉽다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:254-265`(인덱스), `:274-283`(유니크), `:311-322`(CHECK) | `reportMissingOrRenamed(problems, label, matches, givenName, noneMessage)` 형태의 공용 헬퍼로 추출 |
| 2 | 유지보수성 | 라벨 생성용 템플릿 리터럴에 다중 삼항 연산자가 인라인으로 중첩되어 한 줄이 최대 240자에 달해 가독성이 떨어진다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:232`(186자), `:256`(203자), `:356`(240자), `:374`(161자) | `formatIndexSummary(idx)` / `formatFkSummary(fk)` 같은 순수 포맷 헬퍼로 분리 |
| 3 | 문서화 | `plan/complete/entity-schema-declaration-drift.md` 를 가리키는 참조 두 곳이 현재는 존재하지 않는 경로다 — 해당 plan 은 아직 `plan/in-progress/`에 있고, 체크리스트의 마지막 미체크 항목이 정확히 "트래커 반영 + `complete/` 이동"이다. 저장소에 이미 8곳 이상 있는 확립된 관례(완료 예정 경로를 미리 인용)이지만, 이 PR 이 그 이동 없이 종료되면 dangling reference 로 남는다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:14`(JSDoc), `plan/in-progress/spec-draft-nullable-notation-followups.md:4668` | PR 마무리 커밋(`--impl-done` 이후, push 전)에서 plan 체크리스트 마지막 항목을 실행해 `plan/complete/`로 실제 이동 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / DB | e2e 가드가 CHECK 식·부분 인덱스 WHERE 절을 이스케이프 없이 문자열로 SQL 에 직접 삽입한다. 값은 `ds.entityMetadatas`(엔티티 데코레이터의 컴파일타임 문자열 리터럴)에서만 나와 외부/사용자 입력 경로가 없으므로 실질적 SQL 인젝션 벡터는 아니다 | `entity-schema-declarations.e2e-spec.ts` `normalizedPredicate`(~128-147행), `normalizedCheck`(~150-166행) | 조치 불요. 헬퍼 재사용 시 "입력은 엔티티 메타데이터로 국한" 주석을 남겨 두면 향후 오용 방지에 도움 |
| 2 | 테스트 | `checked` 카운터(`expect(checked).toBeGreaterThan(0)`)는 완전한 커버리지 소실만 잡고, `ROOT_ENTITIES` 축소 같은 부분적 커버리지 축소는 못 잡는다 — 이번 PR 이 고친 원 문제("몇 곳을 놓쳤는지 아무도 몰랐다")와 같은 방식으로 가드 자체가 조용히 약해질 수 있다 | `entity-schema-declarations.e2e-spec.ts:287`, `:326`, `:379` | 하한을 상수(plan 이 실측한 104)로 박거나 `ds.entityMetadatas.length`를 `ROOT_ENTITIES.length`와 대조하는 카디널리티 단언 추가 |
| 3 | 테스트 | 개발 중 검증한 뮤턴트 10개 중 8개가 영구 회귀 테스트로 남지 않았다 — 판정 로직(`sameColumns`, `normalizedPredicate` 등) 자체의 향후 회귀를 영구적으로 잡는 장치는 CHECK 인용·부분조건 정규화 2건뿐이고, 나머지는 "현재 실제로 드리프트가 있을 때만" 잡는 일반 루프에 의존한다 | `entity-schema-declarations.e2e-spec.ts:182-220`(판별력 대조군) vs `:222-381`(일반 루프) | 이번 PR 이 고친 결함 클래스와 겹치는 뮤턴트(컬럼 누락, FK onDelete 불일치 등) 1~2개를 판별력 대조군에 영구 추가 |
| 4 | 테스트 | FK 검사 테스트만 다른 세 테스트와 달리 `inRolledBackTx` 트랜잭션 래퍼를 쓰지 않는다(SELECT-only 라 버그는 아니나 파일 내부 구조 일관성이 떨어짐) | `entity-schema-declarations.e2e-spec.ts:330` | 의도(쓰기 없음)를 주석 한 줄로 남기거나 다른 세 테스트와 같은 형태로 통일 |
| 5 | 테스트 | 신규 e2e 가드의 DB 접속 기본값이 `test/helpers/db.ts`의 `createDbClient()`와 별도로 하드코딩 중복돼 있다 — 다만 기존 두 e2e 스펙에도 동일 패턴이 있어 이번 PR 이 새로 만든 문제는 아니다 | `entity-schema-declarations.e2e-spec.ts:50-60` | 이번 PR 범위 밖. 공용 `DataSource` 팩토리로 묶는 별도 리팩터 후보로만 기록 |
| 6 | 문서화 | "선언은 실재하는 것만, 실재하면 그대로" 규칙이 `spec/conventions/`가 아니라 in-progress plan 에만 서술돼 있다 — plan 이 `complete/`로 이동하면 discover 하기 어려워진다 | `plan/in-progress/entity-schema-declaration-drift.md` "## 규칙" | 이번 PR 스코프 밖(developer 는 `spec/conventions/` 쓰기 권한 없음). 다음 planner 턴에서 승격 검토 후보로 기록 |
| 7 | 요구사항 | `spec/1-data-model.md` §2 Workspace 표가 `owner_id` FK 의 삭제 동작(CASCADE)을 명시하지 않아, 코드가 이제 명시적으로 아는 사실을 spec 은 침묵한다 — spec 을 위반하는 것은 아니고(다른 값을 주장하지 않음) SPEC-DRIFT 도 아니다 | `spec/1-data-model.md:104` | 이미 planner 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md:4667`)에 등재됨 — 추가 조치 불요 |
| 8 | 범위 | 브랜치가 서로 다른 owner·주제의 커밋 두 개(엔티티 정정/developer, spec i18n 표 동기화/project-planner)를 함께 포함한다 — `--impl-prep` 게이트가 CRITICAL·BLOCK:YES 를 낸 데 따른 규약상 필수 절차이며 별도 커밋·plan·consistency-check 세션으로 투명하게 분리돼 있어 은닉된 스코프 확장이 아니다 | 커밋 `ffd58da4e` / `ff530fc8a` | PR 설명에 "두 개의 독립 plan(엔티티 정정 + spec i18n 동기화)을 포함한다"는 한 줄 명시 권장 |
| 9 | 보안 | `workspace.entity.ts`의 `owner` 관계에 `onDelete: 'CASCADE'`가 코드 상 처음 명시됐다 — `synchronize: false`라 실제 DB 동작(V001 부터 이미 CASCADE)은 바뀌지 않는다. User 삭제 앱 경로가 현재 없어 즉각적 위험은 없으나, 향후 User 삭제 기능 추가 시 이 CASCADE 를 그대로 신뢰해도 되는지 재검토가 필요하다는 점만 기록 | `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts:38` | 조치 불요(정보성) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO 3건(e2e SQL 문자열 삽입은 실질 벡터 아님, DB 자격증명 fallback은 기존 관례, CASCADE 명시는 동작 변화 아님) — Critical/Warning 없음 |
| requirement | NONE | 8개 정정 전부 마이그레이션(V001·V009·V019·V095·V109)과 line-level 일치 재확인, e2e 가드 완전성·뮤턴트 대응 확인. INFO 1건(트래커 미체크·plan 미이동은 자기 인지된 잔여 작업) |
| scope | NONE | codebase 변경이 plan 표와 정확히 1:1 대응, 무관한 리팩토링/포맷팅 없음. INFO 1건(두 plan 병존은 규약상 정당) |
| side_effect | NONE | onDelete/인덱스명 등 메타데이터를 소비하는 런타임 코드 없음(grep 확인), e2e 프로브는 트랜잭션 내 전부 롤백 — 부작용 없음 |
| maintainability | LOW | WARNING 2건(판정 로직 3중 반복, 240자 라벨 줄) — 동작 영향 없음 |
| testing | LOW | INFO 4건(vacuous 완화 부분적, 뮤턴트 8/10 미영속화, FK 테스트 구조 불일치, DB 기본값 중복) — 강한 긍정 관찰(RED-먼저→10 뮤턴트 검증→원복) 동반 |
| documentation | LOW | WARNING 1건(plan/complete 경로 선참조, 자기 해소적) + INFO 2건 |
| database | LOW | 8개 정정 전부 마이그레이션과 재대조 일치, e2e 격리·롤백 설계 양호. INFO(SQL 조립 방식, CASCADE 무동작 변화) |

## 발견 없는 에이전트

- security, requirement, scope, side_effect — Critical/Warning 없이 위험도 NONE(정보성 관찰만 존재)

## 권장 조치사항

1. (선택, 급하지 않음) e2e 가드의 인덱스/유니크/CHECK 판정 골격을 공용 헬퍼로 추출하고, 라벨 생성용 긴 삼항 표현을 포맷 헬퍼로 분리한다 (WARNING #1, #2).
2. PR 마무리 커밋에서 `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 마지막 항목(트래커 반영 + `plan/complete/` 이동)을 실행해 두 개의 dangling 경로 참조를 해소한다 (WARNING #3).
3. (선택) e2e 가드의 `checked` 하한을 실측치(104)로 상향하거나 카디널리티 대조 단언을 추가해, 향후 커버리지 축소가 조용히 통과하지 않도록 보강한다 (INFO #2).
4. (선택) 이번 PR 이 고친 결함 클래스와 겹치는 뮤턴트 1~2개를 판별력 대조군에 영구 테스트로 추가한다 (INFO #3).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **forced 전원 결과 확보됨**
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 이번 diff 범위에서 제외 판단(개별 사유 텍스트는 prompt manifest 에 미포함 — 목록만 전달됨) |
  | architecture | 상동 |
  | dependency | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |
