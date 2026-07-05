# 테스트(Testing) 리뷰 — V-04 folder depth/cycle guard

## 발견사항

- **[INFO]** e2e 테스트 부재 (folders 모듈 전체, pre-existing)
  - 위치: `codebase/backend/src/modules/folders/*`, `codebase/backend/test/*.e2e-spec.ts`
  - 상세: `test/` 디렉터리에 `folder*.e2e-spec.ts` 가 존재하지 않는다. 이번 변경은 `update()` 의 실제 DB 트랜잭션 흐름(TypeORM `findOne`/`find`/`save` 의 실제 쿼리 동작, `(workspace_id, parent_id, name)` UNIQUE 제약과의 상호작용, 실제 Postgres 데이터로 5단계 트리를 구성한 depth/cycle 검증)을 unit mock 만으로 검증하고 있어, mock 이 실제 리포지토리 호출 시그니처와 어긋나는 경우(예: `find` 를 OR 조건 배열로 호출하는 부분, 아래 CRITICAL 참고) 회귀를 잡지 못한다. 이번 PR 자체 스코프에서 필수는 아니나(unit 이 컨트롤러/서비스 계층의 방어 로직을 이미 커버), 실 DB 대상 검증 공백은 기록해 둘 가치가 있다.
  - 제안: `folders.e2e-spec.ts` 를 신설해 실제 Postgres 로 (a) 정상 5단계 생성, (b) update 로 6단계 초과 시도 → 400, (c) update 로 자손 이동 시도 → 400, (d) 타 workspace parentId → 400 을 검증. 이번 PR 필수는 아니지만 후속 backlog 로 남길 것.

- **[WARNING]** `collectSubtree` 의 `find({ where: frontier.map(...) })` mock 이 실제 TypeORM 동작과 정확히 일치하는지 검증되지 않음
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:707-709` (`collectSubtree`), 대응 테스트 `folders.service.spec.ts:257-260`, `284-285`, `317-318`
  - 상세: `folderRepository.find({ where: frontier.map((pid) => ({ parentId: pid, workspaceId })) })` 는 TypeORM 에서 `where` 에 배열을 넘기면 OR 조건으로 해석되는 것에 의존한다. 테스트는 `mockRepository.find` 를 단순 `jest.fn()` 으로 stub 하여 호출 인자(`where` 배열 형태)를 전혀 검증하지 않고 반환값만 고정 시퀀스로 제공한다. 만약 실제 구현에서 `frontier` 가 여러 개인 상황(예: 한 레벨에 형제 폴더가 여러 개 있고 그 자손들을 동시에 수집하는 BFS 확장 상황)에서 `where` 배열 조립이 잘못되어도 이 테스트들은 통과한다 — mock 이 인자 형태와 무관하게 `mockResolvedValueOnce` 순서로만 응답하기 때문. 즉 "실제 동작과의 괴리" 리스크가 있다.
  - 제안: 최소 한 개 테스트에서 `expect(mockRepository.find).toHaveBeenCalledWith({ where: [{ parentId: 'f1', workspaceId: 'ws-uuid-1' }] })` 형태로 인자 검증을 추가하거나, `frontier` 에 2개 이상 id 가 담기는 시나리오(한 폴더가 자식을 2개 이상 가진 경우)의 테스트를 추가해 배열 조립 로직 자체를 검증할 것.

- **[WARNING]** "형제가 여러 개인 서브트리"(BFS `frontier` 다중 원소) 케이스 미검증
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:697-721` (`collectSubtree`)
  - 상세: 추가된 테스트는 모두 단일 체인(부모 1개 자식 1개) 구조만 다룬다 (`f1→f2`, `f1`(leaf), `p1→p2→...→p5`). `collectSubtree` 는 BFS 로 `frontier` 배열을 다음 레벨로 확장하는데, 한 레벨에 자식이 2개 이상 있어 `frontier.length > 1` 이 되는 경로, 그리고 `next` 배열에 중복 id 가 들어오지 않도록 하는 `!ids.has(child.id)` 가드는 테스트로 exercise 되지 않는다.
  - 제안: `f1` 아래 `f2`, `f3` 두 자식이 있고 각각 하위에 자손이 있는 케이스를 추가해 다중 frontier 확장 및 중복 제거 로직을 검증할 것.

- **[WARNING]** `getDepth`/`validateParentChange` 의 depth 경계값(정확히 `MAX_NESTING_DEPTH` 인 경우, `+1` 경계) 케이스 부족
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:684-690` (`parentDepth + height > MAX_NESTING_DEPTH`)
  - 상세: "rejects when resulting depth exceeds max" 테스트는 `parentDepth=5, height=1` → `6 > 5` 초과 케이스만 검증한다. 정확히 경계에 걸치는 `parentDepth + height === MAX_NESTING_DEPTH` (허용되어야 함, 5) 케이스, 그리고 `height > 1`(자손이 있는 폴더를 이동시켜 서브트리 전체가 딸려가는 경우 depth 초과)를 조합한 케이스가 없다. "allows a valid shallow reparent" 는 `parentDepth=1, height=1` 로 경계에서 멀리 떨어진 값만 검증한다.
  - 제안: `parentDepth + height === 5`(정확히 허용 한계, 통과해야 함)와 `height=2`(자손을 가진 폴더 자체를 이동, 서브트리가 딸려가며 초과되는 경우)를 검증하는 테스트를 추가할 것. 이는 실제 운영에서 "자손이 있는 폴더를 깊은 곳으로 이동" 시나리오와 정확히 일치하며 현재 테스트 스위트가 놓치고 있는 실질적 회귀 취약 지점이다.

- **[WARNING]** `data.parentId` 가 `undefined` 로 명시적으로 전달되는 경우(즉 DTO 에 필드 자체가 없는 경우) 와 "부모 미변경"의 구분이 테스트되지 않음
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts:622` (`if (data.parentId !== undefined && data.parentId !== folder.parentId)`)
  - 상세: "renames without parent change" 테스트는 `{ name: 'Renamed' }` 만 전달 — `parentId` 키 자체가 없는 경우다. 이는 `data.parentId === undefined` 조건을 검증한다. 그러나 "parentId 를 명시적으로 현재와 동일한 값으로 전달"(예: `{ parentId: null }` 를 이미 `parentId: null` 인 폴더에 호출)하는 no-op 케이스가 없다. 현재 로직상 `data.parentId !== folder.parentId` 비교이므로 동일 값이면 재검증을 스킵하는 최적화 경로인데, 이 분기가 정확히 동작하는지(=재검증 호출 안 됨) 확인하는 테스트가 없다.
  - 제안: `folder.parentId = 'p1'` 인 상태에서 `service.update('f1', 'ws-uuid-1', { parentId: 'p1' })`(동일 부모로 재지정)을 호출해 `mockRepository.find`/추가 `findOne` 이 호출되지 않음을 검증하는 테스트 추가.

