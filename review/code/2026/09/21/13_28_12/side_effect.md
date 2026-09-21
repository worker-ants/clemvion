# 부작용(Side Effect) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 (12_57_05 후속 조치 포함)

## 발견사항

- **[INFO]** `memberRepository.remove(entity)` → `memberRepository.delete(criteria)` 전환이 TypeORM 엔티티 레벨 lifecycle hook/subscriber 를 우회하지만, 이 저장소엔 그런 훅이 없어 실질 유실이 없음을 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:834-838` (`const { affected } = await this.memberRepository.delete({ id: memberId, workspaceId }); ... if (affected === 0) this.throwMemberNotFound();`)
  - 상세: TypeORM 에서 `repository.remove(entity)` 는 엔티티 인스턴스 기반 삭제라 `@BeforeRemove`/`@AfterRemove` 훅과 `EventSubscriber` 를 발화시키지만, `repository.delete(criteria)` 는 쿼리 빌더 기반이라 이런 훅을 타지 않는다 — 일반적으로는 "삭제 방식 전환이 부작용을 조용히 없앤다" 는 형태의 회귀를 만들 수 있는 지점이다. 직접 확인한 결과 `WorkspaceMember` 엔티티(`codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts`)에는 lifecycle 데코레이터가 없고, `grep -rn "EventSubscriber\|@BeforeRemove\|@AfterRemove" codebase/backend/src` 전체가 0건이라 이 백엔드엔 TypeORM subscriber 자체가 없다. 또한 워크스페이스 모듈 어디에도 멤버 제거에 연동된 WebSocket/EventEmitter emit 이 없음을 확인했다(`grep -n "emit\|Gateway\|EventEmitter2"` 0건). 즉 이번 전환으로 유실되는 부작용은 실재하지 않는다 — 형제 PR(#1369~#1372)이 이미 검증한 것과 같은 안전한 패턴이다.
  - 제안: 조치 불요(확인용 기록). 다만 향후 이 엔티티 계열에 `@BeforeRemove`/subscriber 를 추가하는 변경이 들어오면, 이 9자리 계열( `removeMember` 포함, 트래커에 등재된 `auth-configs`/`model-config`/`webauthn` 포함) 전체가 원자적 `delete()` 기반이라 그 훅을 타지 않는다는 점을 그 시점의 리뷰어가 놓치지 않도록 유의.

- **[WARNING]** (재확인, 신규 아님) owner 승격 TOCTOU 로 인한 의도치 않은 상태 변경 경로가 코드에 남아 있음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:797`(무락 `member.role === 'owner'` 판정)부터 `:838`(원자적 `delete` + `affected===0` 판정)까지의 창. 자기-인지 주석 `:817-833`.
  - 상세: `member.role === 'owner'` 검사가 `:800` 의 무락 `findOne` 스냅샷에 기반하므로, 그 검사와 `:834` 의 `DELETE` 사이에 동시 `transferOwnership()` 이 같은 행을 owner 로 승격시키면 `removeMember()` 가 가드를 재검사하지 않고 그대로 삭제를 실행한다 — 결과적으로 `workspace.ownerId` 가 멤버십이 삭제된 사용자를 가리키는 상태로 남는, "예상 외의 공유 상태 변경"이 실제로 재현됐다(`plan/in-progress/member-dup-remove.md` §C-2: 재진입 기법으로 `status=200, rows_remaining=0` 실측). 이번 PR 이 새로 만든 결함이 아니라 이번 PR 이 도입한 `affected===0` 판별자가 "행 없음"과 "owner 로 변경됨"을 구분하지 못한다는 한계이며, 코드 주석·plan·`spec-draft-nullable-notation-followups.md`(4840~4873행)에 재현 레시피·후보 처방과 함께 이미 등재·유예되어 있다. security/database/concurrency/requirement 리뷰어도 동일 사안을 각자 관점에서 재확인한 것으로 보인다.
  - 제안: 이번 PR 을 막을 사유는 아님(스코프 분리 근거가 타당함 — 판별자 오염 회피). 후속 PR 에서 `delete({..., role: Not('owner')})` + 0-행 시 재조회로 원인을 가르는 처방을 반드시 닫을 것.

