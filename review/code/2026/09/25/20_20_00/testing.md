# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** 신규 테스트가 실제로 재검사 분기를 고정하는지 뮤테이션으로 직접 검증 완료
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1149-1185` (신규 `it('인가 선행은 owner 였지만 락 재검사에서 강등이 보이면 OWNER_REQUIRED...')`)
  - 상세: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 `transferOwnership()` 재검사 조건 `if (!requesterMembership || requesterMembership.role !== 'owner')` 에서 role 비교를 제거하는 뮤턴트(`!requesterMembership`만 남김)를 넣고 재실행한 결과, 신규 테스트가 `OWNER_REQUIRED` 대신 `MEMBER_NOT_FOUND` 를 받아 **RED** 로 즉시 실패했다(재현·복원 로그는 아래 검증 섹션). 전체 스위트(`workspaces.service.spec.ts`, 98건)도 원본 기준 전부 GREEN — 회귀 없음. `memberRepo.findOne.mock.calls` 를 `where.userId`+`lock` 유무로 필터링해 "선행(무락)→재검사(락)" 순서까지 단언하는 방식은 호출 인자의 형태(shape)로 판별해 내부 순서 재배치에도 버티는 구조라 가독성·견고성 모두 양호하다.

- **[WARNING]** 재검사 OR 조건의 두 분기 중 "요청자 멤버십 소멸"(`!requesterMembership`) 가지는 테스트되지 않음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `transferOwnership()` 함수, 트랜잭션 내부의 `if (!requesterMembership || requesterMembership.role !== 'owner') { this.throwOwnerTransferRequired(); }` 분기 (gate 없음 — 이 파일은 이번 diff 대상이 아니라 컨텍스트로만 열람). 대응 신규 테스트: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1149-1185`
  - 상세: 신규 테스트는 "무락 선행=owner, 락 재검사=admin"(강등) 케이스만 고정한다. 같은 OR 조건의 다른 가지인 "무락 선행 통과 후 락 재검사 시점엔 요청자의 멤버십 행 자체가 사라짐(`null`)"은 어떤 테스트에서도 재현되지 않는다. 이 가지는 이론상으로만 존재하는 게 아니다 — 요청자가 owner 라도 다른 owner 가 있으면 `leaveWorkspace` 로 자신의 멤버십을 지울 수 있고, admin 이 `removeMember` 로도 지울 수 있다(모두 동시성 하에서 `transferOwnership` 과 경합 가능). 이 가지를 지우는 뮤턴트(예: null-체크만 남기고 `.role` 접근을 optional chaining 없이 role 조건만 남기는 형태)를 넣으면, `requesterMembership` 이 `null` 인 경로에서 `newOwnerMemberId === requesterMembership.id` 접근 시 처리되지 않은 `TypeError` 가 나 트랜잭션 콜백이 예기치 못한 방식으로 실패할 수 있는데, 이를 잡아 줄 테스트가 없다.
  - 제안: 위 신규 테스트 옆에 형제 케이스를 하나 추가 — 무락 선행은 owner, 락 재검사는 `memberRepo.findOne` 이 요청자 쪽에서 `null` 을 반환하도록 해 `!requesterMembership` 가지를 직접 고정한다(같은 패턴으로 `opts.lock` 유무 분기 재사용 가능). `deleteWorkspace` 쪽에는 이미 "선검사 뒤 역할이 바뀌어 재검사가 거부" 케이스가 있어 유사 패턴을 그대로 옮길 수 있다.

- **[INFO]** README 변경(파일 1)은 문서 전용이라 별도 테스트 대상 없음, 코드-문서 정합성 실측 확인
  - 위치: `codebase/backend/README.md:57-58`
  - 상세: 새 문구("두 판별 **따로** 부팅 로그에 남습니다 — `@WorkspaceId() 소비 라우트 N건 인식 · @WorkspaceParam() 소비 라우트 M건 인식`", "캐너리는 **합계 0건만** 잡으므로")를 `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` 의 `assertWorkspaceIdReflectionWorks`/`countWorkspaceConsumingRoutes` 실제 구현과 대조했다. 로그 포맷 문자열(`` `@WorkspaceId() 소비 라우트 ${requestContext}건 인식 · @WorkspaceParam() 소비 라우트 ${pathParam}건 인식...` ``)과 `if (total === 0) throw ...` 판정이 README 서술과 정확히 일치한다. 이 캐너리 로직 자체의 dual-count 동작을 검증하는 `workspace-reflection-canary.spec.ts` 는 이번 diff 대상이 아니고(이미 이전 커밋 `#1399`에서 커버됨) 이번 변경으로 인한 새 커버리지 갭은 없다.

- **[INFO]** 테스트 격리 — 신규 테스트는 `beforeEach` 로 매번 새 `TestingModule` 을 만들어 `memberRepo`/`workspaceRepo` mock 이 매 테스트 새로 생성됨을 확인. 신규 테스트의 `mockImplementation` 은 이 테스트 안에서만 유효하고 이전/이후 테스트의 mock 상태에 의존하지 않아 독립 실행 가능. `npm run test -- workspaces.service.spec.ts` 전체 98건 실행 시 순서 무관하게 GREEN.

## 검증 절차 (본 리뷰에서 수행)

1. `npm run test -- workspaces.service.spec.ts` — 98건 전부 통과(회귀 없음).
2. 원본을 `mktemp` 계열 scratch 디렉터리(`/private/tmp/.../scratchpad/workspaces.service.ts.orig`)에 `cp` 로 백업 후, 저장소의 `workspaces.service.ts` 재검사 조건에서 role 비교를 제거하는 뮤테이션을 주입 → 신규 테스트만 재실행 → `MEMBER_NOT_FOUND` 로 어긋나며 **RED** 확인 → 즉시 scratch 백업에서 `cp` 로 원복 → `diff` 로 원복 완전성 확인 → `git status --short` 로 저장소가 리뷰 시작 시점과 동일함(미커밋 잔여물 없음, 세션 자신의 output 디렉터리 `review/code/2026/09/25/20_20_00/` 만 untracked)을 확인. `git checkout`/`restore`/`stash` 는 사용하지 않았다.

## 요약

이번 변경의 핵심 테스트 산출물은 `workspaces.service.spec.ts` 에 추가된 `transferOwnership` 트랜잭션-내 재검사 분기 단위 테스트 1건이며, 뮤테이션으로 직접 검증한 결과 실제로 그 분기(무락 선행=owner, 락 재검사=admin 강등)를 고정하고 있고 전체 스위트도 회귀 없이 통과한다. mock 은 `beforeEach` 마다 재생성되어 격리도 양호하고, 호출 인자의 `where`/`lock` 형태로 판별해 호출 순서 재배치에도 버티는 견고한 작성 방식이다. 다만 같은 재검사 조건의 OR 중 "요청자 멤버십 자체가 사라진(null)" 가지는 이번에도 여전히 테스트되지 않은 채 남아 있어(동시 `leaveWorkspace`/`removeMember` 경합 시 처리되지 않은 예외로 샐 잠재 위험), 형제 케이스 하나를 추가할 것을 제안한다. README 변경은 문서 전용이며 실제 캐너리 코드와 문구를 대조해 정합함을 확인했다.

## 위험도

LOW
