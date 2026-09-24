# 신규 식별자 충돌 검토

## 검토 범위 확인

- **spec/5-system 델타: 0개 파일.** 이 브랜치는 `spec/5-system` 문서를 변경하지 않았다 — 신규 spec 식별자(요구사항 ID, 엔티티/DTO, endpoint, 이벤트, ENV, 파일 경로) 자체가 없다.
- 실제 구현 diff(3파일/371줄)는 아래 세 파일뿐이다:
  - `codebase/backend/src/modules/workspaces/workspaces.service.ts`
  - `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`
  - `codebase/backend/test/workspace-rbac.e2e-spec.ts`
  - (+ `CHANGELOG.md`, `plan/in-progress/member-auth-order.md` — 문서/플랜, 신규 식별자 없음)

이 PR 은 `WorkspacesService.removeMember()` 의 **인가 판정 순서**를 재배치하는 보안 수정이다(비-멤버가 대상 존재/owner 여부를 응답 차이로 알아내는 오라클을 닫음). 아래는 diff 를 절대경로 워킹트리(`git -C .../member-auth-order-8c4d1f diff origin/main`)로 직접 확인해 "신규 식별자"가 실제로 존재하는지 대조한 결과다.

## 발견사항

신규 식별자 충돌에 해당하는 항목 없음. 아래는 확인 과정과 근거만 기록한다(모두 비충돌로 판정).

- **에러 코드 `NOT_A_MEMBER` / `ADMIN_REQUIRED`** — diff 에서 `this.throwNotAMember()` / `this.throwAdminRequired()` 라는 새 **private 메서드**가 추가됐지만, 이들이 던지는 wire 코드 `NOT_A_MEMBER`(403)·`ADMIN_REQUIRED`(403) 자체는 신규가 아니다. `git show origin/main:codebase/backend/src/modules/workspaces/workspaces.service.ts` 확인 결과 두 코드 모두 변경 전부터 같은 파일의 `assertMembership`/`assertAdmin` 인라인으로 이미 존재했고, `spec/5-system/3-error-handling.md:46,49` 에 이미 등재돼 있다. 이번 변경은 중복 throw 로직을 헬퍼 메서드로 추출하고 **호출 순서만** 바꾼 리팩터로, 새 발행 지점(`removeMember`)이 생겼을 뿐 새 식별자는 아니다. `plan/in-progress/member-auth-order.md` §A 도 "`NOT_A_MEMBER` 가 정식 코드인가 → 있다(`3-error-handling.md:49` 403 등재), 이 자리가 새 발행처가 된다" 고 스스로 확인하고 있다.
- **`MEMBER_NOT_FOUND` / `CANNOT_REMOVE_OWNER`** — 이 diff 로 순서상 새로 노출되는 경로가 생기지만(예: 비-admin이 owner를 지목하면 종전 `CANNOT_REMOVE_OWNER` 대신 `ADMIN_REQUIRED`), 두 코드 모두 변경 전부터 같은 서비스 안에 존재(`throwMemberNotFound`, `throwCannotRemoveOwner` 헬퍼는 diff 밖, origin/main 에 이미 있음). 새 식별자 아님. (코드 값이 바뀌는 **wire 계약 변경**은 CHANGELOG 에 "계약 변경 고지"로 별도 기록돼 있으나, 이는 naming-collision 관점이 아니라 breaking-change 관점이라 본 리뷰 축 밖이다.)
- **테스트 식별자** — `workspaces.service.spec.ts`/`workspace-rbac.e2e-spec.ts` 에 추가된 `it(...)` 설명 문자열과 로컬 헬퍼 `wireFindOne`(기존 함수, signature 만 확장)은 파일-스코프이며 spec 문서의 요구사항 ID·엔티티명과 겹치는 네임스페이스가 아니다.
- **요구사항 ID / 엔티티·DTO / API endpoint / 이벤트 / ENV·config key / 파일 경로** — diff 에 이 다섯 범주에 해당하는 신규 항목이 전혀 없다. 새 endpoint 없음, 새 DTO/엔티티 없음, 새 webhook/queue/sse 이벤트 없음, 새 ENV var 없음, 새 spec 파일 없음.

## 요약

이번 변경은 `spec/5-system` 문서 자체를 건드리지 않았고(델타 0), 구현 diff 도 기존에 이미 spec(§`3-error-handling.md`)에 등재된 `NOT_A_MEMBER`·`ADMIN_REQUIRED`·`MEMBER_NOT_FOUND`·`CANNOT_REMOVE_OWNER` 네 코드를 재사용하는 인가 순서 재배치 리팩터일 뿐, 어떤 범주에서도 새 식별자를 도입하지 않는다. 신규 식별자 충돌 관점에서는 문제 될 것이 없다.

## 위험도

NONE
