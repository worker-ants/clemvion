# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 1건(plan 전방 참조가 아직 존재하지 않는 경로를 가리킴, 문서 표현 문제). 11개 reviewer(forced 7명 전원 포함) 모두 전문을 확보해 "결과 없음" 갭은 없다. `removeMember()` 인가 순서 재배치는 신규 취약점이 아니라 기존 존재·owner 오라클을 닫는 보안 수정으로 다수 reviewer 가 독립 확인했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | `plan/complete/member-auth-order.md` 를 가리키는 전방 참조 2곳이 diff 시점에 아직 존재하지 않는 경로다(실제 plan 은 `plan/in-progress/`에 있고 체크리스트 미완). backtick 코드텍스트라 markdown 링크 전용 build guard 도 못 잡는다 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4945,4956` | 지금 시점 인용을 `plan/in-progress/member-auth-order.md` 로 고치거나 "이 PR 종료 시 이동 예정" 을 명시. plan 이동 커밋에서 재확인 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `removeMember()` 가 더 이상 `assertAdmin()` 을 호출하지 않도록 리팩터됐으나, `1-auth.md:551`·`3-error-handling.md:46,49` 는 여전히 옛 호출 경로("`assertAdmin()` 만 요구"/"발행처 단수")를 근거로 서술돼 낡았다. 결론(Admin 이 삭제 가능·`ADMIN_REQUIRED` 의미)은 여전히 참이라 코드 결함 아님 | `spec/5-system/1-auth.md:551`, `spec/5-system/3-error-handling.md:46,49` | 코드 변경 불요. `developer` 쓰기 권한 밖(자기-반증형 소정정 조건 불충족: developer 가 쓴 문장 아님 + API 계약 서술)이라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 백로그로 정확히 이관됨 — planner 턴에서 spec 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 인가 순서 재배치(요청자 멤버십을 대상 조회보다 먼저 확인)는 신규 취약점이 아니라, 가드 계층이 이 라우트를 보호하지 못하는 조건(`@Roles()` 없음 + `handlerConsumesWorkspaceId` false → `RolesGuard` 단축 통과)에서 비-멤버가 응답 차이로 대상 존재·owner 여부를 추론하던 오라클을 닫는 보안 수정. 신규 e2e 가 헤더 미부착 상태에서 세 응답이 `new Set` 크기 1 로 구분 불가능함을 성질 단언으로 검증 | `workspaces.service.ts:814-850`, `workspace-rbac.e2e-spec.ts:669-732` | 없음(확인 완료) |
| 2 | API계약 / 부작용 | 비-admin 이 owner 를 지목할 때 wire `error.code` 가 `CANNOT_REMOVE_OWNER`→`ADMIN_REQUIRED` 로 바뀌는 계약 변경. HTTP 상태(403) 동일, 사내 프런트는 코드값 미소비 + 버튼이 `RoleGate minRole="admin"` 으로 가려져 영향 없음(실측). `CHANGELOG.md` 에 이미 고지 | `workspaces.service.ts:847,850`, `CHANGELOG.md:28-30` | 없음(고지 완료) |
| 3 | 성능 | 요청자 role 조회와 대상 조회의 순차 await 은 의도적 — 비-멤버 거부 시 대상 조회 자체를 생략해 종전보다 쿼리 1회 감소(테스트가 `targetLookups.toHaveLength(0)` 로 명시 검증). `Promise.all` 병렬화는 이 최적화와 회귀 테스트를 깨뜨림 | `workspaces.service.ts:831,834-836` | 현행 순차 구조 유지 |
| 4 | 동시성 | 요청자 자신의 admin 권한 판정 TOCTOU 창이 대상 조회 await 만큼 넓어졌으나, 형제 메서드(`addMemberByEmail`·`updateMemberRole`)가 이미 이와 같거나 더 큰 창을 가져 새로운 위험 유형은 아님. owner 승격 경쟁은 `role: Not('owner')` + EvalPlanQual 재평가로 별도 방어됨(불변) | `workspaces.service.ts:831,834,847,877` | 즉시 조치 불요. "권한 회수 즉시 반영" 요구사항이 생기면 세 메서드를 한 axis 로 묶어 재검토 |
| 5 | 테스트 | 대상 부재(404) 판정과 admin 판정의 상대 순서를 비-admin 요청자로 가르는 테스트가 없음 — 같은 파일이 admin/owner, self/admin 순서는 각각 전용 조합으로 가르는데 이 조합만 비대칭으로 비어 있음 | `workspaces.service.spec.ts` (`대상이 없으면 삭제를 시도하지 않는다`) | `wireFindOne(null, { role: 'editor' })` 조합으로 `MEMBER_NOT_FOUND` 를 단언하는 테스트 추가 |
| 6 | 테스트 | "요청자 role 을 한 번만 읽는다" 는 설계 의도(주석)를 지키는 쿼리-횟수 회귀 테스트가 없음 | `workspaces.service.ts:829-830` | 대표 admin 제거 성공 경로에 `findOne` 호출 횟수(2회) 단언 추가 |
| 7 | 유지보수성 | `removeMember()` 가 6개 책임(요청자 인가/self위임/owner가드/원자적 DELETE/0-affected 판별/감사로그)을 한 함수에 담아 책임 수가 늘었으나 guard-clause 형태로 가독성은 유지 — 직전 라운드가 이미 "현 상태 유지 가능"으로 결론낸 동일 함수 | `workspaces.service.ts:814-906` | 조치 불요. 향후 분기 추가 시 인가 부분을 별도 헬퍼로 추출 고려 |
| 8 | 유지보수성 | `where` 기반 mock 라우팅 로직이 두 `describe` 블록에 중복 — 직전 라운드부터 잔존, 이번 diff 로 시그니처가 소폭 더 벌어짐 | `workspaces.service.spec.ts:1291-1303, 1498-1511` | 조치 불요, 추가로 늘어나면 공용 헬퍼 추출 고려 |
| 9 | 문서화 | `removeMember()` JSDoc 의 "인가(앞의 둘)" 표현이 5단계 나열 순서와 어긋나 위치 지칭 오독 유발(결론 자체는 정확) — 직전 라운드부터 유예된 채 잔존 | `workspaces.service.ts:805` | 위치 대신 이름으로 재지칭("인가(멤버십·admin)") 하도록 재서술 |
| 10 | 부작용 | self-removal/대상-부재 경로에서 `getMemberRole` 조회가 한 번 더 발생 — `leaveWorkspace` 내부 `pessimistic_write` 재조회와 부분 중복이나 잠금 없는 읽기라 경합 안전성 영향 없음, 무시 가능한 수준 | `workspaces.service.ts:831,840-842` | 조치 불요 |
| 11 | 유저가이드동기화 | `auth-session-flow-change` trigger 매칭(인가 순서 변경) — 확인 결과 `07-workspace-and-team/workspaces-and-members.mdx` 의 RBAC 서술은 이미 정확했고, 이번 PR 은 그 문서화된 모델을 어기던 구현 결함을 고친 것이라 가이드 갱신 대상 없음. e2e 는 동일 커밋 세트에 추가돼 target 충족 | `workspaces-and-members.mdx` §역할(RBAC) | 없음 |
| 12 | 범위 | 예외 리터럴 `throwNotAMember()`/`throwAdminRequired()` 추출이 `removeMember` 밖의 기존 `assertMembership`/`assertAdmin` 본문도 함께 바꿔 diff 범위가 소폭 넓어짐 — plan 에 사전 근거 있고 동일 리터럴 순수 추출이라 동작 변화 없음 | `workspaces.service.ts:913-942` | 조치 불요. 헬퍼 시그니처/리터럴이 바뀌면 재검토 |
| 13 | 요구사항 | plan(`member-auth-order.md` §B) 이 규정한 순서(멤버십→대상 존재→self 위임→admin→owner)가 line-level 로 정확히 구현됨. `removeMember` 관련 unit 14/14, 전체 스위트 80/80 실측 통과, 독립 뮤테이션(M4 재현, self-위임을 admin 판정 뒤로 이동)으로 정확히 1건만 실패함을 재확인 | `workspaces.service.ts:814-851`, `workspaces.service.spec.ts:1702-1781` | 없음 |
| 14 | 보안 | 멤버(비-admin) 대상 응답 차이는 새로 생긴 정보가 아니다 — `listMembers` 가 admin 불요로 이미 동일 정보(존재·role) 노출 | `workspaces.service.ts:205-235` vs `:834-850` | 없음(향후 `listMembers` 권한이 강화되면 재검토) |
| 15 | 보안 | SQL 인젝션·하드코딩 시크릿 없음(TypeORM repository API + 파라미터화된 raw 쿼리) | `workspaces.service.ts` 전체, `workspace-rbac.e2e-spec.ts:694-697,727-730` | 없음 |
| 16 | 보안(구조적 갭, 별도 트래킹) | 동일 컨트롤러 17개 라우트 중 13개가 이번 PR 이 닫은 것과 동일한 가드 우회 조건(`@Roles()`/`@WorkspaceId()` 둘 다 없음)을 공유 — 새 발견 아니며 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 별 항목·조건과 함께 등재됨 | `workspaces.controller.ts` (update·updateSettings·listMembers 등) | 이 PR 스코프 밖, 이미 추적됨 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 아님 — 존재/owner 오라클을 닫는 보안 수정. SQLi·시크릿 노출 없음 |
| performance | NONE | 순차 await 은 의도된 쿼리 절감 최적화, 회귀 없음 |
| requirement | NONE | plan 명세와 line-level 일치, 테스트 14/14·80/80 통과, spec stale 2건은 SPEC-DRIFT 로 적절히 이관 |
| scope | NONE | 단일 목적에 수렴, 헬퍼 추출로 인한 소폭 범위 확장은 사전 근거 있음 |
| side_effect | LOW | wire `error.code` 변경(고지·영향 없음 확인), 쿼리 1회 증가는 무시 가능 |
| maintainability | NONE | 책임 수 증가하나 가독성 유지, 잔존 사소 항목 2건 재확인(직전 라운드부터) |
| testing | LOW | self-removal 회귀 테스트 신규 추가·뮤턴트로 검증 완료, 404-vs-admin 순서 테스트 갭은 잔존 |
| documentation | LOW | CHANGELOG/docstring 정정 확인, WARNING 1건(plan 전방 참조) + JSDoc 표현 잔존 |
| concurrency | LOW | TOCTOU 창 소폭 확대되나 형제 메서드와 동일 수준, 실행 가능한 결함 없음 |
| api_contract | LOW | wire 코드 변경 고지 완료, spec stale 이관 적절, 에러 포맷·HTTP 상태 컨벤션 일관 |
| user_guide_sync | NONE | `auth-session-flow-change` trigger 매칭했으나 가이드·e2e 갭 없음 |

