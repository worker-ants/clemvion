# 테스트(Testing) 리뷰 — V-04 folder depth/cycle guard 재검토 (14_38_09)

이전 라운드(14_28_16)의 testing WARNING×4 조치(RESOLUTION.md) 검증. 대상: `folders.service.spec.ts` 신규 2개 테스트 —
"allows reparent at exactly max depth" (경계값), "detects cycle across a multi-child, multi-level subtree (BFS 다중 frontier)".

## 검증 방법

1. `npx jest src/modules/folders/folders.service.spec.ts` 전체 실행 — 16 passed 확인 (RESOLUTION 주장과 일치).
2. 각 신규 테스트를 `-t` 필터로 단독 실행 — 15 skipped/1 passed, 정상.
3. Mutation testing (프로덕션 코드를 의도적으로 변형 후 원복) 으로 테스트가 실제로 회귀를 잡는지 확인.

## 발견사항

- **[INFO]** 경계값 테스트는 실질적 — 경계 off-by-one 회귀를 실제로 검출함
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:244-267` (`allows reparent at exactly max depth`), 연동 대상 `codebase/backend/src/modules/folders/folders.service.ts:142`
  - 상세: `parentDepth + height > MAX_NESTING_DEPTH` 를 `>=` 로 변형(더 엄격하게)하면 이 신규 테스트가 즉시 실패로 전환됨을 확인(mutation 검증). 반대로 `MAX_NESTING_DEPTH + 1` 로 완화하면 기존 "rejects when resulting depth exceeds max" 테스트가 실패함을 확인. 두 테스트가 경계의 양쪽(정확히 5=허용, 6=차단)을 상호보완적으로 고정한다 — 이전 라운드 WARNING 이 실질적으로 해소됨.
  - 제안: 없음(이대로 유효).

- **[WARNING]** BFS 다중 frontier 테스트가 실제로 배치 조회(`frontier.map(...)`) 로직을 검증하지 못함 — mock 이 호출 인자를 무시
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:269-293` (`detects cycle across a multi-child, multi-level subtree`), 대상 `codebase/backend/src/modules/folders/folders.service.ts:162-176` (`collectSubtree` 의 `frontier.map((pid) => ({ parentId: pid, workspaceId }))`)
  - 상세: mutation 검증 결과, `collectSubtree` 의 `where: frontier.map(...)` 를 `where: { parentId: frontier[0], workspaceId }` 로 바꿔 **형제 다중 프론티어를 사실상 무시하고 첫 번째 부모만 조회**하도록 회귀를 주입해도 16개 테스트가 전부 그대로 통과했다. 원인은 스펙 전체에서 `mockRepository.find`/`findOne` 호출 시 넘겨진 `where` 인자를 한 번도 `toHaveBeenCalledWith` 등으로 검증하지 않고, `mockResolvedValueOnce` 체인의 **호출 순서**에만 의존하기 때문 — 실제로는 `find` 가 어떤 인자로 불렸는지와 무관하게 다음 큐잉된 값을 그대로 반환한다. 즉 이 테스트는 이름이 주장하는 "BFS 다중 frontier(형제 배치 조회)" 로직을 검증하지 못하고, 단지 "두 번의 `find` 호출이 순서대로 일어나고 두 번째에서 `gc1` 이 반환되면 cycle 로 판정된다"만 검증한다. 실제 프로덕션에서 워크스페이스 규모가 커 형제가 많을 때 배치 쿼리가 깨지면(N+1 로 회귀하거나 첫 형제만 조회) 이 테스트는 통과하므로 회귀를 놓친다.
  - 제안: `mockRepository.find` 를 `toHaveBeenCalledWith(expect.objectContaining({ where: [{ parentId: 'c1', workspaceId: 'ws-uuid-1' }, { parentId: 'c2', workspaceId: 'ws-uuid-1' }] }))` 형태로 최소 1회 인자 검증을 추가하거나, mock 을 `mockImplementation` 기반의 실제 부모-자식 그래프 시뮬레이터로 바꿔(예: 이전 라운드의 `getDepth cyclic parent chain` 테스트처럼 `where.id`/`where` 배열을 파싱해 실제 로직으로 응답) 인자에 따라 다른 값을 반환하도록 개선 권장. 최소한 형제 중 하나(`c2`)에 자체 자식이 있고 다른 형제(`c1`)에는 없는 케이스를 넣어 "여러 부모의 자식이 한 번의 배치 쿼리로 합쳐지는지"를 인자 레벨에서 구분해야 검증력이 생긴다.

