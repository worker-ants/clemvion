## 발견사항

### 파일 2: `mcp-server-selector.tsx`

**[WARNING]** 매 렌더마다 인라인 그룹 배열 + 이중 `filter()` 실행
- 위치: `mcp-server-selector.tsx` +187–+226 (새 JSX 블록)
- 상세: JSX 안에서 `([{ key: "mcp", items: available.filter(...) }, { key: "cafe24", items: available.filter(...) }] as const).map(...)` 형태로 작성되어, 렌더마다 외부 배열 객체 1개 + `filter()` 2회가 실행된다. `available`이 `MCP_LIST_LIMIT`(제한된 크기)로 캐핑되어 있으므로 지금은 체감 비용이 낮지만, 부모 컴포넌트 리렌더가 잦을 경우(예: 사용자가 피커를 열어둔 채 다른 조작) 불필요한 반복 비용이 누적된다.
- 제안:
```tsx
const grouped = useMemo(() => [
  { key: "mcp", heading: "🌐 Generic MCP (HTTP) servers",
    items: available.filter((i) => i.serviceType === "mcp") },
  { key: "cafe24", heading: "🛒 Cafe24 stores (Internal Bridge)",
    items: available.filter((i) => i.serviceType === "cafe24") },
], [available]);
// JSX: grouped.map(group => ...)
```

---

**[INFO]** `queryKey` 변경으로 인한 강제 캐시 미스 (배포 직후 일회성)
- 위치: `mcp-server-selector.tsx` +64 — `["integrations", "mcp"]` → `["integrations", "mcp-capable"]`
- 상세: 배포 순간 기존 브라우저 캐시가 무효화되어 AI Agent 편집 패널을 열 때 강제 재요청이 발생한다. `staleTime: 30_000` 이 설정되어 있어 이후에는 정상적으로 캐싱된다. 일회성 비용이므로 실질적 위험은 낮다.
- 제안: 해당 없음.

---

### 파일 6: `mcp-capable-service-types.ts`

**[INFO]** 모듈 상수 올바르게 정의됨 — 성능 문제 없음
- 위치: `mcp-capable-service-types.ts:9`
- 상세: `MCP_CAPABLE_SERVICE_TYPES = ["mcp", "cafe24"] as const` 를 모듈 최상위에 선언하여 `integrationsApi.list()` 호출마다 새 배열 리터럴을 생성하던 문제(기존 인라인 `["mcp"]`)를 해소했다. 기존 `performance/review.md` I2 항목의 권장사항이 반영된 구조다.

---

### 파일 1: `override-registry.ts`

**[INFO]** 모듈 레벨 레지스트리 오브젝트에 키 추가 — 성능 영향 없음
- 위치: `override-registry.ts:77`
- 상세: `OVERRIDE_REGISTRY`는 모듈 초기화 시 단 1회 평가되는 정적 객체 리터럴이다. `cafe24: Cafe24Config` 추가는 O(1) 조회 비용 그대로이며 런타임 성능에 영향 없다.

---

### 파일 3–4: MDX 문서, 파일 5: `integrations.ts` 타입 확장

**[INFO]** 성능 관련 사항 없음
- 타입 전용 선언 / 정적 문서로 런타임 비용 없음.

---

## 참고: 기존 리뷰에서 식별된 백엔드 성능 이슈 (diff 미포함 파일)

이번 diff에 포함되지 않았지만 `review/2026-05-14_01-29-47/performance/review.md` 에서 지적된 항목 중 **`RESOLUTION.md`에서 follow-up으로 분류된 항목**을 재확인:

| 항목 | 상태 |
|---|---|
| `listAllCafe24Operations()` 매 호출마다 재할당 (INFO I1) | follow-up |
| `findCafe24Operation()` 선형 탐색 O(M) → Map으로 O(1) (INFO I2) | follow-up |
| `integrationLocks` Map unbounded → `.finally()` 정리 (CRITICAL C5) | **이미 적용됨** (false positive로 분류, `tracked.finally()` 내 delete 존재) |
| `Cafe24Config.fields` 타입 불일치 → 런타임 TypeError (WARNING W2) | **이미 수정됨** (`normalizeCafe24Fields()` 추가) |
| 429 retry thundering herd → jitter 추가 (WARNING W3) | **이미 수정됨** |

---

## 요약

이번 diff 범위(프론트엔드 레지스트리 등록, MCP 서버 셀렉터 리팩토링, 상수 파일 분리, 문서)에서 성능 위험은 낮다. 가장 주목할 지점은 `mcp-server-selector.tsx`의 그룹 렌더링 로직으로, 매 렌더마다 이중 `filter()`와 인라인 배열 생성이 발생하지만 `MCP_LIST_LIMIT`으로 데이터 크기가 제한되어 있어 실용적 영향은 미미하다. `useMemo`로 한 줄 개선 가능하다. 백엔드의 주요 성능 이슈(`listAllCafe24Operations` lazy-init, `findCafe24Operation` Map 인덱싱)는 이미 RESOLUTION에서 follow-up으로 분리되어 추적 중이다.

## 위험도

**LOW**