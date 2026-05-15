## 발견사항

### File 1: override-registry.ts

**[INFO]** `OVERRIDE_REGISTRY`에 `cafe24` 키 추가
- 위치: `override-registry.ts:77`
- 상세: 정적 Record에 새 항목 추가. 기존 키에 영향 없음. `Cafe24Config` import 경로가 `integration-configs`에 의존하므로 해당 파일 변경 시 tree-shaking 영향 가능하나 실질 위험 없음.
- 제안: 없음

---

### File 2: mcp-server-selector.tsx

**[WARNING]** React Query 캐시 키 변경 (`["integrations", "mcp"]` → `["integrations", "mcp-capable"]`)
- 위치: `mcp-server-selector.tsx:64`
- 상세: 키 변경으로 배포 시점에 기존 브라우저 캐시는 즉시 stale 처리되고 강제 재요청이 발생한다. 더 중요한 것은, 다른 코드 경로에서 `queryClient.invalidateQueries(["integrations", "mcp"])` 를 호출할 경우 이 컴포넌트의 캐시를 더 이상 무효화하지 못한다. RESOLUTION.md(Info-13)에서 grep 결과 다른 consumer가 없음을 확인했다고 명시하나, 향후 mutation 핸들러 추가 시 새 키로 invalidate해야 함을 놓치기 쉽다.
- 제안: 쿼리 키 근처에 주석으로 "캐시 무효화 시 `mcp-capable` 키 사용" 명시. 또는 상수로 분리: `const MCP_CAPABLE_QUERY_KEY = ["integrations", "mcp-capable"] as const`

**[INFO]** `[...MCP_CAPABLE_SERVICE_TYPES]` spread — `as const` 배열 변환
- 위치: `mcp-server-selector.tsx:68`
- 상세: `MCP_CAPABLE_SERVICE_TYPES`는 `readonly ["mcp", "cafe24"]` 타입이므로 API 함수가 mutable array를 요구할 경우 spread가 필요하다. 올바른 처리.
- 제안: 없음

**[INFO]** 그룹 렌더링 중 빈 그룹 `null` 반환
- 위치: `mcp-server-selector.tsx:196-227`
- 상세: `group.items.length === 0 ? null : (...)` 패턴은 React에서 안전하다. 양쪽 그룹이 모두 비어 있을 경우 "All available MCP servers are already attached" 조건(`available.length === 0`)이 먼저 분기되므로 빈 그룹 UI 문제 없음.
- 제안: 없음

---

### File 5: integrations.ts

**[INFO]** `oauthBegin` 파라미터 객체에 선택적 필드 4개 추가
- 위치: `integrations.ts:172-181`
- 상세: TypeScript 타입 전용 변경. 모든 필드가 `?` optional이므로 기존 호출자 코드는 수정 없이 동작. 런타임 동작 변화 없음.
- 제안: 없음

---

### File 6: mcp-capable-service-types.ts (신규)

**[WARNING]** 백엔드 상수의 프론트엔드 수동 미러 — 동기화 드리프트 위험
- 위치: `mcp-capable-service-types.ts:1-12` (파일 전체)
- 상세: 이 파일 자체는 순수 선언이므로 부작용이 없다. 그러나 새 Internal Bridge 서비스 타입(예: `'shopify'`)이 백엔드에 추가될 때 이 프론트엔드 미러를 함께 수정하지 않으면, `McpServerSelector`가 해당 타입의 통합을 API에서 조회조차 하지 않아 UI에서 완전히 누락된다 — 에러 없이 조용히 사라지는 silent omission 부작용이다.
- 제안: 파일 상단 주석에 "새 Internal Bridge 추가 시 반드시 이 파일과 백엔드 쌍 파일을 동시에 수정" 명시 (현재 주석에 이미 언급됨). 장기적으로는 `/api/integrations/services` 엔드포인트로 단일화.

---

### Files 3 & 4: cafe24.en.mdx, cafe24.mdx (신규)

부작용 없음. 신규 정적 문서 파일이며 기존 코드를 수정하지 않는다.

---

## 요약

변경된 코드 파일 6개 중 실질적 부작용 위험은 두 곳에 집중된다. `mcp-server-selector.tsx`의 React Query 캐시 키 변경(`"mcp"` → `"mcp-capable"`)은 기존 `invalidateQueries` 호출 호환성을 조용히 끊을 수 있으나, 현재 consumer가 해당 컴포넌트 하나뿐임이 grep으로 확인되어 즉각적 위험은 낮다. `mcp-capable-service-types.ts`의 프론트엔드 미러 패턴은 백엔드와의 동기화 드리프트 시 UI 누락이라는 silent side effect를 내포한다. 나머지 변경사항(`override-registry.ts`의 키 추가, `integrations.ts`의 선택적 타입 확장, 신규 문서 파일)은 모두 순수 추가(additive) 변경으로 기존 동작에 영향을 주지 않는다.

## 위험도

**LOW**