## 발견사항

### **[WARNING]** 마이그레이션 스크립트 — 트랜잭션 내 N+1 UPDATE
- **위치**: `migrate-button-ids.ts:225-233`
- **상세**: `pendingUpdates` 배열을 순회하며 노드마다 별도의 `UPDATE node SET config = $1 WHERE id = $2`를 실행. 워크플로 노드가 수천 개인 프로덕션 환경에서 N번의 DB 라운드트립이 단일 트랜잭션 내에 발생한다. 일회성 스크립트이므로 치명적이지는 않지만 대용량 데이터에서 타임아웃 위험이 있다.
- **제안**: `unnest`를 사용한 단일 배치 업데이트로 교체.
  ```sql
  UPDATE node SET config = v.config
  FROM unnest($1::uuid[], $2::jsonb[]) AS v(id, config)
  WHERE node.id = v.id
  ```

### **[INFO]** 마이그레이션 스크립트 — 전체 데이터 메모리 일괄 적재
- **위치**: `migrate-button-ids.ts:195-213`
- **상세**: 버튼 타입 노드 전체를 `rows` 배열에 한 번에 적재. 노드가 수만 개이고 `config` 컬럼이 크다면 프로세스 메모리를 과도하게 사용한다.
- **제안**: 일회성 마이그레이션이므로 현재 구조는 대부분의 환경에서 무방하나, 대용량이 예상되면 `LIMIT/OFFSET` 또는 서버사이드 커서(PostgreSQL `DECLARE CURSOR`)로 청크 처리 고려.

### **[INFO]** `uniqueSlug` — 동일 label 다수 시 O(n²) 충돌 탐색
- **위치**: `button-slug.util.ts:37-42`
- **상세**: N개의 버튼이 모두 동일한 label을 가질 때, 각 호출의 `while` 루프가 1, 2, …, N-1회 반복되어 총 O(N²) 비교가 발생. 현실적 상한(버튼 ≤ 수십 개)에서는 무시 가능하나 이론적 worst case로 존재.
- **제안**: 현 구현 유지(버튼 수 상한 덕분에 실용적 영향 없음). 필요 시 `base → 최대 카운터` 맵을 `normalizeButtonsArray` 외부에서 관리해 O(1)로 낮출 수 있다.

### **[INFO]** `shadow-workflow.ts` — `patch.config`에 버튼 필드가 없어도 `normalizeNodeButtonIds` 실행
- **위치**: `shadow-workflow.ts:549-556`
- **상세**: `update_node`에서 `patch.config`가 존재하면 병합 후 무조건 `normalizeNodeButtonIds`를 호출. `patch.config`가 `{ url: '...', method: 'GET' }` 같이 버튼과 무관한 필드만 수정해도 carousel 노드라면 buttons 배열 전체를 순회한다. 현재 per-call 비용은 O(버튼수)로 미미하지만 불필요한 순회.
- **제안**: `patch.config`에 `buttons`, `itemButtons`, `items` 키 중 하나라도 있을 때만 `normalizeNodeButtonIds` 호출하는 early guard 추가 가능. 단, 현재 부하 수준에서 실질 영향이 없으므로 선택적 최적화.

---

## 요약

성능 관점의 가장 실질적인 이슈는 `migrate-button-ids.ts`의 **N+1 UPDATE 패턴**으로, 대규모 데이터 환경에서 마이그레이션 실행 시간이 선형 이상으로 늘어날 수 있다. `button-slug.util.ts`와 `shadow-workflow.ts`의 핫패스 로직(`normalizeNodeButtonIds`, `labelToSlug`, `uniqueSlug`)은 모두 버튼 수에 선형 비례하며 모듈 수준 컴파일 정규식·lazy copy-on-write 패턴 등 적절한 최적화가 적용되어 있어 런타임 성능 우려는 낮다. 마이그레이션은 일회성 스크립트이므로 치명도는 높지 않으나, 배치 UPDATE로 교체하면 안전하게 대용량 운용이 가능하다.

## 위험도

**LOW** — 런타임 핫패스는 양호하며, 실질 위험은 일회성 마이그레이션 스크립트의 N+1 쿼리에 국한됨.