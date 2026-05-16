# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` (구현 착수 전 --impl-prep)
작업 요약: `Cafe24Config` fields "추가" 버튼 버그 수정 — frontend React state 분리, 백엔드 계약 무변경

---

### 발견사항

특이사항 없음 — 아래 6개 점검 관점 전항 이상 없음.

- **[INFO]** `config.fields` 의 UI 내부 표현과 백엔드 계약 형태의 분리 패턴 — 명시적 문서화 권장
  - target 위치: `Cafe24Config.onChange` 콜백 (현재 `integration-configs.tsx` lines ~332-342)
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §1` (`fields: Record<string, unknown>`) · `spec/conventions/cafe24-api-metadata.md §2`
  - 상세: 수정 방향은 `Cafe24Config` 내부에 `Array<{key,value}>` 형태의 React state 를 도입하여 빈 key 행을 UI 에 유지하고, key 가 채워질 때만 `Record<string,unknown>` 으로 변환해 `config.fields` 에 flush 한다. 이는 spec 이 규정한 백엔드 계약(`fields: Record<string,unknown>`) 을 그대로 준수하는 구현 선택이다. 다만 현재 spec §2 설정 UI 설명에는 이 "UI 내부 목록 표현 ↔ 백엔드 object 형태 간 변환" 패턴이 명시되지 않아, 향후 동일 컴포넌트를 유지보수하는 개발자가 UI 형태와 저장 형태의 차이를 spec 에서 확인할 수 없다.
  - 제안: 구현 완료 후 `spec/4-nodes/4-integration/4-cafe24.md §2` 에 한 줄 주석("fields 편집 UI 는 내부적으로 key-value 배열을 관리하며, `onChange` 시 빈 key 항목을 제거한 뒤 `Record<string,unknown>` 으로 변환해 저장한다") 추가를 권장. 구현 차단 대상이 아님.

---

### 점검 관점별 결과

| 관점 | 결과 | 비고 |
|------|------|------|
| 1. 데이터 모델 충돌 | 이상 없음 | `config.fields: Record<string,unknown>` shape 변경 없음. `spec/1-data-model.md §2.6 Node.config: JSONB` 와 일치 유지 |
| 2. API 계약 충돌 | 이상 없음 | 백엔드 schema(`cafe24.schema.ts`) 가 `fields` 를 `Record<string,unknown>` 으로 수신하는 계약 유지. 프론트엔드 내부 상태 분리는 API 경계에 영향 없음 |
| 3. 요구사항 ID 충돌 | 해당 없음 | 본 작업은 요구사항 ID 를 신규 정의·변경하지 않음 |
| 4. 상태 전이 충돌 | 해당 없음 | 노드 실행 흐름·Integration 상태 머신 변경 없음 |
| 5. 권한·RBAC 모델 충돌 | 해당 없음 | 권한 구조 변경 없음 |
| 6. 계층 책임 충돌 | 이상 없음 | 변경이 frontend 설정 패널 내부(React state)에 국한. 백엔드 executor 계약(`spec/4-nodes/4-integration/4-cafe24.md §4` · `spec/4-nodes/4-integration/0-common.md §4`) 은 `config.fields` 의 object shape 을 그대로 받으며, 이 계약은 변경되지 않음. frontend/backend 경계 준수 |

---

### 요약

본 작업은 `Cafe24Config` 컴포넌트 내부에서 `KeyValueEditor` 가 추가한 빈 key 행이 `onChange` 의 object 변환 시 즉시 소실되는 버그를 로컬 React state 도입으로 수정한다. 변경은 frontend 렌더 로직에만 한정되며, `config.fields` 의 백엔드 계약(`Record<string,unknown>`)·데이터 모델(`Node.config: JSONB`)·API 계약·Integration 상태 전이·RBAC 모델 중 어느 것도 변경하지 않는다. spec 과의 직접 모순은 발견되지 않았고, `spec/4-nodes/4-integration/4-cafe24.md §2` 에 UI 내부 표현 변환 패턴을 한 줄 보완하면 미래 유지보수 명료성이 높아지나 구현을 차단할 이유는 없다.

---

### 위험도

NONE
