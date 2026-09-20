# 테스트(Testing) 리뷰 — 동시 중복 DELETE 감사 (dup-delete-audit, 3라운드 fresh 검토)

이 diff 는 이미 두 차례 `/ai-review` 라운드(`review/code/2026/09/20/20_06_26`, `20_43_03`)를 거쳤고,
1라운드 WARNING(`.catch` 의 거짓 error 로그 억제 미검증)·2라운드 WARNING(워크스페이스 403→404 수정이
단위 mock 으로만 닫혀 실제 CASCADE 를 재현 못함)이 모두 코드로 조치되어 이번 diff 에 포함돼 있다.
본 리뷰는 그 결과물을 처음부터 독립적으로 재검증한 결과다. 저장소 파일은 `Read`/`grep` 으로만
조사했고 뮤테이션·수정은 하지 않았다(`git status --short` 확인 결과 워크트리 변경 없음).

## 발견사항

- **[INFO]** `TriggerResourceReleaserService.lockParentAndListTriggerIds` 의 "부모 부재"(`absent`) 판정이
  `workspaceId` 변형에서는 여전히 직접 테스트되지 않는다 (1라운드 `20_06_26/testing.md` INFO 에서 이미
  식별됐고 비차단으로 처리된 항목 — 새 발견 아니라 캐리오버 확인)
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts` `describe('lockParentAndListTriggerIds', ...)` 블록 — `absent`/"present+0행" 테스트 두 개가 모두 `{ workflowId: ... }` 파라미터만 쓴다(`잠글 부모 행이 없으면 parent: absent 로 돌려준다` 테스트, `부모가 있고 트리거가 0개인 경우는 present 다` 테스트). `workspaceId` 변형은 present+정상 케이스(`워크스페이스 — 워크스페이스 행을 잠그고 workspaceId 로 연다`)만 있고 `absent` 조합이 없다.
  - 상세: 구현(`trigger-resource-releaser.service.ts` `lockParentAndListTriggerIds`)은 `workflowId`/`workspaceId` 두 분기가 `parentRow ? 'present' : 'absent'` 판정 한 줄을 공유하므로 실질 위험은 낮지만, 두 분기가 갈라지는 방향으로 리팩터될 경우(예: 워크스페이스만 다른 예외 정책이 붙을 때) 이 갭이 회귀를 늦게 잡는다.
  - 제안: `it.each`로 `{ workflowId }`/`{ workspaceId }` 두 파라미터에 대해 present/absent 조합을 표로 묶으면 향후 분기 갈림을 더 빨리 잡는다. 급하지 않음(3라운드 연속 INFO, 코드 리스크 낮음).

- **[INFO]** 워크플로/워크스페이스 신규 404 유닛 테스트의 예외 단언 스타일이 같은 파일의 기존 관례와 다르다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` `it('remove — 잠금 뒤 부모가 사라졌으면 404 이고 감사·비밀 정리를 남기지 않는다', ...)` 안 `.rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } })` — 대조: 같은 파일의 `it('should throw NotFoundException if not found', ...)` 는 `.rejects.toThrow(NotFoundException)` 만 쓴다.
  - 상세: 결함은 아니다 — 오히려 `code` 값까지 정확히 단언하는 새 방식이 "상태만 보면 값이 바뀌어도 통과한다"는 이 저장소의 기존 교훈(e2e `workspace-delete-concurrency.e2e-spec.ts` 도 `results[1].code` 를 별도로 단언)과 더 부합한다. 다만 한 파일 안에 두 관례가 섞여 있어, 다음 사람이 어느 쪽을 따라야 할지 헷갈릴 수 있다.
  - 제안: 조치 불필요. 후속 정리 시 기존 `.rejects.toThrow(NotFoundException)` 자리도 `code` 단언을 겸하도록 통일하면 더 좋다는 정도의 참고.

## 검증한 항목 (결함 아님 — 확인 근거)

