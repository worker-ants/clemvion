# 테스트(Testing) 리뷰 — 워크플로우 duplicate 캔버스 복제

대상: `workflows.controller.ts`(Swagger 설명만 변경) · `workflows.service.ts`(`duplicate()` 재구현) ·
`workflows.service.spec.ts`(unit 11건 추가) · `test/workflow-crud.e2e-spec.ts`(C 케이스 보강) ·
`plan/in-progress/workflow-duplicate-nodes-edges.md` 및 `review/consistency/**` 산출물(코드 아님, 테스트 관점 해당 없음).

## 발견사항

- **[WARNING]** `duplicate` describe 의 mock 재할당이 `saveCanvas` describe 로 누수 — 테스트 격리 위반 (실측 확인)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:496-507` (`duplicate` describe 의
    `beforeEach` 안 `mockTransactionManager.find = …` / `mockTransactionManager.save = …` 재할당). 영향받는
    지점: 같은 파일 `saveCanvas` describe(687행)의 `beforeEach`(688-693행)가 `.find`/`.save` 를 재설정하지
    않아, 트랜잭션 본문까지 도달하는 5개 테스트 — 695행 `should save canvas with nodes and edges in a
    transaction`, 722행 `should create a version snapshot after committing the canvas`, 913행 `should accept
    a single-underscore variable name`, 924행 `should not reject an expression-valued variable name at save
    time`, 934행 `should accept a trigger with a well-formed parameter schema` — 가 `duplicate` describe 가
    남긴 mock(Node 엔티티 조회 시 origNodes 5개, Edge 조회 시 origEdges 2개 반환)을 그대로 물려받는다. 중첩
    `describe('graphWarningRules backend enforcement')`(1001행)의 첫 테스트가 1005행에서 `.find`를 다시
    `[]`로 리셋하기 전까지의 구간에 한정된다.
  - 상세: `jest.clearAllMocks()`(118행 바깥 `beforeEach`)는 mock 호출 이력만 지우고 `mockImplementation`/
    `mockResolvedValue`로 심어둔 구현은 지우지 않는다. `duplicate` describe 의 `beforeEach` 주석(493-494행,
    "다른 describe 의 beforeEach 가 얹어둔 잔여가 아니라 이 describe 소유의 spy 임을 보장한다 — 테스트 파일
    순서 의존 제거")은 **자신이 다른 describe 의 잔여를 물려받는 방향**만 방어했고, **자신이 다음 describe
    에 잔여를 남기는 반대 방향**은 막지 못한다. 이 mutation-leak 메커니즘을 별도 최소 재현 스펙으로
    확인했고, 실제 파일에 임시 계측(`console.log`)을 넣어 전체 스위트를 실행한 결과 `saveCanvas` 첫
    테스트 실행 시점에 `mockTransactionManager.find(Node, …)` 가 빈 배열이 아니라 `duplicate` fixture 의
    5개 노드를 그대로 반환함을 직접 관측했다(계측은 실행 직후 `git checkout --`로 완전히 원복, 반영 전후
    모두 76/76 테스트 통과 확인 — 즉 현재 이 오염이 assertion 실패를 유발하지는 않는다).
    영향받는 `saveCanvas` 테스트들이 `manager.remove` 호출 여부나 `.find` 인자를 단언하지 않기 때문에
    지금 당장은 무해하지만, (1) "기존 노드 없음"을 가정하는 시나리오에서 실제로는 5개의 유령 노드에 대해
    `manager.remove` 가 조용히 호출되는 상태로 실행되고 있고, (2) 이후 누군가 "새 캔버스 저장은 삭제를
    호출하지 않는다" 류의 자연스러운 단언을 추가하면 실제 회귀가 아니라 이 잔여 오염 때문에 실패해
    디버깅을 오도하는 landmine 이 된다.
  - 제안: `saveCanvas` describe 의 `beforeEach`(688행)에 `mockTransactionManager.find =
    jest.fn().mockResolvedValue([])`(필요하면 `.save` 도 pristine 기본값으로)를 명시적으로 재설정해 실행
    순서에 의존하지 않게 한다. 더 근본적으로는 최상위 `beforeEach`(118행)에서 `jest.clearAllMocks()` 직후
    `mockTransactionManager`의 모든 메서드를 pristine 기본값으로 재조립하는 헬퍼를 두어, 각 describe 의
    로컬 override 가 그 describe 범위 밖으로 새지 않도록 구조적으로 봉쇄하는 편이 좋다.

- **[WARNING]** `sourceNodeId`/`targetNodeId` OR 가드의 피연산자별 fixture 미분리 — mutation 사각지대
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:294`
    (`if (!sourceNodeId || !targetNodeId) return [];`). 대응 테스트:
    `codebase/backend/src/modules/workflows/workflows.service.spec.ts:656-675`
    (`노드가 사라져 endpoint 를 못 찾는 엣지는 skip 한다`).
  - 상세: 이 테스트는 "target(agent)만 없고 source(loop)는 있다" 케이스만 검증한다. 이 fixture 만으로는
    `!targetNodeId` 검사가 사라지는 변형(예: `if (!sourceNodeId) return [];`로 축소)은 여전히 target-missing
    경로에서 조건이 거짓이 되어 걸러지지 않는 edge 가 섞여 length 단언이 깨지므로 잡히지만, **반대로
    "source 는 없고 target 은 있다" 케이스가 없어 `!sourceNodeId` 검사 자체가 통째로 사라지는 변형은 이
    스위트로 잡히지 않는다** — 현재 fixture 에서는 항상 target-missing 경로로만 조건이 참이 되기 때문이다.
    import 경로의 동일 가드(`importWorkflow`, `sourceId`/`targetId`)도 같은 구조라 같은 사각지대를 공유할
    가능성이 있다.
  - 제안: source 노드가 빠지고 target 은 살아있는 두 번째 fixture 케이스를 추가해 두 피연산자를 대칭적으로
    검증한다(예: 원본 노드 집합에서 `n-loop` 를 제거해 `e-1`(trig→loop)의 target 이 없고 `e-2`(loop→agent)의
    source 가 없는 상황을 하나의 테스트에서 동시에 관측).

