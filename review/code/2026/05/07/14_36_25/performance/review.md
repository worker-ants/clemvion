## 발견사항

- **[INFO]** `lookupMcpServers` 에서 DB 쿼리와 slice 상한이 중복 적용됨
  - 위치: `candidate-lookup.service.ts` — `lookupMcpServers` (및 기존 `lookupIntegrations`, `lookupKnowledgeBases`)
  - 상세: `query.limit = MAX_CANDIDATES(20)` 으로 DB 조회를 이미 제한했음에도 `result.data.slice(0, MAX_CANDIDATES)` 를 한 번 더 수행. 기존 패턴을 그대로 답습한 것이지만 slice 호출 자체가 새 배열을 할당하므로 불필요한 메모리 할당이 발생.
  - 제안: 서비스 레이어가 limit 보장을 책임지고 있다면 slice 를 제거. 만약 서비스가 limit 를 무시할 가능성이 있다면 주석으로 의도를 명시해 혼란을 줄임.

- **[INFO]** `selectedIds.includes(id)` 가 체크박스 렌더 루프 안에서 O(n) 탐색 반복
  - 위치: `candidate-picker.tsx` — multi-select 분기의 `candidates.map(...)` 내 `checked={selectedIds.includes(c.id)}`
  - 상세: 최대 20개 후보 × 최대 20개 선택 = 400회 비교이므로 실 사용 시에는 무시 가능. 그러나 후보 상한이 완화될 경우 O(n²) 로 열화됨. `selectedIds`를 `Set<string>` 으로 관리하면 `has()` 가 O(1).
  - 제안: `const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);` 로 캐싱 후 `checked={selectedSet.has(c.id)}` 사용.

- **[INFO]** `onSubmitMulti` 내 candidates 배열 이중 순회
  - 위치: `candidate-picker.tsx` — `onSubmitMulti` 의 `candidates.map(...).filter(...)`
  - 상세: `map` + `filter` 두 번 순회하는 대신 `filter` 하나로 합칠 수 있음. 역시 20개 상한으로 실 영향 없음.
  - 제안: `candidates.filter(c => selectedIds.includes(c.id)).map(c => c.id)` 또는 위의 Set 방식과 결합.

- **[INFO]** `confirmed` 상태의 `selectedLabel` 계산 — multi 모드에서 O(n×m) 탐색
  - 위치: `candidate-picker.tsx` — confirmed 분기 내 `ids.map((id) => candidates.find(...))`
  - 상세: 선택된 id 수 × candidates 수만큼 find 가 돌지만 상한(20×20=400)으로 무해. 이 컴포넌트가 대량 후보를 받는 방향으로 바뀔 경우 `Map<id, label>` 캐시가 필요해짐.
  - 제안: 현재는 변경 불필요. 후보 상한 정책이 바뀐다면 `candidateMap = useMemo(() => new Map(candidates.map(c => [c.id, c.label])), [candidates])` 로 전환.

---

### 요약

이번 변경은 MCP 서버 선택기 추가와 multi-select UI 구현이 핵심이며, 성능 구조 자체는 건전하다. `fillCandidates` 는 `Promise.all` 로 lookup 을 병렬화하고, 화이트리스트 조회는 `ReadonlySet` 으로 O(1) 이며, 모든 DB 조회는 `limit: 20` 으로 상한이 걸려 있다. 지적된 이슈들은 모두 상한 20개라는 경계 조건 안에서 실질적 영향이 없으며, 기존 코드에서 답습된 `slice` 중복과 프론트엔드 렌더 루프의 선형 탐색 패턴이 약간의 코드 냄새로 남아 있는 수준이다.

### 위험도

**LOW**