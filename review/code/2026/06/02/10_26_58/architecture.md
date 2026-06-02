# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] 공유 헬퍼 추출 — 올바른 DRY 적용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/lib/node-definitions/cafe24-extras.ts` (신설)
- 상세: `readCafe24Extras()`와 `resolveCafe24OperationLabel()`이 `integration-configs.tsx`의 비공개 함수에서 `@/lib/node-definitions/cafe24-extras`로 추출됨. 두 소비자(`integration-configs.tsx`, `cafe24-allowlist-editor.tsx`) 간 로직 drift를 방지하는 명확한 단일 진실 원칙 적용. 레이어 위치(`lib/node-definitions/`)도 적합하다 — 데이터 접근/변환 계층으로서 프레젠테이션 코드가 아님.
- 제안: 현행 유지.

---

### [INFO] `Cafe24AllowlistEditor` 컴포넌트 — 단일 책임 원칙 준수
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx`
- 상세: 이 컴포넌트는 Cafe24 MCP allowlist(`enabledTools`) 편집이라는 단일 책임만 갖는다. 데이터 fetch(`useQuery`) 없이 `readCafe24Extras()`로 이미 로드된 정의를 읽고, props(`enabledTools`, `onChange`)로만 외부와 통신한다. 부모(`McpServerSelector`)가 fetch, patch 책임을 가지며, `Cafe24AllowlistEditor`는 순수 편집 UI로 분리된다 — 레이어 책임 분리가 적절함.
- 제안: 현행 유지.

---

### [WARNING] `McpServerSelector`에 Cafe24 특화 렌더 로직 직접 삽입 — OCP 위반 잠재성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/mcp-server-selector.tsx` 226-265행 (diff 기준)
- 상세: `McpServerSelector`는 `serviceType === "cafe24"` 조건 분기로 Cafe24 전용 expandable 섹션을 직접 렌더링한다. 현재는 Cafe24 단일 특수 처리이지만, 향후 `serviceType === "shopify"` 등 다른 Integration 타입이 유사 advanced surface를 요구할 경우 `McpServerSelector` 내부에 `if/else serviceType` 분기가 누적되는 Open-Closed Principle 위반 경로가 열린다. `McpServerSelector`의 원래 책임(서버 picker + on/off + resource/prompt toggle)을 벗어나, Cafe24 allowlist 확장 UI 조건까지 알게 된다.
- 제안: 단기적으로 현행 수용 가능하나, 중기적으로 `renderAdvancedSection?: (ref: McpServerRef, integration: IntegrationDto) => ReactNode` 방식의 render prop 또는 provider 패턴으로 서비스 타입별 고급 UI를 외부에서 주입 가능하도록 리팩터링을 검토한다. `McpServerSelector`가 serviceType 명칭을 알 필요가 없어진다.

---

