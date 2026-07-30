# 성능(Performance) 코드 리뷰 — 워크플로우 duplicate 캔버스 전체 복제

## 검토 범위

실제 실행 코드가 있는 4개 파일만 성능 관점 분석 대상으로 삼았다: `workflows.controller.ts`(Swagger
설명 텍스트 변경뿐, 로직 변경 없음), `workflows.service.ts`(`duplicate()` 재구현 — 핵심 대상),
`workflows.service.spec.ts`/`workflow-crud.e2e-spec.ts`(테스트 코드). 나머지 파일(`CHANGELOG.md`,
`plan/**`, `review/code/2026/07/30/17_54_27/**`, `review/consistency/**`, `spec/**`,
`ui-tour*.mdx`)은 런타임에 실행되지 않는 문서/추적 산출물이라 성능 특성이 존재하지 않아 제외했다.

이번 diff 는 이전 라운드(`review/code/2026/07/30/17_54_27/`)의 concurrency/database 리뷰가 이미 같은
`duplicate()` 코드를 상세히 다뤘고(WARNING #1 REPEATABLE READ 적용은 이미 커밋 `a7ab2750a` 로 반영
완료), 그 산출물이 이번 diff 에 그대로 포함되어 있다. 아래는 그 코드의 **현재 상태**(픽스 반영 후)를
성능 관점에서 독립적으로 재검토한 결과다.

## 발견사항

