---
title: 경로 파라미터 워크스페이스도 가드가 보고, 가드 거부는 코드를 갖는다 — 구현
status: in-progress
owner: developer
worktree: workspace-path-guard
spec_impact:
  - spec/data-flow/12-workspace.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/1-auth.md
  - spec/5-system/13-replay-rerun.md
  - spec/5-system/2-api-convention.md
  - spec/conventions/swagger.md
  - spec/conventions/error-codes.md
  - spec/2-navigation/6-config.md
  - spec/2-navigation/9-user-profile.md
started: 2026-09-25
---

# 구현 — 같은 PR 의 spec 커밋 `e2257707` 을 참으로 만든다

설계 결정 · 실측 · spec 변경은 `plan/complete/spec-draft-workspace-path-guard.md` 와 커밋 `e2257707`(planner 턴) 에 있다. 착지 방식은
**spec 과 구현을 한 PR 에**(그 draft §B-1) — 이 plan 의 체크리스트가 끝나기 전에는 머지하지 않는다. 트래커 항목 «경로 파라미터로
워크스페이스를 받는 라우트 13개가 가드 층 보호를 전혀 못 받는다» 는 이 plan 이 닫는다.

## 구현 요구 (draft §D)

1. `@WorkspaceParam('<name>')` 파라미터 데코레이터 + `RolesGuard` 인식(팩토리 identity · 등록 이름 · 경로 값). 부트 캐너리가 경로
   소비자도 센다. `nestjs-v12-coordinated-upgrade.md` §C 캐너리 기준값(142) 재실측 · 갱신.
2. 15곳을 `@WorkspaceParam('id')` 로 — 역할 요구는 서비스와 같게: Admin 8(`update` · `updateSettings` · `addMember` · `updateMember` ·
   초대 넷) `@Roles('admin')`, Owner 2(`remove` · `transferOwnership`) `@Roles('owner')`, 멤버 4(`getSettings` · `leave` · `listMembers`
   · `removeMember`) + 전환 1 은 `@Roles()` 없이.
3. 가드 거부 코드 — 비멤버 `NOT_A_MEMBER`, 멤버의 역할 미달 `EDITOR_REQUIRED` / `ADMIN_REQUIRED` / `OWNER_REQUIRED`(최소 요구 역할).
   메시지는 서비스와 같은 한국어. 가드는 파이프보다 먼저 돌므로 경로 값은 `isUuidShaped` 로만 보고 형식이 아니면 넘긴다.
4. 저장소 가드 `workspace-param-binding` — `@Param(...)` 로 받은 파라미터 이름이 `workspaceId` 이거나 `WorkspaceId` 로 끝나면 실패.
   AST · 허용목록 없음 · 공허성(`@WorkspaceParam` 소비 > 0) 단언. `param-uuid-pipe-guard` 모집단에서 빠지는 것을 기록.
5. `leaveWorkspace` · `addMemberByEmail` 인가 선행(두 번째 선의 오라클 제거). (2026-09-25 보탬) `transferOwnership` 도 — 계획 단계
   실측이 놓친 세 번째 오라클을 `/ai-review` 4라운드가 찾았다(`1f616ef05`, spec 정정은 두 번째 planner 턴).
6. frontend 403 표시 — `ERROR_KO` 등재 여부 판단(트래커 «`ERROR_KO` 를 아무도 읽지 않는다» 와 함께).
7. e2e — 라우트 클래스(멤버 · Admin · Owner)마다 비멤버 `NOT_A_MEMBER` · 부재 워크스페이스 같은 응답 · 역할 미달 코드 · 형식 파손
   400 · nil UUID 403 · 헤더 위조 `NOT_A_MEMBER` · `transferOwnership` 이 경로 워크스페이스로 판정.
8. `roles.guard.ts` docstring 의 «별도 작업» 문장 갱신. swagger `@ApiForbiddenResponse` 설명(재실행 · chain · 워크스페이스 라우트).

## `--impl-prep` 경고 처리 (`review/consistency/2026/09/25/15_15_21` — BLOCK: NO, WARNING 5 · INFO 4)

