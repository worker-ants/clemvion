# 테스트(Testing) 리뷰 — member-owner-toctou (2라운드, 2026-09-24 08:46:47)

## 검증 절차

- 저장소 파일은 전량 `Read`/`grep`/`sed -n` (read-only)로만 확인했다. 뮤테이션·백업·임시 파일을
  워킹트리 안에 만들지 않았고, `git status --short` 로 무변형을 확인했다(잔여물 없음).
- `codebase/backend/src/modules/workspaces/workspaces.service.ts`, `workspaces.service.spec.ts`,
  `test/member-remove-concurrency.e2e-spec.ts`, `test/helpers/concurrency.ts` 를 diff 뿐 아니라
  파일 전체 컨텍스트로 열어 대조했다.
- 1라운드(`review/code/2026/09/24/08_09_57`) 의 testing/concurrency 리뷰가 지적한 WARNING·항목이
  이번 라운드 diff 에서 실제로 해소됐는지 직접 확인했다:
  - `VACUITY_GUARD_MS` export 및 재진입 e2e 두 파일의 import 사용 — 확인됨(해소).
  - 신규 owner-TOCTOU e2e 블록의 전용 워크스페이스 격리(`createTeamWorkspace` 별도 호출) — 확인됨
    (해소, "파일 마지막이어야 한다" 주석 의존 제거).
  - `affected === 0` 재조회의 제3 상태(존재+non-owner) 처리 — `if (still?.role === 'owner')` →
    `if (still)` 로 분기 형태 자체가 바뀌었고, 그에 대응하는 강등 케이스 전용 단위 테스트
    (`재조회가 강등된 행을 봐도 403이다`)가 추가된 것을 확인했다.
- `getMemberRole`/`assertAdmin` 이 `where: { workspaceId, userId }` 만 쓰고 `id` 필드를 쓰지
  않음을 직접 확인해, `wireFindOne` 헬퍼가 `opts.where.id !== memberId` 로 대상 조회와 요청자
  조회를 가르는 라우팅이 여전히 유효함을 검증했다(이 부분은 코드 변경이 없어 1라운드 검증을
  재사용).

## 발견사항

- **[WARNING]** 신규/수정된 두 단위 테스트가 완전히 동일한 입력·단언을 갖는 중복 테스트다 —
  서로 다른 시나리오를 검증한다는 인상을 주지만 실제로는 같은 코드 경로를 두 번 확인한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1534`
    (`it('진 쪽은 404 이고 감사를 남기지 않는다', ...)`) 및 `:1609`
    (`it('DELETE 시점에 행이 사라졌으면 404 다', ...)`)
  - 상세: 두 `it` 블록 모두 `wireFindOne({ id: memberId, userId: 'target-user', role: 'editor' }, undefined, null)`
    로 동일하게 wiring 하고, `memberRepo.delete.mockResolvedValue({ affected: 0 })` 를 걸고,
    `rejects.toMatchObject({ response: { code: 'MEMBER_NOT_FOUND' } })` 와
    `expect(getAudit().record).not.toHaveBeenCalled()` 를 동일하게 단언한다 — 이름과 JSDoc
    설명만 다를 뿐 실행되는 mock 값·검증 내용이 바이트 단위로 같다. 이 PR 의 plan
    (`plan/in-progress/member-owner-toctou.md` §E "뮤턴트 — 예측과 대조")은 각 테스트가
    특정 뮤턴트를 죽이는 역할을 명시적으로 추적하는 방법론을 쓰고 있는데, 그 표에 이
    두 테스트가 함께 필요하다는 근거가 없다 — 표에 등장하는 것은 "owner 로 승격됐으면 403"
    과 "강등된 행을 봐도 403"(뮤턴트 B′/B″)뿐이고, 404 두 블록은 어느 뮤턴트 항목에도
    개별적으로 연결돼 있지 않다(둘 다 같은 뮤턴트 — `throwMemberNotFound()` → `throwCannotRemoveOwner()`
    치환 — 을 잡을 뿐이며 하나로 충분하다). 직전 라운드에서 "진 쪽은 404" 테스트를
    (일어날 수 없는 상태를 고정하던 것에서) `null` 재조회로 고치는 과정에서, 별도로 추가된
    "DELETE 시점에 행이 사라졌으면 404 다" 블록과 우연히 완전히 겹치게 된 것으로 보인다.
  - 제안: 둘 중 하나를 제거하거나(권장: 원래 있던 "진 쪽은 404 이고 감사를 남기지 않는다"를
    남기고 신규 블록을 제거), 둘을 남기려면 서로 다른 관측을 검증하도록 분화한다(예: 하나는
    "동시 제거"라는 원래 계약의 회귀를, 다른 하나는 "행 소실" 이유를 명시적으로 이름 붙여
    구분). 현재 상태로는 유지보수 시 한쪽만 갱신되고 다른 쪽이 낡아도 아무도 알아채지 못하는
    silent drift 위험이 있다.

- **[INFO]** `affected === 0` 이후의 재조회(`still`) 가 `workspaceId` 로도 좁혀 조회하지만, 그
  스코핑 자체를 확인하는 단위 테스트는 없다 — 향후 회귀로 `workspaceId` 필터가 빠져도 현재
  단위 테스트 스위트는 이를 잡지 못한다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:863-865`
    (`const still = await this.memberRepository.findOne({ where: { id: memberId, workspaceId } });`)
    / 대응 테스트 헬퍼 `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1483-1492`
    (`wireFindOne` — `opts.where.id !== memberId` 로만 라우팅, `opts.where.workspaceId` 는 전혀 보지 않음)
  - 상세: `wireFindOne` 목은 `id` 필드만으로 대상 조회 vs 요청자 조회를 가르기 때문에, 프로덕션
    코드가 이 두 번째 `findOne` 호출에서 `workspaceId` 조건을 실수로 빼도 목 응답은 달라지지
    않고 테스트는 그대로 통과한다. 실제 위험은 낮다 — `workspace_member.id` 가 UUID PK 라 다른
    워크스페이스 소속 행과 충돌할 일이 실무적으로 없고, e2e (`member-remove-concurrency.e2e-spec.ts`)
    는 실 DB 를 쓰므로 같은 사각지대를 안고 있지는 않다(다만 e2e 도 이 필드 자체를 직접
    검증하는 단언은 없다). 그래도 이 자리가 멀티테넌시 경계 조건(다른 워크스페이스의 동일 `id`
    행을 잘못 참조)이라는 성격을 감안하면, 최소 단위 테스트에서 "대상 조회를 `workspaceId` 로도
    좁힌다" 는 계약을 한 줄이라도 고정해 두는 편이 다음 리팩터에 대한 안전망이 된다.
  - 제안: (조치 불요로 판단해도 무방) 원한다면 `wireFindOne`에 `where.workspaceId` 를 캡처해
    두 번째 `findOne` 호출에서 이 값이 실제로 전달됐는지 검증하는 단언을 하나 추가한다.

