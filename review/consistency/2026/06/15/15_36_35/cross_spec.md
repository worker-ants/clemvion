# Cross-Spec 일관성 검토 — execution §1.3 single-node execution

검토 모드: `--impl-done` (diff-base: `015b11df38531ae9fd291d99e8634a21b4a8f8c7`)
Target scope: `spec/1-data-model.md §2.13 (single_node_id / previous_execution_id / WorkflowTestDataset)` + `spec/3-workflow-editor/3-execution.md §1.3 / §2.2`

---

## 발견사항

### [INFO] ERD 다이어그램에 WorkflowTestDataset 미포함
- **target 위치**: `spec/1-data-model.md §2.13.3 WorkflowTestDataset` (V097 신규 엔티티)
- **충돌 대상**: `spec/1-data-model.md §1 엔티티 관계 개요` — ASCII ERD 다이어그램
- **상세**: §1 의 ERD 는 `Workflow (1:N)` 아래 `Node / Edge / WorkflowVersion / Execution` 을 나열하지만 `WorkflowTestDataset` 가 누락되어 있다. §2.13.3 본문에는 `workflow_id FK → Workflow (ON DELETE CASCADE)` 로 명확히 정의돼 있어 실제 스키마와 다이어그램 사이에 동기화 갭이 존재한다.
- **제안**: `spec/1-data-model.md §1` ERD 의 `Workflow (1:N)` 아래에 `WorkflowTestDataset (1:N)` 항목 추가. 파괴적 모순은 아니므로 다음 spec 편집 사이클에 반영 권장.

### [WARNING] API 경로 3단계 이상 중첩 — 명시 예외 미등록
- **target 위치**: `spec/3-workflow-editor/3-execution.md §9 API 표`, `POST /api/workflows/:id/nodes/:nodeId/execute`
- **충돌 대상**: `spec/5-system/2-api-convention.md §2.2` — "중첩은 2단계까지 / 3단계 이상은 최상위로 분리"
- **상세**: `POST /api/workflows/:id/nodes/:nodeId/execute` 는 `workflows/:id` → `nodes/:nodeId` → `execute` 로 3단계 이상 중첩이다. API 컨벤션 §2.2 의 허용 예외는 `{resource}/{id}/{channel}/{action}` (RPC-style sub-channel action) 이며, 해당 예시는 `triggers/:id/notification/rotate-secret` 처럼 **고정 채널명 + 동작** 패턴이다. `nodes/:nodeId` 는 고정 채널이 아닌 동적 ID 세그먼트로 예외 패턴과 구조가 다르다. `spec/3-workflow-editor/3-execution.md §Rationale "전용 엔드포인트"` 에서 `api-convention §2.2 의 단일 동사 action 패턴` 을 근거로 들지만, api-convention 에는 이 경로 패턴을 허용한다는 명시적 기재가 없다. 같은 패턴이 `spec/3-workflow-editor/5-version-history.md` 의 `POST /workflows/:id/versions/:versionId/restore` 에도 존재하여 선례가 있으나, api-convention 에는 해당 예외가 등록돼 있지 않다.
- **제안**: (a) `spec/5-system/2-api-convention.md §2.2` 예외 표에 `{resource}/{id}/{sub-resource-collection}/{sub-id}/{action}` 패턴을 RPC-style 동작 허용 예외로 명시 추가, 또는 (b) target 경로를 `POST /api/nodes/:nodeId/execute`(최상위) 로 분리. 기존 version-history 의 동일 패턴과 함께 일괄 결정 필요. 현행 구현이 다른 허용 선례와 나란히 동작하므로 즉각 파단은 없으나 api-convention 미등록 상태다.

### [INFO] `DUPLICATE_NAME` 에러 코드 미카탈로그화
- **target 위치**: `spec/3-workflow-editor/3-execution.md §9` — `POST /api/workflows/:workflowId/test-datasets` / `POST /api/test-datasets/:id/clone` 응답 `409 DUPLICATE_NAME`
- **충돌 대상**: `spec/conventions/error-codes.md` — UPPER_SNAKE_CASE 에러 코드 카탈로그
- **상세**: `DUPLICATE_NAME` 은 `spec/conventions/error-codes.md` 의 등록 목록에 없다. 동 문서는 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` (409 중복) 처럼 역사적 예외 코드를 특별히 기재하며, 프로젝트 전체의 에러 코드 문자열에 동 규율이 적용된다고 명시한다 (`spec/conventions/error-codes.md §1 적용 범위`). `DUPLICATE_NAME` 코드가 새로운 도메인(`WorkflowTestDataset`) 에 처음 도입되므로 카탈로그에 추가하는 것이 일관성에 기여한다.
- **제안**: `spec/conventions/error-codes.md` 에 `DUPLICATE_NAME | 409 | WorkflowTestDataset (workflow_id, owner_id, name) UNIQUE 위반` 항목 추가 (정식 stable 코드로 등재). 단, 카탈로그가 "이름·의미 안정성 계약" 목적이므로 이 추가는 breaking 위험이 없고 INFO 수준 조치다.

---

## 요약

target 문서(`spec/1-data-model.md §2.13.3 WorkflowTestDataset + Execution V097/V098 컬럼`, `spec/3-workflow-editor/3-execution.md §1.3 / §2.2`)가 기존 spec 영역과 충돌하는 CRITICAL 사항은 없다. 데이터 모델 컬럼(`single_node_id`, `previous_execution_id`, `WorkflowTestDataset` 엔티티)은 기존 Execution 모델과 직교하며 mode-encoding 선례(`dry_run`, `re_run_of`)를 따른다. RBAC (`Editor+`) 는 user-profile §4.2 매트릭스와 일치하고, 실행 상태 머신은 변경 없이 재사용된다. 재실행(re-run) 스펙의 C3 항목은 이미 "구현됨" 으로 현행 spec 과 교차 등록돼 있다. 발견된 불일치는 두 가지 동기화 갭(ERD 다이어그램 누락 / 에러코드 미카탈로그)과 api-convention 예외 미등록 한 건이며, 세 항목 모두 운용 파단 없이 다음 spec 편집 시 조치 가능한 수준이다.

---

## 위험도

LOW