scope 는 12-workspace · 1-auth · 3-error-handling 의 scratch 사본(번들 절단 회피, meta.json `scope_note`). 5 checker 가
나머지 spec 은 저장소 원본을 직접 읽어 대조했다.

| # | 경고 | 처리 |
| --- | --- | --- |
| W1 | `9-user-profile.md` §3 «backend 인가 모델은 불변» 이 경로 라우트 예외(12-workspace «URL slug» 절 2026-09-25 보탬)를 미러링하지 않는다 | **planner 턴** — 제품 정의 문장이라 자기-반증형 소정정 대상이 아니다. 아래 planner 턴에 묶는다 |
| W2 | `1-auth.md` §부트 캐너리 (b) «캐너리는 호출부에 아무것도 요구하지 않는다» 가 (a) 와 달리 정정되지 않았다 | **planner 턴** — 12-workspace 의 두 각주(«보탬» · «정정»)와 같은 모양의 역방향 각주 |
| W3 | 새 저장소 가드 `workspace-param-binding` 이 어느 spec 의 `code:` 에도 없다 | **planner 턴** — `1-auth.md` frontmatter `code:` 에 가드 · fixture 경로 등재(기존 가드도 전부 개별 glob 으로 등재돼 있다) |
| W4 | `spec_impact` 가 spec 커밋이 건드린 9개 중 3개만 담았다 | **이 plan 에서 처리** — frontmatter 를 9개로 넓혔다. `--impl-done` 은 이 9개가 들어가는 scope 로 돌린다 |
| W5 | 가드 이름이 같은 디렉터리의 `workspace-roles-attachment.spec.ts` 와 가깝다 | **이 plan 에서 처리** — 이름은 spec draft · plan 이 이미 쓰는 `workspace-param-binding` 을 유지하고, 새 파일 머리 주석에 두 가드의 경계(이름 패턴 금지 vs 특정 핸들러의 `@Roles` 부착 고정)를 적는다 |

INFO 3(`nestjs-v12-coordinated-upgrade.md` §C 캐너리 기준값 142)은 요구 1 에 이미 있다. INFO 1(`error-codes.md` §5 머리말에 «발행 이력 없는 spec-drift
항목은 §5 대상 아님») 은 W1~W3 planner 턴에 함께 싣는다.

**planner 턴 순서**: 구현 · 테스트가 끝난 뒤 `/ai-review` 전에 연다(`--spec` → spec 반영 → 커밋). `--impl-done` 은 `/ai-review` 수렴 뒤.

## 구현 중 결정

- **요구 6 — `ERROR_KO` 에 등재하지 않는다.** `ERROR_KO` 를 읽는 함수 `translateBackendError` 의 프로덕션 호출부가 0건이다(트래커
  «`ERROR_KO` 의 API 에러 코드 매핑을 아무도 읽지 않는다», 2026-09-25 재확인). 등재하면 죽은 매핑이 늘 뿐이다. frontend 가 코드로
  가르는 자리는 `workspace/settings/page.tsx` 의 `OWNER_REQUIRED` 하나이고 가드도 같은 코드를 낸다.
- **요구 8 의 범위 — 경로 15곳 · 재실행 · chain 만.** 나머지 `@ApiForbiddenResponse` 설명(2026-09-25 실측: «워크스페이스 멤버가 아님»
  63 · «editor 이상 권한 필요» 54 · 기타 20여)은 코드를 싣지 않았지만 틀린 문장은 아니고, `swagger.md §5-4` 는 **새 엔드포인트**
  체크리스트다. 30여 컨트롤러를 건드리면 `--impl-done` 스코프가 spec 영역 여럿으로 번진다 — 트래커 후속으로 등재한다.
- **`param-uuid-pipe` 가드도 `@WorkspaceParam` 을 모집단에 넣는다.** 넣지 않으면 15곳이 그 가드의 문서 축(`@ApiParam({format:'uuid'})`)
  검사에서 조용히 빠진다 — 실측: 모집단 136 유지(분기 없으면 121). 파이프 축은 데코레이터에 내장돼 구조적으로 만족한다.