### [WARNING] `Cafe24AllowlistEditor` 내 비즈니스 로직과 렌더링 혼재 — 추출 여지
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` 53-78행 (`commit`, `toggleOp`, `setCategory`, `base`)
- 상세: `default_true materialize` 의미론(`enabledTools === undefined` → 전체 id materialize 후 토글, 전체 일치 시 `undefined`로 환원)은 순수 비즈니스 로직이다. 현재 컴포넌트 함수 본문 안에 인라인으로 정의되어 있어 단위 테스트가 컴포넌트 렌더링을 통해서만 가능하다. 테스트 파일이 실제로 `fireEvent.click`을 통해 우회적으로 검증한다.
- 제안: `materializeAllowlist(current: string[] | undefined, allIds: string[], toggle: { id?: string; category?: string[]; on?: boolean }): string[] | undefined` 형태의 순수 함수로 추출하면 컴포넌트와 독립적인 단위 테스트가 가능하고, 동일 로직을 향후 keyboard shortcut이나 bulk operation에서 재사용하기 쉬워진다. 현재 규모에서는 minor.

---

### [INFO] `onChange` 타입 서명의 의미론적 비일관성
- 위치: `cafe24-allowlist-editor.tsx` Props 인터페이스 (`onChange: (enabledTools: string[]) => void`) 및 `commit` 함수 내 `onChange(sameAsAll ? (undefined as unknown as string[]) : next)`
- 상세: `Props.onChange` 타입은 `(enabledTools: string[]) => void`로 선언되어 있으나, 내부 `commit`은 `sameAsAll` 조건 시 `undefined as unknown as string[]`로 강제 캐스팅해 `undefined`를 전달한다. 이 타입 강제는 인터페이스 계약을 런타임에서 실질적으로 위반하며, 호출자(`McpServerSelector`의 `patch` 함수)가 실제로 `string[] | undefined`를 처리해야 함에도 타입 시스템이 이를 표명하지 않는다. 인터페이스 분리 측면에서 `onChange` 서명 자체가 `string[] | undefined`를 반영해야 한다.
- 제안: `onChange: (enabledTools: string[] | undefined) => void`로 변경. `McpServerSelector`의 `patch(ref.integrationId, { enabledTools: et })` 도 자연스럽게 타입 안전해진다. `as unknown as` 캐스팅은 제거.

---

### [INFO] `readCafe24Extras()` — 글로벌 스토어 직접 접근 (의존성 역전 경계 약함)
- 위치: `codebase/frontend/src/lib/node-definitions/cafe24-extras.ts` — `getNodeDefinition("cafe24")` 내부적으로 `useNodeDefinitionsStore` 직접 접근
- 상세: `readCafe24Extras`는 전역 Zustand 스토어에서 직접 데이터를 읽는다. 컴포넌트 외부 함수로서 전역 상태에 암묵적으로 결합된 패턴이다. 테스트 파일은 `useNodeDefinitionsStore.setState()`로 이를 우회하는데, 이는 인터페이스 대신 구현을 직접 제어한다는 신호다. 현행 Zustand 접근 패턴이 이미 프로젝트 전반에서 사용되고 있다면 일관성 면에서 수용 가능하지만, 의존성 역전 원칙상 `readCafe24Extras(store: NodeDefinitionsStore)`처럼 주입 가능한 형태가 더 테스트 친화적이다.
- 제안: 현 수준에서는 다른 헬퍼들과 동일한 관례이므로 즉각 변경 불요. 향후 함수형 의존성 주입 패턴 도입 시 함께 리팩터링.

---

### [INFO] `expanded` 상태와 허용 목록 데이터의 책임 분산
- 위치: `mcp-server-selector.tsx` — `expanded: Set<string>` state
- 상세: `expanded` UI 상태(어느 Cafe24 서버가 펼쳐졌는가)는 `McpServerSelector` 내부에 있고, `enabledTools` 데이터 상태는 부모를 통해 props로 내려온다. 이 두 상태는 성격(UI 로컬 vs 데이터 영속)이 명확히 구분되어 있고 현재 위치가 적절하다. 다만 Cafe24 서버 수가 많아질 경우 Set의 ID 관리가 stale해질 수 있다 — 서버가 제거될 때 `expanded`에서도 제거해야 한다. 현재 `remove` 함수는 `expanded`를 정리하지 않는다.
- 제안: `remove` 함수에 `setExpanded(prev => { const next = new Set(prev); next.delete(integrationId); return next; })` 추가로 stale UI 상태 방지. 현재는 harmless(렌더링에 영향 없음)이나 preventive 수준 권장.

---

## 요약

이번 변경의 핵심인 `cafe24-extras.ts` 공유 헬퍼 추출과 `Cafe24AllowlistEditor` 신설은 레이어 책임 분리와 단일 진실 원칙을 잘 따른다. 컴포넌트 간 경계도 데이터 fetch / 편집 UI / 렌더 trigger 로 명확히 나뉘어 있다. 아키텍처 관점의 주요 위험은 두 가지다: (1) `McpServerSelector`가 `serviceType === "cafe24"` 특수 처리를 하드코딩함으로써 서비스 타입 종류가 늘어날 때 OCP를 위반하는 확장 경로, (2) `onChange` 타입 서명이 `string[]`이지만 실제로는 `undefined`를 전달하는 타입 계약 위반 — 이 두 항목은 현재 코드베이스 규모에서 즉각 치명적이지 않지만, `onChange` 타입 불일치는 즉시 수정하는 것이 타입 시스템 신뢰도 측면에서 권장된다.

## 위험도

LOW

---

STATUS: SUCCESS
