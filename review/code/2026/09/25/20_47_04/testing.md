# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** 1라운드 WARNING(재검사 OR 의 "멤버십 소멸(null)" 가지 미고정)이 실제로 해소됨 — 독립 재확인 완료
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` `describe('transferOwnership', …)` 내 `it.each([...])('인가 선행은 owner 였지만 락 재검사에서 %s OWNER_REQUIRED — 멤버를 바꾸지 않는다', …)` (게이트 1150-1196)
  - 상세: 전 라운드(`review/code/2026/09/25/20_20_00`) WARNING 은 재검사 조건 `if (!requesterMembership || requesterMembership.role !== 'owner')` 의 OR 두 가지 중 `!requesterMembership`(null) 가지가 미고정이라고 지적했다. 이번 diff 는 단일 `it` 를 `it.each(['강등이 보이면','admin'], ['멤버십이 사라졌으면', null])` 로 바꿔 두 가지를 모두 태운다. 본 리뷰에서 직접 `npm run test -- workspaces.service.spec.ts -t "락 재검사"` 로 실행한 결과 **2 passed**(두 파라미터화 케이스 모두 GREEN), 전체 스위트도 `npm run test -- workspaces.service.spec.ts` 로 **99 passed / 0 failed**(회귀 없음, 이전 98건+it.each 순증 1건과 일치)로 재확인했다. 서비스 코드(`workspaces.service.ts:756-762`)와 대조했을 때 mock 이 `opts.lock` 유무로 "무락 선행 → owner" / "락 재검사 → 파라미터화된 상태" 를 정확히 갈라 실제 두 단계 조회 순서·락 사용을 그대로 재현하고 있어 mock 적절성도 양호하다. 이 PR 은 트래커(`plan/complete` 이전 `20_20_00` 세션 RESOLUTION)에 기록된 뮤턴트 예측/실측(V1→admin 케이스만 RED, V2→null 케이스만 RED)도 남아 있어 두 분기가 서로 독립적으로 커버됨이 재검증됐다.

- **[INFO]** 새 테스트의 부정 단언이 vacuous 하지 않음 — 재검사 분기를 실제로 탔는지 호출 형태로 별도 고정
  - 위치: 위와 동일 파일, 게이트 1183-1194 (`requesterReads` 필터링 후 `[null, {mode:'pessimistic_write'}]` 단언, `memberRepo.save`/`workspaceRepo.save` `not.toHaveBeenCalled()`)
  - 상세: `OWNER_REQUIRED` 거부만 단언했다면 "애초에 재검사 분기에 진입하지 않고 사전 인가에서 먼저 걸려도" 같은 결과가 나올 수 있어 새 분기를 실제로 exercising 하는지 보장하지 못한다(과거 memory `feedback_vacuous_test_three_shapes` 의 "경로 미진입" 패턴). 이 테스트는 `memberRepo.findOne.mock.calls` 를 `where.userId === requesterId` 로 걸러 `lock` 값 순서를 `[null, {mode:'pessimistic_write'}]` 로 단언해, 무락 선행(owner 통과) 뒤 락 재검사가 **실제로** 실행됐음을 호출 형태로 고정한다. `save` 미호출 단언과 결합해 "거부는 됐지만 상태는 안 바뀜"까지 함께 잠근다 — 견고한 구성.

- **[INFO]** 회귀 테스트 유효성 — 기존 인접 케이스와 중복 없이 상호 보완
  - 위치: 같은 파일의 `'refuses when requester is not owner'`(게이트 1225-1232, `setupOwnerLookup('admin')` 사용) vs 신규 `it.each` 케이스
  - 상세: 기존 케이스는 **트랜잭션 진입 전** 무락 사전 인가에서 이미 admin 으로 거부되는 경로(코드 731-733)를 고정하고, 신규 케이스는 **트랜잭션 안** 락 재검사에서 상태가 바뀐 경로(코드 756-762)를 고정한다. 두 테스트가 같은 `OWNER_REQUIRED` 를 내지만 서로 다른 코드 경로를 타므로 중복이 아니라 상호 보완 — 신규 테스트가 없었다면 락 재검사 분기 자체가 죽어도(뮤턴트로 실측 완료) 스위트 전체가 GREEN 을 유지했을 것.

- **[INFO]** README 변경(파일 1)은 캐너리 실제 구현과 문구를 한 줄씩 대조 — 정합 확인
  - 위치: `codebase/backend/README.md` 게이트 52-63 vs `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` `assertWorkspaceIdReflectionWorks`(그 파일 131-157) 및 `workspace.decorator.ts` 의 `handlerConsumesWorkspaceId`/`workspaceParamNamesOf`
  - 상세: "합계 0건만" 판정(`if (total === 0) throw …`), "두 판별 따로 부팅 로그에 남는다"(로그 문자열 `` `@WorkspaceId() 소비 라우트 ${requestContext}건 인식 · @WorkspaceParam() 소비 라우트 ${pathParam}건 인식` ``), "먼저 볼 곳" 두 함수명 모두 실제 소스와 정확히 일치한다. 이 캐너리 자체의 dual-count 동작을 검증하는 `workspace-reflection-canary.spec.ts` 는 이번 diff 범위 밖(선행 커밋 `#1399`에서 이미 커버)이라 이번 문서 변경으로 인한 새 커버리지 갭은 없다.

