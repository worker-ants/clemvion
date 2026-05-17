# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/` (구현 착수 전, --impl-prep)
검토 대상 파일: `0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `12-workflow-version-history.md`, `13-user-guide.md`, `14-execution-history.md`, `2-trigger-list.md`, `3-schedule.md`, `4-integration.md`

---

### 발견사항

- **[INFO]** `triggerSource` / `triggerLabel` 필드명 — DTO 필드명이 spec 내 여러 위치에 걸쳐 일관되게 사용됨
  - target 신규 식별자: `triggerSource` (enum), `triggerLabel` (string | null) — `spec/2-navigation/14-execution-history.md §2.4 Trigger 출처 분류`
  - 기존 사용처: 동일 파일 §5 API 응답 예시에서도 `triggerSource`, `triggerLabel` 가 JSON 필드로 노출됨. 대시보드 spec(`0-dashboard.md §5`)의 "트리거" 열 설명(`subworkflow/manual/schedule/webhook/unknown`)도 같은 분류 체계를 참조
  - 상세: 동일 개념을 가리키는 식별자가 복수 파일에서 선언 없이 사용되고 있어 구현 시 DTO 위치를 명확히 정의해야 한다. `triggerSource` 와 `triggerLabel` 을 공유 DTO 타입으로 선언할 위치(예: `backend/src/modules/executions/dto/`)를 spec 이 지정하지 않는다.
  - 제안: `14-execution-history.md` §5 API 본문에 DTO 타입 선언 위치를 명시하거나, `0-dashboard.md §5` 에서 "출처 분류 규칙·보조 라벨 정책은 14-execution-history.md §2.4 참조" 와 같이 단일 정의 지점으로 명확히 위임한다 (현재 일부는 이미 참조 표기가 있으나, 구현 진입점에서의 참조 명시 보완 권장).

- **[INFO]** `ownership` 쿼리 파라미터 — API 수준 파라미터명이 단일 spec 내에서만 정의됨
  - target 신규 식별자: `GET /api/workflows?ownership=mine|shared|all` — `spec/2-navigation/1-workflow-list.md §2.3 필터`, `§3 API`
  - 기존 사용처: `spec/1-data-model.md §2.4 Workflow`, `spec/5-system/2-api-convention.md` (참조만 있음). 데이터 모델에는 `ownership` 컬럼이 없으며, `createdBy` 컬럼과 `workspaceId` 로 필터 로직을 구현해야 함
  - 상세: `ownership` 파라미터는 UI 필터 값(`mine`/`shared`/`all`)을 API 에 그대로 노출하는 구조인데, Execution 목록 API(`/api/executions/workflow/:workflowId`)에는 대응 파라미터가 없어 파라미터 명명 패턴이 비대칭이다. 충돌은 아니나 구현 중 혼동 가능성이 있음.
  - 제안: `spec/2-navigation/1-workflow-list.md §3 API` 주석에 "backend 구현 시 `ownership` 파라미터를 쿼리 빌더가 `createdBy` 비교 또는 전체 조회로 변환한다"는 내용을 추가하면 충돌 위험을 낮출 수 있다.

- **[INFO]** `VersionSnapshot` 인터페이스 — spec 에서만 정의되고 기존 코드 타입과 대조 미비
  - target 신규 식별자: `interface VersionSnapshot { name, description, nodes: Array<{...}>, edges: Array<{...}> }` — `spec/2-navigation/12-workflow-version-history.md §7.2`
  - 기존 사용처: `spec/1-data-model.md §2.15 WorkflowVersion` 의 `snapshot JSONB` 컬럼. 기존 spec 에서 snapshot 의 내부 스키마가 명시되어 있지 않았고 `12-workflow-version-history.md` 에서 처음으로 타입을 정의함
  - 상세: `nodes[]` 내부에 정의된 필드(`containerId`, `toolOwnerId`)가 `spec/1-data-model.md §2.6 Node` 의 `container_id`, `tool_owner_id` 와 casing 차이(snake_case vs camelCase)가 있는데, 이는 의도된 JSON 표현(camelCase)이면 문제없으나 명시적으로 언급하면 좋다.
  - 제안: `12-workflow-version-history.md §7.2` 아래에 "필드명은 API 응답 형식에 따라 camelCase 로 직렬화된다" 한 줄을 추가하거나, `spec/conventions/` 에 이미 관련 규약이 있다면 참조 링크를 추가한다.

- **[INFO]** `reRunOf` / `re_run_of` 필드 — spec 내 혼재 표기
  - target 신규 식별자: `execution.reRunOf` (camelCase, §3.7 Chain badge 설명), `re_run_of` (snake_case, §3.3 EH-DETAIL-11 ID 기술) — `spec/2-navigation/14-execution-history.md`
  - 기존 사용처: `spec/5-system/13-replay-rerun.md` 에서 Re-run spec 이 정의됨 (corpus 에 포함되지 않으나 교차 참조됨)
  - 상세: 동일 필드를 가리키는 표기가 `reRunOf`(UI/DTO camelCase)와 `re_run_of`(DB snake_case)로 혼재하는데, 두 맥락이 달라 의도적 분리라면 문제없다. 그러나 spec 독자가 혼동할 수 있으므로 "(DB 컬럼명은 `re_run_of`, API 응답 필드는 `reRunOf`)" 와 같이 맥락을 명시하면 좋다.
  - 제안: `14-execution-history.md §3.7` 또는 `§5` 에 "(DB: `re_run_of`, DTO: `reRunOf`)" 주석 추가.

---

### 요약

`spec/2-navigation/` 내 모든 파일을 기존 코퍼스(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/3-workflow-editor/0-canvas.md` 등)와 대조한 결과, **진짜 CRITICAL·WARNING 등급의 식별자 충돌은 발견되지 않았다.** API 엔드포인트(`/api/dashboard/*`, `/api/workflows`, `/api/triggers`, `/api/schedules`, `/api/integrations`, `/api/executions/*`, `/api/auth/*`, `/api/invitations/:token`)는 코퍼스 내 다른 곳과 중복 정의 없이 새로 등록되거나 기존 시스템 spec 과 일관되게 연결된다. 엔티티/타입명(`WorkflowVersion`, `VersionSnapshot`, `Entity`, `Relation`, `ExecutionNodeLog` 등)도 데이터 모델과 충돌 없이 정합된다. 다만 `triggerSource`/`triggerLabel` DTO 위치 미지정, `ownership` 파라미터 구현 단서 부재, `VersionSnapshot` 필드 casing 명시 부재, `reRunOf`/`re_run_of` 혼재 표기 네 가지가 구현 착수 시 혼동을 줄이기 위한 보완 권장 사항으로 식별되었다. 모두 INFO 등급으로, 개발자가 스펙을 읽으며 문맥을 파악하면 충분히 처리 가능한 수준이다.

### 위험도

LOW
