# 요구사항(Requirement) 충족 리뷰 — `member-auth-order`

## 검증 방법
`workspaces.service.ts`(전체 파일), `workspaces.service.spec.ts`, `workspace-rbac.e2e-spec.ts` 를
`Read`/`Bash cat`으로 직접 열어 diff 게이트 숫자와 대조했고, 다음도 함께 확인했다:
- `codebase/backend/src/modules/workspaces/workspaces.controller.ts` — `removeMember` 라우트에
  `@Roles()` 없음, `@Param('id')`(워크스페이스) 사용 확인.
- `codebase/backend/src/common/guards/roles.guard.ts` / `.../decorators/workspace.decorator.ts` —
  `@Roles()`·`@WorkspaceId()` 둘 다 없으면 `RolesGuard` 가 멤버십 검사 전에 단축 통과함을 확인.
- `spec/5-system/1-auth.md:377`(§3.2 각주), `spec/data-flow/12-workspace.md:141`,
  `spec/5-system/3-error-handling.md:49,230` — plan/consistency 산출물이 인용한 spec 문장을 원본
  대조.
저장소에는 아무것도 쓰거나 고치지 않았다(읽기 전용 검증만 수행, `git status --short` 로 확인 완료
— 리뷰 세션 시작 시점의 `review/code/2026/09/24/11_10_45/` 외 변경 없음).

## 발견사항

