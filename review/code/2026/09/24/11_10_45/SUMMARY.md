# Code Review 통합 보고서

## 전체 위험도

**HIGH** — CHANGELOG 미갱신(직전 항목의 전방 참조가 이제 거짓) 1건이 CRITICAL 로 확인됐다. 보안·기능·DB 관점에서는 코드 자체의 신규 결함이 없고(이 diff 는 오히려 존재/owner 오라클을 닫는 유효한 보안 수정), 나머지는 문서 정합성 WARNING 5건(그중 2건은 developer 가 즉시 수정 가능한 stale 테스트 주석, 2건은 spec 카탈로그 서술로 developer 권한 밖이라 planner 등재 필요) 및 테스트 커버리지 WARNING 1건이다. forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 는 전원 결과를 확보했고 화이트리스트 미이행 사례는 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `CHANGELOG.md` 미갱신 — 바로 앞 PR(`fc56873be`)이 "남는 것: `removeMember()` 의 권한 검사 순서 오라클은 여전히 열려 있다"고 예고했는데, 이번 PR이 정확히 그 오라클을 닫으면서도 `CHANGELOG.md` 를 건드리지 않아 그 전방 참조가 이제 거짓이 됐다. 같은 파일의 `:130`·`:173` 은 선행 PR 이 닫힐 때 취소선으로 정정하는 관례를 보이는데 이번 항목만 그 관례를 건너뛰었다 | `CHANGELOG.md:31` | 신규 CHANGELOG 항목 추가(요청자 role 을 대상 조회보다 먼저 확인 → 비-멤버는 항상 `NOT_A_MEMBER`, admin 판정이 owner 판정보다 앞으로 이동) + `:31` 의 "남는 것" 문장을 `:130`/`:173` 과 같은 취소선 방식으로 정정 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | self-removal 이 admin 판정보다 먼저 통과해야 한다는 설계 의도(코드 주석이 명시적 근거로 듦)를 직접 검증하는 unit 테스트가 없다 — 유일한 self-removal 테스트가 admin-tier(`owner`) 요청자를 쓰고 있어, self 위임 분기를 admin 판정 뒤로 옮기는 회귀가 나도 unit 스위트는 초록일 수 있다. e2e 동시성 테스트가 `editor` 로 이 경로를 부산물로 실행하나 목적이 다르고 느리다 | `workspaces.service.spec.ts:1730` (설계 근거: `workspaces.service.ts:826`) | `wireFindOne({..role:'editor'})` 조합으로 "비-admin 이 자기 자신을 제거하면 `leaveWorkspace` 로 위임되고 `ADMIN_REQUIRED` 가 나지 않는다"를 직접 단언하는 unit 테스트 추가 |
| 2 | Documentation | `wireFindOne` 헬퍼 docstring 이 제거된 `assertAdmin()` 호출을 그대로 언급(stale) — 이번 diff 로 `removeMember()` 는 더 이상 `assertAdmin()` 을 호출하지 않고 `getMemberRole()` 을 직접 호출하는데, 헬퍼 주석은 "`assertAdmin` 이 부르는 요청자 멤버십"이라고 서술해 새 JSDoc(`:908-912`)과 어긋난다 | `workspaces.service.spec.ts:1473-1474` | "`removeMember` 가 `getMemberRole` 로 직접 읽는" 식으로 갱신(developer 가 즉시 수정 가능, codebase 소속) |
| 3 | Documentation | "후속 PR 이 `assertAdmin` 을 앞으로 옮길 예정" 이라는 예고 문구가 실제 구현(assertAdmin 자체는 안 옮기고, `removeMember` 안에 별도 `getMemberRole`+`throwAdminRequired` 경로를 신설)과 다르게 남아 있다 | `workspaces.service.spec.ts:1660-1664` | 예고 문장을 과거형·정확한 메커니즘으로 갱신(developer 가 즉시 수정 가능, codebase 소속) |
| 4 | Documentation / API Contract | `spec/5-system/3-error-handling.md` 의 `ADMIN_REQUIRED` 카탈로그 설명이 발행처를 `WorkspacesService.assertAdmin()` 단수로 못박고 있는데, 이번 diff 이후 `removeMember()` 는 `assertAdmin()` 을 거치지 않고 `throwAdminRequired()` 를 직접 호출해 같은 코드를 던진다 — 의미는 동일하나 서술이 더 이상 완전하지 않다 | `spec/5-system/3-error-handling.md:46` | 같은 `--impl-prep` 라운드가 이미 등재한 `NOT_A_MEMBER` 카탈로그 planner 백로그 항목에 `ADMIN_REQUIRED` 행도 함께 묶어 등재(`spec/` 은 developer 쓰기 권한 밖) |
| 5 | API Contract | `spec/5-system/1-auth.md`§3.2 정정 노트가 "`removeMember()` 는 `assertAdmin(workspaceId, requesterId)` 만 요구한다"고 서술하는데, 이번 리팩터로 `removeMember` 는 더 이상 `assertAdmin()` 을 호출하지 않는다(결론 "Admin 이 멤버 삭제 가능"은 여전히 참이나 인용된 구체 호출 경로가 stale). 이번 세션의 `--impl-prep` 산출물에도 이 줄에 대한 언급이 없어 아직 아무도 잡지 않은 신규 spec 진부화다 | `spec/5-system/1-auth.md:551` | CLAUDE.md 자기-반증형 소정정 예외 대상 아님(제품 정의/API 계약이라 조건 2 배제, 이 문장을 developer 가 쓴 것도 아님) — `plan/in-progress/member-auth-order.md` 또는 관련 planner 백로그에 후속 항목으로 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | 동일 컨트롤러의 다른 13개 라우트가 여전히 가드 계층 보호 없이 서비스 계층 순서에만 의존하는 구조적 갭이 남아 있다(`@Param('id')` + `@Roles()`/`@WorkspaceId()` 부재). 이번 diff 가 새로 만든 문제는 아니며 plan 문서(`member-auth-order.md` §E)가 이미 실측·인지해 별도 항목("13-라우트 축")으로 분리 등재했다 | `workspaces.controller.ts` (예: 131, 158, 192, 216, 237, 267, 290, 316 등) | plan 에 이미 등재된 후속 항목에서 구조적 해법(가드가 경로 파라미터 기반 워크스페이스 id 도 인식) 검토 우선순위 유지 |
| 2 | Side Effect / API Contract | 비-admin 멤버가 owner 를 지목했을 때 wire 에러 코드가 `CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED` 로 바뀐다(의도된 breaking change). HTTP 상태는 403 으로 동일. 사내 프런트(`RoleGate minRole="admin"`으로 버튼 자체가 가려짐, 코드가 아닌 message 텍스트만 소비)는 영향 없음을 실측 확인했으나, 이 코드로 분기하는 외부/서드파티 연동이 있다면 깨질 수 있다 | `workspaces.service.ts:843-850` | API 변경 이력에 이 `code` 값 변경을 명시적으로 남겨 향후 회귀 방지(현재도 커밋 근거는 충분) |
| 3 | Testing | 비-admin 요청자 + 대상 부재(404) 조합을 직접 검증하는 unit 테스트가 없다 — 대상 존재(404) 판정이 admin 판정보다 앞이라는 순서 계약을 뒤집는 뮤턴트가 현재 스위트에서 생존 가능(보안적으로 심각하지는 않음, 요청자가 이미 유효 멤버라 노출 범위가 비-멤버 오라클과 다름) | `workspaces.service.spec.ts:1641` vs `workspaces.service.ts:834-847` | `wireFindOne(null, {role:'editor'})` 조합으로 `MEMBER_NOT_FOUND` 단언 테스트 추가 |
| 4 | Testing | "요청자 role 을 한 번만 읽는다"는 최적화 의도(주석에 명시)를 지키는 회귀 테스트(`toHaveBeenCalledTimes`)가 없어, 조용히 쿼리가 늘어나도 반증 불가능한 상태 | `workspaces.service.ts:829-830` | 대표 성공 경로에 `findOne` 호출 횟수 단언 추가 |
| 5 | Maintainability | `where` 기반 mock 라우팅 로직("`opts.where.id` 로 요청자 role 조회와 대상 조회를 가른다")이 서로 다른 `describe` 블록 2곳에 각자 구현돼 중복된다(각 5~12줄, 당장 부담은 낮음) | `workspaces.service.spec.ts:1291-1303`, `:1492-1502` | `removeMember` mock 구성이 더 늘어나면 파일 상단 공용 헬퍼로 추출 고려(선택적) |
| 6 | Maintainability | 같은 `describe` 블록 안에 order-coupled(`mockResolvedValueOnce` 체인)와 where-routed mock 관용구가 공존한다 — `addMemberByEmail`/`updateMemberRole` 테스트는 여전히 순서-결합 방식이라 향후 그 서비스 메서드들의 조회 순서가 바뀌면 같은 방식으로 깨질 잠재적 취약점이 남는다 | `workspaces.service.spec.ts:1224-1284` | 해당 메서드들의 조회 순서를 건드리는 후속 PR 이 있을 때 where-라우팅 방식으로 전환 고려 |
| 7 | Side Effect | self-removal 및 대상-부재 경로에서 `getMemberRole` 조회가 추가로 한 번 더 발생한다(종전엔 self 분기가 `assertAdmin` 도달 전 `return` 되어 미발생). 기능 결함 아님, 성능 영향 무시 가능 수준 | `workspaces.service.ts:829-830` 주석, `leaveWorkspace:668-671` | 문서화 목적이면 "self 위임 시 `leaveWorkspace` 가 별도 재조회(락 포함)한다" 한 줄 추가(필수 아님) |
| 8 | Requirement / Documentation | `spec/5-system/3-error-handling.md` 의 `NOT_A_MEMBER` 카탈로그 예시 경로 열거에 `removeMember` 가 없다(발행 모듈 자체는 이미 `workspaces.service` 로 포괄 기재돼 의미상 모순은 아님) | `spec/5-system/3-error-handling.md:49` | 조치 불필요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 planner 백로그 항목으로 등재됨 |
| 9 | Documentation | `removeMember()` JSDoc 의 "인가(앞의 둘)" 표현이 5단계 순서 목록의 위치(1·2번째)와 실제 의미(1·4번째: 멤버십·admin)가 어긋나 모호하다(결론 자체는 옳음) | `workspaces.service.ts:804-808` | "인가(멤버십·admin)"처럼 이름으로 명시하거나 보장 범위를 "비-멤버는"으로 한정 |

