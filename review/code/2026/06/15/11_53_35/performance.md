# 성능(Performance) 리뷰 결과

## 발견사항

- **[INFO]** `list()` — `assertWorkflow` 선행 SELECT 후 데이터셋 SELECT, 총 2-RTT
  - 위치: `workflow-test-datasets.service.ts` `list()` / `create()` 메서드
  - 상세: `list`와 `create` 양쪽 모두 `assertWorkflow`를 먼저 호출해 `workflow` 테이블에 SELECT를 날리고, 이어서 `workflow_test_dataset`에 추가 쿼리를 실행한다. 현재 트래픽 규모(편집기 수동 조작)에서는 성능 문제가 아니지만, 두 쿼리를 JOIN 또는 EXISTS 서브쿼리로 합칠 수 있다.
  - 제안: `list` 쿼리의 `WHERE workflow_id = :wf AND workspace_id = :ws` 조건 자체가 워크플로우 소속 검증을 암묵적으로 커버한다. `assertWorkflow`를 별도 SELECT로 유지하는 대신 쿼리 결과가 0건일 때 workflow 존재 여부를 한 번에 확인하는 방향으로 단순화 가능 (단, 404 응답 의미 분리가 필요하면 현행 유지가 타당).

- **[INFO]** `findAccessible` — 불필요한 전체 컬럼 SELECT
  - 위치: `workflow-test-datasets.service.ts` `findAccessible()` (line ~1700)
  - 상세: `datasetRepository.findOne({ where: { id, workspaceId } })` 는 `select` 옵션 없이 `data(input)` JSONB 컬럼을 포함한 모든 컬럼을 읽는다. `remove`나 권한 검사만 수행할 때에도 JSONB 페이로드가 전송된다.
  - 제안: `remove` 흐름은 `select: { id: true, ownerId: true, workspaceId: true, visibility: true }` 로 최소 컬럼만 읽도록 오버로드/옵션 파라미터를 추가하면 불필요한 JSONB 전송을 줄일 수 있다. `update`·`clone`은 `input`이 필요하므로 현행 유지.

- **[INFO]** `list()` 상한 200 — JSONB 컬럼 대량 전송 가능성
  - 위치: `workflow-test-datasets.service.ts` `list()` `.take(200)`
  - 상세: Mock Input JSON 크기에 상한이 없다 (`data JSONB NOT NULL DEFAULT '{}'`). 유저가 큰 JSON을 저장하고 200개 데이터셋이 누적되면 단일 list 응답이 수십 MB가 될 수 있다. 현재 spec 코멘트는 "워크플로우당 소수"를 예상하며 DoS 방지 소프트 리밋이라 설명하는데, 이 가정이 실제 운영에서 무너질 경우 메모리/네트워크 압력이 생긴다.
  - 제안: (1) `data` 컬럼에 PostgreSQL `CHECK (pg_column_size(data) <= 65536)` 등 크기 제한 추가, 또는 (2) list API에 `name`, `id`, `visibility`, `isOwner` 만 반환하는 summary 응답을 내리고 실제 `input` 로딩은 단건 GET으로 분리하는 것을 중장기적으로 검토.

- **[INFO]** 프론트엔드 `datasetsQuery` — `enabled` 조건이 없으면 `runWithInputOpen` 닫혀도 재검색
  - 위치: `editor-toolbar.tsx` `datasetsQuery` useQuery (line ~1641)
  - 상세: `enabled: !!workflowId && runWithInputOpen && datasetPickerOpen` 조건은 적절히 구현되어 있다. 다만 `datasetPickerOpen`이 닫힌 후 다시 열릴 때마다 `refreshDatasets()`(invalidateQueries)를 명시적으로 호출하지 않아도 캐시가 stale이면 자동 재요청이 발생한다. TanStack Query 기본 `staleTime: 0` 동작이므로 불필요한 재요청이 매번 발생할 수 있다.
  - 제안: `datasetsQuery`에 `staleTime: 30_000` 정도를 설정해 데이터셋 피커를 반복 열 때 불필요한 네트워크 요청을 줄인다. 삭제·생성·복제 후에는 이미 `refreshDatasets()`로 무효화하므로 일관성은 유지된다.

- **[INFO]** `handleSaveDataset` 내 `JSON.parse(jsonInput)` 재파싱
  - 위치: `editor-toolbar.tsx` `handleSaveDataset` (line ~1664)
  - 상세: `jsonError` 상태를 위해 이미 입력 변경 시점마다 JSON 파싱이 실행되고 있다(`§2.2 검증` 로직). `handleSaveDataset`에서 다시 `JSON.parse(jsonInput)`를 호출하는 것은 중복 파싱이다. 문자열이 작으므로 실제 비용은 무시 가능하나 코드 일관성 측면에서 지적한다.
  - 제안: 파싱된 값을 state로 캐싱하거나, `handleSaveDataset`에서 이미 검증된 parsed 값을 참조하도록 리팩터링.

## 요약

이번 변경(workflow_test_dataset 테이블·서비스·컨트롤러·프론트엔드 통합)은 성능 관점에서 전반적으로 양호하다. DB 인덱스는 주요 쿼리 패턴(`owner_id + workflow_id`, `workspace_id + visibility`)을 잘 커버하고, UNIQUE 제약 위반을 try-catch로 409 변환하는 방식은 추가 SELECT를 피하는 적절한 선택이다. `take(200)` 소프트 리밋도 DoS 방어 의도가 명확하다. 다만 `findAccessible` 에서 `remove` 경로에도 JSONB 전체 컬럼이 로딩되는 점, list에서 assertWorkflow 선행 RTT가 항상 추가되는 점, 프론트엔드 TanStack Query에 staleTime 미설정으로 피커 반복 개폐 시 매번 재요청이 발생하는 점은 향후 개선을 권장한다. 현 트래픽 규모에서 즉각적인 성능 장애를 유발하는 항목은 없다.

## 위험도

LOW