- **[INFO]** 문서화된 판정 순서와 실제 구현이 line-level 로 정확히 일치한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:805`(docstring "판정
    순서: 멤버십 → 대상 존재 → self 위임 → admin → 대상이 owner 인가") 및 `:819-850`(구현)
  - 상세: docstring 이 나열한 5단계 순서(멤버십 → 대상 존재 → self 위임 → admin → owner)가
    실제 코드의 `requesterRole` 조회 → `throwNotAMember()` → `findOne` → `throwMemberNotFound()`
    → self 위임 → `throwAdminRequired()` → `throwCannotRemoveOwner()` 순서와 정확히 일치한다.
    "의도와 구현 간 괴리" 관점에서 결함 없음.
  - 제안: 없음(정상).

- **[INFO]** 가드 우회 경로에 대한 코드 주석의 주장이 실측으로 확인된다
  - 위치: `workspaces.service.ts:819-823`("`@Roles()` 가 없고 `handlerConsumesWorkspaceId` 가
    false" 라는 주장) / 대조: `workspaces.controller.ts:355-372`(`removeMember` 에 `@Roles()`
    없음, `@Param('id')` 사용) / `roles.guard.ts:112-118`(둘 다 없으면 멤버십 검사 전에
    `return true`)
  - 상세: 이 PR 이 서비스 계층 인가를 도입한 근거(가드 층이 이 라우트를 못 막는다)가 코드
    레벨에서 실제로 성립함을 직접 확인했다. 근거 없는 주장이 아니다.
  - 제안: 없음.

- **[INFO]** 테스트가 "코드만 바꾸고 조회를 남겨 두는" 회귀를 실제로 잡는 형태로 작성됐다
  - 위치: `workspaces.service.spec.ts:1688-1704`(`비-멤버는 대상을 조회하기 전에 NOT_A_MEMBER 로
    끝난다`)
  - 상세: 단언이 에러 코드뿐 아니라 `memberRepo.findOne.mock.calls` 를 `where.id === memberId` 로
    필터링해 대상 조회 자체가 없었음(`toHaveLength(0)`)까지 확인한다. plan 의 뮤턴트 표(M3: 대상
    조회만 앞으로 옮기고 판정 순서는 유지 — 유닛 1, e2e 0)가 이 테스트의 존재 이유를 정확히
    설명하며, 실측대로 e2e 만으로는 이 회귀 클래스를 못 잡는다는 주장도 코드 구조상 타당하다
    (e2e 는 최종 응답 코드만 보고, `findOne` 호출 여부는 서비스 내부 상태라 유닛에서만 관측
    가능).
  - 제안: 없음(정상 — 오히려 모범적).

- **[INFO]** `wireFindOne` 헬퍼의 where-키 기반 분기가 `getMemberRole`/대상 조회 두 호출을
  정확히 가른다
  - 위치: `workspaces.service.spec.ts:1477-1497`(`wireFindOne` 정의), 사용처
    `:1689-1692`·`:1715-1718`
  - 상세: `getMemberRole` 은 `findOne({ where: { workspaceId, userId } })` (`id` 필드 없음)를
    부르고 대상 조회는 `findOne({ where: { id: memberId, workspaceId } })` 를 부른다.
    `wireFindOne` 의 `opts.where.id !== memberId` 분기가 이 둘을 정확히 구분해, 순서가 바뀌어도
    (이번 PR 이 실제로 순서를 바꿨다) 테스트가 깨지지 않는 근거가 된다. 실측: 옛 버전은
    `mockResolvedValueOnce` 두 개로 호출 **순서**에 결합돼 있었고, 이번 diff 의 커밋 메시지
    (`7b851df3f`)가 "무효 하나가 그 자체로 결과였다"는 뮤턴트 검증도 기록하고 있다 — 실제로
    반증 가능한 형태로 리팩터됐다.
  - 제안: 없음.

- **[INFO]** 관측 가능한 응답 변화(§C 표)가 실제 구현과 e2e 단언에서 재현된다
  - 위치: `plan/in-progress/member-auth-order.md`(§C 표) vs
    `codebase/backend/test/workspace-rbac.e2e-spec.ts:669-732`(신규 e2e)
  - 상세: 비-멤버가 (없음/owner/비-owner) 세 memberId 에 대해 종전엔 서로 다른 응답
    (`404`/`403 CANNOT_REMOVE_OWNER`/`403 ADMIN_REQUIRED`)을, 수정 후엔 모두 `403 NOT_A_MEMBER`
    로 받는다는 §C 의 표를 e2e 가 `new Set(answers).size === 1` 로 성질 단언한다(값 3개를 각각
    고정하지 않음 — "성질을 직접 단언" 원칙 준수, plan §D 의 명시적 요구사항과 일치). 삭제가
    일어나지 않았음도 DB count 로 확인한다.
  - 제안: 없음.

- **[INFO/SPEC-DRIFT 후보 아님 — 회색지대]** `spec/5-system/3-error-handling.md` 의
  `NOT_A_MEMBER` 카탈로그 예시 경로 열거에 `removeMember` 가 없다
  - 위치: `spec/5-system/3-error-handling.md:49`("전환 `/switch`·탈퇴·멤버십 확인 경로")
  - 상세: 발행 모듈은 이미 `workspaces.service` 로 포괄 기재돼 있어 의미상 모순은 아니고,
    예시 열거만 새 발행처를 언급하지 않는다. 이것은 spec 이 틀린 것도(CRITICAL 대상 아님),
    코드가 spec 을 어긴 것도 아니다 — 코드가 spec 범위 밖의 새 emission site 를 정당하게
    추가했을 뿐이고, `plan/in-progress/member-auth-order.md` §E 가 이미 이를 인지해 "developer
    권한 밖(`spec/` 은 read-only)이라 planner 항목으로 등재한다"고 명시했으며, 실제로
    `plan/in-progress/spec-draft-nullable-notation-followups.md` diff(파일 5)에 해당 backlog
    항목이 신규 등재돼 있다. `SPEC-DRIFT` 로 분류하지 않는 이유: SPEC-DRIFT 는 "spec 본문이
    코드와 다른데 코드가 옳다" 는 line-level 불일치를 요구하는데, 여기는 예시 목록의
    **완결성 누락**(불일치 아님)이고, 이미 절차대로(consistency-check INFO + planner 위임
    예고) 처리되고 있다.
  - 제안: 없음(이미 올바른 경로로 위임됨). 이 리뷰가 추가로 요구할 것은 없다.

- **[INFO]** 인접 spec 서술(`1-auth.md:377` Admin 멤버 삭제 각주, `data-flow/12-workspace.md:141`
  DELETE 엔드포인트 정의)은 이번 변경으로 깨지지 않는다
  - 위치: 위 두 spec 위치 vs `workspaces.service.ts:850`(owner 판정), `:905-926`(thrower)
  - 상세: 두 spec 문장 모두 "owner 는 제거 불가", "본인 제거는 leaveWorkspace 로 위임" 을
    기술하는데, admin/owner 경로의 이 두 불변은 이번 diff 로 변경되지 않는다(§C 표 마지막 행
    "admin/owner: 변화 없음"과 일치, 직접 코드 대조로 확인). 비-멤버·비-admin 응답 형태는 두
    spec 문서 모두 침묵하는 영역이라 회색지대(INFO), CRITICAL 대상 아님.
  - 제안: 없음.

## 요약

`removeMember` 의 인가 순서를 "대상 조회 → 판정" 에서 "판정(멤버십→대상존재→self→admin→owner) →
delete" 로 재배치한 처방이 코드·테스트·plan·spec 네 층에서 서로 line-level 로 정합한다. 메서드
docstring 이 서술하는 5단계 순서가 실제 구현과 정확히 일치하고(의도-구현 괴리 없음), 신규 유닛
테스트 2건은 값(에러 코드)뿐 아니라 "대상 조회 자체가 없었음"(`findOne` 호출 횟수)까지 단언해
회귀 방지력이 실질적이며, 신규 e2e 는 "세 응답이 구분 불가"라는 성질을 직접 단언해 값 고정에
따른 결합을 피한다. `RolesGuard`/`handlerConsumesWorkspaceId` 를 직접 열어 "가드가 이 라우트를
막지 못한다"는 코드 주석의 핵심 주장을 검증했고, 참조된 spec 문장(`1-auth.md §3.2`,
`data-flow/12-workspace.md §1.6`) 도 원문과 정확히 대조했다 — 관련 spec 은 admin/owner 경로만
규정하고 비-멤버 응답은 침묵하므로 이번 변경과 충돌하지 않는다. 유일한 잔여 항목(에러 카탈로그
예시 열거 누락)은 developer 권한 밖으로 이미 올바르게 planner 백로그에 위임돼 있어 이 리뷰가
추가로 요구할 조치가 없다. TODO/FIXME/HACK/XXX 류 미완성 마커도 diff 전체에서 0건이다.

## 위험도
LOW