## 발견 없는 에이전트

없음 — 11개 에이전트 전원이 최소 1건 이상의 INFO(또는 그 이상) 발견을 보고했다.

## 운영 참고 (코드 발견 아님)

maintainability reviewer 가 리뷰 도중 `workspaces.service.ts` 에서 다른 세션의 뮤테이션 테스트로 보이는 미커밋 변경(M4 재현, admin 검사를 self-위임 분기 앞으로 이동)을 일시 관측했다고 보고했다. 되돌리지 않고 원본 기준 결과만 보고했으며, 이번 SUMMARY 취합 시점 `git status --short` 로 재확인한 결과 해당 워크트리에는 리뷰 산출물 디렉터리 외 변경이 없다(다른 세션 작업은 이미 정리됨). 코드 결함이 아니므로 위 표에 포함하지 않았다.

## 권장 조치사항

1. (WARNING) `plan/in-progress/spec-draft-nullable-notation-followups.md:4945,4956` 의 `plan/complete/member-auth-order.md` 전방 참조를 현재 경로(`plan/in-progress/`)로 고치거나 이동 예정 문구를 덧붙인다 — plan 이동이 이 PR 마지막 커밋에서 실제로 일어난다면 그 커밋에서 재확인.
2. (SPEC-DRIFT) `spec/5-system/1-auth.md:551`·`3-error-handling.md:46,49` 의 `assertAdmin()` 단수 호출 서술을 현재 구현(`getMemberRole` 직접 호출 + `throwAdminRequired()`)에 맞게 planner 턴에서 갱신한다. 코드 변경 불요.
3. (INFO, 선택) `wireFindOne(null, { role: 'editor' })` 조합으로 404-vs-admin 판정 순서를 가르는 테스트를 추가해 커버리지 비대칭을 해소한다.
4. (INFO, 선택) 요청자 role 단일 조회 의도를 지키는 `toHaveBeenCalledTimes` 회귀 테스트를 추가한다.
5. 그 외 INFO 항목은 이미 직전 라운드부터 유예되거나 별도 plan 항목으로 추적 중이므로 이번 PR 을 막을 사유가 아니다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 diff(단일 메서드 인가 순서 재배치)와 무관 |
  | dependency | 신규/변경 의존성 없음 |
  | database | 스키마·마이그레이션 변경 없음(쿼리 순서만 변경) |