- **[INFO]** Node/Edge 배치 insert 가 크기 상한(chunk) 없이 단일 다중-VALUES INSERT 로 전송됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:303-305`(`manager.insert(Node, nodeRows...)`), `:327-329`(`manager.insert(Edge, edgeRows...)`)
  - 상세: `originalNodes`/`originalEdges` 를 트랜잭션 안에서 전량 메모리에 적재한 뒤(`:263-268`), `nodeRows`/`edgeRows` 배열 전체를 각각 `manager.insert()` 1회 호출로 전송한다. TypeORM 은 기본적으로 이를 단일 다중-row INSERT 문으로 컴파일하므로, Postgres 바인드 파라미터 상한(65535)을 감안하면 Node(컬럼 11개 기준) 약 5,900개, Edge(컬럼 7개 기준) 약 9,300개를 넘는 캔버스에서 이론상 쿼리 실패로 이어질 수 있고, 그 이하 규모라도 캔버스가 커질수록 단일 요청의 페이로드 크기·DB 측 파싱 비용이 선형으로 증가한다. 다만 이는 같은 파일의 기존 `importWorkflow()`(`:475-480`, `:501-506`, "perf #10" 주석이 이미 "N+1 루프 대신 배치 insert 2회" 로 명시)가 채택한 것과 동일한 형태를 그대로 재사용한 것이지, 이번 diff 가 새로 만든 리스크가 아니다. 워크플로우 캔버스는 사용자가 에디터에서 직접 그리는 그래프이므로 실무상 그 규모(수천 노드)에 도달할 가능성은 낮다.
  - 제안: 현재로서는 조치 불필요. 향후 대량 생성 경로(예: 프로그래matic 대량 import, 템플릿 마켓플레이스 등)가 추가돼 캔버스 규모가 사용자 손 그림 범위를 벗어날 가능성이 생기면, `manager.insert(..., { chunk: N })` 형태의 분할을 `duplicate()`/`importWorkflow()` 양쪽에 함께 도입하는 것을 검토.

## 검증했으나 문제 없음 (참고)

- **알고리즘 복잡도**: `duplicate()` 는 노드 수 N, 엣지 수 E 에 대해 O(N+E) 다. `idMap`(`:275-277`) 은 `Map<string,string>` 으로 구성해 `remap()`(`:281-282`)·엣지 재매핑(`:312-313`)이 모두 O(1) lookup 이다 — 같은 파일의 기존 `exportWorkflow()`(`:349-353`, `:369-371`, 이번 diff 범위 밖)가 노드/엣지마다 `nodes.findIndex()` 를 호출해 사실상 O(N·(N+E)) 로 스케일하는 것과 대비된다. `duplicate()` 는 그 패턴을 반복하지 않고 Map 기반으로 구현되어 있어 알고리즘적으로 더 낫다.
- **N+1 쿼리 없음**: 노드/엣지 복사가 루프 내 개별 쿼리가 아니라 트랜잭션당 고정 왕복 횟수(`findById` 1 + workflow insert 1 + node/edge SELECT 2 + node/edge INSERT 최대 2)로 처리된다. 캔버스 크기가 커져도 쿼리 "개수" 는 늘지 않고 각 쿼리의 페이로드만 커진다 — database.md 리뷰에서 이미 확인된 내용과 일치.
- **블로킹 I/O**: 신규 코드 경로에 동기 I/O 호출 없음. `manager.find(Node, ...)` 와 `manager.find(Edge, ...)` 를 순차 `await` 하는 것은 병렬화 여지처럼 보일 수 있으나, 둘 다 같은 트랜잭션(같은 `QueryRunner`/DB 커넥션)에 묶여 있어 `Promise.all` 로 감싸도 실제 동시 실행은 일어나지 않는다(단일 커넥션은 프로토콜 레벨에서 요청을 직렬화) — 현재 순차 구현이 정확하고, 병렬화 제안은 실질적 이득이 없어 보류.
- **격리 수준 변경의 성능 영향**: `:245` 에서 트랜잭션을 `REPEATABLE READ` 로 명시한 것(이전 라운드 concurrency WARNING #1 의 fix, 커밋 `a7ab2750a`)은 Postgres MVCC 특성상 reader 가 추가 락을 잡지 않으므로 동시 `saveCanvas()` 를 블로킹하지 않고, 처리량에 측정 가능한 악영향이 없다. 재시도(40001) 로직 부재도 이 트랜잭션이 write-write 충돌 대상이 아니라는 근거(원본에 대한 UPDATE/DELETE 없음)로 타당하다.
- **메모리 할당**: `tags: [...(original.tags ?? [])]`/`settings: { ...(original.settings ?? {}) }`(`:252`, `:254`)·`config: { ...node.config }`(`:297`) 는 얕은 복사 1회씩으로 트리비얼한 비용이며, 참조 공유로 인한 원본 오염을 막기 위해 필요한 복사다 — 불필요한 할당이 아니다.
- **지연 로딩**: 복제 범위 밖으로 명시된 버전 이력·트리거·테스트 데이터셋·실행 이력은 아예 조회되지 않는다(주석 `:225-226`) — 당장 필요하지 않은 리소스를 선행 로딩하지 않는다.
- **캐싱**: `duplicate()` 내에 반복 호출되는 순수 계산이나 외부 조회가 없어 캐싱이 필요한 지점 자체가 없다. (`importWorkflow()` 는 이미 `defaultLlm` 조회를 트랜잭션 밖에서 1회만 수행하도록 캐싱돼 있으나 이는 이번 diff 범위 밖.)
- **테스트 코드**: `workflow-crud.e2e-spec.ts` C 케이스가 e2e 왕복(save→duplicate→export→DB query 2회→GET→DB query)을 다수 추가했지만 이는 e2e 테스트 성격상 불가피하고 프로덕션 핫패스가 아니다. `workflows.service.spec.ts` 의 mock 기반 unit 테스트 추가분도 실제 DB/네트워크 호출이 없어 CI 성능에 미치는 영향은 무시 가능하다.

## 요약

`WorkflowsService.duplicate()` 를 "메타 row 단일 INSERT" 에서 "workflow+node+edge 를 한 트랜잭션으로
원자적 복제" 로 재구현한 이번 변경은 성능 관점에서 실질적 결함이 없다. 시간 복잡도는 O(N+E) 로
선형이고 UUID 재매핑에 `Map` 을 사용해 O(1) lookup 을 보장하며(같은 파일의 기존 `exportWorkflow()`
의 O(n²)급 `findIndex` 패턴을 반복하지 않음), 노드/엣지 복사는 루프 내 개별 쿼리가 아니라 캔버스
크기와 무관하게 고정된 왕복 횟수(배치 SELECT 2회 + 배치 INSERT 최대 2회)로 처리돼 N+1 문제가 없다.
이전 라운드에서 concurrency 리뷰가 지적한 read skew 문제의 수정(`REPEATABLE READ` 트랜잭션 명시)도
Postgres MVCC 특성상 추가 락이나 처리량 저하를 유발하지 않는다. 유일한 관찰 사항은 배치 insert 에
chunk 분할이 없어 이론상 매우 큰 캔버스에서 bind 파라미터 상한에 도달할 수 있다는 점(INFO)인데, 이는
기존 `importWorkflow()` 가 이미 채택한 동일 패턴을 재사용한 것이라 이번 diff 가 새로 만든 리스크가
아니며, 사용자가 직접 그리는 캔버스 특성상 실무적 발생 가능성도 낮아 조치가 시급하지 않다.

## 위험도

LOW