- **[INFO]** 테스트 격리 — `beforeEach` 마다 새 `TestingModule`/mock 생성 확인, `it.each` 두 케이스 간 상태 누수 없음
  - 위치: 파일 상단 `beforeEach(async () => { … })`(게이트 72-159)와 신규 `it.each` 블록
  - 상세: `memberRepo`/`workspaceRepo` 는 매 `it` 마다 새 `jest.fn()` 으로 재생성되고 `fakeManager.getRepository` 가 서비스 내부 `manager.getRepository(WorkspaceMember)` 호출을 같은 mock 인스턴스로 되돌리도록 배선돼 있어, 사전 인가 조회(`this.memberRepository.findOne`)와 트랜잭션 내부 조회(`memRepo.findOne`)가 실제로 동일 객체를 공유하는 구조를 정확히 재현한다. `it.each` 두 파라미터 케이스는 서로 다른 `beforeEach` 인스턴스에서 실행되므로 admin 케이스의 mock 상태가 null 케이스로 새지 않는다 — 순서 무관 실행 확인(`npm run test -- workspaces.service.spec.ts -t "락 재검사"` 결과 2 passed).

- **[INFO]** 잔여 개선 여지(전 라운드에서 이미 기록·조치 불요로 처분됨, 재-flag 아님)
  - 위치: `setupOwnerLookup` 헬퍼(게이트 1068-1094)와 신규 `it.each` 내 인라인 mock
  - 상세: 신규 테스트는 `setupOwnerLookup` 을 재사용하지 않고 `lock` 유무 분기가 필요해 인라인으로 별도 구현했다 — 소규모 중복이지만, `20_20_00` RESOLUTION 에서 "헬퍼로 합치면 2-인자 헬퍼가 한 곳에만 쓰인다"는 이유로 조치 불요로 이미 처분됐다. 본 리뷰도 동의 — 강제 조치 대상 아님.

## 검증 절차 (본 리뷰에서 수행, 저장소 뮤테이션 없음)

1. `npm run test -- workspaces.service.spec.ts -t "락 재검사"` — 2 passed (신규 `it.each` 두 케이스만 타겟).
2. `npm run test -- workspaces.service.spec.ts` — 99 passed / 0 failed (전체 회귀 없음).
3. `codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 `transferOwnership`(723-802) 구현부를 읽어 새 테스트의 mock 배선(`opts.lock` 진위로 무락 선행/락 재검사 구분)과 `throwOwnerTransferRequired()`(939-944) 의 `code`/`message` 를 대조 — 완전히 일치.
4. `git status --short` — 본 리뷰 세션 산출물(`review/code/2026/09/25/20_47_04/`) 외 변경 없음. 저장소 파일은 전혀 편집하지 않았다(읽기·grep·테스트 실행만 수행).

## 요약

이번 diff 는 1라운드 리뷰(`review/code/2026/09/25/20_20_00`)가 지적한 유일한 WARNING — `transferOwnership` 트랜잭션 안 재검사 OR 조건 중 "요청자 멤버십 소멸(null)" 가지 미고정 — 을 `it.each` 로 정확히 메운 수정이다. 독립적으로 재실행한 결과 신규 두 케이스 모두 GREEN, 전체 스위트도 99건 회귀 없이 통과했고, mock 은 실제 서비스의 두 단계(무락 사전 인가 → 락 재검사) 조회 구조를 정직하게 반영하며 `save` 미호출·조회 순서까지 단언해 vacuous 하지 않다. README 문서 변경도 실제 캐너리 코드·로그 문구와 한 줄씩 대조해 정합함을 확인했다. 테스트 관점에서 추가로 요구할 만한 갭은 없다.

## 위험도

NONE
