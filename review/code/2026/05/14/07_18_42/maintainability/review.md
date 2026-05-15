### 발견사항

---

**[WARNING] `mcp-server-selector.tsx:187-226` — 그룹 설정 객체가 JSX 렌더 경로에 인라인**
- 위치: `mcp-server-selector.tsx` +187-211
- 상세: `[{ key: "mcp", heading: "...", items: available.filter(...) }, { key: "cafe24", heading: "...", items: available.filter(...) }] as const` 구조가 렌더 함수 내부에 직접 작성되어 있다. 그룹 목록이 늘어날 때마다 렌더 블록을 찾아 수정해야 하고, 헤딩 문자열도 함께 묻혀 있어 찾기 어렵다. 컴포넌트 상단 또는 모듈 레벨에 `const MCP_SERVER_GROUPS` 상수로 추출하면 렌더 로직과 그룹 설정이 분리된다.
- 제안:
  ```tsx
  const MCP_SERVER_GROUPS = [
    { key: "mcp",    heading: "Generic MCP (HTTP) servers",       serviceType: "mcp" },
    { key: "cafe24", heading: "Cafe24 stores (Internal Bridge)", serviceType: "cafe24" },
  ] as const;
  ```
  렌더에서는 `MCP_SERVER_GROUPS.map(group => ...)` 로 교체. 새 Internal Bridge 추가 시 이 상수만 수정하면 된다.

---

**[WARNING] `mcp-server-selector.tsx:194,199` — 그룹 헤딩이 `serviceType` 문자열과 따로 움직임**
- 위치: `mcp-server-selector.tsx` 그룹 헤딩 정의 + filter 조건
- 상세: `items: available.filter(i => i.serviceType === "mcp")` 와 `items: available.filter(i => i.serviceType === "cafe24")` 가 `MCP_CAPABLE_SERVICE_TYPES` 상수(`"mcp" | "cafe24"`)를 import 해두고도 그것을 사용하지 않는다. `serviceType` 문자열이 세 곳(상수 정의·filter·heading key)에 분산된다.
- 제안: 위 `MCP_SERVER_GROUPS` 상수에 `serviceType` 필드를 포함시켜, filter 조건을 `available.filter(i => i.serviceType === group.serviceType)` 로 단일화한다.

---

**[WARNING] `mcp-capable-service-types.ts:1-8` — 파일 크기 대비 주석 비율이 지나치게 높음**
- 위치: `mcp-capable-service-types.ts` 전체
- 상세: 실행 코드는 2줄인데 JSDoc은 7줄이다. "Both lists must move together"는 절차적 주의사항으로, 인라인 주석보다는 `CLAUDE.md`나 plan 트래킹이 더 적절한 위치다. 특히 "A future follow-up could expose this list via `/api/integrations/services` and drop the duplication"은 TODO 성격의 문장으로, 코드에 박아두면 날짜가 지날수록 신뢰도가 떨어진다.
- 제안: JSDoc을 1-2줄 요약으로 줄이고("Frontend mirror of backend twin — both must be updated together when a new service type is added."), follow-up 노트는 별도 plan 항목으로 이동한다.

---

**[WARNING] `integrations.ts:171-178` — 파라미터 객체 내 6줄 인라인 주석**
- 위치: `integrations.ts` `oauthBegin` 파라미터 타입 블록
- 상세: 파라미터 타입 정의 안에 구현 상세("backend ignores them for other services", "mall_id is part of the base URL", "Public apps read client_id/secret from server env")를 설명하는 주석이 6줄 포함되어 있다. 타입 시그니처는 **무엇**을 받는지만 기술하면 되고, 백엔드가 어떻게 처리하는지는 서비스 레이어 또는 spec 문서의 몫이다.
- 제안: 주석을 제거하거나 각 필드 위 1줄 요약으로 압축한다. `spec/2-navigation/4-integration.md §10.3` 링크 하나로 대체 가능하다.

---

**[INFO] `mcp-server-selector.tsx:62-68` — 6줄 인라인 블록 주석**
- 위치: `mcp-server-selector.tsx` `useQuery` 바로 위
- 상세: spec 섹션 두 개를 열거하는 6줄 주석이다. 이 컴포넌트가 `cafe24` serviceType을 포함시키는 이유가 명확하지 않은 독자에게는 유용하지만, 길이가 다소 과하다. "Both `mcp` and `cafe24` expose tools via the same `mcp_<sid>__` scheme — see spec §2.3 + §14.2" 처럼 1줄로 축약해도 충분히 맥락이 전달된다.
- 제안: 2줄 이내로 축약.

---

**[INFO] `cafe24.mdx` vs `cafe24.en.mdx` — 내용 비대칭**
- 위치: `cafe24.mdx`(Korean) / `cafe24.en.mdx`(English)
- 상세: 한국어 문서에는 "OAuth scope 권장 프리셋" 표와 "자주 묻는 질문" 섹션(4개 Q&A)이 있으나 영문 문서에는 없다. 두 파일을 독립 관리하면 한쪽을 수정할 때 다른 쪽 동기화를 빠뜨리기 쉽다. 실제로 Q&A는 한국어 사용자에게만 유용한 내용이 아니라 공통 내용이다.
- 제안: 영문 문서에도 동일 섹션을 추가하거나, 두 문서 상단에 "See Korean version for FAQ" 와 같은 참조 링크를 두어 비대칭을 의도적으로 명시한다.

---

**[INFO] `override-registry.ts` — 변경 자체는 깔끔함**
- 위치: `override-registry.ts` 전체
- 상세: 기존 패턴(`http_request`, `database_query`, `send_email`)을 그대로 따르고 있어 일관성 문제 없음.

---

### 요약

이번 변경에서 유지보수성의 핵심 리스크는 `mcp-server-selector.tsx`에 집중된다. 그룹 설정 객체가 렌더 경로에 인라인되어 있고, `serviceType` 문자열이 상수 선언·filter 조건·heading key 세 곳으로 분산되어 있다. 다음 Internal Bridge(`shopify` 등)가 추가될 때 수정 지점이 모호해지는 구조다. 나머지 파일(`mcp-capable-service-types.ts`, `integrations.ts`)은 기능은 정확하지만 코드 대비 주석 비율이 높아 실제 로직을 찾기 어렵다는 점이 보완될 여지가 있다. 전체적으로는 기능 범위에 맞는 최소한의 변경이 이루어졌고, 심각한 유지보수성 결함은 없다.

### 위험도
**LOW**