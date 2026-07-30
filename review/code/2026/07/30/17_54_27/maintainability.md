# 유지보수성(Maintainability) 코드 리뷰

대상: `WorkflowsService.duplicate()` 재구현(캔버스 전체 복제) + 관련 컨트롤러 문서·단위/e2e 테스트.
실제 코드 변경은 4개 파일(`workflows.controller.ts`, `workflows.service.ts`, `workflows.service.spec.ts`,
`workflow-crud.e2e-spec.ts`)이며, 나머지 번들 파일(plan/spec/consistency 리포트 등 markdown/json)은
"함수 길이·중첩·매직넘버·복잡도" 같은 코드 중심 기준이 적용되지 않는 문서 산출물이라 본 리뷰 범위에서 제외했다.

## 발견사항

- **[WARNING]** Node/Edge row 생성 로직의 3중 구조적 중복 (shotgun-surgery 위험)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:271-309` (`duplicate()` 내 `nodeRows`/`edgeRows` 구성, 신규)
  - 상세: 이번 diff 로 "Node/Edge row 를 동일한 필드 이름 집합으로 조립"하는 로직이 **세 번째 사본**이 됐다.
    같은 파일에 이미 두 곳이 있다 — `syncNodes`/`syncEdges`(`:913-1000`, saveCanvas 경로, 신규 노드 리터럴은
    `:947-960`)와 `importWorkflow()`(`:409-451` node, `:461-476` edge, 본 diff 범위 밖 기존 코드). 세 곳 모두
    Node 는 `id, workflowId, type, category, label, positionX, positionY, config, isDisabled, description,
    containerId, toolOwnerId`(12 필드), Edge 는 `workflowId, sourceNodeId, sourcePort, targetNodeId,
    targetPort, type, condition`(7 필드)로 **필드 이름 집합이 정확히 동일**하다. 값 계산(설정 defaults 적용
    여부, LLM 주입, UUID remap 소스가 ID-map 인지 index-array 인지)만 세 곳마다 다르다. Node/Edge 엔티티에
    컬럼이 하나 추가되면 이 3곳을 모두 손으로 동기화해야 하고, 하나만 빠뜨려도 TypeScript 컴파일 에러 없이
    조용히 필드 유실이 발생할 수 있다 — `manager.insert` 호출부가 전부 `as QueryDeepPartialEntity<...>[]` 로
    타입 체크를 우회하기 때문에 더욱 그렇다(`:286`, `:308`, 기존 `:456`, `:480`). 부수적으로 "length > 0 이면
    insert" 3줄 가드 패턴(`:285-287`, `:307-309`)도 `importWorkflow()`의 동일 가드(`:453-458`, `:477-482`)와
    반복된다.
  - 제안: `duplicate()`/`importWorkflow()`의 값 계산(게이트)까지 강제로 통합할 필요는 없다 — 서비스 코드의
    JSDoc(`:219-223`)이 "UUID 재매핑 알고리즘만 공유하고 게이트는 공유하지 않는다"고 이미 의도적으로 명시하고
    있고, 이 프로젝트는 관심사가 발산하는 근-중복 로직을 무리하게 완전 통합하지 않는 컨벤션을 갖고 있다. 다만
    최소한 **필드 이름 집합**만 공유하는 얕은 헬퍼(예: `private buildNodeRow(base, config, containerId,
    toolOwnerId)` / `private buildEdgeRow(base, ...)`)를 도입하거나, 그것이 부담스럽다면 세 함수 상단에
    "Node/Edge 컬럼 추가 시 `syncNodes`/`syncEdges`·`importWorkflow`·`duplicate` 3곳 동기화 필요" 라는
    명시적 상호 참조 주석만이라도 남겨 향후 drift 를 막는 것을 권장한다.

- **[WARNING]** e2e 테스트 C 케이스가 단일 `it()` 블록에 183줄·6개 이상의 관심사를 담음
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:144-325` (`it('C. duplicate → 새 ID, " (Copy)" 접미, isActive=false, 캔버스 전체 복사', ...)`)
  - 상세: 같은 파일의 다른 테스트(A/B/D/E/F, 대략 25~40줄, 예: `:48`, `:79`, `:327`, `:355`, `:393`)에 비해
    4~7배 길다. 한 테스트 안에 ① 5노드·2엣지 그래프 fixture 저장 ② `duplicate` 호출 ③ 응답 메타 검증
    (name/isActive/currentVersion, `:247-253`) ④ export 기반 노드·엣지 구조 검증(`:257-293`) ⑤ DB 직접
    쿼리로 원본/사본 노드 UUID 비중첩 검증(`:296-309`) ⑥ 원본 워크플로우 불변 검증(`:312-317`) ⑦ 버전
    스냅샷 0건 검증(`:320-324`)까지 최소 6단계 관심사가 들어 있고, 로컬 변수도 15개 이상
    (`nTrig~nTool`, `dup`, `dupId`, `dupExport`, `nodes`, `edges`, `idx`, `edgePairs`, `dupNodeIds`,
    `origNodeIds`, `origSet`, `original`, `dupVersions`)이라 실패 시 어느 단언이 실패했는지 파악하려면
    전체를 다시 훑어야 한다.
  - 제안: e2e 라운드트립 비용(네트워크+DB) 을 고려하면 fixture 를 매 assertion 그룹마다 새로 만드는 완전
    분리는 비용이 크다. 대신 최소한 5노드 그래프 payload 구성(`:161-233`)을 별도 헬퍼 함수로 추출해 테스트
    본문을 "무엇을 검증하는지" 위주로 줄이는 것을 권장한다. 관심사가 뚜렷이 나뉘므로(메타/구조/DB
    무결성/원본 불변/버전 이력) 헬퍼 도입 후 여유가 되면 `it()` 를 2~3개로 쪼개는 것도 고려할 수 있으나
    필수는 아니다.

