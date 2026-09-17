# 테스트(Testing) 리뷰 — 트리거 삭제 자원 정리 (DRT-2, 3라운드)

검증을 위해 저장소 파일을 수정하지 않았다(읽기 전용 `Read`/`Grep`/`Bash`만 사용). `git status --short`
확인 결과 잔여 변경 없음.

## 총평

이번 라운드의 실질 diff 는 2라운드(`review/code/2026/09/17/19_14_29`) 대비 `d2184dcf2`(부모 삭제
트랜잭션 잠금 대기 5초 상한) 한 커밋뿐이고, 나머지는 두 건의 `docs(review)` 커밋이다. `d2184dcf2` 가
처리한 두 항목을 코드·테스트 양쪽으로 대조했다.

- **W2(부모 행 잠금에 `lock_timeout` 없음)** — `trigger-resource-releaser.service.ts`
  `lockParentAndListTriggerIds`(72-95행)가 `setLocalLockTimeout(manager, TRIGGER_DELETE_LOCK_TIMEOUT_MS)`
  를 잠그기 **전** 첫 호출로 두도록 바뀌었고, `trigger-resource-releaser.service.spec.ts`
  "워크플로 — 부모 행을 pessimistic_write 로 잠근 **뒤** 트리거를 연다"(264-287행)·
  "워크스페이스 — 워크스페이스 행을 잠그고 workspaceId 로 연다"(289-305행) 두 케이스 모두
  `events` 배열에서 `"query:SET LOCAL lock_timeout = '5000ms'"` 가 `lock:*` 보다 먼저 옴을
  단언한다 — **워크플로·워크스페이스 두 분기 모두** 순서가 관측 가능한 형태로 고정됐다.
  `workspaces.service.spec.ts` 의 "owner — 외부 해제 → (열거·잠금 → 잠금 재검사 → 삭제) → 커밋 뒤
  비밀 순서다"(641-667행)도 `lockAndList` 가 `check:locked`(재검사) 보다 먼저 오는 것으로 갱신돼,
  실제 호출부의 재배치(열거를 재검사 **앞**으로)와 일치한다.
- **INFO4(다중 실패 메시지 조합 미검증)** — `trigger-resource-releaser.service.spec.ts` "실패가
  여럿이면 전부를 한 메시지에 담는다"(178-193행)가 새로 추가돼 `removeJobFailsFor: ['sched-1',
  'sched-2']` 로 `join('; ')` 구분자·순서를 직접 행사한다. 2라운드 testing 리뷰가 지적한 정확히
  그 갭이 닫혔다.

뮤턴트 M21(상한 제거)·M22(열거를 재검사 뒤로)에 대해 plan 이 "예측 RED · 실측 RED" 를 명시했고
(`plan/in-progress/trigger-deletion-release.md:159`), 위 두 테스트가 그 뮤턴트를 잡는 자리와
정확히 대응한다 — 상한 SQL 문자열을 지우면 순서 배열의 첫 항목이 사라져 RED, 열거를 재검사 뒤로
옮기면 `lockAndList`/`check:locked` 순서가 뒤집혀 RED 가 되는 구조다.

1·2라운드에서 이미 처리된 항목(binder 자기 스펙 위치·혼합 트리거 타입·워크스페이스 이중 검사 역할
변경 경쟁)은 재확인만 하고 새로 지적하지 않는다 — 코드·테스트 상태가 각 RESOLUTION 이 기록한 그대로다.

## 발견사항

- **[INFO]** 워크플로·워크스페이스 삭제 wiring 레벨에는 "부모 밑 트리거가 0개" 케이스의 직접 테스트가 없다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:268,288`
    (`releaseExternalForParent`/`releaseSecretsAfterCommit` 호출부),
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:513,548`(동일)
  - 상세: `workflows.service.spec.ts`/`workspaces.service.spec.ts` 의 mock
    `lockParentAndListTriggerIds` 는 항상 비어 있지 않은 배열(`['trig-a','trig-b']`,
    `['trig-x']`)을 돌려준다. 빈 배열(트리거 없는 워크플로/워크스페이스 삭제)로
    `releaseSecretsAfterCommit([], caller)` 를 부르는 경로는 이 두 spec 파일에서 직접 행사되지
    않는다. 다만 그 함수 자체의 no-op 계약은 `trigger-resource-release.spec.ts` "빈 목록이면
    아무것도 부르지 않는다"(646-652행)가 격리 단위로 이미 덮고 있고, wiring 쪽은 인자를 그대로
    전달하는 한 줄이라 실질 위험은 낮다.
  - 제안: 필수는 아님. `lockAndList` mock 이 `[]` 를 돌려주는 케이스 하나를 추가하면 "빈 배열도
    그대로 전달된다" 는 wiring 자체의 계약까지 봉인된다.

- **[INFO]** `deleteWorkspace()` 의 `WORKSPACE_NOT_FOUND` 분기가 `describe('deleteWorkspace')` 안에
  전용 테스트가 없다 (이 PR 이전부터 있던 갭 — 새로 생긴 것은 아니다)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:564-613`
    (`assertWorkspaceDeletable`)
  - 상세: `main` 의 `workspaces.service.spec.ts` 에도 `deleteWorkspace` 용 NOT_FOUND 케이스가 없었다
    (`transferOwnership` 용은 있다, 623행대). 이번 PR 은 그 판정 로직을 `assertWorkspaceDeletable`
    이라는 **공유 private 메서드**로 뽑아 잠금 없이/있이 두 번 부르는 구조로 바꿨는데, 공유 코드가
    된 만큼 "워크스페이스가 없다" 분기 하나를 새로 봉인해 두면 앞으로 이 메서드를 고칠 때 두 호출
    지점 중 하나만 깨지는 것을 더 싸게 잡을 수 있다. 이번 diff 의 스코프 밖(회귀 아님)이라 차단
    사유는 아니다.
  - 제안: 필수는 아님. `memberRepo.findOne` 은 owner 를 돌려주고 `workspaceRepo.findOne` 만 `null`
    을 돌려주는 케이스 하나를 `deleteWorkspace` describe 에 추가.

