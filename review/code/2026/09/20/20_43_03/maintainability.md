# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `RESOURCE_NOT_FOUND` / `'Workflow not found'` 객체 리터럴이 같은 파일 안에서 두 번째로 중복됐다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:172`(`findById`, 기존) / `:282`(`remove` 신규 `absent` 분기)
  - 상세: 두 자리 모두 `{ code: 'RESOURCE_NOT_FOUND', message: 'Workflow not found' }` 를 그대로 복사해 쓴다. 지금은 두 곳뿐이라 위험이 낮지만, 이 저장소가 이미 "복사된 리터럴 한 곳만 갱신" 드리프트를 반복해 겪었다는 점을 감안하면, 다음에 메시지 문구를 바꿀 사람이 한 자리만 고칠 여지가 있다. 이 지적은 직전 라운드(`review/code/2026/09/20/20_06_26/architecture.md` INFO#1)에서 이미 나왔고 이번 커밋(`e175489fe` 등)에서 손대지 않았다 — 의도적으로 비차단·후속으로 남겨둔 것으로 보인다.
  - 제안: `private workflowNotFound(): never { throw new NotFoundException({...}); }` 류 헬퍼로 묶으면 이후 두 자리를 따로 추적할 필요가 없다. 급하지 않음(WARNING 아님).

- **[INFO]** `WorkflowsService.remove()` 와 `WorkspacesService.deleteWorkspace()` 의 "잠금 → 헬퍼 호출 → `absent` 검사 → 트랜잭션 `.catch`(NotFoundException 은 조용히 재던지고 그 외엔 error 로그)→ 커밋 뒤 비밀 정리" 4단 구조가 두 파일에 거의 동일한 형태로 반복된다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:263-312`(`remove`) vs `codebase/backend/src/modules/workspaces/workspaces.service.ts:498-567`(`deleteWorkspace`)
  - 상세: 이번 PR 로 두 곳의 `if (locked.parentPresence === 'absent') { throw new NotFoundException(...) }` 분기와 `.catch` 안의 `if (err instanceof NotFoundException) throw err;` 가드가 문구만 다르고 구조가 완전히 같아졌다. 다만 이 중복은 이번 PR 이 새로 만든 것이 아니라 원래도 있던 구조(두 리소스가 각자 다른 repository·감사 액션·에러 코드를 쓴다)이고, `plan/in-progress/dup-delete-audit.md` §"`--impl-prep`이 요구한 것" (W2) 이 이미 "네 자리 공용 형태" 후속 설계 항목으로 트래커에 교차 참조를 남기기로 약속했다.
  - 제안: 조치 불요 — 이미 추적 중. 그 설계가 착수될 때 이번에 새로 생긴 두 `absent` 분기도 같은 공용 형태로 흡수하면 된다.

- **[정정 확인]** 직전 라운드(`review/code/2026/09/20/20_06_26/maintainability.md`)가 지적한 두 항목은 이번 커밋들로 해소됨을 확인했다.
  - WARNING(같은 함수 안 `parent` 식별자가 파라미터/반환 필드에서 다른 의미로 재사용) → `trigger-resource-release.ts:117-129`(`LockedParentTriggers.parentPresence`)로 리네임, 호출부 3곳(`trigger-resource-releaser.service.ts:81-109`, `workflows.service.ts:273-287`, `workspaces.service.ts:522-547`)과 spec 3파일이 동반 수정됨(`e175489fe`). 재발 없음.
  - INFO(워크플로/워크스페이스 삭제 경로의 "정상적 부재" 로그 처리 비대칭) → `workspaces.service.ts:530-535`(재검사 전 `absent` 404 단락) + `:553`(`.catch` 의 `NotFoundException` 조기 재던짐)으로 워크플로 경로(`workflows.service.ts:280-285`, `:293`)와 대칭화됨(`27f488d09`). 새 단위 테스트(`workspaces.service.spec.ts:743-778`)가 뮤테이션으로 판별력까지 확인했다.

## 그 외 점검 결과 (이상 없음)

- **가독성**: 각 함수·분기에 "왜 이렇게 했는가"를 설명하는 주석이 촘촘하다. 새로 추가된 `absent` 분기·`.catch` 가드 모두 그 앞뒤에 이유가 적혀 있어 코드만 봐도 의도가 드러난다.
- **네이밍**: `LockedParentTriggers`, `parentPresence`, `triggerIds` 모두 목적을 정확히 드러내고, `'present' | 'absent'` 판별 유니온은 이 저장소가 반복해 강조해 온 "truthiness 로 부재를 오판하지 말 것" 원칙과 일치한다.
- **함수 길이/중첩 깊이**: `remove()`(50줄), `deleteWorkspace()`(70줄), `lockParentAndListTriggerIds()`(29줄) 모두 단일 책임 범위 안에 있고, 신규 분기 추가로도 중첩은 최대 2단(트랜잭션 콜백 안 `if`)을 넘지 않는다.
- **매직 넘버**: e2e 테스트의 `60_000`(jest 타임아웃)·`1_500`(공허성 가드 폴링)은 같은 디렉터리의 다른 e2e 스펙(`execution-concurrency-cap.e2e-spec.ts` 등)과 동일한 관례값이라 새로운 매직 넘버가 아니다.
- **일관성**: 신규 e2e(`workflow-delete-concurrency.e2e-spec.ts`)의 "테스트가 직접 행 락을 쥐고 공허성 가드로 겹침을 확인" 기법은 plan 이 명시한 선례(`rotate-lost-update.md`, `trigger-config-lost-update.md` §C)와 동일한 패턴을 재사용한다.
- 저장소 파일은 Read 만 수행했고 수정하지 않았다 — 원복 불필요.

## 요약

핵심 코드 변경(`LockedParentTriggers` 도입, 워크플로/워크스페이스 두 삭제 경로의 대칭적 404 처리, 결정적 e2e)은 가독성·네이밍·함수 길이·중첩·복잡도 모든 축에서 양호하며, 직전 라운드가 지적한 유일한 실질 WARNING(반환 필드 `parent` 이름 충돌)과 그 INFO(로그 비대칭)는 이번 커밋으로 정확히 해소됐다. 남은 것은 `RESOURCE_NOT_FOUND` 리터럴이 한 파일 안에서 한 곳 더 늘어난 것과, 두 삭제 경로 간 "잠금→검사→로그 억제" 4단 구조 중복 정도이며 둘 다 이미 추적 중이거나 사소해 병합을 막을 사안이 아니다.

## 위험도

LOW
