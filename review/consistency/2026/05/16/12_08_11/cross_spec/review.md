# Cross-Spec Consistency Review — Phase 2 Cafe24 Node UX (impl-prep)

> Checker: cross_spec
> Date: 2026-05-16
> Worktree: cafe24-node-ux-impl-9d3e1a
> Scope: backend + frontend implementation only (no spec/ edits in this PR)

---

## 발견사항

### [WARNING] `spec/conventions/cafe24-api-catalog/` 디렉토리가 존재하지 않음 — `catalog-sync.spec.ts` 의 SoT 참조가 공중에 떠 있음

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` line 17 (`spec/conventions/cafe24-api-catalog/_overview.md §4` 를 SoT 로 명시) 및 line 31–34 (`CATALOG_DIR` 상수가 `spec/conventions/cafe24-api-catalog/` 를 가리킴). `backend/src/nodes/integration/cafe24/metadata/planned.ts` line 7–9 도 동일 경로를 SoT 로 참조.
- **충돌 대상**: `spec/conventions/` 실제 파일 트리. 현재 `cafe24-api-catalog/` 디렉토리 및 `_overview.md` 가 존재하지 않음. `spec/conventions/cafe24-api-metadata.md` 는 존재하지만 카탈로그 파일 자체(resource 별 `.md`)가 없음.
- **상세**: `catalog-sync.spec.ts` 의 `parseCatalogFile()` 은 `spec/conventions/cafe24-api-catalog/<resource>.md` 를 런타임에 `readFileSync` 로 읽는다. 해당 파일이 없으면 테스트 스위트 전체가 `ENOENT` 로 폭발한다 — `planned.ts` ↔ catalog MD 간 bi-directional 동기 가드 4건이 포함된 새 테스트 케이스도 마찬가지다. `planned.ts` 주석도 "SoT lives in `spec/conventions/cafe24-api-catalog/<resource>.md`" 라고 명시하지만 그 파일은 없다.
- **제안**: `spec/conventions/cafe24-api-catalog/` 디렉토리와 각 resource 별 MD 파일(`store.md`, `product.md`, …, 18개) + `_overview.md` 을 생성해야 한다. 이는 `project-planner` 권한 영역(spec 신규 작성)이므로 구현 PR 과 별도로 spec 작성 태스크를 먼저 완료한 뒤 본 PR 을 체결하거나, CI 에서 해당 테스트를 일시 skip 처리하는 방어막을 마련해야 한다. 그렇지 않으면 현재 상태에서 `npm test` 를 실행하면 `catalog-sync.spec.ts` 전체가 파일 부재로 실패한다.

---

### [WARNING] `spec/4-nodes/0-overview.md §1.0` 메타데이터 API 응답 형식 — `extras?` 필드 미기재

- **target 위치**: `backend/src/modules/nodes/dto/responses/node-response.dto.ts` `NodeDefinitionDto.extras?: Record<string, unknown>` (line 116–123). `backend/src/nodes/core/node-component.registry.ts` `NodeDefinitionView.extras?: unknown` (line 29–31). `backend/src/nodes/core/node-component.interface.ts` `NodeComponent.extras?: () => unknown` (line 296–306).
- **충돌 대상**: `spec/4-nodes/0-overview.md` §1.0 메타데이터 API 절 (line 45). 해당 절은 `GET /api/v1/nodes/definitions` 의 `definitions` 배열 요소 형식을 `{ metadata, ports, configSchema, defaultConfig, inputSchema?, outputSchema? }` 로 명시하며 `extras?` 를 포함하지 않음.
- **상세**: 구현이 `extras` 를 추가했지만 spec 의 응답 형식 서술이 갱신되지 않았다. WARNING 수준인 이유는 `extras` 가 `optional` 이고 기존 소비자가 해당 필드를 무시하도록 안전하게 설계됐기 때문이다 — 직접 충돌이 아닌 spec 미기재다. 단, AI Assistant spec (`spec/3-workflow-editor/4-ai-assistant.md` line 620) 도 `listDefinitions()` 결과 형식을 서술하므로 연쇄 누락 가능성이 있다.
- **제안**: `spec/4-nodes/0-overview.md §1.0` 메타데이터 API 절의 definitions 요소 서술에 `extras?: Record<string, unknown>` (optional, 현재는 cafe24 노드만 사용) 를 추가한다. `project-planner` 위임.

---

### [INFO] `spec/conventions/cafe24-api-metadata.md §1` 디렉토리 구조 목록에 `public-meta.ts` / `planned.ts` 미기재

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` (신규), `backend/src/nodes/integration/cafe24/metadata/planned.ts` (신규).
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md §1 디렉토리 구조` (line 11–33). 현재 목록은 `index.ts`, `store.ts`, …18개 resource 파일만 나열하며 `public-meta.ts`, `planned.ts` 를 포함하지 않음.
- **상세**: §1 목록은 "각 파일은 한 Resource 의 모든 Operation 메타데이터를 export 한다" 라고 설명하는데, `public-meta.ts` / `planned.ts` 는 resource 파일이 아니라 projection / catalog 파일이다. 디렉토리 서술이 새 구조를 반영하지 않아 독자에게 혼동을 줄 수 있다.
- **제안**: `spec/conventions/cafe24-api-metadata.md §1` 에 `public-meta.ts` (frontend 공개 projection — method/path 제거) 와 `planned.ts` (status:planned 연산 목록 — catalog MD 와 sync) 를 추가한다. `project-planner` 위임.

---

### [INFO] `public-meta.ts` 의 `PublicCafe24Extras.operationsByResource` 타입이 `Cafe24Resource` 키 전체를 커버한다고 보장되나 spec §2 `Cafe24OperationMetadata` 와 `plannedByResource` 분리가 spec 에 미기재

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` `PublicCafe24Extras` 인터페이스 (line 63–72). `buildCafe24Extras()` 는 `operationsByResource` 와 `plannedByResource` 를 분리된 맵으로 반환한다.
- **충돌 대상**: `spec/conventions/cafe24-api-metadata.md §2 Operation 메타데이터 형식`. spec §2 는 `Cafe24OperationMetadata` 단일 인터페이스만 정의하고 supported/planned 구분이나 `PublicCafe24OperationPlanned` 형식을 서술하지 않음. `spec/4-nodes/4-integration/4-cafe24.md §9.3` 도 메타데이터 위치만 컨벤션에 위임할 뿐 public projection 의 구조를 언급하지 않음.
- **상세**: 이번 Phase 2 PR 이 `status: 'supported' | 'planned'` 구분과 `PublicCafe24OperationPlanned` 를 신규 도입했지만, spec 에는 이 공개 형식이 정의되어 있지 않다. 직접 모순은 아니나 frontend 가 `extras.operationsByResource` 와 `extras.plannedByResource` 를 소비할 때 타입 계약의 단일 진실이 어디에 있는지 불명확하다.
- **제안**: `spec/conventions/cafe24-api-metadata.md` 에 §2.1(또는 새 §X) 로 "Public projection 형식" 절을 추가해 `PublicCafe24OperationSupported` / `PublicCafe24OperationPlanned` / `PublicCafe24Extras` 인터페이스를 기술하고, method/path 제거 근거(URL 구조 미노출)를 명시한다. `project-planner` 위임.

