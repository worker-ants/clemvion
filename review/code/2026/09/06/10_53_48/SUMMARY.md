# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. forced 화이트리스트 7개(security·requirement·scope·side_effect·maintainability·testing·documentation) 전원 결과 확보(누락 없음). 직전 라운드 Critical 1건(`WorkflowVersionsService.findOne` 의 `User` 전체 컬럼 유출)은 이번 diff 로 실측 확인상 완전히 닫혔다. 남은 것은 WARNING 4건 — 전부 국소적(보안 경계 리터럴 중복, 가드의 중첩 객체 형태 미검출, e2e 라벨 순서, plan 문서 수치 정정)이며 새로운 살아있는 유출은 발견되지 않았다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | MAINTAINABILITY | 보안 경계로 명시된 `creator` 투영 리터럴 `{ id: true, name: true, email: true }` 이 SoT(`WorkflowVersionCreatorDto`)에서 파생되지 않고 production 2곳 + spec 2곳, 총 4곳에 손으로 복제돼 있다. 이 PR 이 다른 곳(`collectUserRelationNames`)에서 강조한 "손 열거 금지, SoT 파생" 원칙이 정작 이 리터럴에는 적용되지 않았다 | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:62`(`findByWorkflow`)·`:89`(`findOne`), `workflow-versions.service.spec.ts:60`·`:85` | `CREATOR_PROJECTION` 같은 단일 상수로 통합하거나 `WorkflowVersionCreatorDto` 필드 목록에서 구조적으로 파생시켜 두 메서드가 참조하게 한다 |
| 2 | TESTING / REQUIREMENT | 구조 축 가드(`user-entity-exposure-guard.ts`)가 TypeORM 0.3 `relations` **중첩 객체 리터럴** 형태(`relations: { workflow: { creator: true } }`)를 스캔도 테스트도 하지 않는다 — 최상위 프로퍼티만 순회. 배열 형태의 중첩 경로(`'member.user'`)는 대조군이 있으나 객체 형태의 중첩은 스캔 로직도 fixture 도 없어, 이 가드가 막으려는 결함 클래스(정의를 한 칸 좁게 잡아 유출을 놓침)를 자신이 반복할 수 있는 자리 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`userRelationInInitializer` 객체 리터럴 분기), `fixtures/user-relation-load.fixture.ts` | fixture 에 중첩 객체 위반 대조군 추가 + 객체 분기를 재귀적으로 확장. 최소한 가드 docstring 에 "중첩 객체 형태는 대상 밖" 한계를 명시 |
| 3 | MAINTAINABILITY | 신규 e2e 라벨 `J.` 가 유일성은 회복했지만(직전 `F.` 중복 해소), 물리적으로는 `D.`와 `E.` 사이에 삽입되어 이 파일이 지금까지 유지해 온 "라벨=등장 순서" 관례를 처음으로 깬다(`A, S, B, C, D, J, E, F, G, H, I` 순) | `codebase/backend/test/workspace-rbac.e2e-spec.ts:287`(`J.`, 앞 `:231` `D.`, 뒤 `:326` `E.`) | `J.` 를 `I.`(:585) 뒤로 옮겨 물리적/라벨 순서를 재정렬하거나, 라벨이 "추가 순서"를 의미하지 않는다는 점을 헤더에 명시 |
| 4 | DOCUMENTATION | plan 완료 노트가 "§5.4 계약 대조 DTO 가 하나 늘었다"고 적었지만, 같은 diff 안에서 Critical 1 을 닫으며 추가된 `workflow-crud.e2e-spec.ts` 신규 테스트가 `WorkflowVersionDto` 를 `assertMatchesContract` 에 처음 배선해 실제로는 **둘**(`WorkspaceMemberDto`·`WorkflowVersionDto`) 늘었다 — 최종 diff 기준 수치가 stale | `plan/in-progress/spec-draft-nullable-notation-followups.md:356-359` | "하나 늘었다"를 "둘 늘었다"로 정정하거나, 이 문장도 재실측 대상에 포함 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SIDE_EFFECT | `WorkflowVersionsService.findOne` 의 TS 반환 타입은 여전히 `Promise<WorkflowVersion>`(전체 `User` 약속)인데 실제 런타임 값은 3필드로 좁혀짐 — 타입-런타임 불일치(안전한 방향이나, 향후 `creator.xxx` 신규 참조 시 컴파일은 통과하고 런타임 `undefined`) | `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne`) | 반환 타입을 `Pick<User,'id'|'name'|'email'>` 류로 좁혀 컴파일 타임에도 드러나게 하는 후속 보강 검토 |
| 2 | REQUIREMENT | `spec/3-workflow-editor/5-version-history.md` §7.2 가 `creator` 하위 필드 narrowing(`id`·`name`·`email`)을 명시하지 않아, 이번 유출이 그 스펙 정밀도 gap 배경에서 발생했다(spec 위반은 아님) | `spec/3-workflow-editor/5-version-history.md` §7.1(96-101)·§7.2(103-108) | planner 턴에서 `creator: { id, name, email }` 형태를 명시, 이미 등재된 후속 항목에 셋째로 묶기 |
| 3 | REQUIREMENT / DOCUMENTATION | 신규 e2e 테스트(`workflow-crud.e2e-spec.ts` 게이트 513)가 이 파일의 `A.`~`G.` 레터 관례를 따르지 않는다 — 다른 파일(workspace-rbac `J.`)은 정확히 인용하면서 정작 자신이 속한 파일 관례는 미적용. 외부 문서(`plan/complete/workflow-duplicate-nodes-edges.md`)가 이 파일을 레터로 인용하는 선례가 있어 향후 이 케이스만 예외로 남음 | `codebase/backend/test/workflow-crud.e2e-spec.ts:513` | 다음 미사용 레터 `H.` 를 제목 앞에 부여 |
| 4 | TESTING | `enclosingName` 의 "메서드가 변수보다 우선" 설계 근거가 그 근거로 든 구체 코드 형태(`const stored = ...`)로 어떤 fixture 에서도 실행되지 않는다 — 이 우선순위를 뒤집는 뮤턴트도 현재 스위트는 초록 | `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` (`enclosingName`) | fixture 에 중간 변수를 두는 위반 함수 추가해 `#<함수명>` 키를 직접 단언 |
| 5 | TESTING | `hasProjectionFor` 가 배열 형태 `relations` + 동일 `select` 조합에 대한 대조군이 없음(현재 production 은 객체 형태만 사용해 실질 위험 낮음) | `fixtures/user-relation-load.fixture.ts` (준수 2) | 여유 있으면 배열 형태 + select 조합의 준수 대조군 추가 |
| 6 | MAINTAINABILITY | "점으로 구분된 경로의 마지막 세그먼트" 추출 로직이 3곳(`userRelationInInitializer`·`findUserRelationLoads`·`isUserRelationPath`)에 인라인으로 반복, 폴백값만 다름 | `user-entity-exposure-guard.ts` | `lastPathSegment(value)` 헬퍼 하나로 통합 |
| 7 | SECURITY / SCOPE / SIDE_EFFECT | `WorkspaceMemberDto.joinedAt` 필드 추가는 `WorkspacesService.listMembers` 가 이미 무조건 실어 온 값의 뒤늦은 선언 보강이며 wire 동작 변경 없음(3개 reviewer 중복 확인, additive) | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` | 조치 불요 |
| 8 | SECURITY | CHANGELOG 에 과거 유출 사고의 구체 세부사항(노출 컬럼명·엔드포인트·권한)이 평문 기록됨 — 이미 패치 완료 상태이고 이 저장소의 확립된 관례라 지금은 결함 아님 | `CHANGELOG.md` | 저장소 공개 정책 변경 시 과거 항목 민감도 재검토 권장(이번 diff 범위 밖) |
| 9 | SCOPE | fix 커밋이 이전 리뷰/consistency 세션의 harness 상태 파일(`_retry_state.json` 등)까지 함께 커밋 — 저장 위치 규약에는 부합하나 이 파일이 매 세션 영구 보존 대상인지는 이 diff 만으로 판단 불가 | `review/code/.../10_13_22/_retry_state.json`, `review/consistency/.../10_13_23/_retry_state.json` | 영구 보존 의도 여부 한 번 확인해 관례 명확화 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 직전 Critical(User 전체 컬럼 유출) 수정 확인, 신규 검출 가드 2축 실효성 확인. 신규 결함 없음 |
| requirement | LOW | 직전 Critical 완전히 닫힘 실측 확인. spec §7.2 필드 narrowing 미명시(배경 gap), relations 중첩 객체 미검출 재확인 |
| scope | NONE | feat/fix 두 커밋 모두 선언 범위와 diff 일치. WorkspaceMemberDto.joinedAt 은 정당한 곁가지 |
| side_effect | NONE | 실질 side-effect 표면 2곳(creator 투영 축소, joinedAt 선언)만 존재, 둘 다 안전. 전역 가변 상태·네트워크·FS 쓰기 없음 |
| maintainability | LOW | creator 프로젝션 리터럴 4곳 수기 복제(WARNING), e2e 라벨 순서 관례 이탈(WARNING) |
| testing | LOW | 핵심 회귀는 unit+e2e 삼중 봉인. 구조 가드의 중첩 객체 relations 미검출(WARNING), enclosingName 설계 근거 미검증(INFO) |
| documentation | LOW | 인라인 주석/JSDoc 전부 코드와 일치. plan 완료 노트 DTO 카운트 stale(WARNING), e2e 레터 관례 누락(INFO) |

## 발견 없는 에이전트

없음 — 전원 최소 INFO 이상 기록. 단, security·scope·side_effect 는 신규 실질 결함(WARNING 이상) 없이 확인/재확인성 INFO 만 보고(위험도 NONE).

## 권장 조치사항

1. `creator` 투영 리터럴(`{ id, name, email }`)을 `WorkflowVersionCreatorDto` 에서 파생되는 단일 상수로 통합 — 보안 경계를 이루는 값이 4곳에 수기 복제된 상태를 해소 (WARNING #1)
2. 구조 가드에 TypeORM 0.3 중첩 `relations` 객체 형태(`{ workflow: { creator: true } }`) 스캔 추가 + fixture 위반 대조군 신설 (WARNING #2)
3. e2e 라벨 `J.` 를 물리적 마지막 위치로 재정렬하거나 라벨 의미(추가 순서 아님)를 헤더에 명시 (WARNING #3)
4. plan 완료 노트의 "§5.4 계약 대조 DTO 하나 늘었다"를 최종 diff 기준 "둘"로 정정 (WARNING #4)
5. (선택, planner 후속) spec §7.2 에 `creator` 하위 필드 형태(`id`·`name`·`email`) 명시해 이번 유출의 근본 배경 gap 을 닫기 (INFO #2)
6. (선택) 신규 e2e 테스트에 미사용 레터 `H.` 부여, `enclosingName`/`hasProjectionFor` 커버리지 갭 보강, `lastPathSegment` 헬퍼 통합 (INFO #3·#4·#5·#6)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전원 — forced 화이트리스트 7명 전원 결과 확보됨, 누락 없음)
  - **제외**: 아래 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위 밖 |
  | architecture | router 판단상 이번 diff 범위 밖 |
  | dependency | router 판단상 이번 diff 범위 밖 |
  | database | router 판단상 이번 diff 범위 밖 |
  | concurrency | router 판단상 이번 diff 범위 밖 |
  | api_contract | router 판단상 이번 diff 범위 밖 |
  | user_guide_sync | router 판단상 이번 diff 범위 밖 |