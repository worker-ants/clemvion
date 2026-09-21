# 요구사항(Requirement) 리뷰 — `WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정

## 발견사항

- **[SPEC-DRIFT]** `DELETE` 멱등성 표(§3)가 이번(여섯 번째) 사례로 실제 동작과 다시 어긋남
  - 위치: `spec/5-system/2-api-convention.md §3` (HTTP 메서드 표, `DELETE | 리소스 삭제 | O`) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:826` (`if (affected === 0)` → 진 쪽 404)
  - 상세: 이번 구현으로 동시 `DELETE /api/workspaces/:id/members/:memberId` 두 건 중 패자는 `204`류 성공이 아니라 `404 MEMBER_NOT_FOUND`를 받는다. 이는 코드 결함이 아니라 이미 다섯 차례(#1369 workflow/workspace, #1370 trigger, #1371 schedule, #1372 integration) 검증된 의도된 패턴의 6번째 적용이며, `2-api-convention.md §3`의 "멱등 O" 서술이 "최종 상태 기준"이라는 각주 없이 낡아 있다. 코드는 옳고 spec 각주만 아직 반영되지 않은 전형적인 SPEC-DRIFT다.
  - 제안: 코드 유지. spec 반영은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4894~4904(및 이번 PR이 등재한 4816행 정정)에 planner 소유 항목으로 등재돼 있고, 집행 시 "동시 요청 중 진 쪽은 404를 받을 수 있다"는 각주를 `spec/5-system/2-api-convention.md §3`에 추가하는 형태다. 이번 PR이 신규로 등재할 필요는 없음(이미 처리됨).

- **[INFO]** `spec/2-navigation/9-user-profile.md §6.1`·`spec/data-flow/12-workspace.md §1.6`가 "동시 삭제 시 진 쪽 404" 행위를 서술하지 않음(모순이 아니라 누락)
  - 위치: `spec/2-navigation/9-user-profile.md:378` (`DELETE /api/workspaces/:id/members/:memberId | 멤버 제거 (Admin+ / 자가 탈퇴 시 leave로 위임)`), `spec/data-flow/12-workspace.md:141` (`DELETE workspace_member. owner는 제거 불가. 본인 제거는 자가 탈퇴로 위임.`)
  - 상세: 두 문서 모두 owner 보호·자가 탈퇴 위임은 정확히 서술하지만 동시 요청 처리(진 쪽 404)는 언급이 없다. 다른 필드(RBAC·상태 전이·엔드포인트 시그니처)는 코드와 line-level로 일치한다. 이 누락은 이미 이번 PR의 `--impl-prep` 검토(`review/consistency/2026/09/21/12_23_48/SUMMARY.md` WARNING #2)에서 3개 checker 교차로 확인돼 트래커에 반영 대상으로 등재됐다(`spec-draft-nullable-notation-followups.md` 4891~4893행). 중복 지적 불필요.
  - 제안: 조치 불요(이미 트래킹됨).

- **[WARNING]** owner 보호 가드가 무락 읽기 위에 있어 `transferOwnership`과의 레이스로 우회 가능 — 이번 PR이 만든 결함은 아니나 여전히 열려 있음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:797-799` (`if (member.role === 'owner') throw Forbidden('CANNOT_REMOVE_OWNER')`)와 `:822-825`(`delete({id, workspaceId})`, `role` 조건 없음) 사이의 창
  - 상세: `member.role === 'owner'` 판정과 실제 `DELETE` 사이에 동시 `transferOwnership`이 대상 멤버를 owner로 승격시키면 가드를 통과한 채 owner가 지워질 수 있다. 코드 주석(`:817-821`)이 이 사실을 명시하고, plan(`plan/in-progress/member-dup-remove.md` §C-2)이 재진입 기법으로 **실측 재현**(`status=200, rows_remaining=0`)까지 마쳤다. 다만 이번 PR의 판별자(`affected === 0` = "행이 삭제됐다/안 됐다")를 `role: Not('owner')`로 확장하면 그 의미가 "삭제 실패" vs "owner로 승격되어 보호됨" 두 가지로 갈라져 이번 PR이 세우는 판별자 자체가 흐려진다는 근거로 의도적으로 분리했다(`spec-draft-nullable-notation-followups.md` 4819~4851행에 재현 레시피·후보 처방과 함께 별도 등재). 계약이 다른 별개 결함이라는 판단은 타당하다.
  - 제안: 코드 변경 불요(이번 PR 스코프 밖, 이미 별도 트래커 항목·후보 처방 존재). 사람이 판단할 지점은 "이 TOCTOU를 별도 PR로 얼마나 빨리 닫을지"의 우선순위뿐 — 이번 diff의 완전성 평가에는 영향 없음.