- **[INFO]** `getDepth` 무한루프 가드 테스트("getDepth terminates on cyclic parent chain")의 assertion 이 약함
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:574-597`
  - 상세: 테스트 마지막이 `expect(true).toBe(true)` 로, 실질적으로는 "타임아웃 없이 함수가 반환되었다"는 사실만으로 통과를 판정한다 (주석에도 명시). 이는 가드가 없으면 jest 기본 타임아웃(수 초~기본 5s)에 걸려 실패하는 방식으로 간접 검증하는 접근인데, 두 가지 약점이 있다: (1) 만약 가드 로직에 미묘한 버그가 있어 무한루프까지는 안 가지만 잘못된 depth 값을 반환하는 경우는 이 테스트로 전혀 잡히지 않는다. (2) CI 환경에서 jest 기본 타임아웃이 늘어나 있다면(`testTimeout` 설정) 실패 판정까지 오래 걸릴 수 있다.
  - 제안: 가능하면 `jest.setTimeout` 을 짧게 오버라이드하거나, `getDepth`/`validateParentChange` 를 `private` 이 아닌 별도로 노출해 반환값(`depth` 가 `MAX_NESTING_DEPTH + 1` 근방의 특정 값으로 종료됨)을 직접 assert 하는 방식이 더 견고하다. 다만 이는 캡슐화를 깨야 하는 트레이드오프이므로, 최소한 `await expect(service.create(...)).resolves.toBeDefined()` 형태로 "무엇이 반환되었는지"를 명시적으로 확인하는 정도의 개선은 가능하다 (현재는 반환값을 아예 버림).

- **[INFO]** 컨트롤러 변경(Swagger description 텍스트만)에 대한 테스트 불필요 확인
  - 위치: `codebase/backend/src/modules/folders/folders.controller.ts:139-145`
  - 상세: diff 는 `@ApiOperation({ description: ... })` 문자열만 변경했고 라우팅·가드·파라미터에는 영향이 없다. 기존 `folders.controller.spec.ts` (`@Roles` 메타데이터 검증)는 이 변경과 무관하며 그대로 유효하다 — 회귀 없음. 테스트 추가 불필요.

- **[INFO]** 회귀 테스트 통과 확인
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts`, `folders.controller.spec.ts`
  - 상세: 로컬에서 `npx jest src/modules/folders/` 실행 결과 2 suites / 18 tests 전부 통과 확인. 기존 `create()` 의 "should enforce max nesting depth" 테스트도 `getDepth` 변경(visited-set 추가) 이후에도 유효하게 통과한다.

## 요약

이번 변경은 `update()` 경로에 누락되어 있던 parentId 재검증(cross-workspace·self-parent·자손-cycle·깊이 초과) 로직을 추가하고, `getDepth`/신규 `collectSubtree` 에 손상 데이터(순환 참조)에 대한 무한루프 방지 가드를 넣은 것으로, 8개의 신규 단위 테스트가 이름 변경 없음(no-op)·self-parent cycle·타 workspace/미존재 parent·자손 이동 cycle·깊이 초과·루트 이동·정상 shallow reparent·손상 데이터 무한루프 방지의 핵심 경로를 빠짐없이 커버하고 있어 구조적으로 견고하다. 다만 세부적으로는 (1) `collectSubtree` 의 BFS `find` 호출이 배열 `where` 형태에 의존하는데 이 호출 인자 자체를 검증하는 테스트가 없어 mock 과 실제 TypeORM 동작 간 괴리 위험이 있고, (2) 단일 체인 구조만 다뤄 형제가 여러 개인 실제 트리(다중 frontier) 케이스가 빠져 있으며, (3) depth 정확 경계값(`parentDepth+height === MAX`)과 자손을 동반한 서브트리 이동(`height > 1`) 조합이 미검증이고, (4) `getDepth` 무한루프 가드 테스트가 반환값을 버리는 약한 assertion 이라는 점에서 개선 여지가 있다. e2e 커버리지 부재는 folders 모듈 전체의 pre-existing 갭으로 이번 PR 스코프 밖이나 후속 과제로 기록할 만하다. CRITICAL 은 없으며, 위 갭들은 실제 프로덕션 트리(형제 다수·서브트리 이동)에서의 잠재 회귀를 놓칠 수 있는 실질적 갭이라 WARNING 수준으로 판단한다.

## 위험도
LOW
