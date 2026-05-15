## 발견사항

---

### [WARNING] `mcp-server-selector.tsx` — UI 그룹 정의가 `MCP_CAPABLE_SERVICE_TYPES`와 비동기화

- **위치**: `mcp-server-selector.tsx:187-220` (그룹 정의 인라인 배열)
- **상세**: `MCP_CAPABLE_SERVICE_TYPES`는 쿼리 필터의 단일 진실 소스로 도입되었으나, UI 그룹핑은 `[{ key: "mcp", ... }, { key: "cafe24", ... }]`로 하드코딩되어 있다. 새로운 서비스 타입(예: `shopify`)이 `MCP_CAPABLE_SERVICE_TYPES`에 추가되면 API 응답에는 포함되지만 어떤 그룹에도 속하지 않아 **UI에서 완전히 누락**된다. 상수를 도입한 목적(단일 진실 소스)이 UI 레이어에서 달성되지 않는다.
- **제안**: 그룹 정의를 `MCP_CAPABLE_SERVICE_TYPES` 기반으로 동적으로 구성하거나, 최소한 서비스 타입→그룹 레이블 매핑을 별도 상수(`GROUP_CONFIG`)로 분리하여 `MCP_CAPABLE_SERVICE_TYPES`와 함께 갱신되도록 강제한다.

---

### [WARNING] `cafe24.en.mdx` — 한국어 버전 대비 중요 섹션 누락

- **위치**: `cafe24.en.mdx` 전체 vs `cafe24.mdx`
- **상세**: 한국어 문서에는 영어 문서에 없는 두 섹션이 존재한다.
  1. **"OAuth scope 권장 프리셋"** — Product/Order/Customer 등 8개 카테고리의 권장 scope 값 테이블. `mall.read_product`, `mall.write_order` 등 구체적인 scope 이름을 알아야 하는 운영 정보로 필수적이다.
  2. **"자주 묻는 질문"** — `OAUTH_CONFIG_MISSING`, `CAFE24_MCP_NO_SESSION` 에러 대응, mall_id 오입력 복구, rate limiting 대응 등 4가지 실제 운영 시나리오 가이드.

  영어 사용자는 통합 설정 중 오류 상황에서 한국어 문서에만 존재하는 트러블슈팅 정보에 접근할 수 없다.
- **제안**: 두 섹션을 `cafe24.en.mdx`에 추가한다. 특히 FAQ의 에러 코드는 언어와 무관한 기술 정보이므로 반드시 포함되어야 한다.

---

### [INFO] `mcp-capable-service-types.ts` — 동기화 강제 수단 없음

- **위치**: `frontend/src/lib/integrations/mcp-capable-service-types.ts`
- **상세**: 파일 내 주석이 "백엔드 twin과 함께 수정"을 명시하고 있으나, 이를 컴파일 타임 또는 테스트로 강제하는 수단이 없다. 백엔드에 새 타입이 추가되고 프론트엔드가 누락되어도 조용히 통과된다. 주석 자체가 동기화 실패 리스크를 인정하고 있다.
- **제안**: 단기적으로 `// TODO: sync-check` E2E 테스트 추가를 plan에 포함시킨다. 장기적으로는 주석이 제안하는 `/api/integrations/services` API 노출이 근본 해결책이다.

---

### [INFO] `mcp-server-selector.tsx` — 그룹 헤딩 i18n 미적용

- **위치**: `mcp-server-selector.tsx:196, 201`
- **상세**: `"🌐 Generic MCP (HTTP) servers"`, `"🛒 Cafe24 stores (Internal Bridge)"` 문자열이 영어로 하드코딩되어 있다. 한국어 문서(`cafe24.mdx`)는 동일한 문자열이 UI에 그대로 노출되는 것을 전제하고 설명하고 있어, 다국어 지원이 추가될 경우 문서와 UI 모두 수정이 필요하다.
- **제안**: 다른 UI 텍스트의 i18n 처리 방식(예: `useT()` 훅)을 따르거나, 최소한 모듈 상단에 `const GROUP_LABELS` 상수로 추출한다.

---

## 요약

요구사항 관점에서 이번 변경은 전반적으로 Cafe24 통합을 프론트엔드 레이어에 올바르게 연결하고 있다. `override-registry.ts`의 Cafe24 노드 등록, `integrations.ts`의 API 파라미터 확장, `mcp-capable-service-types.ts`의 상수화 모두 의도와 구현이 일치한다. 그러나 두 가지 실질적 요구사항 공백이 있다: `MCP_CAPABLE_SERVICE_TYPES`를 단일 진실 소스로 도입했음에도 UI 그룹핑이 하드코딩되어 미래 확장성 요구사항을 충족하지 못하며, 영어 문서가 한국어 문서 대비 OAuth scope 프리셋과 트러블슈팅 FAQ를 누락하여 제품 사용성 요구사항에 미달한다.

## 위험도

**LOW** — 현재 기능(mcp + cafe24 두 타입)은 정상 동작하며 즉각적 결함은 없다. 그러나 확장 시나리오에서 UI 누락과 영어 사용자 지원 공백이 발현된다.