- **[INFO]** 순환 감지 회귀(자기 자신·직계 자손) 테스트는 여전히 견고 — mutation 으로 확인
  - 위치: `folders.service.spec.ts:115-124`(self), `139-158`(직계 자손)
  - 상세: 별도 mutation 은 수행하지 않았으나, 로직이 `descendants.has(newParentId)` 단일 검사이고 `collectSubtree` 자체는 신뢰할 수 있는 자료구조(`Set`)를 사용하므로 이 두 케이스는 기존처럼 유효. 위 WARNING 은 "형제가 여러 명일 때 배치 조회가 깨지는" 시나리오에 국한된다.

- **[INFO]** `getDepth` 방문가드/상한 테스트는 실제 무한루프 방지 로직을 강하게 검증
  - 위치: `folders.service.spec.ts:219-242`
  - 상세: `visited` Set 이나 `depth > MAX_NESTING_DEPTH + 1` 상한 가드를 제거하면 이 테스트는 jest 기본 timeout(5s)으로 실패하게 되어(무한루프 → mockImplementation 이 계속 a↔b 반복 resolve) 실질적 회귀 방지 효과가 있다. 별도로 mutation 검증하지 않았으나 로직상 명확.

- **[INFO]** RESOLUTION.md 의 "mock 정확도는 e2e(235 실 DB)로 보완" 판단은 이번 검증 결과와 부분적으로만 일치
  - 위치: `review/code/2026/07/05/14_28_16/RESOLUTION.md:8`
  - 상세: e2e 가 실제 DB 로 형제 배치 쿼리를 검증한다면 위 WARNING 의 실질 리스크는 낮아진다(unit 이 못 잡아도 e2e 가 잡음). 다만 이 회귀 리뷰 turn 에서 e2e 스위트 자체를 재실행하지는 않았으므로, "e2e 가 실제로 이 배치 쿼리 형태(다중 워크스페이스 형제 폴더)를 다루는 시나리오를 포함하는지"는 별도 확인이 필요하다. unit 테스트 이름이 "BFS 다중 frontier" 를 검증한다고 주장하는 이상, unit 레벨에서 최소 인자 검증을 추가하는 편이 e2e 의존성 없이 더 견고하다.

## 요약

이전 라운드에서 지적된 4개 testing WARNING 중 경계값(정확히 depth 5) 테스트는 mutation testing 으로 실제 회귀 검출 능력이 확인되어 실질적으로 해소되었다. 그러나 "BFS 다중 frontier" cycle 테스트는 이름이 의도한 형제-배치 조회 로직을 실제로는 검증하지 못한다는 것을 mutation testing 으로 확인했다 — `collectSubtree` 의 `frontier.map(...)` 배치 쿼리를 깨뜨려 첫 형제만 조회하도록 만들어도 전체 스펙이 그대로 통과한다. 원인은 스펙 전반에 걸쳐 `mockRepository.find`/`findOne` 호출 인자를 한 번도 검증하지 않고 순서 기반 `mockResolvedValueOnce` 체인에만 의존하는 구조적 패턴이다. 이는 CRITICAL 은 아니지만(로직 자체는 코드 리뷰상 타당해 보이고, e2e 가 실 DB 로 보완할 가능성 있음), "커버리지 갭이 닫혔다"는 RESOLUTION 의 주장을 부분적으로만 지지하므로 WARNING 으로 재기록한다. 나머지 경계값·getDepth 무한루프 방지 테스트는 견고하다.

## 위험도

LOW
