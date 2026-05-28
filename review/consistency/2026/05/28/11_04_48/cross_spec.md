---
checker: cross-spec
target: spec/conventions/cafe24-api-metadata.md
mode: impl-prep
session: review/consistency/2026/05/28/11_04_48/
---

# Cross-Spec 일관성 검토 결과

## 발견사항

### [INFO] `spec/4-nodes/4-integration/4-cafe24.md §2` 설정 UI 설명이 label → labelKey 변경을 반영하지 않음
- **target 위치**: `spec/conventions/cafe24-api-metadata.md` §7.5 "노드 에디터 operation 드롭다운 노출" 행 + CHANGELOG `2026-05-28 (label 제거)` — `extras.operationsByResource[].label` → `labelKey` 필드명 변경 명시.
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §2 설정 UI, 라인 62 — "메타데이터의 (resource, operation) → label 매핑" 이라는 표현이 여전히 `label` 을 가리키고 있다. `labelKey` 로 갱신하거나 "catalog key lookup" 이라는 표현으로 교체해야 일관성이 유지된다.
- **상세**: target(`cafe24-api-metadata.md`)은 §7.5 책임 분리 표와 CHANGELOG에서 `/nodes/definitions` 응답의 `extras.operationsByResource[].label` 필드가 `labelKey` 로 rename 되었음을 정의한다. 그러나 `4-cafe24.md §2` 는 여전히 "(resource, operation) → label 매핑"이라는 표현을 유지하고 있어, 해당 섹션을 읽는 사람이 `/nodes/definitions` 응답 shape 에 `label` 필드가 여전히 존재한다고 이해할 수 있다. 구현 중에 frontend 가 `operationsByResource[].label` 을 읽는 코드를 그대로 두는 실수로 이어질 수 있다.
- **제안**: `4-cafe24.md §2` 설정 UI 설명(라인 62)의 "메타데이터의 (resource, operation) → label 매핑"을 "메타데이터의 (resource, operation) → `labelKey` (catalog key) — frontend i18n dict 로 변환"으로 갱신한다. 작은 표현 수정이므로 project-planner 위임 없이 함께 처리 가능.

---

### [INFO] `spec/4-nodes/4-integration/4-cafe24.md §9.9 (B, 채택)` 설명이 `extras.operationsByResource` 의 label 구조를 과거 상태로 기술
- **target 위치**: `spec/conventions/cafe24-api-metadata.md` CHANGELOG `2026-05-28 (label 제거)` — `operationsByResource[].label` → `labelKey` 필드명 변경 명시.
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` §9.9 라인 563 — "Phase 2 의 `extras.operationsByResource` 페이로드로 (resource, operation) 별 `fields[]` 가 frontend 에 도달한다"는 표현에서 `fields[]` 구조와 함께 `label` 언급은 없으나, 해당 설명이 label/labelKey 전환 이전의 결정 배경 맥락으로 작성되어 있어, 현재 `labelKey` 구조를 반영하지 않는다.
- **상세**: §9.9는 Rationale 성격의 섹션이므로 역사적 배경 설명으로 남겨도 무방하나, `(resource, operation) 별 fields[]` 가 도달한다는 설명에서 `label` 관련 언급이 아예 없다. 전체적으로 큰 충돌은 아니나 새 구현자가 `extras.operationsByResource` 의 정확한 shape 을 이 섹션만으로 파악하기 어렵다.
- **제안**: §9.9 Rationale 섹션에 "현재는 `label` 필드 대신 `labelKey` 를 노출하며, frontend i18n dict 가 사람 친화 라벨의 SoT 다 (§7.5 cafe24-api-metadata.md)" 식의 한 줄 주석을 추가하거나, §2 설정 UI 섹션(INFO 항목 1)의 수정으로 충분히 커버 가능하다. 낮은 우선순위.

---

### [INFO] `spec/4-nodes/4-integration/4-cafe24.md` 의 `/nodes/definitions` extras shape 이 명시적으로 정의되어 있지 않음
- **target 위치**: `spec/conventions/cafe24-api-metadata.md` §7.5 책임 분리 표 — "노드 에디터 operation 드롭다운 노출 | `GET /nodes/definitions` 의 cafe24 extras (`extras.operationsByResource[].labelKey`) | `cafe24.<resource>.<operation>`" 명시.
- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md` 전체 — `/nodes/definitions` 의 cafe24 extras shape (특히 `operationsByResource[].labelKey` 가 어떤 필드를 포함하는지) 에 대한 명시적인 스키마 정의가 없다.
- **상세**: cafe24-api-metadata.md §7.5 는 `extras.operationsByResource[].labelKey` 라는 필드명을 catalog key 형식으로 정의했다. 그러나 `4-cafe24.md` 또는 `spec/4-nodes/0-overview.md` 어디에도 `/nodes/definitions` 응답 중 cafe24 노드의 `extras` 전체 shape (`operationsByResource` 의 각 element 가 가지는 필드 목록)이 명시되어 있지 않다. 구현자가 target 문서의 §7.5 표에만 의존해야 하는 상황이다.
- **제안**: `4-cafe24.md` 의 적절한 섹션(예: §9.3 노드 Resource/Operation 메타데이터 위치, 또는 §2 설정 UI)에 `extras.operationsByResource` element 의 최소 shape (`{ resource, id, labelKey, requiredFields, fields, responseShape?, paginated?, restrictedApproval? }` 수준)을 명시하거나, `cafe24-api-metadata.md §7.5` 로 명확히 cross-reference 한다. 단독 INFO 수준이며 현재 구현 차단은 아니다.

---

## 요약

target 문서 `spec/conventions/cafe24-api-metadata.md` 는 §7.5 신설(활동 로그 catalog key 형식 명문화)과 `Cafe24OperationMetadata.label` 필드 완전 제거(→ `labelKey` 로 rename) 두 가지 신규 결정을 정의한다. 이 두 결정은 `spec/1-data-model.md §2.10.1 IntegrationUsageLog`, `spec/2-navigation/4-integration.md §4.6·§9.3·Rationale`, `spec/4-nodes/4-integration/4-cafe24.md §4·§8.5` 와 이미 정합성이 맞는다. 발견된 충돌은 모두 INFO 수준으로, `4-cafe24.md §2` 의 "label 매핑" 표현 및 extras shape 미명시 문제로 한정된다. CRITICAL 또는 WARNING 수준의 모순은 없으며, 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 영역 모두에서 직접 충돌이 발견되지 않았다.

## 위험도

LOW
