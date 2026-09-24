# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 API 응답의 `error.code` 가 특정 시나리오에서 바뀐다 (의도된 변경, 계약 영향 고지)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember` 함수 본문의 `if (!ADMIN_ROLES.has(requesterRole)) this.throwAdminRequired();` 와 그다음 `if (member.role === 'owner') this.throwCannotRemoveOwner();` 두 줄의 순서 (게이트 847, 850)
  - 상세: 「비-admin 멤버가 owner 를 대상으로 제거를 시도」하는 경우, 종전에는 `403 CANNOT_REMOVE_OWNER` 가 먼저 던져졌는데 이번 순서 교체로 `403 ADMIN_REQUIRED` 가 던져진다. 둘 다 403 이지만 `error.code` 값이 달라 이 값을 분기하는 프런트/외부 클라이언트가 있다면 동작이 바뀐다. 리포지토리 내 검색 결과 프런트엔드(`codebase/frontend`)와 spec 문서에는 이 특정 조합(비-admin → owner 대상)을 `code` 값으로 분기하는 코드가 없었고, `spec/5-system/1-auth.md:375-379,553` 의 `CANNOT_REMOVE_OWNER` 서술은 "Admin 이 owner 를 지목"하는 케이스(순서 무관하게 동일 결과)만 다루므로 spec 과 상충하지는 않는다. 이 PR 의 plan(`plan/in-progress/member-auth-order.md`)이 이 트레이드오프를 실측·명시하고 있고 신규 unit/e2e 테스트로 고정돼 있어 의도적 변경으로 보이나, 이 함수를 호출하는 유일한 지점은 `workspaces.controller.ts:372` 하나뿐이라는 것도 확인했다(다른 내부 호출자 없음) — 파급 범위는 그 HTTP 라우트 하나로 국한된다.
  - 제안: 그대로 두어도 무방하나, API 변경 이력에 이 `code` 값 변경을 명시적으로 남겨 두면(CHANGELOG 등) 향후 프런트가 이 값을 소비하게 될 때 회귀를 막을 수 있다.

- **[INFO]** 비-멤버 요청자에 대한 응답이 `404`/`403` 혼합에서 단일 `403 NOT_A_MEMBER` 로 통일됨 (의도된 보안 수정)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember` 함수 상단, 게이트 831-832 (`const requesterRole = await this.getMemberRole(...)` / `if (!requesterRole) this.throwNotAMember();`)
  - 상세: 이 PR 의 목적 자체가 이 변경(존재 오라클 차단)이며 `codebase/backend/test/workspace-rbac.e2e-spec.ts` 의 신규 e2e 테스트가 3가지 대상 상태(부재/owner/editor)에 대해 응답이 모두 `403 NOT_A_MEMBER` 로 수렴함을 명시적으로 검증한다. 부작용이 아니라 명세된 변경이므로 등급을 CRITICAL/WARNING 이 아닌 INFO 로 기록한다.
  - 제안: 없음(의도된 동작).

- **[INFO]** self-removal 경로에서 요청자 role 을 두 번 조회하는 추가 DB 호출이 생긴다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember` 게이트 831 (`getMemberRole`) 과 그 아래 self 위임 분기(게이트 840-842, `await this.leaveWorkspace(...)`), `leaveWorkspace` 자체는 게이트 644-704(특히 668-671 `pessimistic_write` 재조회)
  - 상세: 이번 변경으로 `removeMember` 는 함수 시작 시 항상 `getMemberRole(workspaceId, requesterId)` 를 호출한다. 요청자가 대상 멤버 본인(자가 탈퇴)인 경우 이 호출은 이후 위임되는 `leaveWorkspace` 내부의 트랜잭션 `pessimistic_write` 재조회와 완전히 중복된다 — 종전에는 self 분기가 `assertAdmin` 도달 전에 `return` 되어 이 조회가 발생하지 않았다. 기능적으로는 문제없으나(잠금 없는 읽기라 경합에도 안전), 코드 주석이 "요청자 role 을 **한 번만** 읽는다"(게이트 829-830)고 명시한 의도와 self-removal 경로에서는 정확히 일치하지 않는다 — 그 주석이 막으려는 중복은 `assertMembership`+`assertAdmin` 이중 호출이라는 좁은 범위이므로 기재된 주장 자체가 틀린 것은 아니지만, self 경로의 추가 쿼리는 언급돼 있지 않다.
  - 제안: 문서화 목적이면 주석에 "self 위임 시 `leaveWorkspace` 가 별도로 재조회(락 포함)한다" 한 줄을 덧붙이는 정도로 충분하다. 기능 결함은 아니므로 필수 수정은 아니다.

- **[INFO]** 동일 사유로, 멤버(요청자)가 존재하지 않는 `memberId` 를 지정한 경우에도 새 `getMemberRole` 호출이 추가된다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 게이트 831-836
  - 상세: 종전에는 `findOne(대상)` 한 번의 조회로 즉시 404 를 던졌으나, 이제는 그 전에 요청자 멤버십 조회가 선행된다. 요청자가 정상 멤버인 한 이 경로는 쿼리 1회가 추가된다(요청자가 비-멤버면 오히려 대상 조회가 생략되어 쿼리가 그대로 1회). 성능상 무시할 수준의 인덱스 조회이며 정확성에는 영향이 없다.
  - 제안: 별도 조치 불필요.

