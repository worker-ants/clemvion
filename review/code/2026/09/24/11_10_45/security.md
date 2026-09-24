# 보안(Security) 코드 리뷰

## 대상

- `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()` 인가 순서 재배치
- `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — 순서 역행 뮤턴트를 잡는 단위 테스트 보강
- `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 존재/owner 오라클 폐쇄를 검증하는 e2e 케이스 추가
- `plan/in-progress/member-auth-order.md` (신규) — 이번 변경의 설계 근거 문서

## 발견사항

이 변경 자체는 **정보 노출(존재 오라클) 취약점을 닫는 보안 수정**이다. 새로 도입된 취약점은 발견되지 않았다.

- **[INFO]** 인가 순서 재배치는 목적한 오라클을 정확히 닫는다 — 새 취약점 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` (게이트 814~906, 특히 819~850)
  - 상세: 종전 순서(`findOne` → 404 → self → owner 403 → `assertAdmin`, 게이트 -표시된 삭제 줄)에서는 워크스페이스와 무관한 사용자도 유효 JWT만 있으면 `(workspaceId, memberId)` 쌍에 대해 `404 MEMBER_NOT_FOUND` / `403 CANNOT_REMOVE_OWNER` / `403 ADMIN_REQUIRED` 세 갈래로 구분되는 응답을 받아, 대상 멤버의 존재 여부와 owner 여부를 추론할 수 있었다(`codebase/backend/src/modules/workspaces/workspaces.controller.ts:355-372`의 `@Delete(':id/members/:memberId')` 라우트가 `@Param('id')`를 쓰고 `@Roles()`가 없어 `RolesGuard`의 `handlerConsumesWorkspaceId` 판정이 false가 되고 가드가 단락 통과시키기 때문). 수정 후에는 `getMemberRole` 조회 결과가 없으면(게이트 831~832) 대상 조회(게이트 834) 이전에 `NOT_A_MEMBER`로 즉시 종료해 비-멤버에게 항상 동일한 응답을 반환한다. 새로 추가된 `workspace-rbac.e2e-spec.ts`의 "비-멤버는 대상 상태를 구분할 수 없다" 테스트(게이트 669~732)가 헤더 없이(=`RolesGuard`의 header-first 경로를 우회해) 세 가지 대상 상태에 대해 응답이 모두 `403 NOT_A_MEMBER`로 수렴함(집합 크기 1)을 직접 검증하고, `workspaces.service.spec.ts`의 신규 단위 테스트(게이트 1688~1704)는 한 걸음 더 나아가 `findOne`이 대상 id로 **호출조차 되지 않았음**을 mock 호출 기록으로 확인한다 — 서비스가 "같은 코드를 던지되 조회는 여전히 수행"하는 얕은 회귀를 잡는 형태다.
  - 제안: 없음(수정 자체가 유효한 방어). 다만 감사 목적상, admin/owner 판정 순서(admin 우선)도 `throwCannotRemoveOwner` 대비 `throwAdminRequired`가 먼저 나가도록 재배치돼(게이트 843~850) "대상이 owner만 아니면 제거 가능하다"는 거짓 함의를 제거한 점도 함께 확인했다.

- **[INFO]** 잔여 구조적 갭 — 동일 컨트롤러의 다른 라우트들은 여전히 가드 계층 보호를 받지 못한다(이번 PR 범위 밖으로 명시적으로 분리됨)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` — `@Param('id')`를 쓰고 `@WorkspaceId()`/`@Roles()`가 없는 다른 핸들러들(예: 게이트 131, 158, 192, 216, 237, 267, 290, 316 등)
  - 상세: `plan/in-progress/member-auth-order.md` §E(게이트 141~160)가 이미 실측하여 명시한 대로, 같은 컨트롤러에서 경로 `:id`를 워크스페이스로 쓰면서 가드 계층 보호가 없는 라우트가 17개 중 13개 존재한다. 이번 diff는 그중 `removeMember` 하나에 대해 서비스 계층 인가 순서를 고쳤을 뿐이고, 나머지 라우트들은 여전히 각 서비스 메서드의 개별 `assertAdmin`/`assertMembership` 호출 순서에 전적으로 의존한다(`addMemberByEmail`·`updateMemberRole`·`renameWorkspace`·`updateWorkspaceSettings` 등은 이미 대상 조회보다 인가를 먼저 하므로 안전하지만, 이는 라우트별 수동 준수이지 가드가 강제하는 불변식이 아니다). plan 문서 자신이 이를 "구조적 해법(가드가 경로 파라미터 워크스페이스도 인식하게 하기)을 먼저 검토해야 하는 별도 항목"으로 분리했고, 라우트별 수동 체크를 표준 패턴으로 승인하는 것 자체를 경계하는 조건(§E 인용문)까지 명시했다 — 2026-08-08 결정("73개 라우트에 개별 마커를 붙이는 opt-in 모델은 74번째 라우트에서 재발한다")과의 정합성도 자체 검토했다. 이 diff가 새로 만든 문제는 아니므로 이번 PR을 막을 사유는 아니지만, 다음 서비스 메서드를 작성하는 사람이 "대상 조회 전에 인가"라는 관례를 놓치면 같은 클래스의 오라클이 재발할 수 있다는 점은 리마인드해 둔다.
  - 제안: plan에 이미 등재된 "13-라우트 축" 후속 항목에서, 구조적 해법(가드가 경로 파라미터 기반 워크스페이스 id도 인식) 검토를 우선순위로 유지할 것.