## 확인 사항 (문제 아님 — 1라운드 WARNING 해소 검증)

- `VACUITY_GUARD_MS` 가 `test/helpers/concurrency.ts` 에서 `export` 되고,
  `integration-rotate-concurrency.e2e-spec.ts:9`·`member-remove-concurrency.e2e-spec.ts:11` 양쪽이
  이를 import 해 재사용한다 — 세 번째 하드코딩이 재발하지 않았고 `assertGuardBelowKnownTimeouts`
  의 검사 범위 안에 남아 있다.
- 신규 owner-TOCTOU e2e 블록(`member-remove-concurrency.e2e-spec.ts:209-294`)이 `beforeAll` 의
  공유 `workspaceId` 를 쓰지 않고 자체 `createTeamWorkspace` 호출로 격리된
  `isolatedWorkspaceId` 를 만든다 — "파일 마지막이어야 한다" 는 순서 의존 주석이 더는 유일한
  안전장치가 아니다.
- `still?.role === 'owner'` → `if (still)` 로 판정 분기가 바뀐 것에 맞춰, 종전 무효했던 단위
  테스트("진 쪽은 404"가 재조회 `role:'editor'`+404 기대라는 도달 불가능한 조합을 고정하던 것)를
  `null` 재조회로 바로잡았고, 강등 이양 연쇄를 검증하는 별도 블록(`workspaces.service.spec.ts:1589`)
  을 추가했다. 뮤턴트 B′(옛 형태 복귀)·B″(분기 제거)가 각각 이 신규 테스트로 죽는 것을
  plan/RESOLUTION 표와 코드 대조로 확인했다.
- `wireFindOne` 의 `targetReads` 카운터는 `removeMember` 의 실제 `findOne` 호출 순서(대상 1차 조회
  → `assertAdmin` 의 요청자 조회 → 0-행 시 대상 재조회)와 여전히 일치한다 — 이번 diff 가
  `getMemberRole`/`assertAdmin` 의 where 절을 바꾸지 않았음을 직접 확인했다.
- 단위 테스트의 `criteria.role.type`/`.value` 로 `FindOperator` 를 직접 언팩하는 방식과, 그
  렌더링 정확성을 실 DB e2e(`member-remove-concurrency.e2e-spec.ts`)로 이중 오라클하는 설계는
  1라운드에서 이미 검증됐고 이번 라운드에서도 그대로 유효하다.
- e2e 신규 블록의 `try/finally`(정상 경로 no-op, 단언 실패 시에만 `ROLLBACK` + `pending` 드레인)는
  락 보유 커넥션 누수를 막는 설계로 여전히 적절하다.
- 기존 e2e ([200, 404] 동시 삭제 두 건) 은 owner 가 아닌 두 대상의 겹침이라 새 `role: Not('owner')`
  술어에 영향받지 않는다 — plan 의 TEST 결과(378 → 379 PASS)로 회귀 없음이 실측 확인됐다.

## 요약

핵심 프로덕션 변경(`removeMember` 의 조건부 원자 `DELETE ... WHERE role != 'owner'` + 0-행
재조회 3분기 판별)은 unit 4건(신규 2 + 재작성 2) + e2e 1건으로 두 계층에서 상호 보완적으로
커버되고, 1라운드 리뷰가 지적한 6개 WARNING 중 테스트에 관련된 항목(공허성 가드 상수 중복,
공유 워크스페이스 오염, 제3 상태 미처리)이 모두 실제 코드·테스트 변경으로 해소된 것을 직접
대조 확인했다. 새로 발견한 문제는 동작 결함이 아니라 테스트 위생 이슈다 — 단위 테스트 두 개가
서로 다른 이름과 JSDoc 을 갖고도 완전히 동일한 mock 입력·단언을 반복해(WARNING), 이 PR 이
스스로 표방하는 "테스트마다 죽이는 뮤턴트가 명확하다"는 방법론과 어긋나는 잔여물을 남겼다.
부수적으로 재조회의 `workspaceId` 스코핑을 직접 검증하는 단위 테스트가 없다는 낮은 우선순위
갭(INFO)도 있으나 UUID PK 특성상 실질 위험은 낮다. 둘 다 병합을 막을 사유는 아니다.

## 위험도

LOW