**해당 없음 / 문제 없음으로 분류된 확인 사항**: 하드코딩된 시크릿·SQL 인젝션·암호화 약화·에러 메시지 상세 노출(Security, Database) 없음. 마이그레이션/스키마 변경(Database) 없음. N+1/추가 라운드트립(Database) 없음 — 거부 경로는 오히려 쿼리 1회로 감소. 스코프 이탈·불필요한 리팩토링·포맷팅/임포트/설정 변경(Scope) 없음. `removeMember` 시그니처·공개 인터페이스 불변(Side Effect).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인가 순서 재배치가 존재/owner 오라클을 정확히 닫음, 신규 취약점 없음. 13-라우트 구조적 갭은 기존 plan 항목 |
| requirement | LOW | 구현·테스트·plan·spec 이 line-level 로 정합. 잔여 카탈로그 누락은 이미 planner 위임됨 |
| scope | NONE | `removeMember` 인가 순서 재배치라는 단일 목적에 타이트하게 수렴, 무관 변경 없음 |
| side_effect | LOW | wire error code 변경(CANNOT_REMOVE_OWNER→ADMIN_REQUIRED) 고지, self-removal 경로 중복 조회 미미 |
| maintainability | LOW | mock 라우팅 로직 중복 2건, mock 관용구 혼재 1건 — 모두 즉시 조치 불요 |
| testing | LOW | self-removal/admin 순서, 404/admin 순서를 직접 검증하는 unit 부재(WARNING 1 + INFO 2) — 뮤테이션 테스트 실측은 모범적 |
| documentation | MEDIUM | CHANGELOG 미갱신(CRITICAL) + stale 테스트 주석 2건 + spec 카탈로그 서술 1건 |
| database | NONE | 스키마/인덱스/트랜잭션 변경 없음, 쿼리 파라미터화 유지 |
| api_contract | LOW | `1-auth.md:551` stale 서술(신규 발견) + wire code 변경 고지 |

