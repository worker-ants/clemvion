# Rationale Continuity Review — Phase 2 `extras` Payload (Cafe24 Node UX)

**세션**: `review/consistency/2026/05/16/12_08_11/`
**검토 대상**: Phase 2 — `NodeComponent.extras?` 메커니즘 + `PublicCafe24Operation` 투영 + `planned.ts` 카탈로그

---

## 발견사항

### [INFO] `extras` 필드가 spec 문서(`spec/4-nodes/0-overview.md §1.0`)에 등록되지 않음

- **target 위치**: `backend/src/nodes/core/node-component.interface.ts` `NodeComponent.extras?: () => unknown` + `backend/src/nodes/core/node-component.registry.ts` `NodeDefinitionView.extras?` + `backend/src/modules/nodes/dto/responses/node-response.dto.ts` `NodeDefinitionDto.extras?`
- **과거 결정 출처**: `spec/4-nodes/0-overview.md §1.0 메타데이터 API` — `GET /api/v1/nodes/definitions` 응답 구조를 `{ metadata, ports, configSchema, defaultConfig, inputSchema?, outputSchema? }` 배열로 명시. `extras` 키는 열거되지 않음.
- **상세**: 현재 spec §1.0 의 API 응답 필드 목록이 Phase 2 에서 도입된 `extras` 를 포함하지 않는다. 구현은 DTO(`NodeDefinitionDto.extras?`)·인터페이스(`NodeComponent.extras?`)·레지스트리(`NodeDefinitionView.extras?`) 세 곳에 일관되게 추가되어 있으나, spec 본문의 열거 목록과 드리프트된다. 기능 결정의 번복이 아니라 spec 미반영에 해당한다.
- **제안**: `spec/4-nodes/0-overview.md §1.0 메타데이터 API` 의 응답 필드 목록에 `extras?` 를 추가하고, "대부분의 노드에서 비어 있으며 cafe24 노드만 `operationsByResource`/`plannedByResource` 카탈로그를 동봉한다"는 설명을 한 줄 기재. `spec/4-nodes/4-integration/4-cafe24.md §9.3` 에도 "frontend 에 `extras.operationsByResource` / `extras.plannedByResource` 로 투영한다" 한 줄 보완 권장.

---

