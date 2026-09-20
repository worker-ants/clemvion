# 유지보수성(Maintainability) 리뷰 — dup-delete-audit (21_07_19)

## 검증 방법

이번 라운드는 3라운드째 누적 diff(`origin/main...HEAD`, 51개 파일)를 대상으로 한다. 그중 실제 소스는
`codebase/backend/src/modules/{triggers,workflows,workspaces}/*.ts` 6개 + 신규 e2e 2개(`workflow-`,
`workspace-delete-concurrency.e2e-spec.ts`)이고, 나머지는 `plan/`·`review/code/20_06_26`·
`review/code/20_43_03`·`review/consistency/19_30_57` 산출물(직전 두 라운드의 리뷰 결과물 자체)이다.
직전 두 라운드(`20_06_26`, `20_43_03`)가 이미 같은 소스를 유지보수성 관점에서 검토했으므로, 이번
라운드는 (1) 지적된 WARNING 이 실제로 해소됐는지 코드 레벨로 재확인, (2) 두 라운드 사이에 새로
추가된 파일(워크스페이스 e2e)을 신규 검토하는 데 집중했다. 저장소 파일은 `Read`/`grep`/`git show`
만 사용했고 수정하지 않았다 — `git status --short` 로 뮤테이션 없음 확인, 원복 불필요.

## 발견사항

- **[INFO]** 신규 `workspace-delete-concurrency.e2e-spec.ts` 가 기존 `workflow-delete-concurrency.e2e-spec.ts`
  와 거의 동일한 "락 직접 보유 + 공허성 가드 + Promise.race" 보일러플레이트를 세 번째로 반복한다.
  - 위치: `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts` 전체(특히 `beforeAll`/`afterAll`
    커넥션 설정, `fireDelete` 클로저, `Promise.race` 공허성 가드 블록) — `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`
    의 대응 블록과 구조가 거의 1:1로 겹친다. `grep -rl "Promise.race" codebase/backend/test/*.e2e-spec.ts`
    확인 결과 `integration-rotate-concurrency.e2e-spec.ts`(선례)까지 포함해 이 패턴이 이미 **세 번째
    파일**에서 손으로 복붙되고 있다.
  - 상세: 두 신규 파일은 이번 PR 안에서 함께 추가됐고, 커넥션 열고/닫기(`createDbClient`+`connect`/`end`),
    "아직 안 끝났음" 공허성 가드(`Promise.race` + `setTimeout(1_500)`), `finally` 의 `ROLLBACK`+`pending`
    드레인까지 거의 동일한 코드가 파일 두 개에 나란히 존재한다. 지금은 두 파일이 각자 다른 엔드포인트·
    응답 스키마·DB 검증 쿼리를 갖고 있어 즉시 위험한 drift 는 아니지만, "동시 락 경합 e2e" 라는 같은
    기법이 세 번째로 손 복붙되는 시점이라 규칙-of-3 관점에서 공용 헬퍼(`test/helpers/`)로 추출할 만한
    임계점을 넘었다.
  - 제안: `test/helpers/` 에 `raceTwoRequestsUnderRowLock(locker, lockQuery, fire)` 류의 헬퍼를 만들어
    세 파일이 이를 공유하면, 향후 네 번째 유사 e2e(예: 트리거·스케줄 삭제 동시성)를 추가할 때 같은
    보일러플레이트를 또 손으로 옮기지 않아도 된다. 급하지 않음 — 이번 PR 을 막을 사안은 아니며,
    다음에 이 기법을 쓸 때 함께 정리해도 된다.

