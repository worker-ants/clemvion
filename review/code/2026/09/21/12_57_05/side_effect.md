# 부작용(Side Effect) 리뷰 — `WorkspacesService.removeMember()` 동시 삭제 감사 중복 수정

## 발견사항

- **[INFO]** 공개 API 관측 가능 동작 변경 — 동시 DELETE 패자가 200 → 404 로 바뀐다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` (`  822|`~`  831|`, atomic `delete` + `if (affected === 0)` 분기)
  - 상세: 종전엔 무락 `findOne` → `memberRepository.remove(member)` 였고, `remove()` 는 대상이 이미 지워졌어도 예외를 던지지 않아 동시 요청 두 건이 **둘 다** `200 {data:{ok:true}}` 를 받고 감사도 두 번 남겼다. 이번 수정 이후에는 원자적 `delete({id, workspaceId})` 의 `affected===0` 을 판정자로 써서, 늦게 도착한 요청이 `404 MEMBER_NOT_FOUND` 를 받고 감사도 남기지 않는다. 이것은 `removeMember` 를 호출하는 모든 외부 클라이언트가 관측할 수 있는 **의도된** 동작 변경이며(형제 5건 #1369~#1372 와 동일 패턴), 함수 시그니처(`Promise<void>`, 파라미터)는 그대로다.
  - 제안: 이미 `spec/5-system/2-api-convention.md §3` "DELETE=멱등(O)" 표와의 충돌이 이번 작업의 `--impl-prep` consistency-check (`review/consistency/2026/09/21/12_23_48/SUMMARY.md` WARNING 1) 에서 확인·추적되고 있다. 코드 자체의 부작용으로는 이상 없음 — 추가 조치 불요.

- **[INFO]** owner 승격 TOCTOU 창은 이 diff 가 새로 만든 것이 아니라 폭이 그대로다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `removeMember()` — `member.role === 'owner'` 가드(`  797|`대) 와 신설 `delete({id, workspaceId})` (`  822|`) 사이
  - 상세: 신설 `delete()` 호출의 WHERE 절이 `id`·`workspaceId` 만 걸고 `role` 은 걸지 않으므로, owner 가드 통과 이후 동시 `transferOwnership` 이 그 멤버를 owner 로 승격시키면 여전히 삭제가 성공한다. 다만 이 창은 수정 전 `remove(member)` 때도 동일하게 존재했다(제거 대상 판정 기준이 role 을 재검증하지 않는 것은 이전과 같음) — 이번 diff 가 그 폭을 넓히거나 좁히지 않았다. 코드 주석(`  817|`~`  821|`)과 plan(`plan/in-progress/member-dup-remove.md` §C-2)이 실측 재현까지 마치고 별도 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md` "removeMember() 의 owner 보호 가드가 TOCTOU 로 뚫린다")으로 명시 유예했다.
  - 제안: 이번 PR 범위 밖으로 이미 처분됨 — 재지적 불요. 후속 PR 에서 `role: Not('owner')` 를 추가할 때 `affected===0` 의 의미가 "행 없음"과 "owner 로 승격됨" 두 가지로 늘어난다는 점만 유의(코드 주석에 이미 명시).

- **[INFO]** 감사 이벤트 발생 횟수 감소는 의도된 것
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `auditLogsService.record(...)` 호출 (`  832|` 대 이후, atomic delete 뒤로 이동)
  - 상세: 이제 `affected===0` 이면 `NotFoundException` 을 던지고 함수가 리턴하므로 `auditLogsService.record` 는 실행되지 않는다. 이것이 바로 이 PR 의 목적(동시 제거 시 `member.removed` 감사가 두 번 남던 결함 제거)이며 콜백/이벤트 발생 감소는 의도된 부작용이다. 문제 없음.

- **[INFO]** 테스트 mock 시그니처 확장(`delete: jest.Mock`)은 격리돼 있음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 상단 `beforeEach`(`   29|` 타입 필드, `  145|`~`  147|` 기본값 `{affected: 0}`)와 신설 `describe('removeMember — 동시 제거')` 자체 `beforeEach`(`  1478|`~`  1481|`)
  - 상세: 최상위 `beforeEach` 가 매 테스트마다 `TestingModule` 을 새로 만들어 `memberRepo` 를 재발급하므로(라인 65~111), 새 describe 블록의 `wireFindOne`/`memberRepo.delete.mockResolvedValue(...)` 설정이 다른 테스트로 새는 경로가 없다. 기존 테스트(`:1292` 부근)에 `memberRepo.delete.mockResolvedValue({ affected: 1 })` 를 명시적으로 추가한 것도, 상단 기본값이 `{affected: 0}`(공유 mock 관례)이기 때문에 필요한 최소 변경이며 다른 테스트의 기본값을 바꾸지 않는다. 부작용 없음.

## 요약

프로덕션 코드 변경은 `WorkspacesService.removeMember()` 내부에서 `memberRepository.remove(member)` 를 원자적 `memberRepository.delete({id, workspaceId})` + `affected===0` 판정으로 교체한 것이 전부이며, 함수 시그니처·리턴 타입·호출 순서(findOne → 자가탈퇴 위임 → owner 가드 → assertAdmin → 삭제 → 감사)는 그대로 유지된다. 유일하게 실질적인 "부작용"은 동시 요청의 패자가 이제 `404`(감사 없음)를 받는다는 관측 가능한 API 동작 변화인데, 이는 형제 PR 5건과 동일 패턴이며 이미 `--impl-prep` consistency-check 에서 idempotency 표 충돌로 추적 중이다. owner 승격 TOCTOU 창은 이 diff 이전부터 있던 것으로 폭이 변하지 않았고 plan 이 실측·유예를 명시했다. 전역 상태·환경 변수·파일시스템·네트워크·공개 시그니처에 대한 의도치 않은 영향은 발견되지 않았다. 리뷰 중 저장소에 어떤 파일도 수정하지 않았다(Read/Grep/Bash 만 사용, `git status --short` 확인 결과 사전 상태와 동일).

## 위험도

LOW
