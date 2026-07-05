# Database Review — folder-depth-cycle-guard

대상: `codebase/backend/src/modules/folders/folders.service.ts` (`update()`, `getDepth()`, `validateParentChange()`, `collectSubtree()` 신설), `folders.controller.ts` (Swagger 설명 문구만 변경, DB 관점 무관), `folders.service.spec.ts` (테스트 전용, DB 관점 무관).

## 발견사항

- **[INFO]** `collectSubtree()` BFS 는 트리 레벨당 1쿼리 — 반복문 내 "개별 행" 단위 쿼리가 아니라 depth-5 상한이 있어 실질적 N+1 아님
  - 위치: `folders.service.ts` `collectSubtree()` (약 라인 88-107, diff 라인 700-724)
  - 상세: 흔한 N+1 은 "행(row) 개수" 에 비례해 쿼리가 느는 패턴이다. 여기서는 `while (frontier.length > 0 && height <= MAX_NESTING_DEPTH)` 로 **트리 레벨(level)** 당 1회 `folderRepository.find()` 를 호출하고, 각 레벨의 `frontier` 전체(해당 레벨의 모든 부모 id)를 `where: frontier.map((pid) => ({ parentId: pid, workspaceId }))` 로 한 번에 조회한다. 즉 형제(sibling) 개수와 무관하게 쿼리 수는 레벨 수(≤ `MAX_NESTING_DEPTH + 1` = 6)에만 비례한다. `MAX_NESTING_DEPTH = 5` 로 상수 고정되어 있어 반복 상한이 낮고 확정적이므로, 고전적 N+1(반복 행마다 쿼리)로 분류하기는 어렵다. 다만 "쿼리 1회로 전체 서브트리를 못 가져오고 레벨 수만큼(최대 6회) 왕복"한다는 점에서 완전한 단일 쿼리 대비 오버헤드는 존재.
  - 제안: 현재 규모(깊이 상한 5, `update()` 호출 시에만 실행)에서는 성능 이슈로 보기 어려워 별도 조치 불요. 만약 향후 `MAX_NESTING_DEPTH` 를 크게 올리거나 폴더 트리가 매우 넓어지는(각 레벨 자식이 수천 개) 시나리오가 생기면 재귀 CTE(`WITH RECURSIVE`) 로 서브트리 전체를 단일 쿼리로 가져오는 전환을 고려.

- **[INFO]** `getDepth()` / `validateParentChange()` 도 동일하게 "레벨당 1쿼리" 패턴이며 depth 상한(`MAX_NESTING_DEPTH + 1` = 6회)으로 bound
  - 위치: `folders.service.ts` `getDepth()` (라인 74-91, diff 라인 631-648), `validateParentChange()` 내 `getDepth(newParentId, workspaceId)` 호출 (라인 871)
  - 상세: `getDepth()` 는 `while (currentId)` 루프에서 조상(ancestor) 체인을 한 단계씩 `findOne()` 으로 거슬러 올라간다. 이번 diff 에서 추가된 `visited` Set + `depth > MAX_NESTING_DEPTH + 1` 가드 덕분에, 정상 데이터든 순환(cycle) 손상 데이터든 최대 6회 `findOne()` 호출로 종료가 보장된다. `update()` 경로 한 번당 실질 쿼리 수는: `findById`(1) + `validateParentChange` 내부 `findOne`(parent, 1) + `collectSubtree`(최대 6) + `getDepth`(최대 6) + 최종 `save`(1) = 최대 약 15회. 이는 API 트래픽 특성(폴더 재배치는 저빈도 관리 작업)과 depth-5 라는 명확한 상한을 감안하면 허용 가능한 수준이다. "반복문 내 쿼리" 이지만 반복 횟수가 사용자 입력이 아닌 고정 상수(`MAX_NESTING_DEPTH`)로 bound 되어 있어, 대량 데이터에 따라 무한정 늘어나는 전형적 N+1 위험 패턴과는 구별된다.
  - 제안: 현재 스코프에서 조치 불요. 다만 `getDepth()` 가 `create()` 경로와 `validateParentChange()` 경로 양쪽에서 동일 알고리즘(레벨당 1쿼리)으로 중복 호출되므로, 만약 향후 폴더 API 트래픽이 늘어나면 단일 재귀 쿼리(`WITH RECURSIVE parent_chain AS (...)`) 로 depth 계산을 1회 왕복으로 축소하는 것을 성능 백로그로 남길 만하다. 지금은 우선순위 낮음(INFO).

