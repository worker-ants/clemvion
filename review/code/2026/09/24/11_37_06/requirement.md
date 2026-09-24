# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** `1-auth.md:551`·`3-error-handling.md:46` 의 stale 서술은 이미 코드가 아니라 spec 이 낡은 케이스로 올바르게 식별·처리됨
  - 위치: `spec/5-system/1-auth.md:551`, `spec/5-system/3-error-handling.md:46`
  - 상세: `Read` 로 직접 확인. `1-auth.md:551` 은 *"`WorkspacesService.removeMember()` 는 `assertAdmin(workspaceId, requesterId)` 만 요구한다"* 고 적는데, 이번 diff 로 `removeMember()` 는 더 이상 `assertAdmin()` 을 호출하지 않는다(`workspaces.service.ts` — `getMemberRole` 직접 호출 + `throwAdminRequired()`). `3-error-handling.md:46` 도 `ADMIN_REQUIRED` 발행처를 `WorkspacesService.assertAdmin()` 단수로 못박아 같은 방식으로 낡았다. 두 경우 모두 결론("Admin 이 멤버 삭제 가능", "ADMIN_REQUIRED 의 의미")은 여전히 참이고 구현이 명백히 의도적·합리적인 리팩터라 코드 fix 대상이 아니다 — 이것은 코드 버그가 아니라 **spec 갱신 누락**([SPEC-DRIFT])이다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 백로그 항목(`# 3` "removeMember 리팩터로 낡은 spec 서술 세 줄")으로 3줄(`3-error-handling.md:46`·`:49`, `1-auth.md:551`) 모두 묶여 등재돼 있고, 자기-반증형 소정정 조건 불충족(그 문장을 developer 가 쓰지 않음 + API 계약 서술이라 조건 2 배제)도 정확히 판단해 developer 가 직접 spec 을 고치지 않고 planner 로 넘겼다. 처리 방식 자체에 결함 없음 — 재조치 불요.
  - 제안: 코드 유지. spec 반영은 이미 planner 백로그로 넘어갔으므로 추가 조치 없음(참고용 기록).

- **[INFO]** `removeMember` 판정 순서가 plan(`member-auth-order.md` §B)에 명시된 순서·조건과 line-level 로 일치함을 실측 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:814-851`
  - 상세: plan 이 규정한 순서 "멤버십 → 대상 존재 → self 위임 → admin → owner" 그대로 구현돼 있다: `getMemberRole` → `!requesterRole` 이면 `throwNotAMember()`(832) → `findOne` 404(837) → self 면 `leaveWorkspace` 위임(838-842) → `!ADMIN_ROLES.has(requesterRole)` 면 `throwAdminRequired()`(847) → `member.role === 'owner'` 면 `throwCannotRemoveOwner()`(850). `1-auth.md:377` 각주("Admin 의 멤버 삭제는 대상이 Owner 인 경우 거부된다")와도 모순 없다. `getMemberRole`(`:113`)과 대상 `findOne`(`:834`)의 `where` 절이 서로 다른 필드(`userId` vs `id`)를 쓰는 것도 확인해, 신규 `wireFindOne`/`mockImplementation` 라우팅 로직(`workspaces.service.spec.ts:1291-1303`, `:1492-1502`)이 실제 호출과 정확히 대응함을 검증했다.
  - 제안: 없음(정보성 확인).

- **[INFO]** 신규 unit/e2e 테스트가 성공적으로 실행되며 판정 로직의 각 분기를 실측대로 판별함
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1702-1781`, `codebase/backend/test/workspace-rbac.e2e-spec.ts:669-732`
  - 상세: `npx jest src/modules/workspaces/workspaces.service.spec.ts -t "removeMember"` 실측 결과 14 passed(관련 스위트 전체 그린). "비-멤버는 대상을 조회하기 전에 NOT_A_MEMBER 로 끝난다" 테스트는 단순히 에러 코드만이 아니라 `memberRepo.findOne.mock.calls` 를 필터링해 대상 조회(`where.id === memberId`) 자체가 없었음까지 검증해 — 코드만 바꾸고 조회를 남겨 두는 회귀를 실제로 잡는다(RESOLUTION.md 의 뮤턴트 표 M1′/M3 실측과 일치). "비-admin 도 자기 자신이면 위임된다" 테스트는 요청자 role 을 `editor` 로 둬 W1 이 지적한 "self 위임이 admin 판정보다 앞" 계약을 실제로 가른다(기존 테스트는 요청자가 기본값 `owner` 라 이 계약을 가르지 못했었음). e2e 신규 테스트는 헤더 없이(`X-Workspace-Id` 미부착) 세 갈래(부재/owner/editor)를 동시에 찔러 `Set` 크기 1(`403 NOT_A_MEMBER`)을 단언하고, 사후 `COUNT(*)` 로 삭제가 일어나지 않았음도 확인한다. UUID 형식(`00000000-0000-4000-8000-000000000000`)도 `ParseUUIDPipe` 통과를 고려해 올바르게 구성됨.
  - 제안: 없음(정보성 확인).

- **[INFO]** CHANGELOG 정정(C1 fix)이 사실관계와 line-level 로 일치
  - 위치: `CHANGELOG.md` (신규 항목 + `:65-66` 취소선 정정)
  - 상세: 직전 라운드 CRITICAL(전방 참조 "남는 것: … 오라클은 여전히 열려 있다"가 이번 PR 로 거짓이 됨)이 취소선 + "2026-09-24 해소 — 맨 위 항목이 그것이다" 로 정확히 조치됐다. 신규 항목의 서술(판정 순서, 인가 2단 분리 이유, wire 코드 변경 고지, 13-라우트 잔여 항목 고지)이 실제 코드·plan 내용과 모두 일치함을 대조 확인.
  - 제안: 없음(정보성 확인).

## 요약

이번 diff(fix 커밋 `f6c49c5f2`/`3fcc19e2c` + test 커밋 `7b851df3f`/`da5112f3f` 및 관련 plan/CHANGELOG/review 산출물)는 `WorkspacesService.removeMember()` 의 인가 판정 순서를 대상 조회보다 앞으로 옮겨 비-멤버 존재/owner 오라클을 닫는다는 의도한 기능을 완전히 구현했다. 직전 라운드(`11_10_45`)가 지적한 Critical 1(CHANGELOG 미갱신)과 Warning 5(self-removal 미검증 테스트 갭·stale docstring 2건·spec 카탈로그 서술 2건)는 전부 이번 diff 에서 정확하게 해소됐으며, spec 이 낡은 2건(`1-auth.md:551`, `3-error-handling.md:46`)은 코드가 옳고 spec 갱신이 필요한 SPEC-DRIFT 로 올바르게 판별돼 developer 권한 밖이라는 이유로 planner 백로그에 정확히 위임됐다(자기-반증형 소정정 예외 조건도 정확히 검토·배제). 실제 코드(`getMemberRole`/`findOne`/thrower 3종)를 직접 열어 판정 순서·에러 코드·where 절을 대조했고, 관련 `removeMember` unit 테스트(14건)를 직접 실행해 전부 통과함을 확인했다. 에러 시나리오(비-멤버·대상 없음·self·비-admin·owner 대상·동시성 0-행) 전부가 각각 정확한 코드를 반환하고, 반환값 없는 경로(`void`)도 self 위임/정상 삭제 양쪽에서 일관되게 처리된다. TODO/FIXME/HACK 류의 미완성 표식은 이번 diff 범위에서 발견되지 않았다. 요구사항 충족 관점에서 추가로 조치가 필요한 신규 결함은 없다.

## 위험도

NONE