- **테스트 격리**: `workflows.service.spec.ts`(`removeEvents.length = 0`)와 `workspaces.service.spec.ts`(`deleteEvents.length = 0` + `Object.values(triggerReleaser).forEach(fn => fn.mockClear())`)가 모두 `beforeEach` 안에서 공유 이벤트 배열/mock 호출 이력을 리셋한다 — 신규 테스트가 이전 테스트의 잔여 상태에 기대지 않는다.
- **Mock 적절성 — 트랜잭션 콜백**: `mockRepository.manager.transaction`(workflows) 은 콜백이 던지면 `tx:commit` 이벤트를 남기지 않고 그대로 전파해, 실제 TypeORM `transaction()` 이 예외 시 자동 ROLLBACK 하는 동작과 일치한다. `NotFoundException` 을 트랜잭션 콜백 안에서 던지는 신규 분기는 이 mock 으로도 "감사·비밀 정리 미실행"이 정확히 검증된다.
- **Mock 한계와 그 보완**: `workspaces.service.spec.ts` 신규 테스트(`잠금 뒤 워크스페이스가 사라졌으면(동시 삭제) 404...`)는 `lockParentAndListTriggerIds` 에 `parentPresence: 'absent'` 를 **직접 주입**하므로 "이긴 쪽이 CASCADE 로 멤버 행까지 지운다"는 실제 DB 동작을 재현하지 못한다 — 이 비대칭은 2라운드에서 정확히 지적됐고(`20_43_03` WARNING 1), `codebase/backend/test/workspace-delete-concurrency.e2e-spec.ts` 신설로 실제 PostgreSQL 락(`SELECT ... FOR UPDATE`)을 이용해 닫혔다. RESOLUTION 기록상 수정 전 코드로 되돌린 e2e 재현이 실제로 `403`(`Received [200, 403]`)을 냈고 고친 뒤 `[200, 404]`+`WORKSPACE_NOT_FOUND` 로 통과했다는 판별력 실측이 남아 있어 신뢰할 만하다.
- **엣지 케이스 — "부재" vs "0개" 구분**: `trigger-resource-releaser.service.spec.ts` 의 두 신규 테스트(`잠글 부모 행이 없으면 parent: absent...`, `부모가 있고 트리거가 0개인 경우는 present 다...`)가 `managerWithEvents([], null)` vs `managerWithEvents([])`(기본 `parentRow = { id: 'parent-1' }`)로 정확히 이 두 경우를 가른다 — 빈 배열로 부재를 신호했다면 두 케이스가 같은 값이 됐을 것이라는 주석의 주장이 fixture 로 실증된다.
- **회귀 테스트**: `lockParentAndListTriggerIds` 반환 타입 변경(`Promise<string[]>` → `Promise<LockedParentTriggers>`)의 호출부(`workflows.service.ts`, `workspaces.service.ts`)와 테스트(두 `.spec.ts` 파일 모두)가 `grep -rl` 기준 예외 없이 전부 동반 갱신되어 있다 — 옛 배열 반환을 가정하는 잔존 호출부/단언 없음.
- **네이밍 일관성**: 1라운드 WARNING 2 가 지적한 `parent` → `parentPresence` 리네임이 소스·테스트·`plan/in-progress/dup-delete-audit.md` 전체에서 일관되게 반영돼 있다(`grep` 으로 옛 필드명 `parent:` 잔존 없음 확인).
- **e2e 결정성**: 신규 `workflow-delete-concurrency.e2e-spec.ts`/`workspace-delete-concurrency.e2e-spec.ts` 는 별도 커넥션이 대상 행을 `SELECT ... FOR UPDATE` 로 실제로 쥐어 겹침을 강제하고, 락 해제 전 `Promise.race` 로 "아직 안 끝남"을 확인하는 공허성 가드까지 포함한다 — 우연한 타이밍에 기대지 않는다. `try/finally` 가 assertion 실패 경로에서도 `ROLLBACK`+`pending` 드레인을 수행해 커넥션·트랜잭션 누수가 없다.

## 요약

핵심 변경(`LockedParentTriggers` 도입, 워크플로/워크스페이스 양쪽의 `parentPresence === 'absent'` 404 단락, 그 위에 `.catch` 의 거짓 error 로그 억제)은 단위 테스트로 각 분기가 명시적으로 갈라져 있고, 특히 mock 만으로는 재현되지 않는 워크스페이스 CASCADE 시나리오는 실제 PostgreSQL 락을 쓰는 결정적 e2e 로 보완되어 신뢰도가 높다. 1·2라운드에서 뮤테이션(가드 삭제 → 관련 단언 RED)으로 판별력까지 실측한 기록이 RESOLUTION.md 에 남아 있어 "테스트가 실제로 그 결함을 가른다"는 주장이 근거를 갖췄다. 이번 독립 재검토에서 새로 발견한 결함은 없다 — 남는 갭은 `workspaceId` 변형의 `absent` 단위 테스트 부재 하나(공유 로직이라 위험 낮음, 3라운드 연속 INFO)뿐이며 차단 사유가 아니다.

## 위험도

NONE