- **유저 가이드 `07-workspace-and-team/workspaces-and-members.mdx`(+`.en`) — 검토함, 갱신 불필요**(`/ai-review` `16_03_32` W8).
  가이드의 권한 서술(역할별 권한 표 · 나가기 · Owner 이양 · 삭제)은 그대로 참이다 — 누가 무엇을 할 수 있는지는 바뀌지 않았다. 바뀐 것은
  거부 코드(가이드는 코드를 적지 않는다)와, frontend 가 만들지 않는 요청(헤더 워크스페이스 ≠ 경로 워크스페이스)의 판정뿐이다.
- **`@WorkspaceId` + `@WorkspaceParam` 을 함께 쓰는 핸들러**(오늘 0곳)는 경로 워크스페이스에 역할을, 헤더 워크스페이스에 멤버십만
  본다 — 헤더 쪽을 검사 밖에 두면 헤더 위조가 새므로 fail-closed 로 둘 다 본다.

## 체크리스트

- [x] `--impl-prep` — `15_15_21` BLOCK: NO, 경고 처리 위 표
- [x] planner 턴(W1 · W2 · W3 · INFO 1) — `--spec` `review/consistency/2026/09/25/15_50_10` BLOCK: NO, WARNING 1(`2-api-convention.md` §2.3
      미러 누락)을 변경 5 로 반영. draft `plan/complete/spec-draft-workspace-path-guard-followup.md`
- [x] 테스트 선작성(가드 · 데코레이터 · 캐너리 · 저장소 가드 · 서비스 순서) → RED 확인 — 데코레이터(내보내기 없음) · 가드 30 ·
      캐너리 6 · 저장소 가드(위반 15 = spec 실측과 같은 목록) · `param-uuid-pipe` 대조군 2 · 서비스 6. `workspace-roles-attachment`
      의 15곳 표는 구현 뒤에 썼다 — 뮤턴트로 따로 검증한다
- [x] 구현 1~5 · 8 (요구 1 의 캐너리 기준값 재실측은 e2e 부팅 로그에서)
- [x] 뮤턴트(가드 분기마다) — 17개 전부 KILLED, 각각 의도한 테스트가 잡았다(아래 표). nestjs-v12 §C 판별자도 재실측(MB RED 11 · MB2 RED 25)
- [ ] TEST WORKFLOW — lint · unit · build · e2e (1차: lint · unit · build PASS, e2e 1회 실패 = 내 단언 200 vs 실제 201 → 고쳐 71/390 PASS.
      리뷰 fix 뒤 최종 재수행에서 체크)
- [x] CHANGELOG(제품 동작 · 가드 신설) — 항목 둘
- [x] 부트 캐너리 기준값 재실측 — `@WorkspaceId()` 142 · `@WorkspaceParam()` 15, `nestjs-v12-coordinated-upgrade.md` §C 갱신

### 뮤턴트 (2026-09-25, 커밋 `d5031b699` 위에서 · 원복 cp)

