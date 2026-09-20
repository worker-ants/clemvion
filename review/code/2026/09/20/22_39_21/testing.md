# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 락 안 재조회의 `workspaceId` 스코프가 어떤 단위 테스트로도 검증되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1090-1094`(신규 재조회 `where: { id, workspaceId }`, 특히 1092행) vs `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3811-3815`(`freshFindOne: () => {...}` — 인자 자체를 받지 않는다)
  - 상세: 이번 PR 이 새로 추가한 락 안 재조회(`m.findOne(Trigger, { select: { id: true }, where: { id, workspaceId } })`)는 `id` 뿐 아니라 `workspaceId` 로도 스코프를 좁혀야 한다 — 이번 라운드 `api_contract` 리뷰(INFO)가 "재조회도 원 조회와 동일한 workspaceId 스코프를 유지해 authz 누수 없음"이라고 적었지만, 그 근거는 **소스를 읽은 것**이지 테스트로 고정된 것이 아니다. `makeService()`(`triggers.service.spec.ts:3766`)의 `freshFindOne` 콜백은 `(options)` 인자를 아예 선언하지 않아 어떤 `where` 절이 넘어왔는지 볼 수 없고, 신규 테스트 두 건(`triggers.service.spec.ts:4030`, `:4125`)도 `m.findOne` 호출 인자를 단언하지 않는다. 신규 e2e(`codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts`)도 단일 workspace 안에서만 두 DELETE 를 겹치므로 이 스코프를 실측하지 못한다(`X-Workspace-Id` 가 35·53·69·84행에서 항상 같은 값). 결과적으로 `where: { id, workspaceId }` 에서 `workspaceId` 를 빠뜨리는 회귀(다른 workspace 의 트리거 id 존재 여부를 "락 재조회 통과/404" 로 노출하는 authz 누수)가 나도 이 스위트 전체가 GREEN 으로 남는다.
  - 제안: `makeService` 의 `freshFindOne` 시그니처에 `(findOptions) => ...` 를 받게 하고, 새 테스트(또는 별도 케이스)에서 `m.findOne` 이 `where: { id, workspaceId }` 로 불렸는지(`toHaveBeenCalledWith` 또는 캡처한 `findOptions` 단언)를 확인하거나, e2e 에 "다른 workspace 의 트리거 id 로 DELETE → 404, 재조회가 그 workspace 를 넘지 않는다" 케이스를 추가.

- **[INFO]** 신규 404-분기 단위 테스트가 `releaseExternal`(외부 teardown)이 여전히 실행됐는지는 단언하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4030-4054`
  - 상세: 이 테스트는 `repo.remove`·`audit.record`·`deleteByPrefix`·`logger.error` 미호출은 확인하지만 `events` 에 `'teardown'` 이 있는지는 보지 않는다. 이 자체는 새 결함이 아니다 — 외부 teardown 이 두 요청 모두에서 실행되는 것은 지난 라운드(`review/code/2026/09/20/22_07_23` side_effect WARNING 1)가 이미 알고 있는 의도된 잔여이고 이번 PR 범위 밖으로 문서화돼 있다. 다만 "패자 쪽도 teardown 은 그대로 실행된다"는 사실 자체를 이 테스트가 양성으로 고정해 두면, 다음 사람이 그 잔여를 다시 조사할 때 재현 비용이 준다.
  - 제안: 선택 사항 — `expect(events).toContain('teardown')` 한 줄 추가로 "이 경로가 teardown 을 스킵하지 않는다"를 명시적 회귀 가드로 만들 수 있음.

## 요약

핵심 로직(락 안 재조회 → `!fresh` 시 404, `.catch` 에서 `NotFoundException` 과 genuine 실패 분리)은 두 개의 새 단위 테스트로 각각 독립적인 뮤턴트를 죽이도록 잘 설계돼 있고, `RESOLUTION.md`·plan 이 무효 뮤턴트(앵커 문자열 충돌로 440줄·116건 실패) 발견과 재측정 과정을 정직하게 기록해 뮤테이션 판별력 신뢰도가 높다. e2e(`trigger-delete-concurrency.e2e-spec.ts`)도 형제 워크플로/워크스페이스 스펙과 같은 검증된 기법(advisory lock 을 테스트가 직접 쥐고 공허성 가드로 "진짜 겹침"을 확인)을 그대로 재사용해 타이밍 결함 위험이 낮다. `withTransactionMock` 의 `m.findOne` 위임 구조 덕분에 기존 `remove()` 회귀 테스트들(라인 1846·2448·2948·4278 등)은 새로 추가된 재조회 호출에도 영향받지 않고 그대로 유효하다. 유일하게 실질적인 갭은 이번에 새로 도입된 인가-민감 재조회(`where: { id, workspaceId }`)의 workspace 스코프가 어떤 테스트로도 고정돼 있지 않다는 점 — 지금은 소스 코드 읽기로만 "안전하다"고 결론 내려진 상태라, 향후 회귀에 대한 방어선이 비어 있다.

## 위험도

LOW
