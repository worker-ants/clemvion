충분한 정보를 수집했습니다. 이제 cross-spec 분석을 수행합니다.

---

## Cross-Spec Consistency Check Report

### 검토 모드: `--spec` (spec draft 신규 반영 전 점검)
### 대상: `plan/in-progress/spec-draft-cafe24-integration.md` (v2)
### 검토 기준: 기존 `spec/**` 문서와의 충돌

---

### 발견사항

---

- **[WARNING] Node.type `Enum` 표기와 `cafe24` 추가의 마이그레이션 전제 미정의**
  - target 위치: Draft §1b — `spec/1-data-model.md §2.6` Node.type 표에 `cafe24` 행 추가
  - 충돌 대상: `spec/1-data-model.md §2.6` 현재 Node.type 컬럼 타입 annotation
  - 상세: 현재 spec은 `Node.type | Enum | ...`으로 명시되어 있다. Draft §1b는 해당 표에 `cafe24` 행만 추가하고 타입 annotation(`Enum`)을 그대로 둔다. "영향 분석" 절에서 "실제 DB 컬럼은 String — backend schema 확인 필요"라고 언급하지만, 이는 spec 본문이 아닌 draft 메모 수준의 처리다. 만약 DB가 PostgreSQL ENUM이면 `ALTER TYPE` 마이그레이션이 필요한데, 이 조건 분기가 spec 레벨에서 미결 상태로 남는다. `Integration.service_type | String`과 다른 처리로, spec 본문 안에서 두 컬럼의 타입 일관성이 명확하지 않다.
  - 제안: `spec/1-data-model.md §2.6` Node.type 컬럼 타입을 `String (개념적 열거)`으로 명시하거나, Enum 유지 시 Rationale에 "backend schema 확인 후 ALTER TYPE 마이그레이션 여부를 결정한다"는 한 줄을 추가. 현재 draft의 "implementation plan에서 처리"는 spec 본문 바깥의 언급이므로, spec 자체에서도 이 사실을 기록해야 단일 진실 원칙에 부합한다.

---

- **[WARNING] `spec/3-workflow-editor/4-ai-assistant.md §4.3.1` `integrationServiceType` hint 다중값 지원 미정의**
  - target 위치: Draft §10 — `4-ai-assistant.md §4.3.1` 직후 `mcpServers` widget 필터 노트 추가
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md §4.3.1` 현재 `pendingUserConfig` `integration-selector` 동작 명세
  - 상세: 현재 spec §4.3.1은 `integration-selector` widget의 후보 쿼리를 "노드 스키마 meta의 `integrationServiceType` 힌트가 있으면 **해당 `service_type`만**"으로 기술한다. 단수(`해당 service_type`)를 명시하는 표현이다. Draft §10은 mcpServers widget에 대해 `service_type ∈ ('mcp', 'cafe24')` 다중값 필터를 요구하는 노트를 추가하지만, 기존 hint 메커니즘이 배열을 지원하는지를 spec 수준에서 명시하지 않는다. AI Agent 노드 스키마 meta의 `mcpServers` 필드가 현재 `integrationServiceType: 'mcp'`(단일)을 가진다고 추정되는데, 이를 `['mcp', 'cafe24']`(배열)로 바꾸는 변경도 draft에서 누락됐다. 결과적으로 "mcpServers 후보를 두 service_type으로 필터한다"는 요구사항과 "hint는 단일 service_type"이라는 기존 명세 사이에 불일치가 발생한다.
  - 제안: 다음 중 하나를 선택해 spec에 명시:
    1. `spec/3-workflow-editor/4-ai-assistant.md §4.3.1`의 `integration-selector` 동작을 "`integrationServiceType` 힌트가 배열이면 `service_type IN (...)` 쿼리"로 확장 기술하고, AI Agent 노드 스키마 meta의 `mcpServers.integrationServiceType` 값을 `['mcp', 'cafe24']`로 명시.
    2. 또는 mcpServers widget에 대해 `integrationServiceType` hint 대신 별도의 `mcpServiceTypes` 속성을 도입해 명확히 분리.

---

- **[INFO] `spec/0-overview.md §6.3` 로드맵에 Cafe24 미등재**
  - target 위치: Draft 전반 (spec 11개 파일 변경)
  - 충돌 대상: `spec/0-overview.md §6.3` (❌ 로드맵/미구현 목록)
  - 상세: spec 변경이 확정되면 Cafe24는 "spec 정의 완료 / 구현 예정" 상태가 된다. 현재 `§6.3`에는 Cafe24 관련 항목이 없다. spec write 후 overview가 제품의 최신 상태를 반영하지 못하게 된다. 단, spec draft 통과 후 별도 overview 갱신으로 처리 가능.
  - 제안: spec write 시 `spec/0-overview.md §6.3`에 `Cafe24 통합 — 워크플로 노드 + AI Agent Internal MCP Bridge (옵션 A)` 항목을 추가.

---

- **[INFO] `spec/5-system/11-mcp-client.md` `credentials.cached_capabilities`와 Internal Bridge 관계 미명시**
  - target 위치: Draft §7 — `11-mcp-client.md §2.3 Internal Bridge` 신규 절
  - 충돌 대상: `spec/5-system/11-mcp-client.md §3` credentials JSONB 스키마 (현재 `cached_capabilities` 필드 포함)
  - 상세: 현재 외부 HTTP MCP spec에는 `credentials.cached_capabilities` 힌트 필드가 있다. Draft §2.3은 Internal Bridge가 "connect/initialize 가 no-op"이라고만 기술하고, `cached_capabilities` 필드 사용 여부를 명시하지 않는다. Internal Bridge는 자체 메타데이터 테이블에서 직접 capabilities를 가져오므로 이 필드가 무관하지만, 독자가 §3 스키마를 Internal Bridge에도 적용하려 할 수 있다.
  - 제안: Draft §7 §2.3 또는 §3.1에 한 줄 추가: "`credentials.cached_capabilities` 는 외부 HTTP transport(§2.1) 전용 캐시 필드이며 Internal Bridge에는 적용되지 않는다."

---

### 요약

v2 draft는 v1의 Critical 2 + Warning 11을 모두 해소한 것으로 확인된다. Cross-spec 관점에서 신규 Critical 충돌은 없다. 발견된 2개 Warning은 (1) Node.type의 Enum vs. String 마이그레이션 전제가 spec 본문에 기록되지 않은 것, (2) `pendingUserConfig §4.3.1`의 단일값 hint 메커니즘과 Draft §10의 다중값 필터 요구 사이의 명시 갭이다. 두 Warning 모두 spec write 전 제안 내용을 반영해 해소 가능하며, 기존 spec과 직접 모순을 일으키는 수준은 아니다. 전반적인 일관성은 양호하다.

### 위험도

**LOW** — Critical 없음. 두 Warning 모두 구현 착수 전 명세 보강으로 해소 가능한 수준이며, 기존 spec의 작동을 깨는 직접 충돌은 발견되지 않았다.