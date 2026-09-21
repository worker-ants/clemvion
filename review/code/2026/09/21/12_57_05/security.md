# 보안(Security) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정

## 발견사항

- **[WARNING]** `removeMember()` — 권한 검사(`assertAdmin`)가 대상 존재·owner 여부 확인보다 **뒤에** 있어, 워크스페이스 멤버가 아닌 임의의 인증 사용자도 `workspaceId`+`memberId` 만 알면 멤버 존재 여부와 owner 여부를 구분해서 알아낼 수 있다 (사전 조건 자체는 이번 diff 가 만든 것이 아니라 기존 코드다)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()` 함수 전체 컨텍스트 게이트 `783`(`findOne`)·`786`(404 `MEMBER_NOT_FOUND`)·`792`(자가 탈퇴 위임)·`797`(403 `CANNOT_REMOVE_OWNER`)·`803`(`assertAdmin` 호출, 이 시점에야 권한이 검사됨). `assertAdmin` 정의는 게이트 `856-867`.
  - 상세: 호출 순서가 `findOne(무락) → self-check → owner-role 403 → assertAdmin`이다. 즉 요청자가 해당 워크스페이스의 멤버조차 아니어도(`assertAdmin`이 `getMemberRole`을 통해 `null`을 반환해 결국 거부되긴 하지만) 그 이전 단계에서 이미 응답 코드가 갈린다: (1) `memberId`가 그 워크스페이스에 없으면 `404 MEMBER_NOT_FOUND`, (2) 있고 owner면 `403 CANNOT_REMOVE_OWNER`, (3) 있고 owner가 아니면 (권한이 있든 없든) 다음 단계인 `assertAdmin`에서 `403 ADMIN_REQUIRED`로 넘어간다. (1)·(2)는 요청자의 권한과 무관하게 먼저 응답되므로, **권한이 전혀 없는 사용자도 "그 memberId가 존재하는가"와 "그 멤버가 owner인가"를 구분해서 알아낼 수 있다** (CWE-863 Incorrect Authorization / CWE-203 Observable Discrepancy 성격의 순서 결함). 같은 파일의 다른 Admin+ 메서드들(`addMemberByEmail` 게이트 `256-257`, `updateMemberRole` 게이트 `306`)은 모두 `assertAdmin`을 **가장 먼저** 호출하는 반면 `removeMember`만 예외라 이 순서가 의도된 설계라기보다 누락에 가까워 보인다. 실 익스플로잇 난도는 `workspaceId`/`memberId`가 모두 UUID라 blind guessing은 어렵지만, 과거 멤버였던 사용자·URL 공유·로그 등으로 ID가 노출된 경우 실제 정보 노출로 이어질 수 있다.
  - 제안: `assertAdmin(workspaceId, requesterId)`(또는 최소한 요청자의 멤버십 확인)를 `findOne` 직후, self-check 이전 또는 직후로 옮겨 권한 검사를 다른 비즈니스 로직보다 먼저 수행하도록 정렬한다. `transferOwnership`처럼 컨트롤러 레벨 `@Roles` 가드를 병행하는 방식도 고려할 수 있다. 이번 PR 범위(동시 삭제 감사 중복)와는 계약이 다르므로 별도 트래커 항목으로 등재 권장.

- **[WARNING]** owner 보호 가드의 TOCTOU — `member.role === 'owner'` 검사와 원자적 `DELETE` 사이에 동시 `transferOwnership`이 대상을 owner로 승격시키면 owner가 삭제될 수 있음 (이미 팀이 재현·측정하고 트래커에 등재한 기존 갭이며, 이번 PR이 새로 만든 것은 아님)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 게이트 `797`(owner 검사) ~ `822`(`DELETE`) 사이의 무락 구간. 코드 내 주석(게이트 `817-821`)과 `plan/in-progress/spec-draft-nullable-notation-followups.md`(게이트 `4819-4851`)에 실측 재현(`status=200, rows_remaining=0`)이 기록돼 있다.
  - 상세: 이 결과 `workspace.ownerId`가 멤버십 없는 사용자를 가리키는 상태로 남을 수 있어 owner 불변식이 깨진다. Race를 트리거하려면 실제 owner가 거의 동시에 `transferOwnership`을 호출해야 하므로 외부 공격자가 단독으로 악용하긴 어렵지만, 접근 제어 불변식(“owner는 제거되지 않는다”)이 실제로는 보장되지 않는 상태다. 팀이 이미 재현 레시피와 후보 처방(`role: Not('owner')` + 0-행 재조회 분기)을 트래커(`spec-draft-nullable-notation-followups.md`)에 등재하고, 이번 PR에서는 판별자 오염을 이유로 의도적으로 유예했다는 근거가 명시돼 있음(측정된 유예 사유이므로 타당).
  - 제안: 별도 처분 유지에 동의 — 다만 후속 PR로 넘어가지 않고 방치되지 않도록 (이미 등재된) 트래커 항목이 실제로 처리될 때까지 추적 필요. 신규 조치는 이번 PR 범위 밖.

- **[INFO]** 원자적 `DELETE`의 `affected` 판정이 `=== 0` 명시 비교라 `null`/`undefined`(드라이버 미보고)를 오탐하지 않도록 방어돼 있고, 대조군 테스트(`it.each([[undefined],[null]])`)까지 갖춰 안전성이 검증됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 게이트 `826`; 테스트 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 게이트 `1518-1531`
  - 상세: `!affected` 로 뒤집으면 정상 삭제(1행)가 404로 오판되는 회귀를 막는 명시적 규율이며, 형제 PR(#1371)에서 이 대조군이 없어 뮤턴트가 통과했던 사례의 재발을 잘 방지하고 있다. 보안적으로는 문제 없음(가용성/정합성 방어).
  - 제안: 없음 — 현행 유지.

- **[INFO]** 감사 로그 정합성 개선 자체는 보안 로깅 관점(OWASP A09 Security Logging and Monitoring Failures)에서 긍정적
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 게이트 `822-838`
  - 상세: 동시 요청 두 건이 `member.removed` 감사 행을 중복 생성하던 결함을 원자적 `DELETE`의 `affected`로 판별해 제거했다. 감사 로그가 실제 삭제된 행 수와 1:1로 대응하게 되어 사고 조사 시 오탐(중복 감사로 인한 "두 번 지워졌다"는 오판)을 방지한다.
  - 제안: 없음.

- **[INFO]** 인젝션·시크릿·암호화·에러 메시지 노출 관점 — 신규 문제 없음
  - 상세: `memberRepository.delete({ id, workspaceId })`는 TypeORM 파라미터 바인딩을 사용해 SQL 인젝션 위험이 없고, 컨트롤러에서 `ParseUUIDPipe`로 `memberId`/`workspaceId` 형식을 사전 검증한다(`workspaces.controller.ts` `removeMember`). 에러 메시지(`'멤버를 찾을 수 없습니다.'` 등)는 스택 트레이스나 내부 구현 정보를 노출하지 않는다. 하드코딩된 시크릿·자격증명은 diff 전체(서비스·유닛 테스트·e2e 테스트·plan 문서·consistency 리포트)에서 발견되지 않았다. e2e 테스트(`member-remove-concurrency.e2e-spec.ts`)의 DB 직접 접속은 기존 헬퍼(`createDbClient`)를 재사용할 뿐 자격증명을 코드에 하드코딩하지 않는다.

## 요약

이번 diff 자체(원자적 `DELETE`+`affected===0` 판정으로 동시 제거 감사 중복을 없앤 수정)는 새로운 취약점을 도입하지 않고, 오히려 감사 로그 정합성을 개선하는 안전한 변경이다. 다만 리뷰 과정에서 `removeMember()` 전체 컨텍스트를 확인하며 두 가지 사전 존재 이슈를 발견했다: (1) 권한 검사(`assertAdmin`)가 존재/owner 확인보다 뒤에 있어 워크스페이스 비멤버도 멤버 존재·owner 여부를 구분해 알아낼 수 있는 순서 결함(신규 미등재, WARNING) — 같은 파일의 다른 Admin+ 메서드와 순서가 다르다는 점에서 의도된 설계로 보기 어렵다. (2) owner 승격 TOCTOU(팀이 이미 재현·트래커 등재·유예 결정한 기존 갭, WARNING). 둘 다 이번 diff가 만든 결함은 아니며 이번 PR을 막을 사유는 아니지만, (1)은 새로 발견된 것이므로 트래커 등재를 권장한다.

## 위험도

MEDIUM
