# 성능(Performance) 리뷰 — folder-depth-cycle-guard

대상: `codebase/backend/src/modules/folders/folders.service.ts` (`update` → `validateParentChange` → `collectSubtree()` / `getDepth()`), `folders.controller.ts` (Swagger 설명 변경만), `folders.service.spec.ts` (테스트 추가)

## 발견사항

- **[INFO]** `getDepth()` 는 요청당 최대 `MAX_NESTING_DEPTH + 2`(=7) 회의 순차 `findOne` 왕복
  - 위치: `folders.service.ts:81-102` (`getDepth`), 호출부 `folders.service.ts:141`
  - 상세: `parentId` 변경(PATCH, dormant path)에서만 실행되며, 루프는 `visited` 집합 + `depth > MAX_NESTING_DEPTH + 1` 가드로 상한이 걸려 있어 정상/손상 데이터 모두에서 유한하게 종료된다. 트리 깊이 상한이 5로 고정되어 있으므로 반복 횟수는 상수(≤7)이고 데이터 규모(N)에 의존하지 않는다. 순차 라운드트립이라 재귀 CTE(`WITH RECURSIVE`) 1회 쿼리 대비 네트워크 latency가 최대 7배 누적되지만, 절대 호출량이 상수이고 트래픽이 드문(dormant) PATCH 경로이므로 실질적 영향은 미미하다.
  - 제안: 현재 범위에서는 수정 불필요. 향후 폴더 계층 API 가 고빈도 경로가 되거나 `MAX_NESTING_DEPTH` 가 커질 가능성이 생기면 단일 재귀 쿼리로 대체하는 편이 낫다.

- **[INFO]** `collectSubtree()` 의 BFS 는 레벨당 1회 배치 쿼리로 N+1 을 피했으나, `where` 절 구성이 `frontier.map((pid) => ({ parentId: pid, workspaceId }))` — OR 조건 배열
  - 위치: `folders.service.ts:154-178`
  - 상세: 레벨(프론티어) 당 부모 ID 여러 개를 하나의 쿼리로 묶어 조회(`WHERE (parent_id = ? AND workspace_id = ?) OR (...)` 형태로 TypeORM 이 변환)하므로 반복문 내부에서 "행 단위" DB 호출을 하는 전형적 N+1 패턴은 아니다. 레벨 수도 `height <= MAX_NESTING_DEPTH` 로 상수 상한(최대 6회)이 걸려 있다. 다만 각 레벨에서 프론티어 크기(형제 폴더 수)만큼 OR 절이 늘어나므로, 한 레벨에 폴더가 매우 많으면(예: 수백 개) 쿼리 플랜상 `parent_id IN (...)` 형태보다 다소 비효율적일 수 있다 — 그러나 이는 폴더 트리 특성상 실무적으로 발생 가능성이 낮고, 현재 리뷰 대상인 PATCH 무결성 검증 로직 자체의 문제라기보다 기존 헬퍼의 구현 디테일이다.
  - 제안: 필요시 `parent_id IN (:...frontier) AND workspace_id = :workspaceId` 형태로 바꾸면 쿼리 플랜이 약간 더 명확해지지만, 현재 규모에서는 우선순위 낮음.

- **[INFO]** `validateParentChange` 는 `parentId` 실변경 시에만 `getDepth` + `collectSubtree` 총 최대 2회 추가 조회(각 내부적으로 여러 왕복 포함)를 수행
  - 위치: `folders.service.ts:69-71` (호출 가드), `109-148` (`validateParentChange` 본문)
  - 상세: `data.parentId !== undefined && data.parentId !== folder.parentId` 가드로 이름/정렬순서만 바꾸는 흔한 PATCH 케이스에서는 이 비용이 전혀 발생하지 않는다(테스트 `renames without parent change` / `allows moving to root` 에서 `mockRepository.find` 미호출로 확인됨). 즉 비용은 실제로 재부모화가 일어나는 드문 케이스에만 국한되며, 이는 이미 최소 침습적인 지연 실행(lazy) 설계다.
  - 제안: 없음 — 현재 구조가 바람직한 패턴.

- **[INFO]** 캐싱 미적용에 대한 평가
  - 위치: `getDepth`, `collectSubtree` 전체
  - 상세: depth/subtree 결과를 캐싱하지 않지만, 요청 스코프 내 1회성 계산이고 워크스페이스별 폴더 트리는 다른 요청에서 언제든 변할 수 있어(동시 PATCH) 캐시 무효화 비용이 이득보다 크다. 요청 빈도도 낮은(dormant) PATCH 경로이므로 캐싱 도입은 불필요한 복잡도만 추가한다.
  - 제안: 없음.

- **[INFO]** 메모리/자료구조
  - 위치: `collectSubtree` 의 `Set<string>` (ids), `getDepth` 의 `Set<string>` (visited)
  - 상세: 상한이 상수(≤6~7 항목)이므로 메모리 사용은 무시할 수준. `Set` 사용은 O(1) 조회로 중복 방지에 적합하며 용도에 맞는 자료구조다.
  - 제안: 없음.

## 요약

`collectSubtree()`/`getDepth()` 는 반복문 내부에서 DB 를 호출하는 구조이지만, 순회 상한이 `MAX_NESTING_DEPTH=5` 라는 상수로 명시적으로 고정되어 있어 데이터 규모와 무관하게 호출 횟수가 유한(최대 6~7회)하다. 또한 이 경로는 PATCH 의 `parentId` 실변경이라는 드문(dormant) 케이스에서만, 그것도 지연 평가로 실행되므로 트래픽 관점의 실질적 위험은 없다. `collectSubtree` 는 레벨당 배치 쿼리로 이미 N+1 을 피했고, `getDepth` 의 순차 라운드트립은 재귀 CTE 대비 다소 비효율적이나 상수 상한과 낮은 호출 빈도를 고려하면 현재 규모에서는 리팩터링을 요구할 수준이 아니다. cycle 가드(`visited` 집합 + 상한 break)가 정확·안전성 측면에서 우선이며 성능 저해 요소는 아니다.

## 위험도

NONE
