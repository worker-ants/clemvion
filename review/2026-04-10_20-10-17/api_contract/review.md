### 발견사항

- **[WARNING]** `NodesService.create` / `update` — 중복 라벨 충돌 에러 형식 불일치
  - 위치: `nodes.service.ts` `assertLabelUnique`, `bulkCreate`
  - 상세: `create`/`update`에서는 `ConflictException` (HTTP 409)를 던지지만, `WorkflowsService.saveCanvas`의 `validateUniqueLabels`는 동일한 상황에서 `BadRequestException` (HTTP 400)을 던짐. 같은 비즈니스 규칙(중복 라벨 금지)에 대해 두 가지 다른 HTTP 상태 코드가 반환됨.
  - 제안: `saveCanvas`의 `validateUniqueLabels`도 `ConflictException`으로 통일하거나, 명시적으로 다른 의미임을 문서화할 것.

- **[WARNING]** `NodesService.bulkCreate` — 레이스 컨디션 취약점
  - 위치: `nodes.service.ts` `bulkCreate` (기존 노드 조회 → 저장 사이 구간)
  - 상세: 기존 노드를 `findByWorkflow`로 조회한 후 저장하기 전 사이에 다른 요청이 동일 라벨 노드를 생성하면 중복 제약이 우회될 수 있음. DB 레벨의 unique constraint가 없으면 실제로 중복 데이터가 삽입됨.
  - 제안: `Node` 엔티티에 `(workflowId, label)` 복합 unique constraint 추가, 또는 트랜잭션 내 락 처리.

- **[INFO]** `$node` UUID 폴백 — 미문서화 API 인터페이스 노출
  - 위치: `expression-resolver.service.ts` `buildExpressionContext`, `spec/5-system/5-expression-language.md`
  - 상세: `$node["<nodeId>"]` UUID 기반 접근이 공개 표현식 인터페이스로 추가됨. 스펙에는 문서화되었으나, UUID가 사용자에게 노출되는 안정적 식별자인지 여부가 불명확함. 워크플로우 복제(duplicate) 시 UUID가 새로 생성되므로, UUID 기반 표현식은 복제된 워크플로우에서 silently 깨질 수 있음.
  - 제안: UUID 폴백의 사용 목적(디버깅 전용인지, 프로덕션 사용 가능한지)을 스펙과 에러 메시지에 명시. 복제 시나리오에 대한 경고 추가 고려.

- **[INFO]** `NodeSettingsPanel.isDuplicateLabel` — React 훅 규칙 위반 (런타임 에러 가능성)
  - 위치: `node-settings-panel.tsx` `SettingsTab`, line ~130
  - 상세: `useMemo` 내부에서 `useEditorStore.getState()`를 직접 호출하고 있어 반응형 구독이 없음. `label` 상태가 변경될 때 `isDuplicateLabel`이 올바르게 재계산되지 않을 수 있음. API 계약과 직접 관련은 없지만, 저장 시 중복 검증이 우회될 수 있어 서버 API에 잘못된 요청이 전달될 위험.
  - 제안: `useEditorStore((s) => s.nodes)`를 컴포넌트 레벨에서 구독하여 반응형으로 처리.

- **[INFO]** `disambiguate-labels` — 중복 라벨 허용 시 표현식 키 형식 (`#N`) 이 기존 라벨 네이밍과 충돌 가능
  - 위치: `disambiguate-labels.ts`
  - 상세: 사용자가 `"HTTP Request#2"`라는 라벨을 직접 지정한 경우, 실제 두 번째 중복 노드와 키가 충돌함. 서버에서 `#`을 포함한 라벨을 금지하지 않으므로 API를 통해 이런 상황이 생성될 수 있음.
  - 제안: 노드 라벨 유효성 검증에서 `#` 문자 금지 추가, 또는 disambiguation 접미사를 더 충돌 가능성 낮은 형식으로 변경.

---

### 요약

이번 변경은 주로 표현식 컨텍스트의 내부 동작(중복 라벨 구분, UUID 폴백)과 노드 라벨 유니크 정책 강화에 집중되어 있으며, 외부 REST API 엔드포인트의 시그니처나 응답 구조를 직접 변경하지는 않아 전반적인 API 계약 위반은 낮음. 다만 동일한 비즈니스 규칙(중복 라벨)에 대해 `NodesService`(409)와 `WorkflowsService`(400)가 다른 에러 코드를 반환하는 불일치가 존재하며, DB 레벨 unique constraint 없이 애플리케이션 레벨에서만 중복을 검증하는 구조는 레이스 컨디션에 취약하여 데이터 정합성 보장이 불완전함.

### 위험도

**MEDIUM**