- **[INFO]** `nodeRows.length > 0 && edgeRows.length === 0` 조합 미검증
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:285-287`, `:307-309`
    (독립된 두 개의 `if (...length > 0)` insert 게이트). 기존 `duplicate` 테스트는 "0 노드·0 엣지"
    (`workflows.service.spec.ts:648-654`, `빈 캔버스는 노드·엣지 insert 를 호출하지 않는다`)와 "노드 있음
    + 엣지 1개 이상"만 다루고, "노드는 insert 되지만 엣지 insert 는 전혀 호출되지 않는" 조합이 없다.
  - 상세: `importWorkflow` 는 정확히 이 조합에 대한 전용 단언
    (`expect(mockTransactionManager.insert).toHaveBeenCalledTimes(1); // edges 0건 → Node 1회만`,
    `workflows.service.spec.ts:1580`)이 있는데, JSDoc(`workflows.service.ts:219`)이 "import 경로와 UUID
    재매핑 알고리즘만 공유한다"고 명시한 `duplicate` 쪽에는 대응 테스트가 없다.
  - 제안: 원본 엣지가 없는(또는 전부 필터링되는) 케이스를 추가해 `manager.insert` 가 `Node` 로 정확히 1회만
    호출되고 `Edge` 로는 전혀 호출되지 않음을 단언한다.