- **[정정 확인]** 1라운드(`review/code/2026/09/20/20_06_26/maintainability.md`)가 지적한 WARNING(같은
  함수 안에서 파라미터 `parent: TriggerParent` 와 반환 필드 `parent: 'present'|'absent'` 가 동일 식별자로
  충돌)은 코드 레벨로 재확인한 결과 완전히 해소되어 있다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-release.ts:126`(`LockedParentTriggers.parentPresence`),
    `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:106`(`parentPresence: parentRow ? 'present' : 'absent'`),
    호출부 `codebase/backend/src/modules/workflows/workflows.service.ts:280`, `codebase/backend/src/modules/workspaces/workspaces.service.ts:530`.
  - `grep -n "parentPresence\|parent:"` 로 전수 확인한 결과, 남아 있는 `parent` 식별자는 모두 `TriggerParent`
    타입의 파라미터(`releaseExternalForParent(parent: TriggerParent)`, `lockParentAndListTriggerIds(..., parent: TriggerParent)`)
    뿐이며 반환 필드와의 시각적 충돌은 재발하지 않았다. 재-flag 불필요.

- **[재확인 — 조치 불요, 기존 INFO 유지]** `RESOURCE_NOT_FOUND`/`'Workflow not found'` 리터럴이
  `WorkflowsService` 안에 두 곳(`findById`, `remove()` 신규 `absent` 분기)으로 남아 있고, "잠금→헬퍼
  호출→`absent` 검사→`.catch`(NotFoundException 조기 재던짐)→커밋 뒤 정리" 4단 구조가
  `WorkflowsService.remove()`/`WorkspacesService.deleteWorkspace()` 두 곳에 거의 동일하게 반복된다 —
  두 항목 모두 1·2라운드에서 이미 INFO 로 지적됐고 plan(`plan/in-progress/dup-delete-audit.md`)이
  "네 자리 공용 형태" 후속 설계 트래커로 명시적으로 넘겨 두었다. 이번 라운드에서 상태를 재확인했으며
  변화가 없어 새로 지적하지 않는다.

## 그 외 점검 결과 (이상 없음)

- **가독성/네이밍**: `LockedParentTriggers`·`parentPresence`·`triggerIds` 모두 의도를 정확히 드러내고,
  "부재를 빈 배열로 신호하지 않는다"는 판별 유니온 설계 근거가 JSDoc·인라인 주석에 일관되게 남아 있다.
- **함수 길이/중첩**: `WorkflowsService.remove()`(약 45줄), `WorkspacesService.deleteWorkspace()`(약
  70줄), `lockParentAndListTriggerIds()`(약 29줄) 모두 단일 책임 범위이고, 신규 `absent` 분기 추가 후에도
  최대 중첩은 트랜잭션 콜백 안의 단일 `if` 2단을 넘지 않는다.
- **매직 넘버**: 신규 e2e 두 파일의 `60_000`(jest 타임아웃)·`1_500`(공허성 가드)은 같은 디렉터리의
  `integration-rotate-concurrency.e2e-spec.ts` 와 동일한 값 — 새로 생긴 매직 넘버가 아니라 기존 관례값이다.
- **일관성**: 워크플로/워크스페이스 두 e2e 는 "테스트가 직접 행 락을 쥐고 공허성 가드로 겹침을 강제"하는
  같은 기법을 plan 이 명시한 선례(`rotate-lost-update.md`, `trigger-config-lost-update.md §C`)와 동일하게
  재사용한다 — 기법 자체의 일관성은 양호하다(위 INFO 는 그 기법의 "구현 보일러플레이트 공유" 여부에 대한
  것이지 기법 선택 자체에 대한 것이 아니다).
- `plan/in-progress/dup-delete-audit.md` 의 이번 커밋 변경분(옛 필드명 `parent`→`parentPresence` 정정,
  취소선 처리)은 문서 스니펫 수정일 뿐 코드 변경이 아니며, 코드와의 정합성도 위 grep 결과와 일치한다.

## 요약

핵심 소스 변경(`LockedParentTriggers` 도입, 워크플로/워크스페이스 두 삭제 경로의 대칭적 404 처리)은
가독성·네이밍·함수 길이·중첩·복잡도 전 축에서 양호하며, 1라운드가 지적한 유일한 실질 WARNING(반환
필드 `parent` 이름 충돌)은 `parentPresence` 리네임으로 재발 없이 해소됐음을 코드 레벨로 재확인했다.
이번 라운드에서 새로 늘어난 파일은 `workspace-delete-concurrency.e2e-spec.ts` 하나이며, 기능적으로는
문제없으나 워크플로 짝 e2e 와 거의 동일한 "락 직접 보유+공허성 가드" 보일러플레이트를 세 번째로 손
복붙한 것이어서 공용 헬퍼 추출을 고려할 만한 지점이라는 INFO 를 새로 남긴다. 그 외 이미 추적 중인
INFO(리터럴 중복 2곳, 서비스 4단 구조 중복)는 상태 변화가 없어 재지적하지 않는다. Critical/Warning 급
발견사항은 없다.

## 위험도

LOW
