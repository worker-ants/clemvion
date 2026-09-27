# 데이터베이스(Database) 리뷰 — cross-workspace-refs

대상: 요청 본문의 참조 id(workflowId · folderId · parentId · containerId/toolOwnerId · 엣지 끝점 · 캔버스 신규 노드 id · 모델 설정 id)가 다른 워크스페이스/워크플로를 가리키면 저장 전에 400/404 로 거부하는 검증 계층 신설(`codebase/backend/src/common/utils/reference-in-scope.ts` 등). 스키마 변경(마이그레이션)은 이 diff 에 없음 — 전부 애플리케이션 레이어 사전 검증 추가.

## 발견사항

- **[INFO]** 신규 검증기 `assertReferenceInScope` / `repo.exists({ where })` 는 전부 PK(`id`) 등호 조건을 포함하므로 별도 인덱스 없이 효율적이다
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:37`~`45` (`assertReferenceInScope`)
  - 상세: `folderRepository.exists({ where: { id, workspaceId } })`, `workflowRepository.exists({ where: { id, workspaceId } })` 등 새로 추가된 모든 소속 검사는 `id`(PK, unique index)로 이미 단일 행으로 좁혀지고 `workspaceId` 는 부가 필터라 실행 계획에 영향이 없다. 인덱스 추가는 불필요.
  - 제안: 없음 — 현행 유지.

- **[INFO]** `nodes.service.ts` 의 `containerId`/`toolOwnerId` 검사, `knowledge-base.service.ts` 의 추출/rerank 설정 검사가 병렬화 가능한 두세 개의 독립 쿼리를 순차 `await` 한다
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.ts:106`-`110` (`assertPlacementInWorkflow` 의 `for...of` 루프, `this.nodeRepository.exists` 호출)
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:214`-`234` (`assertModelConfigRefsInWorkspace` 의 세 개 `if` 블록)
  - 상세: 각 필드는 서로 독립적인 존재 확인이라 N+1 로 부를 만큼 크지 않다(고정 2~3개, 요청 crUD 경로마다 한 번). 다만 순차 `await` 라 왕복(round-trip) 지연이 필드 수만큼 누적된다 — 요청당 왕복이 한두 번 느는 정도라 트래픽 영향은 미미하지만, `Promise.all` 로 바꾸면 지연을 줄일 수 있다.
  - 제안: 필수 수정 아님. 지연에 민감한 경로라면 `Promise.all([...])` 로 병렬화 고려.

- **[INFO]** `assertEndpointsInWorkflow` / `assertNewNodeIdsUnused` 는 `In()` 으로 배치 조회해 N+1 을 피했다 — 모범 사례
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts:72`-`95` (`assertEndpointsInWorkflow`, `this.nodeRepository.find({ where: { id: In([...]), workflowId } })`)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:1210`-`1233` (`assertNewNodeIdsUnused`, `manager.find(Node, { where: { id: In(...) }, select: { id: true } })`)
  - 상세: 두 곳 다 여러 id 를 배열로 모아 단일 쿼리로 확인한다. `select: { id: true }` 로 불필요한 컬럼(특히 `config` JSONB)을 배제한 점도 대량 캔버스 저장에서 페이로드를 줄인다.
  - 제안: 없음 — 현행 유지.

- **[INFO]** 트랜잭션 진입 전 사전 검증 배치가 적절하다 — 실패 시 빈 트랜잭션을 열지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:214`(`create`), `:255`(`update`) — `assertFolderInWorkspace` 가 `this.dataSource.transaction(...)` 호출 이전에 실행됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:696` — `validateCanvasReferences(dto)` (순수 인메모리 `Set` 검사, DB 접근 없음)도 트랜잭션 시작 전에 실행
  - 상세: `dto.folderId` 소속 검사가 트랜잭션 밖에서 먼저 실패하면 불필요한 `BEGIN`/커넥션 점유가 생기지 않는다. `validateCanvasReferences` 는 페이로드 안의 노드 id 집합만으로 판단하는 순수 함수라 DB 호출이 전혀 없어 이 부분은 성능 영향이 없다. 반면 `assertNewNodeIdsUnused` (`:1154`)는 트랜잭션의 `manager` 로 조회해 같은 트랜잭션 컨텍스트를 유지한다 — 일관성 측면에서 올바른 선택.
  - 제안: 없음 — 현행 유지.

- **[INFO]** `assertNewNodeIdsUnused` 의 check-then-insert 사이에 이론적 TOCTOU 레이스가 있으나 데이터 손상으로 이어지지 않는다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:1210`-`1233` (조회) → 이후 같은 트랜잭션의 `manager.save(Node, nodesToSave)` (삽입)
  - 상세: PostgreSQL 기본 격리 수준(READ COMMITTED)에서, 두 개의 동시 캔버스 저장 요청이 같은(공격자가 알아낸) node id 를 "사용 안 됨" 으로 동시에 관측한 뒤 각자 그 id 로 신규 노드를 `save` 하면, 나중에 커밋을 시도하는 트랜잭션은 PK unique 제약 위반으로 실패한다(500). 데이터가 다른 워크플로로 옮겨지거나 덮이는 이전 결함은 재발하지 않는다 — 최악의 경우도 요청 실패이지 정합성 붕괴가 아니다.
  - 제안: 현재로선 조치 불필요. 레이스를 0으로 만들고 싶다면 `SELECT ... FOR UPDATE` 또는 advisory lock 을 고려할 수 있으나, 신규 노드 id 는 프런트가 발급하는 랜덤 UUID 라 공격 표면이 매우 좁아 우선순위는 낮다.