- **[INFO]** 공개 API 관측 가능 동작 변경(동시 요청 패자 200→404, 감사 이벤트 미기록)은 의도된 변경이며 호출자 영향 범위가 확인됨
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:367-374`(`removeMember` 핸들러, 반환 형태 `{data:{ok:true}}` 불변) / `workspaces.service.ts:795-798`(`removeMember` 시그니처 `Promise<void>` 불변)
  - 상세: `removeMember()` 의 시그니처(`workspaceId, memberId, requesterId): Promise<void>`)와 컨트롤러 반환 형태는 변경되지 않았다 — 유일한 호출자(`workspaces.controller.ts:372`)도 그대로다. 관측 가능한 변경은 "동시 삭제 두 건 중 패자가 이제 예외(404 `MEMBER_NOT_FOUND`)를 받는다"는 런타임 동작뿐이며, 이는 형제 다섯 PR(#1369~#1372)과 동일한 패턴이자 이번 PR 의 목적 그 자체다. `spec/5-system/2-api-convention.md §3`(멱등성 표) 갱신은 이미 planner 소유 트래커 항목으로 등재돼 있다.
  - 제안: 없음 — 의도된 변경이고 추적 완료.

- **[INFO]** 테스트 mock(`memberRepo.delete`) 재생성 구조상 `describe` 블록 간 상태 누수 없음을 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:156-158`(전역 `beforeEach` 에서 `memberRepo.delete = jest.fn().mockResolvedValue({affected:0})` 매 테스트마다 재생성), `:1486`(`removeMember — 동시 제거` describe 자체 `beforeEach` 에서 `{affected:1}` 로 override)
  - 상세: 새 `describe('removeMember — 동시 제거', ...)` 블록과 기존 `describe('audit logging (결정4=B)', ...)` 블록(`:1296-1298`, `memberRepo.delete.mockResolvedValue({affected:1})`)이 모두 같은 `memberRepo.delete` 목을 서로 다른 기본값으로 override 하지만, 최상위 `beforeEach`(:72)가 매 `it` 마다 `TestingModule` 을 새로 컴파일하고 `memberRepo.delete` 를 새 `jest.fn()` 으로 다시 만들기 때문에(:156-158) 실행 순서에 따라 한 테스트의 override 가 다른 테스트로 새는 경로가 없다. `getAudit()` 를 최상위 스코프로 승격한 리팩터(SUMMARY#4)도 `service` 클로저 변수를 그대로 참조해 동일하게 안전하다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** e2e 신규 파일이 실제 서버·DB 에 대해 네트워크·DB 부작용을 일으키지만, 형제 다섯 e2e 스펙과 동일한 격리 패턴을 따름
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:41-59`(커넥션 생성/종료), `:88-118`, `:167-193`(`BEGIN`/`FOR UPDATE`/`COMMIT`/`ROLLBACK`)
  - 상세: `locker` 커넥션으로 실제 `workspace_member` 행에 `SELECT ... FOR UPDATE` 락을 걸어 최대 1.5초 이상 보유한 채 실제 HTTP `DELETE` 두 건을 서버에 발사한다. 이는 프로덕션 코드가 아니라 테스트 전용 기법이며, `finally` 블록이 `ROLLBACK`(이미 COMMIT 된 경우 no-op, `.catch(() => undefined)` 로 무해화)과 `pending` 정리를 항상 수행해 커넥션이 락을 쥔 채 남거나 unhandled rejection 이 새는 경로가 없다. `uniqueEmail`/`uniqueName` 헬퍼로 매 실행마다 신규 사용자·워크스페이스를 만들 뿐 기존 데이터를 변경하지 않으며, 생성된 테스트 데이터를 명시적으로 정리하지 않는 점도 형제 다섯 파일과 동일한 기존 관례다.
  - 제안: 없음 — 형제 패턴과 일치.

## 요약

핵심 변경(`removeMember()` 를 무락 `remove(entity)` 에서 원자적 `delete(criteria)`+`affected===0` 명시 판정으로 교체)은 시그니처·공개 반환 형태를 바꾸지 않고, TypeORM lifecycle hook/subscriber 손실 위험도 이 저장소엔 해당 훅 자체가 없어 실질적 영향이 없음을 직접 확인했다. 유일하게 남아 있는 실질적 "의도치 않은 상태 변경" 경로는 owner 승격 TOCTOU(코드 주석·plan 에 이미 실측·등재·의도적 유예된 사안)이며, 이번 PR 이 새로 만든 것이 아니고 판별자 오염을 피하기 위해 의도적으로 분리한 근거도 타당하다. 관측 가능한 API 동작 변경(동시 삭제 패자 200→404)은 목적 자체이며 호출자·스펙 트래킹이 모두 확인됐다. 테스트 mock 재생성 구조와 신규 e2e 의 커넥션/트랜잭션 정리도 부작용 관점에서 안전하다. 이번 diff 를 막을 부작용 사유는 없다.

## 위험도

LOW
