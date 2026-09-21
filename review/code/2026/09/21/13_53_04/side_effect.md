# 부작용(Side Effect) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 (라운드 3, 12_57_05/13_28_12 후속)

## 사전 확인

- `git diff --stat origin/main...HEAD -- codebase/` → 3개 파일만 변경(`workspaces.service.ts` 62줄, `workspaces.service.spec.ts` 163줄, `member-remove-concurrency.e2e-spec.ts` 208줄). 이전 라운드(13_28_12) 이후 코드 변경은 없고, 마지막 커밋(`6f1113a70`)은 `member-remove-concurrency.e2e-spec.ts` JSDoc 문구·`plan/*.md` 정정뿐인 docs-only 커밋임을 `git show 6f1113a70`로 직접 확인했다.
- 리뷰 중 저장소에 어떤 파일도 Write/Edit 하지 않았다. `git status --short` 는 세션 시작 전과 동일하게 `review/code/2026/09/21/13_53_04/`(이 리뷰 산출물 디렉터리) 만 untracked로 남아 있다.

## 발견사항

- **[INFO]** `memberRepository.remove(entity)` → `memberRepository.delete(criteria)` 전환이 TypeORM lifecycle hook/subscriber를 우회할 수 있는 지점이지만, 이 저장소엔 해당 훅 자체가 없어 실질 유실이 없음을 독립적으로 재확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:834`(`const { affected } = await this.memberRepository.delete({ id: memberId, workspaceId });`)~`:838`(`if (affected === 0) this.throwMemberNotFound();`)
  - 상세: `repository.remove(entity)`는 엔티티 인스턴스 기반이라 `@BeforeRemove`/`@AfterRemove`/`EventSubscriber`를 발화시키지만 `repository.delete(criteria)`는 쿼리 빌더 기반이라 이를 타지 않는다 — "삭제 방식 전환이 부작용을 조용히 삭제한다"는 형태의 회귀가 될 수 있는 자리다. 직접 `grep -rn "EventSubscriber|@BeforeRemove|@AfterRemove|@BeforeSoftRemove|@AfterSoftRemove" codebase/backend/src` 를 실행해 0건을 확인했고, `WorkspaceMember` 엔티티(`codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts`)에도 lifecycle 데코레이터가 없다(관계는 `@ManyToOne(..., {onDelete:'CASCADE'})`뿐이며 이는 DB FK 레벨 캐스케이드로 `delete()`/`remove()` 어느 쪽을 써도 동일하게 작동). `grep -n "emit(|Gateway|EventEmitter2" codebase/backend/src/modules/workspaces/*.ts` 도 0건 — 멤버 제거에 연동된 WS/이벤트 발행이 없다.
  - 제안: 조치 불요(확인용). 다만 이 클래스에 향후 `@BeforeRemove`/subscriber가 추가되면, 이번 6번째(및 트래커에 등재된 `auth-configs`/`model-config`/`webauthn` 잔여 자리 포함) 원자적 `delete()` 계열 전체가 그 훅을 건너뛴다는 점을 그 시점 리뷰어가 놓치지 않아야 한다.

- **[INFO]** 시그니처·공개 인터페이스는 그대로 유지 — 신규 private 헬퍼만 추가됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:342`(`private throwMemberNotFound(): never`, 신규), `:795`(`async removeMember(workspaceId, memberId, requesterId): Promise<void>`, 시그니처 불변), `codebase/backend/src/modules/workspaces/workspaces.controller.ts:367-373`(`removeMember` 핸들러, 반환 형태 `{ data: { ok: true } }` 불변, 유일한 호출자)
  - 상세: `throwMemberNotFound()`는 `private`이라 클래스 외부 호출자에 영향이 없다. `removeMember`/`updateMemberRole`의 파라미터·리턴 타입·컨트롤러 응답 shape 모두 변경 없음(직접 대조 확인). 유일하게 관측 가능한 런타임 동작 변화는 "동시 삭제 두 건 중 패자가 이제 `404 MEMBER_NOT_FOUND`를 받고 감사를 남기지 않는다"(종전엔 둘 다 `200`+감사 2건)는 것으로, 이는 이번 PR의 의도된 목적 그 자체이며 형제 PR 5건(#1369~#1372)과 동일 패턴이다. `spec/5-system/2-api-convention.md §3` 멱등성 표와의 불일치는 이미 requirement/documentation 리뷰와 `--impl-prep` consistency-check에서 SPEC-DRIFT로 추적 중이라 side-effect 관점에서 추가 조치 불요.
  - 제안: 없음.

- **[INFO]** 신규 코드 경로가 기존에 다른 목적(캐스케이드 삭제)으로 설정된 공유 jest mock 기본값에 편승하지만, 필요한 모든 호출부에서 명시적으로 override 되어 있음을 호출부 전수 대조로 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:156-158`(`(memberRepo as unknown as { delete: jest.Mock }).delete = jest.fn().mockResolvedValue({ affected: 0 })`, 주석 `// Also expose delete on workspace/member repos for cascade/deletes` — 이번 diff 이전부터 존재, `git diff` 헝크에 포함되지 않음) / override 지점: `:1298`(`records member.removed (mode=removed) on admin removeMember` 테스트), `:1486`(`describe('removeMember — 동시 제거')`의 `beforeEach`)
  - 상세: `removeMember()`가 이번 diff로 처음 `memberRepository.delete()`를 호출하게 되면서, 원래 `deleteWorkspace`의 캐스케이드 삭제 검증용으로 세팅돼 있던 `memberRepo.delete`의 공유 기본값(`{affected: 0}`)에 새로 결합됐다. `grep -n "removeMember("` 로 이 파일의 모든 `service.removeMember(...)` 호출부(8곳: `:1300,1490,1511,1533,1543,1553,1572,1588`)를 대조한 결과, 삭제가 실제로 성공해야 하는 경로(`:1300`, `describe` 블록 내 `:1490`)는 모두 `{affected: 1}`로 명시 override 되어 있고, 나머지는 `delete`가 호출되지 않는 조기 반환 경로라 이 기본값의 영향을 받지 않는다. 최상위 `beforeEach`(`:65` 부근)가 매 `it`마다 `TestingModule`을 새로 컴파일하며 `memberRepo.delete`도 새 `jest.fn()`으로 재생성하므로(`:156-158`), override 가 다른 테스트로 새는 경로도 없다. 현재로선 결함이 아니지만, 향후 세 번째 코드 경로가 같은 `memberRepository.delete()`를 호출하도록 추가되면 이 공유 기본값의 존재를 모르는 채 작성될 경우 조용한 오탐/오누락 테스트가 생길 수 있는 구조적 취약점으로 기록해 둔다.
  - 제안: 조치 불요(이번 diff 범위에서는 안전). 다음에 `memberRepo.delete`를 사용하는 코드 경로를 추가할 때는 이 공유 기본값을 먼저 확인하도록 유의.

- **[WARNING]** (재확인, 신규 아님) owner 승격 TOCTOU로 인한 "예상 외의 공유 상태 변경" 경로가 코드에 남아 있음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:797`(무락 `if (member.role === 'owner')` 판정)부터 `:838`(원자적 `delete`+`affected===0` 판정)까지의 창. 자기-인지 주석 `:806-833`.
  - 상세: `member.role === 'owner'` 검사가 `:800`의 무락 `findOne` 스냅샷에 기반하므로, 그 검사와 `:834`의 `DELETE` 사이에 동시 `transferOwnership()`이 같은 행을 owner로 승격시키면 `removeMember()`는 가드를 재검사하지 않고 그대로 삭제를 실행한다 — `workspace.ownerId`가 방금 삭제된 멤버십을 가리키게 되는, 의도치 않은 공유 상태 변경이 실측 재현됐다(`plan/in-progress/member-dup-remove.md` §C-2, `status=200, rows_remaining=0`). 이번 PR이 새로 만든 결함이 아니라(코드 주석·`spec-draft-nullable-notation-followups.md`에 재현 레시피·후보 처방과 함께 이미 등재·의도적으로 유예됨), concurrency/database/requirement 리뷰어도 각자 관점에서 동일 사안을 재확인한 것으로 보인다. side_effect 관점에서 새로 추가할 사실은 없고, 다른 관점의 리뷰와 동일한 결론에 독립적으로 도달했다는 점만 교차 확인한다.
  - 제안: 이번 PR을 막을 사유는 아님(판별자 오염 회피라는 스코프 분리 근거가 타당함). 후속 PR에서 `delete({..., role: Not('owner')})` + 0-행 시 재조회 처방을 반드시 닫을 것.

- **[INFO]** 신규 e2e가 실제 DB/네트워크에 부작용을 일으키지만 격리·정리 패턴이 견고함(테스트 스코프 한정, 프로덕션 코드 무관)
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:45-63`(커넥션 생성/`afterAll`에서 `locker.end()`/`db.end()`), `:92-122`, `:171-197`(`BEGIN`/`FOR UPDATE`/`COMMIT`/`ROLLBACK`+`finally`)
  - 상세: `locker` 커넥션이 실제 `workspace_member` 행에 `SELECT ... FOR UPDATE` 락을 최대 1.5초 이상 쥔 채 실제 HTTP `DELETE` 두 건을 서버로 발사한다. `finally` 블록이 `ROLLBACK`(이미 `COMMIT`된 경우 postgres 상 no-op 에러가 나지만 `.catch(() => undefined)`로 무해화됨)과 `pending?.catch(() => undefined)`를 항상 실행해, 커넥션이 락을 쥔 채 남거나 unhandled promise rejection이 다음 테스트로 새는 경로가 없다. `BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011'`는 형제 e2e 스펙들과 동일한 기존 관례이며 새로 도입된 환경 변수 읽기가 아니다.
  - 제안: 없음 — 형제 패턴과 일치.

## 요약

이번 라운드(13_53_04)는 12_57_05→13_28_12 두 차례의 독립적 side-effect 리뷰가 이미 도달한 결론과 동일한 지점에서 출발하며, 그 사이 코드(`workspaces.service.ts`/`.spec.ts`/e2e-spec.ts) 변경은 없고 마지막 커밋은 comment-only docs 정정임을 `git show`로 직접 확인했다. `memberRepository.remove(entity)`를 원자적 `delete(criteria)`+`affected===0` 판정으로 바꾼 핵심 변경은 함수 시그니처·컨트롤러 응답 형태·public 인터페이스를 바꾸지 않으며, TypeORM lifecycle hook/subscriber나 이벤트 발행(WS/EventEmitter2) 손실 우려도 이 저장소엔 해당 메커니즘 자체가 없어 실질 영향이 없음을 직접 grep으로 재확인했다. 새로 발견한 것은 이 코드 경로가 `deleteWorkspace` 캐스케이드용으로 세팅된 기존 공유 jest mock 기본값(`memberRepo.delete` → `{affected:0}`)에 새로 편승한다는 점인데, 성공해야 하는 모든 테스트 케이스에서 명시적으로 override되어 있어 현재는 안전하다(향후 세 번째 호출부가 추가될 때만 주의할 잠재적 취약점). 유일하게 남아 있는 실질적 "의도치 않은 상태 변경" 벡터인 owner 승격 TOCTOU는 이번 PR이 만든 것이 아니라 폭이 그대로이며, 이미 코드 주석·plan·다른 관점 리뷰(concurrency/database/requirement)에서 실측·등재·유예된 사안이라 재지적 이상의 조치를 요구하지 않는다. 전역 변수·파일시스템·환경 변수·의도치 않은 네트워크 호출 관점에서 새로운 문제는 발견되지 않았다.

## 위험도

LOW
