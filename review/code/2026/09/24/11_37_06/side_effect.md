# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 API 응답의 `error.code` 가 특정 시나리오에서 바뀐다 (의도된 계약 변경, 고지됨)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()` 내
    `if (!ADMIN_ROLES.has(requesterRole)) this.throwAdminRequired();` 와 그다음
    `if (member.role === 'owner') this.throwCannotRemoveOwner();` 의 순서(게이트 847, 850)
  - 상세: 비-admin 멤버가 owner 를 대상으로 제거를 시도하면 종전 `403 CANNOT_REMOVE_OWNER` 대신
    `403 ADMIN_REQUIRED` 를 받는다. HTTP 상태는 403 으로 동일하나 wire `code` 값이 바뀌는 관찰
    가능한 API 계약 변경이다. `grep` 으로 직접 확인한 결과 `codebase/frontend` 어디에서도
    `CANNOT_REMOVE_OWNER` 코드값으로 분기하지 않고, 멤버 제거 버튼은
    `frontend/.../workspace/settings/page.tsx` 의 `RoleGate minRole="admin"` 으로 가려져 있어
    (실제 파일에서 재확인) 사내 프런트 영향은 없다. `removeMember()` 의 유일한 프로덕션 호출자도
    `workspaces.controller.ts:372` 하나뿐이다. `CHANGELOG.md` 의 신규 항목이 이 계약 변경을 이미
    명시 고지했다.
  - 제안: 조치 불요 — 이미 문서화·테스트(`workspaces.service.spec.ts` 의 "비-admin 이 owner 를
    지목하면 CANNOT_REMOVE_OWNER 가 아니라 ADMIN_REQUIRED 다" 블록)로 고정됨.

- **[INFO]** self-removal 및 대상-부재 경로에서 `getMemberRole` 조회가 한 번 더 발생한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()`
    상단(게이트 831 `const requesterRole = await this.getMemberRole(...)`)과 self 위임 분기
    (게이트 840-842, `leaveWorkspace` 위임)
  - 상세: 종전엔 self 분기가 `assertAdmin` 도달 전에 `return` 돼 요청자 role 재조회가 없었다.
    이제는 함수 진입 시 항상 `getMemberRole` 을 호출하므로, 자가 탈퇴로 위임되는 경우
    `leaveWorkspace` 내부의 `pessimistic_write` 재조회와 부분적으로 중복된다. 잠금 없는 읽기라
    경합 안전성엔 영향 없고, DB 쿼리 1회 증가는 무시 가능한 수준이다. 기능 결함 아님.
  - 제안: 조치 불요(선택: 주석에 self 경로의 추가 조회를 한 줄 명시).

- **[INFO]** 감사 로그(`auditLogsService.record`) 발행 지점·조건은 이번 diff 로 이동하지 않았다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()`
    말미의 `MEMBER_REMOVED` 기록 (원자적 `DELETE` 성공 이후, 신규 인가 실패 분기들보다 뒤)
  - 상세: 소스를 직접 열어 확인 — 신설된 `throwNotAMember()`/`throwAdminRequired()` 호출은 모두
    `this.memberRepository.delete(...)` 이전에 위치하고, 감사 로그는 `affected !== 0` 확인 후
    한 번만 기록된다. 인가 순서 재배치가 감사 로그의 발행 빈도·조건을 바꾸지 않았다.
  - 제안: 조치 불요(확인 목적 기재).

## 시그니처/인터페이스 점검 — 문제 없음

- `removeMember(workspaceId, memberId, requesterId): Promise<void>` — 시그니처 불변.
  `workspaces.controller.ts:372` 가 유일한 프로덕션 호출자이며 인자 전달 방식도 그대로다.
- `assertMembership`/`assertAdmin` — 두 메서드 모두 `private`, 시그니처·던지는 예외의
  `code`/`message`/HTTP 상태(`ForbiddenException`) 는 리팩터 전후 동일. 신설된
  `private throwNotAMember()`/`private throwAdminRequired()` 는 클래스 내부에만 노출되며
  외부에서 관측 가능한 동작 변화가 없다. `grep` 으로 전 파일을 대조해 중복 선언·충돌 없음을
  확인했다.
- `getMemberRole(workspaceId, userId): Promise<string | null>` — 순수 읽기 전용 메서드로
  기존 그대로이며 부작용 없음.

## 전역 상태 / 파일시스템 / 환경변수 / 네트워크 / 이벤트 점검

- 전역 변수: 신규 도입 없음. 모듈 스코프 상수 `ADMIN_ROLES` 수정 없음.
- 파일시스템: 코드(서비스/스펙/e2e) 변경에 파일 I/O 코드 자체는 없음. `CHANGELOG.md`·
  `plan/in-progress/*.md`·`review/code/2026/09/24/11_10_45/*` 는 이 저장소 컨벤션이 요구하는
  리뷰/plan 산출물이며(`CLAUDE.md` "코드 리뷰 산출물" 표), 이미 커밋(`da5112f3f`)돼 있어
  이 리뷰가 새로 만든 잔여물이 아니다. 이번 세션에서 나 자신은 저장소에 아무것도 쓰지 않았다
  (`git status --short` 로 확인, 미추적 항목은 이 리뷰 세션 자신의 출력 디렉터리
  `review/code/2026/09/24/11_37_06/` 뿐).
- 환경변수: 읽기/쓰기 변경 없음.
- 네트워크: 외부 서비스 호출 변경 없음(DB 쿼리만 관여, 쿼리 형태·개수는 위 INFO 참고).
- 이벤트/콜백: 감사 로그 발행 지점·조건 불변(위 참고). 신규 실패 분기는 모두 그 이전에 예외를
  던져 반환하므로 감사 로그 빈도에 영향 없음.

## 검증용 뮤테이션 여부

저장소 파일을 뮤테이션하지 않았다 — `Read`/`Bash`(grep, sed -n) 로 소스를 직접 열어 대조만
수행했다. `git status --short` 결과 워크트리에는 이 리뷰 세션 자신의 출력 디렉터리
(`review/code/2026/09/24/11_37_06/`, untracked) 외 변경이 없다.

## 요약

`WorkspacesService.removeMember()` 의 인가 순서를 대상 조회보다 앞으로 옮긴 변경으로, 함수
시그니처·공개 인터페이스·전역 상태·파일시스템·환경변수·네트워크 호출·이벤트 발행 지점 모두
관찰 가능한 부작용 문제가 없다. 새로 도입된 `throwNotAMember()`/`throwAdminRequired()` 는
private 헬퍼로 외부 영향이 없고, 유일한 관찰 가능한 변화는 (1) 비-admin이 owner를 지목할 때의
wire `error.code` 가 `CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED` 로 바뀌는 것(문서화·테스트로
뒷받침, 실제 소비 코드 없음을 직접 확인)과 (2) self-removal/대상-부재 경로의 미세한 쿼리 1회
증가다. 둘 다 이미 `CHANGELOG.md`·plan·직전 라운드 리뷰에서 실측·고지됐고, 이번 라운드의
추가 수정(CHANGELOG 갱신, 테스트 docstring 정정, 신규 unit 테스트)도 프로덕션 코드를 건드리지
않아 새로운 부작용을 만들지 않았다. CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