- **[INFO]** `remap()` 의 고아 참조 null 처리 사유가 주석으로 설명되지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:268-269` (`remap` 함수)
  - 상세: 엣지 쪽은 "FK CASCADE 상 원본에 고아 엣지는 없어야 하지만, 있으면 사본에 옮기지 않는다"는 명시적
    방어 주석이 있다(`:290-291`). 반면 `remap()` 은 `idMap.get(nodeId) ?? null` 로 매핑 실패 시 조용히
    `null` 을 반환한다(즉 containerId/toolOwnerId 가 가리키는 노드를 찾지 못하면 컨테이너/Tool Area 배치
    정보가 사본에서 사라진다). 같은 종류의 "왜 이렇게 방어하는지" 설명이 이 함수 옆에는 없어, 처음 읽는
    사람은 두 방어 로직이 왜 다른 형태(엣지는 skip, 노드 참조는 null)로 처리되는지 스스로 유추해야 한다.
  - 제안: `remap` 정의 옆에 한 줄 — "컨테이너/Tool Area 참조 노드가 원본 조회 결과에 없으면(FK CASCADE 상
    발생하지 않아야 하지만) null 로 두어 배치 정보 없는 노드로 취급한다" 같은 설명을 추가.

- **[INFO]** `duplicate()`/`importWorkflow()` 간 변수 네이밍 컨벤션 드리프트
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:265`(`idMap`), `:271`(`nodeRows`), `:289`(`edgeRows`) — cf. 기존 `:407`(`nodeIdMap`), `:409`(`nodeEntities`), `:461`(`edgeEntities`)
  - 상세: 두 함수 모두 "원본→사본 UUID 매핑 후 insert 페이로드 구성"이라는 같은 개념을 다루는데,
    `duplicate()` 는 `idMap`/`nodeRows`/`edgeRows`, `importWorkflow()` 는 `nodeIdMap`/`nodeEntities`/
    `edgeEntities` 로 이름 체계가 다르다. 참고로 `nodeEntities`/`edgeEntities` 라는 기존 이름은 바로 옆
    주석(`:434-437`: "plain literal — manager.insert 는 entity 인스턴스가 아닌 partial 을 받는다")과 실제로
    어긋나 있어(엔티티 인스턴스가 아님), 오히려 이번에 새로 붙인 `nodeRows`/`edgeRows` 쪽이 더 정확하다.
    기능상 문제는 아니지만, 같은 파일 안에서 구조적으로 거의 동일한 두 함수가 다른 이름 체계를 쓰는 것은
    나중에 세 번째 유사 로직을 추가할 사람에게 어떤 컨벤션을 따라야 할지 혼란을 줄 수 있다.
  - 제안: 지금 당장 무관한 리네이밍으로 diff 범위를 넓힐 필요는 없으나, 이 영역을 다음에 다시 손댈 때
    `nodeEntities`/`edgeEntities` → `nodeRows`/`edgeRows` 로 맞추는 사소한 정리를 함께 고려할 것.

