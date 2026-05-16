# Cross-Spec 일관성 검토 — Phase 3 Cafe24Config 재작성

검토 대상: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (Cafe24Config), `shared.tsx`, i18n dict, `cafe24-config.test.tsx`
기준 spec: `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/2-navigation/4-integration.md`, `spec/5-system/11-mcp-client.md`

---

## 발견사항

- **[WARNING]** §9.9 편집 버퍼(내부 Array 버퍼) — spec 본문이 폐기되지 않았으나 구현은 이를 사용하지 않음
  - target 위치: `integration-configs.tsx` — `Cafe24Config` 전체, `readFieldValues()` 함수 (line 322)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §2 "편집 버퍼" 한 줄, §9.9 전체 (Fields 편집 UI 의 내부 버퍼 분리 Rationale)
  - 상세: spec §2 는 "UI 는 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state 로 관리하고, `onChange` 시 빈 key 행을 제거한 뒤 `Record<string, unknown>` 로 변환해 `config.fields` 에 저장한다"고 기술한다. §9.9 Rationale 은 이 결정의 배경으로 "빈 key 행을 즉시 버퍼에서 떨어뜨리지 않도록 해 추가 버튼이 행을 즉시 보여준다"는 PR #62 해결 시나리오를 보존하고 있다. 그러나 Phase 3 구현은 `Array<{key, value}>` 버퍼가 전혀 없다. 대신 typed-dynamic-form 방식으로 각 필드가 메타데이터 정의에 의해 결정되며, `readFieldValues()`는 `Record<string, string>` 를 직접 state 없이 파생한다. KeyValueEditor 의존 제거로 "빈 key 행" 시나리오 자체가 消失했기 때문에 버퍼가 더 이상 필요 없다. 그러나 spec 본문과 Rationale 은 아직 구버전 패턴을 "채택된 결정"으로 서술하고 있어, spec을 읽는 다른 개발자가 이 버퍼를 재도입하거나 회귀 버그로 판단할 수 있다.
  - 제안: spec §2 의 "편집 버퍼" 한 줄을 삭제하고 §9.9 Rationale 을 "Phase 3(typed dynamic form) 이후 불필요해짐" 상태로 갱신하는 spec 수정 PR을 후속으로 제출. 구현 PR 은 그대로 진행 가능하나 spec 갱신이 미완 상태임을 plan 에 후속 항목으로 추가 권장.

- **[INFO]** §1 `pagination.cursor` — spec 에 정의됐으나 UI 가 제공하지 않음
  - target 위치: `integration-configs.tsx` line 442-443, line 606-630 (Pagination 블록)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §1 config 필드 표 — `pagination: { limit?: number, offset?: number, cursor?: string }`
  - 상세: spec §1 은 pagination 객체가 `cursor?: string` 을 포함한다고 명시한다. Phase 3 UI 는 `limit` / `offset` 두 칸만 렌더링하며, `cursor` 입력 위젯이 없다. 현재 구현은 기존 `config.pagination.cursor` 값을 spread(`{ ...pagination, limit: v }`)로 보존은 하지만, 사용자가 cursor 를 입력하거나 확인할 수 없다. spec §2 ASCII mock 또한 Limit/Offset 두 칸만 그렸으므로 mock 은 구현과 일치한다. 그러나 §1 의 cursor 필드 정의와 §2 mock 사이에 이미 존재하는 비일관성이 Phase 3 구현에서 그대로 이월된다.
  - 제안: cursor-based pagination을 지원하는 operation 이 생기는 시점에 UI 확장을 고려. 현재 PR 에서 별도 조치 불필요. spec §2 mock 에 cursor 가 없으므로 현 구현은 mock 기준으로 정합.

- **[INFO]** planned-op 선택 시 fields 미렌더 — spec 에 명시된 동작과 일치하나 spec 에는 이 분기가 기술되지 않음
  - target 위치: `integration-configs.tsx` line 548-557 (`{plannedOp && ...}`, `{!supportedOp && !plannedOp && operation && ...}`)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §2, `spec/conventions/cafe24-api-catalog/_overview.md` §3 (`planned` status 정의)
  - 상세: catalog spec §3 은 planned 상태를 "UI 의 Operation 드롭다운에 disabled + 지원 예정 배지로 노출"이라고만 정의한다. Phase 3 구현은 disabled 옵션으로 표현하므로 사용자가 선택 자체를 할 수 없어 planned-op 를 선택했을 때의 UX 분기(`cafe24OperationPlannedHint` 표시)가 실제로 도달할 수 없는 코드 경로다 — planned 옵션이 `disabled: true` 이므로 `handleOperationChange` 가 호출되지 않는다. plan 문서(§3 상세 설계)는 "Planned op 선택 시: dynamic fields 미렌더 + 이 작업은 아직 지원되지 않습니다 한 줄 hint"를 기술했으나 HTML select의 disabled 옵션은 선택 이벤트를 발생시키지 않으므로 이 분기는 dead code다. spec 에는 이 dead-code 상황이 명시되지 않았다.
  - 제안: 방어적 코드로서 유지하는 것은 무해(legacy 워크플로 호환 또는 programmatic 주입 경우). 단 plan 문서의 "Planned op 선택 시" 시나리오 기술이 실제 UX와 다름을 주석 또는 plan 정정으로 명확화 권장. 스펙에는 영향 없음.

- **[INFO]** `spec/2-navigation/4-integration.md` — Cafe24Config UI 와의 직접 충돌 없음
  - 검토 결과: `spec/2-navigation/4-integration.md` 는 통합 관리 화면(목록, 상세, OAuth 흐름)을 다루며 Cafe24Config 컴포넌트(노드 에디터 설정 패널)와 영역이 분리된다. Cafe24 관련 키(pending_install, reauthorize 비활성 조건, status 전이 등)는 Phase 3 변경과 교차점이 없다.

- **[INFO]** `spec/5-system/11-mcp-client.md` — Cafe24Config UI 와의 직접 충돌 없음
  - 검토 결과: `11-mcp-client.md §2.3 Internal Bridge` 가 Cafe24 메타데이터 테이블을 참조하지만 이는 backend `Cafe24McpBridge` 의 도구다. Phase 3 의 frontend `readCafe24Extras()` 는 `GET /nodes/definitions` 페이로드(Phase 2 에서 확립)를 읽으므로 MCP spec 과 교차점 없다.

---

## 요약

Phase 3 구현은 `spec/4-nodes/4-integration/4-cafe24.md` §2 의 ASCII mock(Integration / Resource / Operation / Required / Optional / Pagination 순서 및 구조)을 정확히 따른다. config 불변 필드(integrationId, resource, operation, fields, pagination)는 `handleFieldChange` / `handleOperationChange` / `handleResourceChange` 의 spread 패턴으로 보존된다. planned-operation 의 disabled select 옵션은 catalog spec §3 의 의도와 일치한다. 직접적인 모순(CRITICAL)은 발견되지 않았다. 유일한 실질적 불일치는 §9.9 편집 버퍼 Rationale 이 구현과 달라진 것으로(WARNING), spec 갱신이 후속 PR 로 필요하다.

---

## 위험도

LOW