### [INFO] `PublicCafe24OperationSupported.location` 노출 — spec §2 인터페이스에 누락

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/public-meta.ts` `PublicCafe24Field.location: Cafe24FieldSpec['location']`
- **과거 결정 출처**: `spec/conventions/cafe24-api-metadata.md §2` `Cafe24OperationMetadata` — `fields[fieldName].location: 'path' | 'query' | 'body'` 는 내부 메타데이터 형식으로 정의됨. public 투영에서 `location` 을 유지하는 결정에 대한 Rationale 기재 없음.
- **상세**: `public-meta.ts` 주석(line 33–35)에 "Not used for dispatch by the frontend; backend is the only HTTP caller" 라는 이유가 인라인으로 서술되어 있다. 이는 충분한 근거이나, spec 레이어에는 기록이 없다. `method`/`path` 를 제거한 결정은 `public-meta.ts` 파일 헤더 JSDoc 에 명시적으로 기술되어 있고, `location` 유지 결정도 인라인으로 설명되어 있으므로 구현 자체는 일관성이 있다. 다만 "내부 메타데이터 vs 공개 투영 필드 경계"가 spec 에 기술되지 않아 향후 필드 추가 시 판단 기준이 불명확해질 수 있다.
- **제안**: `spec/conventions/cafe24-api-metadata.md` 에 "frontend 공개 투영 경계" 소절 또는 `spec/4-nodes/4-integration/4-cafe24.md §9.3` 보완으로 "method/path 제외, location 유지 근거"를 한 문장 기재.

---

## 비충돌 확인 (이슈 없음)

다음 7개 점검 관점 전부를 검토하여 CRITICAL·WARNING 수준의 충돌이 없음을 확인.

**1. §9.1 Option C (단일 노드 + 메타데이터 테이블) 유지 여부**
Phase 2 의 `extras` 페이로드는 단일 `cafe24` 노드 정의 안의 선택적 서브키(`extras.operationsByResource`, `extras.plannedByResource`)로 전달된다. 노드 수가 늘어나지 않으며, 메타데이터 행 기반 동적 폼 패턴을 전혀 변경하지 않는다. Option A(endpoint 당 도메인 노드) / Option B(범용 HTTP 노드) 재도입 없음. 이상 없음.

**2. §9.3 "spec 본문에 ~180개 enumeration 을 적지 않는다" 정책 준수 여부**
`planned.ts` 는 `spec/` 에 속하지 않고 `backend/src/nodes/integration/cafe24/metadata/` 에 위치한다. `planned.ts` 파일 헤더에 "SoT for these rows lives in `spec/conventions/cafe24-api-catalog/<resource>.md`" 라고 명시되어 있으나, 해당 경로(`spec/conventions/cafe24-api-catalog/`)는 현재 존재하지 않는다(`find` 결과 디렉토리 없음). 이는 §9.3 의 "spec drift 위험" 원칙과 관련된 정보성 사항이다 — spec 에 enumeration 이 들어간 것이 아니라(위반 아님), planned.ts 주석이 존재하지 않는 spec 경로를 참조하고 있어 주석 자체가 dangling reference 다. 이는 코드 정합성 문제이며 Rationale 위반이 아니다. 메타데이터 SoT 원칙(`backend` 모듈에 위치) 자체는 준수됨. 이상 없음.

**3. `spec/conventions/cafe24-api-metadata.md §1-2` `Cafe24OperationMetadata` vs `PublicCafe24Operation` 일관성**
`PublicCafe24OperationSupported` 는 `method` / `path` 를 제거한 엄격한 부분집합(strict subset)이다. `scopeType` → `scope` 로 필드명이 공개 인터페이스에서 단축되었으나, 이는 내부 구현 세부(`scopeType` 이 `Node.category` 명명 충돌 회피를 위해 선택된 이름)를 공개 API 에서 정제한 것으로, §2 의 `scopeType` 채택 근거(명명 충돌 회피)를 침해하지 않는다 — 내부 메타데이터는 여전히 `scopeType` 을 사용하며 공개 투영만 `scope` 로 노출한다. 이상 없음.

**4. §9.2 Internal MCP Bridge 계약 불변 여부**
`spec/5-system/11-mcp-client.md §2.3` 의 `IMcpClient` 인터페이스 / `Cafe24McpBridge.listTools()` 는 내부 `Cafe24OperationMetadata` 를 소비한다. `public-meta.ts` 의 `PublicCafe24Operation` 는 `GET /nodes/definitions` 페이로드 전용이며 Bridge 경로에 개입하지 않는다. Bridge 가 소비하는 `CAFE24_OPERATIONS_BY_RESOURCE` (내부 메타데이터 배열)는 변경되지 않는다. 이상 없음.

**5. `spec/conventions/cafe24-api-catalog/_overview.md §4` sync 정책**
해당 파일이 현재 존재하지 않으므로(`find` 결과 없음) 점검 불가. `public-meta.spec.ts` 는 `CAFE24_PLANNED_BY_RESOURCE` 의 카운트를 `planned.ts` 와 비교 검증하나, `planned.ts` 주석이 참조하는 `catalog-sync.spec.ts` 의 존재 여부도 확인 불가. 이는 spec 에서 기각된 결정과의 충돌이 아니라 Phase 1 산출물(카탈로그 MD + catalog-sync 테스트)의 부재 여부로, Rationale 연속성 범위 밖이다.

**6. 메타데이터를 frontend 에 노출하거나 노출하지 않기로 한 선행 결정 존재 여부**
`spec/` 전체와 `review/` 디렉토리에서 "metadata frontend 노출 금지" 또는 "노출 결정"에 해당하는 명시적 Rationale 항목을 찾을 수 없다. 유일한 관련 결정은 §9.3 의 "spec 본문에 enumeration 을 적지 않는다" 이며 이는 spec 문서의 범위에 관한 것이다. frontend 에 메타데이터를 공개하는 결정 자체에 대한 선행 거부 결정 없음. 이상 없음.

**7. §2.3 Internal Bridge — `public-meta.ts` 경로와 교차 불간섭**
Bridge(`Cafe24McpBridge`)는 `CAFE24_OPERATIONS_BY_RESOURCE` 를 직접 소비하며 `public-meta.ts` 를 import 하지 않는다. `extras` 빌드 경로(`buildCafe24Extras`)는 `GET /nodes/definitions` 요청 시에만 호출되는 순수 함수다. Bridge 의 `callTool` / `listTools` 경로는 완전히 분리된다. 이상 없음.

---

## 요약

Phase 2 의 `extras` 페이로드 메커니즘(`NodeComponent.extras?` + `PublicCafe24Operation` 투영 + `planned.ts`)은 과거 Rationale 에서 명시적으로 기각된 대안(Option A/B)을 재도입하지 않으며, 합의된 invariant(단일 노드 + 메타데이터 테이블, spec 내 enumeration 금지, Bridge 계약 불변)를 모두 존중한다. `PublicCafe24Operation` 은 `Cafe24OperationMetadata` 의 엄격한 부분집합으로 `method`/`path` 를 의도적으로 제거하고 그 근거를 인라인에 기술하여 §9.3 의 "URL 구조 노출 금지" 취지를 준수한다. 발견된 2건은 모두 INFO 수준으로, `spec/4-nodes/0-overview.md §1.0` 의 응답 필드 목록 미반영과 public 투영 경계 결정의 spec 레이어 미기재에 관한 것이다. CRITICAL·WARNING 수준의 Rationale 위반 없음.

---

## 위험도

LOW