- **[INFO]** 스키마 자체에는 워크플로/워크스페이스 범위를 강제하는 복합 FK 가 없다 — 이번 PR 은 애플리케이션 레이어에서만 그 불변식을 채운다
  - 위치: `codebase/backend/src/modules/nodes/entities/node.entity.ts` (`container_id`/`tool_owner_id` FK 는 `Node.id` 단일 컬럼만 참조, `workflow_id` 동일성은 DB 제약이 아님) — diff 범위 밖의 기존 스키마이나 이번 검증 로직이 메우는 갭의 근거
  - 상세: `spec/1-data-model.md` §1.1 신설 문구("서버는 이것을 저장 전에 거부한다")와 일치하게, DB 는 `(id, workflow_id)` 복합 유니크나 복합 FK 로 이 불변식을 강제하지 않는다. 즉 오늘 추가된 `assertPlacementInWorkflow`/`assertEndpointsInWorkflow`/`validateCanvasReferences` 가 유일한 방어선이다 — 이 경로를 우회하는 새 쓰기 경로(예: 향후 벌크 import, 관리자 스크립트, 다른 서비스의 직접 `save`)가 생기면 동일 결함이 재발할 수 있다.
  - 제안: 필수 수정 아님(스키마 변경은 별도 마이그레이션·성능 검토가 필요한 큰 작업). 다만 후속 문서화 관점에서 "이 불변식은 DB 제약이 아니라 서비스 레이어 책임" 이라는 점을 spec Rationale 이나 코드 주석에 남겨 두면(이미 §1.1 표/서술에 일부 반영됨) 다음 쓰기 경로 작성자가 같은 검사를 빠뜨리지 않는 데 도움이 된다.

- **[INFO]** 마이그레이션 없음 — 무중단 배포 리스크 해당 없음
  - 상세: 이 PR 은 컬럼/인덱스/제약 추가·변경이 전혀 없고 서비스 코드의 사전 검증만 추가한다. 락·데이터 손실 등 마이그레이션 안전성 관점의 리스크는 없다.

- **[INFO]** SQL 인젝션 해당 없음
  - 상세: 모든 신규 쿼리가 TypeORM `Repository.exists`/`find` 의 객체 리터럴 `where` 를 사용하는 파라미터화된 쿼리다. 원시 SQL 문자열 조합은 없다.

- **[INFO]** 커넥션 관리 해당 없음
  - 상세: 신규 코드는 NestJS DI 로 주입된 `Repository`/트랜잭션 `manager` 만 사용하며 수동 커넥션 획득·해제가 없다. 풀 누수 우려 없음.

- **[INFO]** 대량 데이터 관점: 신규 쿼리는 모두 요청 페이로드 크기(노드 2~수백 개, 참조 필드 1~3개)에 비례할 뿐 테이블 전체 스캔이 아니다
  - 상세: `assertNewNodeIdsUnused` 의 `In()` 대상은 "이번 캔버스 저장에서 새로 등장하는 노드 id" 집합으로, 워크플로 크기에 비례하지 전체 `node` 테이블 크기에 비례하지 않는다(PK IN 조회이므로 테이블 크기와 무관하게 인덱스로 처리됨). 페이지네이션 이슈 없음.

## 요약

이번 변경은 스키마를 건드리지 않고 애플리케이션 레이어에 소속(같은 워크스페이스/워크플로) 검증을 추가하는 방어적 수정이다. 신규 쿼리는 전부 PK 기반 `exists`/`find` 로 인덱스 문제가 없고, 여러 참조를 한 번에 확인해야 하는 자리(엣지 끝점, 캔버스 신규 노드 id)는 `In()` 배치 조회로 N+1 을 피했다. 트랜잭션이 필요한 다단계 쓰기(`workflows.service.ts` 의 `create`/`saveCanvas`)에서는 트랜잭션 진입 전에 저렴한 검증을 먼저 돌려 불필요한 `BEGIN` 을 피하는 등 설계가 신중하다. 남는 것은 전부 INFO 수준 관찰이다 — 소수 필드를 순차 검사하는 두 곳(`nodes.service.ts`, `knowledge-base.service.ts`)은 `Promise.all` 로 왕복을 줄일 여지가 있고, 신규 노드 id 유일성 검사에는 이론적 TOCTOU 레이스가 남아 있으나 PK 제약이 데이터 손상을 막아 최악의 경우도 500 오류에 그친다. 이 불변식이 DB 제약이 아니라 서비스 레이어 책임이라는 점(복합 FK 부재)은 향후 다른 쓰기 경로가 같은 검사를 빠뜨릴 수 있다는 잠재 리스크로 남지만, 이번 PR 범위에서 조치가 필요한 결함은 아니다. SQL 인젝션·커넥션 관리·마이그레이션 안전성 관점에서는 문제가 없다.

## 위험도

LOW