- **[INFO]** 대조군(`affected` `null`/`undefined` → 정상 삭제로 취급) 테스트가 반증 대상 뮤턴트를 정확히 겨냥함 — 확인됨, 결함 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1518-1531` (`it.each([[undefined],[null]])`)
  - 상세: 구현이 `affected === 0` **명시 비교**(`:826`)를 쓰고, `!affected`로 되돌리면 이 두 케이스가 오탐 404를 낼 것이므로 대조군이 그 회귀를 정확히 잡는다. plan이 적은 대로 `#1371`에서 이 대조군 부재로 뮤턴트 32건이 통과했던 사고가 여기서는 재발하지 않는다.
  - 제안: 없음(양호).

## 기능 완전성 · 엣지 케이스 · 반환값 점검 (요약)

- 정상 경로(admin이 타인 제거) → `delete` affected=1 → 감사(`mode:'removed'`) → `void` 반환: 구현·유닛 테스트·e2e 모두 일치.
- 대상 없음(`findOne` null) → `MEMBER_NOT_FOUND` 404, `delete` 미호출: 구현·테스트 일치.
- owner 대상 → `CANNOT_REMOVE_OWNER` 403, `delete` 미호출: 구현·테스트 일치.
- 자기 자신 → `leaveWorkspace`로 위임, 이 경로의 `delete` 미호출: 구현·유닛·e2e(자가 탈퇴 갈래) 모두 일치. `leaveWorkspace` 자체는 트랜잭션 내 `pessimistic_write` 재조회로 이미 닫혀 있음을 e2e로 실증(`member-remove-concurrency.e2e-spec.ts:139-203`) — `[200, 403] NOT_A_MEMBER`.
- 동시 제거 두 건 → 승자 200, 패자 404 `MEMBER_NOT_FOUND`, 감사 1건(`mode:'removed'`로 필터): 구현(`affected===0` 판정)·e2e(`member-remove-concurrency.e2e-spec.ts:61-129`, 공허성 가드 포함) 일치.
- `affected`가 `null`/`undefined`(드라이버 미보고) → 정상 삭제로 취급: 구현·유닛 대조군 일치, 명시 비교 규율이 문서화(`:813-816`)돼 있고 근거(`rewriteTriggerConfigLocked` 선례)도 실재.
- 응답 형태(200 `{data:{ok:true}}`, 204 아님): `workspaces.controller.ts:355-372` 확인, e2e 주석·단언과 정확히 일치.
- TODO/FIXME/HACK/XXX 주석: 검색 결과 없음. 다만 owner-TOCTOU를 남긴다는 의도적 유예는 주석과 별도 트래커에 명시적으로 남아 있어 "미완성을 숨기는" 형태는 아님.
- 함수명·주석·구현 일치: `removeMember` 상단 doc 주석("자기 자신 제거는 leaveWorkspace로 위임")과 실제 분기가 정확히 일치. 새 코멘트 블록(`:806-821`)이 판정 근거·한계(owner TOCTOU)를 정확히 서술하고 실제 코드와 괴리 없음.
- 테스트 목(mock) wiring 검증: `wireFindOne`이 `findOne` 두 호출(대상 조회 vs `assertAdmin`의 `getMemberRole` 조회)을 `where.id` 유무로 정확히 구분해 응답하며, 각 테스트 시나리오(대상 없음/owner/자가 제거/정상)에서 실제 서비스 분기 순서(조회→자가체크→owner체크→admin체크→delete)와 정합.
- 공유 mock 부수 영향: 기존 테스트(`:1279`, `records member.removed (mode=removed) on admin removeMember`)가 새 `memberRepo.delete` 목의 전역 기본값(`{affected: 0}`, `deleteWorkspace`의 CASCADE 케이스용)과 충돌해 깨졌던 것을 그 자리에서 `{affected: 1}`로 명시해 고쳤다(`:1290-1292`) — 회귀 원인과 처방이 주석에 정확히 남아 있고 실제로 해소됨.

