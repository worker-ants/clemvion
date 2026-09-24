# 테스트(Testing) 리뷰 — `removeMember` 인가 순서 재배치 (RESOLUTION 라운드)

## 확인 절차

- `codebase/backend/src/modules/workspaces/workspaces.service.ts` · `workspaces.service.spec.ts` · `codebase/backend/test/workspace-rbac.e2e-spec.ts` 를 `Read` 로 실제 줄 번호 대조.
- `npx jest src/modules/workspaces/workspaces.service.spec.ts --silent` 실행 — **80 passed / 80 total** (직전 라운드 79 → 신규 1, `RESOLUTION.md` 의 claim 과 일치).
- **독립 뮤테이션 검증**: `removeMember()` 안에서 self-위임 분기를 admin 판정 **뒤로** 옮기는 뮤턴트(M4 재현)를 직접 넣어 재실행 — **정확히 1개** 테스트만 실패(`비-admin 도 자기 자신이면 위임된다 — ADMIN_REQUIRED 가 아니다`, `Rejected to value: [ForbiddenException: Admin 이상의 권한이 필요합니다.]`), 나머지 79개는 그대로 통과. `RESOLUTION.md` 의 "M4: 예측 1 · 실측 1" 을 독립적으로 재확인했다. 원본은 `cp` 로 스크래치에 백업 후 뮤테이션 → 테스트 → `cp` 로 원복, `git status --short` 로 트리 클린 확인 완료(리뷰 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 대상 부재(`MEMBER_NOT_FOUND`) 판정과 admin 판정의 순서를 가르는 조합이 여전히 비-admin 요청자로 테스트되지 않는다 (이전 라운드 `review/code/2026/09/24/11_10_45/testing.md` INFO 항목의 잔존 갭 — 이번 RESOLUTION 커밋(`3fcc19e2c`)이 다루지 않았다)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `it('대상이 없으면 삭제를 시도하지 않는다', ...)` (`wireFindOne(null)` 호출 자리), 대응 코드는 `codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 `if (!member) this.throwMemberNotFound();` 와 그 다음 `if (!ADMIN_ROLES.has(requesterRole)) this.throwAdminRequired();` 두 줄
  - 상세: `wireFindOne(null)` 은 `requesterMembership` 인자를 생략해 기본값 `{ role: 'owner' }`(admin-tier)를 쓴다. 따라서 이 테스트는 "대상 존재(404) 판정이 admin 판정보다 앞" 이라는, 이번 diff 가 명시적으로 순서를 고정한 계약(주석 `843-847`)을 판별하지 못한다 — 그 두 검사의 순서를 뒤집는 뮤턴트를 넣어도 요청자가 owner 라 admin 검사는 어차피 통과하므로 이 테스트는 초록으로 남는다. 같은 파일이 "admin/owner 검사 순서"·"self-위임 검사 순서"는 각각 별도 비-admin 조합으로 정확히 가르면서, "404 검사 순서"만 이 패턴이 빠져 있어 커버리지가 비대칭이다.
  - 제안: `wireFindOne(null, { id: 'mem-req', role: 'editor' })` 조합으로 `MEMBER_NOT_FOUND` 를 단언하는 테스트를 추가해, 두 인가 판정과 404 판정의 상대 순서까지 세 갈래 모두 직접 가르게 한다.

- **[INFO]** "요청자 role 을 한 번만 읽는다" 는 명시적 성능/정합성 설계 의도(주석)를 지키는 회귀 테스트가 여전히 없다 (이전 라운드 잔존 갭, 이번 커밋 범위 밖)
  - 위치: 설계 주석 `codebase/backend/src/modules/workspaces/workspaces.service.ts:829-830`(신규 diff), 대응 스펙 자리는 없음
  - 상세: `assertMembership`·`assertAdmin` 을 그대로 이어 쓰면 `getMemberRole` 이 두 번 불린다는 문제를 피하려고 `removeMember` 가 직접 한 번만 읽도록 리팩터했다는 의도가 주석에 못박혀 있으나, 이를 검증하는 `toHaveBeenCalledTimes` 류 단언이 스펙에 없다. 동작 정확성에는 영향이 없는 쿼리-횟수 회귀라 우선순위는 낮지만, 문서화된 의도가 반증 불가능한 상태로 남아 있다.
  - 제안: 대표 admin 제거 성공 경로 테스트 하나에 `expect(memberRepo.findOne).toHaveBeenCalledTimes(2)`(요청자 role 1회 + 대상 조회 1회) 를 추가해 세 번째 쿼리로 조용히 퇴행하는 것을 막는다.

## 긍정적으로 확인된 점 (참고)

- 이전 라운드(`review/code/2026/09/24/11_10_45/testing.md`) WARNING 1(self-removal 이 admin 판정보다 먼저 통과해야 한다는 설계 의도를 직접 판별하는 unit 부재)이 `3fcc19e2c` 에서 신규 테스트 `비-admin 도 자기 자신이면 위임된다 — ADMIN_REQUIRED 가 아니다`(`workspaces.service.spec.ts:1765-1781`)로 정확히 닫혔다. 위 "확인 절차" 의 독립 뮤테이션 재현으로 이 테스트가 실제로 그 회귀를 잡는다는 것을 직접 검증했다(예측=실측=1, 죽는 테스트도 정확히 일치).
- `wireFindOne` 의 `requesterMembership` 파라미터가 `null`(비-멤버)을 받을 수 있게 확장되면서 docstring 도 함께 갱신됐고, 실제 라우팅 로직(`opts.where.id !== memberId` 분기)과 `getMemberRole` 의 `member?.role ?? null` 반환을 대조한 결과 `null` 처리가 정확하다 — 신규 테스트 `비-멤버는 대상을 조회하기 전에 NOT_A_MEMBER 로 끝난다` 가 대상 `findOne` 호출 자체가 없었음을 `mock.calls` 필터로 직접 확인하는 점도 강한 설계다(코드만 고치고 조회를 남겨 두는 얕은 회귀를 잡는다).
- stale 주석 2건(`wireFindOne` docstring 의 `assertAdmin` 언급, "후속 PR 이 옮길 예정" 예고 문구)이 실제 구현에 맞게 정정됐고, 정정 자체가 "이 순서 재배치가 실제로 일어났고 순서-비결합 단언이 통과했다" 는 실측을 덧붙이는 방식이라(재발 방지 문서화) 테스트 가독성·신뢰도에 기여한다.
- e2e 신규 테스트(`workspace-rbac.e2e-spec.ts`)는 값 셋이 아니라 "세 응답이 서로 구분되지 않는다"는 성질을 `new Set(answers).size` 로 단언해, 향후 구체 값이 바뀌어도 성질이 유지되는 한 깨지지 않는다. 헤더를 일부러 붙이지 않아(`X-Workspace-Id` 미첨부) `RolesGuard` 의 header-first 단축 경로를 우회하고 경로-파라미터 전용 라우트의 실제 취약 표면을 재현한다는 점을 docblock 이 명시한다.
- 회귀 테스트 유효성: `records member.removed (mode=removed) on admin removeMember` 등 기존 테스트가 `mockResolvedValueOnce` 순서-결합에서 `where` 값 기반 `mockImplementation` 으로 전환된 뒤에도 그대로 유효함을 전체 스위트 재실행(80/80 PASS)으로 확인했다. 리팩터(thrower 헬퍼 추출)로 인한 동작 변경은 없다.
- 테스트 격리: 최상위 `beforeEach` 가 `TestingModule` 을 매 테스트 새로 만들어 mock 객체가 테스트마다 독립적이다. e2e 테스트도 `uniqueEmail`/`uniqueName` 으로 데이터가 겹치지 않아 다른 테스트와 공유 상태가 없다.

## 요약

이번 라운드는 직전 리뷰(`11_10_45`)의 Testing WARNING 1(self-removal 순서 미검증)을 정확한 대상 테스트로 닫았고, 그 테스트가 의도한 회귀를 실제로 잡는다는 것을 독립 뮤테이션으로 재확인했다. `wireFindOne` 의 `null` 확장과 docstring 정정도 실제 구현과 일치한다. 다만 직전 라운드에서 INFO 로 남았던 두 항목 — "404 판정 vs admin 판정 순서를 비-admin 요청자로 가르는 테스트 부재"와 "요청자 role 단일 조회 의도의 회귀 테스트 부재" — 은 이번 커밋 범위 밖이라 그대로 남아 있다. 둘 다 이미 한 차례 보고·유예된 낮은 우선순위 항목이라 이번 라운드를 막을 사유는 아니지만, 같은 파일 안에서 유사한 순서 계약(admin/owner, self/admin)은 전용 테스트로 가르면서 이 조합만 비대칭으로 비어 있다는 점은 다음에 순서를 재배치할 때 조용히 놓칠 수 있는 자리다.

## 위험도

LOW
