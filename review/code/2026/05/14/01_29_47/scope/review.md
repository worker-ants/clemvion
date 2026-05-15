## 발견사항

### [INFO] `mcp-server-selector.tsx` — 쿼리 캐시 키 변경

- **위치**: `mcp-server-selector.tsx` L64, `queryKey: ["integrations", "mcp"]` → `["integrations", "mcp-capable"]`
- **상세**: 캐시 키 변경은 기존 `["integrations", "mcp"]` 키로 캐시 무효화를 수행하는 코드(다른 컴포넌트나 mutation 등)가 있을 경우 해당 무효화가 더 이상 적용되지 않습니다. 이는 순수하게 cafe24를 필터에 추가하는 것과 별개의 동작 변경입니다.
- **제안**: 기존 키를 유지하거나, 키 변경 전 `["integrations", "mcp"]`를 참조하는 `invalidateQueries` 호출 전체를 점검할 것.

---

### [INFO] `mcp-server-selector.tsx` — 그룹 헤더 이모지 추가 (범위 초과 UI 변경)

- **위치**: `mcp-server-selector.tsx` L186–L220, 그룹 헤더 `"🌐 Generic MCP (HTTP) servers"`, `"🛒 Cafe24 stores (Internal Bridge)"`
- **상세**: cafe24를 필터에 포함시키는 기능 요건을 충족하면서도, 픽커 UI를 그룹핑 레이아웃으로 전면 재구성했습니다. 이는 요청된 기능(cafe24 항목을 리스트에 추가)을 넘어서는 UI 리팩토링입니다. 프로덕션에서 이모지 헤더가 디자인 가이드라인에 부합하는지도 확인이 필요합니다.
- **제안**: 기능 요건만 충족한다면 기존 단일 리스트 구조를 유지하면서 serviceType 필터만 확장하는 최소한의 변경이 더 적절합니다.

---

### [INFO] `candidate-lookup.service.ts` — `sublabel` 필드 추가로 인한 인터페이스 확장

- **위치**: `candidate-lookup.service.ts` L177, `sublabel: i.serviceType`
- **상세**: `CandidateEntry` 반환 객체에 `sublabel` 필드가 추가되었습니다. 이 필드가 `CandidateEntry` 타입 정의에 포함되었는지, 그리고 이 데이터를 소비하는 다른 컨슈머(프론트엔드 워크플로우 어시스턴트 등)가 예상치 못한 필드를 받는지 확인이 필요합니다. MCP 서버 선택기 그룹핑을 위한 변경으로 보이며, 이는 `mcp-server-selector.tsx`의 UI 변경과 결합되어 있습니다.
- **제안**: 범위 문제라기보다는 타입 정합성 확인 사항으로, `CandidateEntry` 인터페이스에 `sublabel?: string`이 명시적으로 선언되어 있는지 확인할 것.

---

### [INFO] `integration.dto.ts` — `mallId` 패턴 유효성 검사 미적용

- **위치**: `integration.dto.ts` L244–L253, `mallId` 필드
- **상세**: `mallId`에 대해 `@MaxLength(50)`만 적용하고, 코드 주석(`/^[a-z0-9-]{3,50}$/`)에 언급된 정규식 유효성 검사는 DTO 레이어에서 `@Matches()` 데코레이터로 강제되지 않습니다. 서비스 계층에서 검사하더라도 DTO 레이어 방어가 없습니다. 범위 이탈은 아니지만 불일치입니다.
- **제안**: `@Matches(/^[a-z0-9-]{3,50}$/)` 데코레이터를 `mallId`에 추가하거나, 주석의 패턴을 제거하여 혼동을 방지.

---

## 요약

전체 50개 파일의 변경사항은 **Cafe24 통합 구현**이라는 목적에 일관되게 집중되어 있습니다. DB 마이그레이션, 엔티티, DTO, OAuth 서비스, 서비스 레지스트리, API 클라이언트, 노드 핸들러, AI 에이전트 MCP 브릿지, 프론트엔드 UI까지 전 계층이 일관된 목적 하에 수정되었습니다. 범위를 벗어난 주요 변경은 `mcp-server-selector.tsx`의 그룹 헤더 UI 재설계(이모지 포함)와 쿼리 캐시 키 변경으로, 기능 요건 이상의 수정입니다. 나머지는 정상 범위 내의 변경입니다.

## 위험도

**LOW**