- **[INFO]** 하드코딩된 시크릿 / 인젝션 / 암호화 / 에러 메시지 노출 — 해당 없음
  - 상세: 모든 DB 접근은 TypeORM의 파라미터화된 `where` 객체 문법을 사용해 SQL 인젝션 표면이 없다. 새로 추가된 에러 헬퍼(`throwNotAMember`/`throwAdminRequired`, 게이트 913~926)는 기존 두 개소에 흩어져 있던 동일 리터럴을 통합한 것으로, 메시지 내용은 이전과 동일한 일반 문구("워크스페이스 멤버가 아닙니다."/"Admin 이상의 권한이 필요합니다.")이며 스택 트레이스나 내부 식별자를 노출하지 않는다. 하드코딩된 API 키/토큰/비밀번호는 diff 어디에도 없다(e2e 파일의 `apiKey: 'sk-test'`는 이번 diff 범위 밖의 기존 테스트 픽스처 literal이며 실제 시크릿이 아니다).

## 요약

이번 diff는 `WorkspacesService.removeMember()`의 인가 판정 순서를 대상 조회보다 앞으로 옮겨, 워크스페이스와 무관한 인증된 사용자가 `(workspaceId, memberId)` 쌍에 대해 존재 여부·owner 여부를 응답 코드 차이로 추론할 수 있던 정보 노출(오라클) 취약점을 닫는 보안 수정이다. 요청자 role을 한 번만 읽어 재사용하고, admin 판정을 owner 판정보다 앞에 두어 부수적으로 "대상이 owner만 아니면 제거 가능하다"는 거짓 함의도 제거했다. 단위 테스트는 대상 레코드가 조회조차 되지 않았음을 mock 호출로 직접 검증하고, e2e 테스트는 실 인프라 위에서 세 가지 대상 상태(부재/owner/비-owner)에 대한 응답이 모두 동일함을 집합 크기로 단언해 회귀를 구조적으로 방지한다. 새로 도입된 취약점(인젝션·하드코딩 시크릿·암호화 약화·에러 노출 등)은 확인되지 않았다. 동일 컨트롤러의 다른 13개 라우트가 여전히 가드 계층 보호 없이 서비스 계층 순서에만 의존하는 구조적 갭이 남아 있으나, 이는 plan 문서가 이미 실측·인지하고 별도 항목으로 명시적으로 분리한 기존 갭이며 이번 diff가 새로 만든 것이 아니다.

## 위험도

NONE