| # | 뮤턴트 | 예측 | 실측 · 잡은 테스트 |
| --- | --- | --- | --- |
| M1 | 경로 분기 제거 | RED | RED 19 — «헤더 · 토큰 워크스페이스의 owner 여도 경로 비멤버면 NOT_A_MEMBER» 등 |
| M2 | 경로 값 형식 검사 제거 | RED | RED 1 — «형식이 아닌 값 → 판정 없이 넘긴다 · 조회 없음» |
| M3 | 경로 분기가 `@Roles` 무시 | RED | RED 5 — «`@Roles("owner")` 는 경로 워크스페이스에 대해 판정한다» 등 |
| M4 | 병용 핸들러의 헤더 검사 생략 | RED | RED 1 — «헤더 워크스페이스의 멤버십도 검증한다» |
| M5 | 병용 핸들러의 헤더에도 역할 요구 | RED | RED 1 — «`@Roles()` 요구는 경로 워크스페이스에 대한 것이다» |
| M6 | 문턱을 가장 높은 역할로 | RED | RED 3 — «역할이 여럿이면 가장 낮은 역할이 요구다» |
| M7 | 비멤버도 역할 코드(규칙 가) | RED | RED 5 — «비멤버는 `@Roles("editor")` 라우트에서도 NOT_A_MEMBER» 등 |
| M8 | 경로 이름 첫 하나만 | RED | RED 1 — «한 핸들러에 여럿이면 전부 돌려준다» |
| M9 | 경로 판별이 `@WorkspaceId` 팩토리를 봄 | RED | RED 25 |
| M10 | 캐너리 합계가 헤더 소비만 | RED | RED 3 |
| M11 | `update` 의 `@Roles('admin')` 제거 | RED | RED 1 — `workspace-roles-attachment` «역할 요구가 ["admin"]» |
| M12 | `getSettings` 를 평범한 `@Param` 으로 | RED | RED 2 — `workspace-param-binding` 위반 + `workspace-roles-attachment` 인식 |
| M13 | `addMemberByEmail` 순서 원복 | RED | RED 3 |
| M14 | `leaveWorkspace` 인가 선행 제거 | RED | RED 3 |
| M15 | 저장소 가드 접미 규칙 제거 | RED | RED 1 — 대조군 «네 형태» |
| M16 | 저장소 가드 경로 이름 미검사 | RED | RED 1 — 대조군 «네 형태» |
| M17 | `param-uuid-pipe` 가 `@WorkspaceParam` 을 모집단에서 뺌 | RED | RED 2 |

리뷰 라운드에서 더한 뮤턴트(같은 하네스 · cp 원복):

| # | 뮤턴트 | 예측 | 실측 |
| --- | --- | --- | --- |
| R1~R3 | 역할 서열 모듈 — `ADMIN_ROLES` 문턱 · `hasOwn` 제거 · 서열 뒤바꿈 | RED | 전부 RED |
| W6 | `@Roles` 인자를 `string[]` 로 넓힘 | RED(ratchet) | RED — ratchet `roles.guard.spec.ts: 0 → 1` |
| R4 · R5 | 다중 경로 이름 첫째만 · 마지막만 검사 | RED | 둘 다 RED |
| S1~S4 | `assertAdmin` 결합 원복 · `getWorkspaceSettings` 검사 제거 · 병용 판별 항상 false · `decoratorCallName` 비-호출형 | RED | 전부 RED |
| T1 · T2 | `transferOwnership` 인가 선행 제거 · 비-owner 통과 | RED | 둘 다 RED |
| T3 | 다중 경로의 `@Roles` 를 첫째에만 | RED | **처음엔 생존** — 미달 케이스가 한 자리뿐이었다. 반대 자리 케이스를 더한 뒤 RED |
| T4 | 다중 경로의 `@Roles` 를 마지막에만 | RED | RED |
- [ ] `/ai-review` — 정지 규칙: Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건. 라운드마다 RESOLUTION.md 가 처분을 적는다.
      | 라운드 | 세션 | 결과 | 조치 |
      | --- | --- | --- | --- |
      | 1 | `16_03_32` | C0 · W8 | `37ee970a2` — 역할 서열 한 표 · 낡은 주석 · 403 설명 상수 · 두 번째 선 의도 주석 |
      | 2 | `16_39_25` | C0 · W8 | `85a38d00f` · `fdd7d8ff7` — 거부 본문 한 표 · `@Roles` 인자 좁히기(ratchet 고정) · 헬퍼 공용화 |
      | 3 | `17_14_49` | C0 · W6 | `dc60b1af8` — 서비스 두 번째 선도 비멤버는 `NOT_A_MEMBER` |
      | 4 | `17_47_18` | C0 · W8 | `1f616ef05` + T3 보강 — **`transferOwnership` 세 번째 오라클(동작 결함)** → 두 번째 planner 턴 |
- [x] 두 번째 planner 턴 — spec «두 메서드» 실측 정정(`--spec` `review/consistency/2026/09/25/18_07_58` BLOCK: NO, WARNING 2 반영).
      draft `plan/complete/spec-draft-workspace-path-guard-oracle-census.md`
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기