- **[INFO]** `node.config`/`edge.condition` 참조 격리가 테스트되지 않음(비대칭 처리)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:243-245`(workflow `tags`/`settings`
    얕은 복사 + "호출부의 변이가 원본까지 오염시킨다" 명시 주석) 대비 `:279`(`config: { ...node.config }`,
    이유 주석 없음), `:303`(`condition: edge.condition`, 복사 자체가 없음 — 원본 참조를 그대로 넘김).
  - 상세: workflow 레벨 `tags`/`settings` 는 명시적 이유로 얕은 복사를 하지만 같은 트랜잭션에서 만들어지는
    `node.config`는 이유 주석 없는 얕은 복사이고 `edge.condition`은 원본 참조를 그대로 재사용한다. 대응
    테스트(`노드 속성(위치·config·isDisabled·description)을 그대로 옮긴다`, `엣지 endpoint 를…보존한다`)는
    모두 `toEqual`(값 비교)만 하고 `not.toBe`(참조 비교)로 독립성을 확인하지 않아, 이 비대칭이 의도인지
    누락인지 테스트로 고정돼 있지 않다. 실무 영향은 낮다 — 두 값 모두 DB insert 직후 버려지는 일회성
    객체라 실제 오염 시나리오가 성립하지 않는다.
  - 제안: 필수는 아님. 참조 독립성이 실제 불변식이라면 `edge.condition`도 얕은 복사로 맞추고 회귀
    테스트(참조 비교)를 추가하거나, 의도된 비대칭이면 그 근거를 주석으로 남긴다.

## 확인했으나 문제 없음 (참고)

- `workflows.controller.ts` 변경은 Swagger `description` 문자열뿐이라 별도 테스트가 필요 없다. 컨트롤러의
  `duplicate` 엔드포인트 자체(209-230행)도 `service.duplicate(...)`로 위임만 하는 얇은 메서드라 기존
  `workflows.controller.spec.ts`(다른 조건부 로직이 있는 엔드포인트만 커버)에서 다루지 않는 것도 기존 관례와
  일관된다.
- 새 unit 11건은 원본 그래프의 `containerId` 축(HTTP→Loop)과 `toolOwnerId` 축(Tool→Agent)을 **서로 다른
  노드**로 분리해 두 축이 뒤바뀌는 회귀가 관측 가능하도록 설계했고(`workflows.service.spec.ts:382-384`
  주석), 원본 fixture 가 in-place 로 변이되지 않는지(`:638-646`), 재발급 UUID 가 원본과 절대 겹치지 않고
  서로도 겹치지 않는지(`:562-567`)까지 확인하는 등 이 프로젝트가 이전에 반복해 지적해 온 "얕은 분기
  매트릭스"를 상당 부분 피해 있다. `import 전용 게이트를 적용하지 않는다` 테스트(`:597-607`)는 원본이
  의도적으로 비워둔 `llmConfigId`를 복제가 채우지 않는지까지 음의 단언(not.toHaveBeenCalled)으로 고정한다.
- e2e 케이스(C, `test/workflow-crud.e2e-spec.ts:144-325`)는 unit 이 mock 으로 가정한 UUID 재매핑·참조
  무결성을 실제 DB round-trip(export 인덱스 정규화 + 원본/사본 `node.id` 비중첩 SELECT)으로 재확인하고
  `workflow_version` row 0건까지 검증해, unit/e2e 두 계층이 서로 다른 관점(구현 세부 vs 실제 영속 상태)으로
  보완한다. "빈 캔버스를 복제하면 회귀가 관측되지 않는다"(과거 실제 그 상태였음)를 인지하고 저장까지 거친
  5노드·2엣지 그래프로 fixture 를 구성한 점도 근거가 있다.
- `duplicate()`가 `manager.insert`를 배치로 쓰는 전제(Node/Edge 엔티티에 `@BeforeInsert` 훅·cascade 가
  없다)는 이미 파일 하단(`workflows.service.spec.ts:2222-2252`, 기존 `importWorkflow` 용 가드)에 고정돼
  있고 이 전제는 두 메서드가 공유하므로 새 주석의 인용("가드 테스트가 본 파일 하단에 있다",
  `workflows.service.ts:263-264`)은 정확하다.
- insert 실패/트랜잭션 롤백 전파에 대한 unit 테스트는 없으나, 같은 패턴을 쓰는 기존 `importWorkflow`
  경로에도 동일하게 없어(전수 grep 결과 `mockTransactionManager.insert`/`.save`에 대한 `mockRejectedValue`
  사용처 0건) 이 diff 가 새로 만든 갭이 아니라 프로젝트 전반의 기존 관례다.

## 요약

새 `duplicate()` unit 11건과 e2e C 케이스 보강은 UUID 재매핑·두 참조 축(container/toolOwner) 분리·원본
불변·import 게이트 미적용·빈 캔버스·고아 엣지 스킵·워크스페이스 경계 404 등 핵심 계약을 폭넓게, 그리고
"뒤바뀌면 관측되는" fixture 설계로 신중하게 커버한다. 다만 리뷰 중 실제 계측으로 확인한 구체적 결함이
하나 있다 — `duplicate` describe 의 `beforeEach`가 스위트 전역에서 공유하는 `mockTransactionManager.find`/
`.save`를 원복 없이 재할당해, 바로 뒤에 오는 `saveCanvas` describe 의 앞쪽 5개 테스트가 "기존 노드/엣지
없음"을 가정한 채로 실제로는 `duplicate` fixture 의 유령 데이터를 물려받아 실행된다(현재는 어떤 단언도
깨지지 않지만, 향후 자연스러운 단언 추가 시 오탐을 유발할 수 있는 landmine). 그 외 엣지 remap 가드의
`||` 두 피연산자 중 한쪽만 fixture 로 검증돼 있는 mutation 사각지대, `duplicate`에서만 빠진 "노드는 있고
엣지는 0건" 분기, `node.config`/`edge.condition` 참조 격리 미검증은 모두 낮은 실무 위험의 보강 항목이다.
전체적으로 테스트 존재·엣지 케이스·회귀 방지 설계는 이 저장소의 평균 이상이며, 위 발견사항은 병합을
막을 사안이 아니라 후속으로 다듬을 항목이다.

## 위험도

MEDIUM