## 확인한 항목 (문제 없음 — 근거만 기록)

- **회귀 테스트 유효성** — `d2184dcf2` 가 바꾼 `workspaces.service.spec.ts` 의 순서 배열이 실제 호출
  순서 변경(열거를 재검사 앞으로)과 정확히 일치하도록 갱신됐다. 옛 순서(`check:locked` →
  `lockAndList`)를 그대로 뒀다면 이 테스트 자체가 새 코드에 대해 RED 였을 것이므로, 테스트가 새
  구현을 실제로 행사하고 있음을 구조적으로 보증한다.
- **`setLocalLockTimeout` 추출이 기존 `acquireTriggerConfigLock` 커버리지를 깨지 않는다** —
  `trigger-config-lock.spec.ts` 의 `toLockTimeoutMs` 경계값 테스트(NaN·Infinity·clamp 상하한)는
  에러 메시지 문자열(`'유한한 수'`)로 단언해 함수 이름이 `acquireTriggerConfigLock:` →
  `setLocalLockTimeout:` 으로 바뀐 것과 무관하게 계속 유효하다 — 직접 실행해 확인.
- **테스트 격리** — `trigger-resource-releaser.service.spec.ts` 의 `make()` 헬퍼가 매 테스트 새
  mock/서비스 인스턴스를 만들고, `workspaces.service.spec.ts` 는 `beforeEach` 에서
  `deleteEvents.length = 0` + `triggerReleaser` 개별 mock 만 `mockClear()` 한다 — 이번 라운드
  변경으로 새로 깨진 공유 상태는 없다.
- **Mock 형태 충실도** — `lockParentAndListTriggerIds` 단위 테스트의 `manager` mock 은 `query`·
  `findOne`·`find` 를 모두 갖추고 `findOne` 의 두 번째 인자(`options.lock?.mode`)까지 그대로
  받아 이벤트 문자열에 반영한다 — `setLocalLockTimeout` 이 `query` 를 부르고 그 다음 `findOne` 이
  오는 실제 순서를 mock 레벨에서도 위조 없이 관측 가능하게 짜여 있다.

## 요약

이번 라운드의 유일한 코드 변경(`d2184dcf2`, 부모 삭제 트랜잭션 잠금 대기 5초 상한)은 워크플로·
워크스페이스 두 분기 모두 순서 단언이 있는 기존 테스트에 자연스럽게 통합됐고, 뮤턴트(M21·M22)
예측·실측 RED 가 plan 에 기록돼 있으며 실행해 확인한 결과 테스트가 실제로 그 순서를 행사한다.
2라운드 testing 리뷰가 지적한 다중 실패 메시지 조합 갭도 이번 커밋에서 정확히 그 케이스로
닫혔다. 새로 발견한 것은 통합 경로로 이미 실질적으로 커버되는 아주 좁은 INFO 2건(빈 트리거
배열의 wiring 레벨 직접 테스트 부재, `deleteWorkspace` 의 pre-existing NOT_FOUND 케이스 미봉인)
뿐이며 둘 다 차단 사유가 아니다.

## 위험도

LOW