## 시그니처/인터페이스 점검 (문제 없음, 확인 목적 기재)

- `removeMember(workspaceId, memberId, requesterId): Promise<void>` — 시그니처 불변. 유일한 프로덕션 호출자는 `workspaces.controller.ts:372` 하나뿐임을 확인했다(다른 서비스/모듈에서 직접 호출 없음).
- `assertMembership` / `assertAdmin` — 시그니처·던지는 예외의 `code`/`message`/HTTP 상태 모두 리팩터 전후 동일. 신설된 `private throwNotAMember()` / `private throwAdminRequired()` 는 클래스 내부 private 메서드로, 두 assert 헬퍼가 이를 호출하도록 바뀌었을 뿐 외부에서 관측 가능한 동작 변화는 없다.
- 테스트 헬퍼 `wireFindOne` 의 두 번째 파라미터 타입이 `Record<string, unknown>` → `Record<string, unknown> | null` 로 넓어졌다(기본값은 그대로). 이 헬퍼는 해당 spec 파일 내부에서만 쓰이며(11회 호출 확인), `null` 을 허용하는 것은 이번에 추가된 신규 테스트(요청자가 멤버가 아닌 케이스)를 표현하기 위함이다. 기존 호출부는 전부 객체 리터럴을 명시 전달하므로 영향 없음.
- `memberRepo.findOne.mockImplementation` 으로 교체된 것(순서 결합 제거)은 프로덕션 코드의 새 조회 순서(요청자 role → 대상)에 맞춘 것으로, `opts.where.id` 유무로 분기해 테스트를 호출 순서로부터 독립시킨다. 프로덕션 코드의 실제 조회(`getMemberRole` 은 `where:{workspaceId,userId}`, 대상 조회는 `where:{id,workspaceId}`)와 정확히 대응함을 소스에서 확인했다.

## 전역 상태/파일시스템/환경변수/네트워크/이벤트 점검

- 전역 변수: 신규 도입 없음. 모듈 스코프 상수 `ADMIN_ROLES` 는 기존 그대로이며 수정되지 않았다.
- 파일시스템: 이번 diff(서비스/스펙/e2e/plan 문서)에 파일 I/O 코드 변경 없음.
- 환경변수: 읽기/쓰기 변경 없음.
- 네트워크: 외부 서비스 호출 변경 없음(DB 쿼리만 관여).
- 이벤트/콜백: `auditLogsService.record(...)` 호출은 여전히 DELETE 성공 이후 지점(게이트 887 부근)에서만 발생하며 위치·조건이 이번 변경으로 이동하지 않았다. 신규 실패 분기(`throwNotAMember`/`throwAdminRequired`)들은 모두 audit 기록 이전에 예외를 던지므로 감사 로그가 더 늘어나거나 줄어들지 않는다(신규 e2e 테스트가 `getAudit().record` 미호출을 명시적으로 단언).
- e2e 신규 테스트(`workspace-rbac.e2e-spec.ts`)는 실제 DB 에 계정/워크스페이스/멤버를 생성하는 정상적인 e2e 부수효과 범위 내이며, 3개의 동시 DELETE 요청(`Promise.all`)을 보내지만 이는 "차단이 실패하면 실제 삭제가 일어난다"는 것을 검증하려는 테스트 설계 의도이고 사후 `COUNT(*)` 로 미삭제를 확인한다 — 리뷰 대상 코드 자체의 부작용이 아니라 테스트 설계임을 확인했다.

## 검증용 뮤테이션 여부

이번 리뷰에서는 저장소 파일을 뮤테이션하지 않았다(정적 분석 + 소스 대조만 수행). `git status --short` 확인 결과 워크트리에는 리뷰 산출물 디렉터리(`review/code/2026/09/24/11_10_45/`, untracked) 외 변경 없음.

## 요약

이번 변경은 `WorkspacesService.removeMember()` 의 인가 판정을 대상 조회보다 앞으로 옮겨 "존재/owner 여부를 응답 차이로 추론"할 수 있던 오라클을 닫는 의도된 보안 수정이다. 함수 시그니처, 공개 인터페이스 형태, 전역 상태, 파일시스템, 환경변수, 네트워크, 이벤트 발행 지점 모두 관찰 가능한 side effect 관점에서 문제가 없음을 확인했다. 유일하게 주목할 지점은 (1) "비-admin이 owner를 지목" 케이스의 `error.code` 가 `CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED` 로 바뀌는 관찰 가능한 API 계약 변화(문서화·테스트로 뒷받침됨, 소비 중인 프런트 코드 없음 확인)와 (2) self-removal/대상-부재 경로에서 `getMemberRole` 조회가 한 번 더 추가되는 미세한 성능 오버헤드다. 둘 다 기능적 결함이 아니며 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