## 검증했으나 문제 없음 (참고)

- `duplicate()` 자체의 가독성·복잡도는 양호하다 — 순환 분기가 적고(삼항·`flatMap` 내 단일 guard 정도),
  중첩 깊이도 얕다. JSDoc(`:216-227`)이 "왜"(게이트 비공유 이유, 복제 범위 밖 항목)를 먼저 설명하는 방식은
  파일 내 다른 private 메서드(`evaluateToolPayloadWarningsAndThrow`, `loadIntegrationsForBudget`)의 문서화
  스타일과 일관된다.
- 컨트롤러 변경(`workflows.controller.ts:215`)은 `@ApiOperation.description` 문자열 갱신뿐이며 다른
  엔드포인트의 설명 스타일(단일 긴 문자열)과 일치한다. 기능 변경 없음.
- 단위 테스트(`workflows.service.spec.ts`)의 `beforeEach` 안에서 `mockTransactionManager.insert`/`update`
  를 매번 재할당하는 패턴(`:492`, `:495`)은 기존 `importWorkflow` describe 블록(`:1520-1521`,
  `:1809-1810`)에 이미 있던 컨벤션을 그대로 따른 것이고, 재할당 이유를 설명하는 주석("다른 describe 의
  beforeEach 가 얹어둔 잔여가 아니라...")도 있어 테스트 격리 의도가 명확하다. `insertedRows` 헬퍼
  (`:510-513`)는 기존 `importWorkflow` 블록의 `insertedNodes` 헬퍼(`:1535-1538`)를 Node/Edge 양쪽에 쓸 수
  있게 일반화한 자연스러운 확장이다.
- 새 단위 테스트들의 `it()` 제목이 한국어(예: `:524`, `:542`)이고 같은 `describe('duplicate', ...)` 블록
  안의 기존 테스트(`:515`, 영어)와 언어가 섞이지만, 이는 파일 전체(`:244`, `:253`, `:269` 등 기존 한국어
  제목과 `:153`, `:164` 등 기존 영어 제목이 이미 공존)에 걸친 기존 컨벤션이라 새로운 불일치가 아니다.
- `duplicate()` 안 " (Copy)" 접미사 리터럴(`:238`)은 이번 diff 이전부터 있던 코드 그대로이며 위치만
  트랜잭션 콜백 안으로 옮겨졌다 — 새로 도입된 매직 스트링이 아니다.

## 요약

`WorkflowsService.duplicate()` 재구현은 기존 `importWorkflow()`의 "UUID 사전 발급 → 참조 재매핑 →
배치 insert 2회" 트랜잭션 패턴을 그대로 재사용하면서, 왜 게이트(label 중복 검증·기본 LLM 주입 등)는
공유하지 않는지를 JSDoc 과 인라인 주석으로 충분히 설명해 의도가 명확하게 읽힌다. 순환 복잡도·중첩 깊이는
낮고, 매직 넘버·새 하드코딩 문자열도 없다. 다만 이번 변경으로 Node/Edge row 구성 로직이 파일 내에서
`syncNodes`/`syncEdges`·`importWorkflow`·`duplicate` 세 곳에 필드 이름이 동일한 형태로 중복 존재하게 됐고
(WARNING), 새로 추가된 e2e 테스트 C 케이스는 183줄·6개 이상의 관심사를 가진 단일 `it()` 로 다른 테스트
대비 과대하다(WARNING). 두 사안 모두 병합을 막을 정도는 아니며, 전자는 프로젝트가 이미 채택한 "관심사
발산 시 전체 통합 지양" 원칙과 맞닿아 있어 완전한 리팩터링보다는 최소 동기화 안전장치(주석 또는 얕은
row-shape 헬퍼)로 완화 가능하고, 후자는 fixture 추출만으로 상당 부분 개선된다. 나머지는 네이밍 드리프트·
주석 보강 수준의 INFO 이다.

## 위험도

LOW