- **[INFO]** 트랜잭션 미사용 — `validateParentChange()` 의 읽기(조회)와 `update()` 최종 `save()` 사이에 트랜잭션 경계 없음
  - 위치: `folders.service.ts` `update()` (라인 55-68), `validateParentChange()` (라인 105-152)
  - 상세: `update()` 는 (1) `findById` 로 folder 조회 → (2) `validateParentChange` 로 parent/서브트리/깊이 검증(다수의 읽기 쿼리) → (3) `Object.assign` + `save()` 로 커밋, 이 전체가 단일 DB 트랜잭션으로 묶여 있지 않다. 검증과 저장 사이에 동시성 있는 다른 요청이 같은 서브트리를 변경(예: 동시에 다른 폴더를 같은 subtree 아래로 옮기거나 삭제)하면 검증 시점 이후 상태가 바뀌어 깊이/cycle 불변식이 저장 시점에는 깨져 있을 수 있는 TOCTOU(check-then-act) 여지가 이론적으로 존재한다.
  - 제안: 폴더 재배치는 저빈도 관리자 작업이고, 최악의 경우도 "깊이 5 초과" 라는 소프트 제약(데이터 무결성 파괴가 아닌 정책 제약) 위반에 그쳐 CRITICAL 급 리스크는 아니다. 엄격성이 필요하면 `validateParentChange` + `save()` 를 `queryRunner` 트랜잭션(`SERIALIZABLE` 또는 대상 행 `SELECT ... FOR UPDATE`)으로 감싸는 것을 고려할 수 있으나, 이번 PR 스코프(depth/cycle 가드 추가)를 넘어서는 별도 개선 트랙으로 분리 권장.

- **[INFO]** 인덱스는 기존 스키마로 충분히 커버 — 이번 diff 에 신규 마이그레이션 없음
  - 위치: `codebase/backend/migrations/V002__indexes.sql:39` `CREATE INDEX idx_folder_workspace_parent ON folder (workspace_id, parent_id)`
  - 상세: `collectSubtree()` 의 `find({ where: frontier.map((pid) => ({ parentId: pid, workspaceId })) })` 와 `getDepth()`/`validateParentChange()` 의 `findOne({ where: { id, workspaceId } })` 모두 `(workspace_id, parent_id)` 복합 인덱스 또는 PK(`id`) 로 커버된다. 이번 코드 변경은 스키마·마이그레이션을 건드리지 않으므로 무중단 배포 리스크(락, 데이터 손실)도 해당 없음.
  - 제안: 조치 불요.

- **[INFO]** SQL 인젝션 벡터 없음
  - 위치: 전체 diff
  - 상세: 모든 쿼리가 TypeORM `Repository.find`/`findOne` 의 객체 기반 `where` 조건만 사용하며 raw SQL 문자열 조합이 없다. 사용자 입력(`newParentId`, `id`, `workspaceId`)은 파라미터 바인딩되어 전달된다.
  - 제안: 조치 불요.

## 요약

이번 변경은 `FoldersService.update()` 에 부모 변경(reparenting) 시 depth/cycle/workspace 무결성 검증을 추가하고, `getDepth()` 에 visited-set + 상한 가드를 더해 순환 데이터에서의 무한루프를 방지하는 코드로, 신규 마이그레이션이나 raw SQL 은 없다. `collectSubtree()`/`getDepth()` 모두 반복문 안에서 쿼리를 실행하지만, 반복 횟수가 `MAX_NESTING_DEPTH=5` 상수로 확정적으로 bound 되어 있고(각각 최대 약 6회 왕복) 각 트리 레벨을 배치 조회(`frontier` 전체를 한 쿼리로)하므로, 행 개수에 비례해 쿼리가 폭증하는 전형적 N+1 패턴은 아니다. 기존 `idx_folder_workspace_parent(workspace_id, parent_id)` 인덱스가 신규 쿼리 패턴을 정확히 커버하며, 트랜잭션 부재로 인한 이론적 TOCTOU 여지는 있으나 저빈도 관리 작업·소프트 제약 위반 수준이라 우선순위는 낮다. 전반적으로 DB 관점에서 심각한 리스크는 없다.

## 위험도

LOW