## 비즈니스 로직 · 에러 시나리오

- 에러 코드: `MEMBER_NOT_FOUND`(대상 없음/동시 삭제 패자 모두 동일 코드 재사용), `CANNOT_REMOVE_OWNER`, `ADMIN_REQUIRED`(assertAdmin), `NOT_A_MEMBER`(leaveWorkspace 위임 경로) — 전부 기존 정의 재사용, 신규 코드 없음. `spec/conventions/error-codes.md`와 충돌 없음(신규 명명이 없으므로 규약 위반 소지 자체가 없음).
- 감사 액션: `AUDIT_ACTIONS.MEMBER_REMOVED` (`member.removed`) + `details.mode: 'removed'`로 자가 탈퇴(`mode:'left'`)와 구분 — 기존 규약·데이터 그대로, 이번 변경이 와이어 계약을 바꾸지 않는다는 plan의 주장과 일치.
- 원자성: `DELETE ... WHERE id=$1 AND workspace_id=$2`가 단일 SQL 문이라 두 동시 요청 중 하나만 1행을 지운다는 근거는 `WorkspaceMember`가 PK(`id`)로 유일 식별되고 CASCADE 자식 테이블이 없다는 엔티티 정의(`workspace-member.entity.ts`)와 부합해 타당하다.

## 위치 표기 참고

인용한 코드 줄 번호는 모두 `Read`/`grep -n`으로 워킹트리 원본 파일에서 직접 확인한 실제 줄 번호이며, 조립 프롬프트의 diff 게이트 숫자(예: `:817`, `:822`, `:826`)와 일치함을 대조 확인했다.

## 요약

`WorkspacesService.removeMember()`를 무락 `findOne`+`remove(entity)`에서 원자적 `delete({id, workspaceId})`+`affected===0` 명시 비교로 교체한 이번 변경은 의도(동시 제거 두 건의 감사 중복 제거)를 정확히 구현했고, 형제 다섯 PR(#1369~#1372)과 동일한 검증된 패턴을 재사용했다. 단위 테스트가 정상/대상없음/owner/자가위임/동시패자/`null`·`undefined` 대조군을 모두 커버하고, e2e가 실제 DB 잠금으로 겹침을 재현해 상태쌍·감사 건수·mode 필터까지 검증한다. 남은 이슈는 둘 다 신규 결함이 아니라 기존에 알려진 채 명시적으로 유예·트래킹된 사안이다 — (1) `DELETE` 멱등성 spec 표가 실제 동작(진 쪽 404)에 뒤처진 SPEC-DRIFT(이미 planner 백로그 등재), (2) `transferOwnership`과의 레이스로 owner 보호 가드가 TOCTOU로 뚫리는 갭(재현까지 마쳤고 별도 트래커 항목·후보 처방과 함께 의도적으로 분리). 두 사안 모두 이번 diff의 완전성 판정을 낮추지 않으며, 코드·테스트·spec 참조 문서(`9-user-profile.md`, `data-flow/12-workspace.md`) 사이에 line-level 불일치는 발견되지 않았다.

## 위험도

LOW