## 발견 없는 에이전트

없음 — 9개 에이전트 전원이 최소 1건 이상의 INFO/WARNING/CRITICAL 발견사항을 보고했다.

## 권장 조치사항

1. `CHANGELOG.md:31` 의 "남는 것" 전방 참조를 이번 PR 이 닫은 오라클로 정정하고(취소선), 이번 변경 내용을 신규 항목으로 추가한다 (CRITICAL).
2. `workspaces.service.spec.ts:1730` 에 비-admin(editor) self-removal 이 admin 판정보다 먼저 통과함을 직접 단언하는 unit 테스트를 추가한다 (WARNING #1).
3. `workspaces.service.spec.ts` 의 stale 주석 2곳(`:1473-1474`, `:1660-1664`)을 실제 구현(`getMemberRole` 직접 호출, `assertAdmin` 미이동)에 맞게 갱신한다 — developer 권한으로 즉시 수정 가능 (WARNING #2, #3).
4. `spec/5-system/1-auth.md:551` 과 `spec/5-system/3-error-handling.md:46` 의 stale 서술을 planner 백로그(`member-auth-order.md` 또는 `spec-draft-nullable-notation-followups.md`)에 등재한다 — `spec/` 은 developer 쓰기 권한 밖 (WARNING #4, #5).
5. (선택) `workspaces.service.spec.ts:1641` 비-admin+대상부재 조합, `getMemberRole` 호출 횟수 고정 등 테스트 커버리지 갭을 보강한다 (INFO #3, #4).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 범위 밖으로 제외 |
  | architecture | router 판단 — 이번 diff 범위 밖으로 제외 |
  | dependency | router 판단 — 이번 diff 범위 밖으로 제외 |
  | concurrency | router 판단 — 이번 diff 범위 밖으로 제외(단, database/testing 리뷰가 동시성 DELETE 원자성·동시 제거 e2e 를 부수적으로 확인함) |
  | user_guide_sync | router 판단 — 이번 diff 범위 밖으로 제외 |