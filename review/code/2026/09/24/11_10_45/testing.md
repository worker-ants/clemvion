# 테스트(Testing) 리뷰 — workspaces.service.ts / workspaces.service.spec.ts

## 확인 절차
- 실제 소스를 `Read`로 전체 열람(`workspaces.service.ts` 1~910행대, `workspaces.service.spec.ts` 1~1743행)해 프롬프트 게이트 번호와 대조.
- `npx jest src/modules/workspaces/workspaces.service.spec.ts --silent` 실행 — **79 passed / 79 total**, 회귀 없음 확인. 저장소에 아무 것도 쓰지 않았고 `git status --short`로 확인 완료(리뷰 산출물 디렉터리 외 변경 없음).
- 이 PR 의 커밋 이력(`7b851df3f`)을 확인 — M1/M1′/M2/M3 4종 뮤턴트를 실제로 넣어 테스트가 죽는지 실측했고, M1 은 무효(컴파일 실패)임을 별도로 식별해 M1′ 로 대체한 기록이 커밋 메시지에 남아 있다. 뮤테이션 검증이 이미 수행된 드문 사례.

## 발견사항

- **[WARNING]** self-removal 이 admin 판정보다 먼저 통과해야 한다는 설계 의도를 직접 검증하는 unit 테스트가 없다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1730` (`it('자기 자신이면 leaveWorkspace 로 위임하고 이 경로의 DELETE 는 타지 않는다', ...)`), 대응 설계 주석은 `codebase/backend/src/modules/workspaces/workspaces.service.ts:826` ("**자가 탈퇴는 비-admin 도 해야 하고**")
  - 상세: `removeMember`의 새 판정 순서는 `멤버십 → 대상 존재 → self 위임 → admin → owner`(`workspaces.service.ts:805`)다. 즉 self-위임 분기(837~841행)는 `admin` 판정(847행)보다 **앞**에 있어 비-admin(viewer/editor) 사용자도 자기 자신은 지울 수 있어야 한다 — 코드 주석이 이 사실을 명시적으로 설계 근거로 든다. 그런데 파일 전체에서 유일한 self-removal unit 테스트(1730행)는 `wireFindOne`의 `requesterMembership` 기본값(`role: 'owner'`, admin-tier)을 그대로 쓴다. 따라서 이 테스트는 "self 분기가 admin 분기보다 먼저 실행된다"를 판별하지 못한다 — 누군가 `if (member.userId === requesterId) {...}` 블록을 `if (!ADMIN_ROLES.has(requesterRole)) this.throwAdminRequired();` **뒤**로 옮기는 회귀를 내더라도(정확히 코드 주석이 "형제처럼 `assertAdmin`을 첫 줄에 둘 수 없다"고 경계하는 그 실수), owner 로 self-remove 하는 이 테스트는 여전히 초록이다.
    e2e `member-remove-concurrency.e2e-spec.ts`의 "자가 탈퇴 갈래는 이미 닫혀 있다" 테스트가 `editor` 역할로 이 경로를 실행하고 승자에게 `200`을 기대하므로(라인 ~168) 이 회귀를 **간접적으로는** 잡을 수 있으나, 그 테스트의 명시된 목적은 "동시 제거 시 중복 감사 방지"이지 판정 순서가 아니며(docblock: "자가 탈퇴 갈래는 이 PR 이 고치는 자리가 아니다"), 실패해도 원인을 가리키지 못하고 느리다.
  - 제안: `wireFindOne({ id: memberId, userId: requesterId, role: 'editor' }, { id: 'mem-req', role: 'editor' })` 같은 조합으로 "비-admin 이 자기 자신을 제거하면 `leaveWorkspace`로 위임되고 `ADMIN_REQUIRED`가 나지 않는다"를 직접 단언하는 unit 테스트를 추가.

- **[INFO]** target 존재(404) 판정과 admin 판정의 순서를 가르는 조합이 비-admin 요청자로 테스트되지 않음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1641`(`it('대상이 없으면 삭제를 시도하지 않는다', ...)`) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:834-847`
  - 상세: 판정 순서상 "대상 존재(404)"가 "admin 판정"보다 앞이므로(834~847행), 비-admin 멤버가 존재하지 않는 memberId 를 지목하면 `ADMIN_REQUIRED`가 아니라 `MEMBER_NOT_FOUND`가 나와야 한다. 그런데 1641행의 유일한 404 테스트는 기본 `beforeEach`의 owner(admin-tier) 요청자를 그대로 쓴다. 이 둘의 순서를 뒤집는 뮤턴트(대상 조회를 admin 판정 뒤로 옮김)는 현재 테스트 스위트에서 생존 가능하다. 보안적으로 심각하진 않다(요청자가 이미 유효한 멤버이므로 노출 범위가 비-멤버 오라클과는 다르다)만, 코드 주석이 순서를 명시적 계약으로 문서화한 만큼 커버리지 공백으로 남겨두는 것은 다음 재배치에서 조용히 깨질 수 있다.
  - 제안: `wireFindOne(null, { id: 'mem-req', role: 'editor' })`로 비-admin 요청자 + 부재 대상 조합의 `MEMBER_NOT_FOUND` 단언 테스트 추가.

- **[INFO]** "요청자 role 을 한 번만 읽는다"는 최적화 의도를 지키는 회귀 테스트가 없음
  - 위치: 설계 주석 `codebase/backend/src/modules/workspaces/workspaces.service.ts:829-830`
  - 상세: `assertMembership`/`assertAdmin`을 그대로 이어 쓰면 `getMemberRole`이 두 번 불린다는 문제를 `removeMember`에서 직접 `getMemberRole`을 한 번만 호출하도록 고쳤다는 의도가 주석에 명시돼 있으나, 이를 검증하는 `toHaveBeenCalledTimes` 류 단언이 스펙에 없다. 동작 정확성에는 영향 없는 성능/쿼리 횟수 회귀이므로 우선순위는 낮지만, 문서화된 의도가 반증 불가능한 상태로 남는다.
  - 제안: 대표 성공 경로 테스트 하나에 `expect(memberRepo.findOne).toHaveBeenCalledTimes(N)`(N = 요청자 role 1회 + 대상 조회 1회)을 추가해 두 단 인가 설계가 조용히 세 번째 쿼리로 퇴행하지 않게 고정.

## 긍정적으로 확인된 점 (참고)
- `wireFindOne`을 호출-순서 결합(`mockResolvedValueOnce` 체인)에서 `where` 값 기반 `mockImplementation`으로 바꾼 것(spec.ts:1291-1303, 1477-1503)은 실제로 "권한 검사를 대상 조회보다 앞으로 옮기자 두 mock 값이 뒤바뀌어 들어갔다"는 실측 결함을 해결한 정확한 리팩터다. 기존 `records member.removed (mode=removed) on admin removeMember` 테스트가 새 호출 순서에서도 여전히 유효함을 직접 확인했다(요청자 role 조회 `where`엔 `id` 키가 없어 `undefined !== 'mem-y'`로 분기되는 것을 `Read`로 대조).
- 신규 "비-멤버는 대상을 조회하기 전에 NOT_A_MEMBER 로 끝난다" 테스트(spec.ts:1688-1704)는 단순히 에러 코드만 보지 않고 `memberRepo.findOne.mock.calls`를 `where.id`로 필터링해 "대상 조회 자체가 발생하지 않았다"까지 단언한다 — 코드만 고치고 조회를 그대로 두는 얕은 회귀를 잡아내는 강한 설계다.
- 신규 "비-admin 이 owner 를 지목하면 CANNOT_REMOVE_OWNER 가 아니라 ADMIN_REQUIRED 다" 테스트(spec.ts:1714-1724)는 대상을 `owner`로 고정해 두 판정의 순서를 정확히 가른다 — 대상이 `editor`인 기존 "admin/owner 가 아니면 ADMIN_REQUIRED" 테스트(spec.ts:1667-1678)로는 이 순서를 가를 수 없다는 점을 docblock이 스스로 짚고 있다.
- 커밋 `7b851df3f`가 뮤테이션 테스트를 실제로 수행했고, 무효 뮤턴트(M1, 컴파일 실패)를 유효로 오인하지 않고 캐스트를 넣은 변형(M1′)으로 재검증한 점, M3(대상 조회만 앞으로 옮기는 뮤턴트)가 e2e(0/0, 380 PASS 그대로)로는 안 잡히고 unit 만 잡는다는 사실을 실측으로 남긴 점은 "단위 단언의 존재 이유"를 근거로 뒷받침한다.

## 요약
`removeMember`의 인가 순서 재배치(멤버십 → 대상 존재 → self 위임 → admin → owner)에 대한 테스트는 전반적으로 품질이 높다 — 특히 비-멤버 오라클 차단을 "조회 자체가 없었음"까지 단언하고, admin/owner 판정 순서를 별도 테스트로 가르며, 실제 뮤테이션 테스트로 각 단언의 판별력을 실측 검증한 점이 인상적이다. 다만 코드 주석이 명시적으로 설계 근거로 든 두 성질 — "self-위임은 admin 판정보다 앞이라 비-admin 도 탈퇴 가능해야 한다"와 "대상 존재(404) 판정이 admin 판정보다 앞이다" — 을 직접 판별하는 unit 테스트가 비어 있어, 향후 순서를 되돌리는 리팩터가 unit 스위트를 통과할 여지가 남는다. 전자는 e2e 동시성 테스트가 부산물로 간접 커버하지만 의도가 다르고 느리므로, 두 조합 모두 unit 레벨의 직접적 회귀 테스트로 보강할 것을 권한다.

## 위험도
LOW