---

### [INFO] MCP Bridge (`Cafe24McpBridge`) 와 `public-meta.ts` 의 레이어 경계 — spec 과 구현 간 일치 확인

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` 의 `toPublicSupportedOperation()` — `method` / `path` 드롭.
- **충돌 대상**: `spec/5-system/11-mcp-client.md §2.3`, `spec/conventions/cafe24-api-metadata.md §5 MCP Bridge 와의 매핑`.
- **상세**: spec §5 `operationToMcpTool()` 은 `op.method` / `op.path` 를 description 에 포함한다 (`\`${op.description}\n\n(Cafe24 ${op.method} ${op.path})\``). MCP Bridge 는 `Cafe24OperationMetadata` (internal, method/path 포함) 를 직접 소비하며, `public-meta.ts` 의 projection 은 `GET /nodes/definitions` → frontend 경로에만 쓰인다. 두 경로가 완전히 분리되어 있으므로 method/path 드롭이 MCP 동작에 영향을 주지 않는다. 레이어 경계가 명확하고 spec 과 충돌하지 않음.
- **제안**: 이슈 없음 (확인 목적 기재). public-meta.ts 주석에 이미 "MCP Bridge 는 internal metadata 를 소비하므로 영향 없음" 취지가 명시되어 있음.

---

### [INFO] `NodeDefinitionDto.extras` 타입이 `Record<string, unknown>` 이지만 `NodeDefinitionView.extras` 는 `unknown` — 타입 불일치 (Swagger ↔ 내부 뷰)

- **target 위치**: `backend/src/modules/nodes/dto/responses/node-response.dto.ts` `NodeDefinitionDto.extras?: Record<string, unknown>` (line 123). `backend/src/nodes/core/node-component.registry.ts` `NodeDefinitionView.extras?: unknown` (line 30).
- **충돌 대상**: 동일 백엔드 내의 두 타입 간 불일치 (spec 외적). Swagger DTO 는 `Record<string, unknown>` 를 선언하지만 내부 뷰와 `NodeComponent.extras?` 반환 타입은 `unknown` 이다. 직렬화 시 NestJS 가 `class-transformer` 없이 plain 객체를 그대로 응답하므로 런타임 동작에는 문제가 없으나, DTO 가 `Record<string, unknown>` 을 약속하면서 실제로 임의의 `unknown` 을 돌려보낼 수 있는 부정합이 있다.
- **제안**: `NodeDefinitionView.extras` 타입을 `Record<string, unknown> | undefined` 로 통일하거나, DTO 의 Swagger 어노테이션을 `additionalProperties: true` 로 유지하면서 타입은 `unknown` 으로 맞추는 것을 검토. spec 을 건드릴 사항은 아니며 개발자 판단 사항.

---

## 요약

Phase 2 구현 변경은 `spec/conventions/cafe24-api-metadata.md §9.3` 의 "metadata 는 backend metadata 모듈에 저장하고 spec 에는 형식·카테고리만 명시" 원칙을 올바르게 따른다. `public-meta.ts` 의 method/path 드롭, `extras` 전파 경로 (component → registry → DTO → frontend store), MCP Bridge 레이어 분리 모두 spec 기술과 일관된다. 단, 두 가지 실질적 위험이 존재한다. 첫째, `catalog-sync.spec.ts` 가 참조하는 `spec/conventions/cafe24-api-catalog/` 디렉토리가 실제로 존재하지 않아 CI 가 파일 부재 오류로 즉시 폭발한다 — 이는 spec 신규 작성 선행 없이 구현을 병합하면 발생하는 WARNING 수준 차단 요인이다. 둘째, `spec/4-nodes/0-overview.md §1.0` 의 definitions 응답 형식 서술이 `extras?` 를 누락해 spec 과 구현 간 기술 drift 가 생긴다. 나머지 INFO 항목들은 spec 동기화 권장 사항으로 기능 충돌은 없다.

---

## 위험도

**MEDIUM**

> CRITICAL 0 / WARNING 2 / INFO 3. Warning 1 (`cafe24-api-catalog/` 디렉토리 부재) 은 CI 테스트 실패를 직접 유발하므로, 해당 spec 카탈로그 파일 생성 또는 테스트 skip 조치 없이는 PR 병합 불가.
