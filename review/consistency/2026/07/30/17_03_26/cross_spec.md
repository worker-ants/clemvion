# Cross-Spec 일관성 검토 — spec/data-flow/ (impl-prep, 워크플로우 복제 계약)

검토 모드: `--impl-prep`, scope=`spec/data-flow/`. `plan/in-progress/workflow-duplicate-nodes-edges.md`
(`worktree: resumable-handler-generic-typing-3918dd`) 의 코드 착수(`WorkflowsService.duplicate()` 재구현)
직전 게이트.

## 검토 방법

프롬프트 번들은 컨텍스트 예산 초과로 `spec/data-flow/` 상당수·`spec/1-data-model.md`·`spec/0-overview.md`
외 100여 개 파일을 생략했다. 번들 대신 저장소를 직접 대조했다:

- `git diff origin/main...HEAD --stat` 로 실제 변경 파일 확정 — `spec/data-flow/11-workflow.md`
  (§1.5 duplicate 계약 정정 + §2.1 표 + `## Rationale` 4개 절 신설), `spec/2-navigation/1-workflow-list.md`
  (§2.6·§3 API 표 문구 보강). 나머지 `spec/data-flow/*.md` 13개 파일은 target 스코프에는 포함되나 이번
  커밋(`f71839fe6`)에서 내용 변경이 없다 — 폴더 전체가 아니라 이 두 파일이 실질 target.
- `spec/1-data-model.md` §2.4~§2.9(Workflow/Folder/Node/Edge/Trigger/Schedule)·§2.13(Execution)·§2.13.3
  (WorkflowTestDataset)·§2.15(WorkflowVersion) 전문 대조 — 컬럼명·제약조건 일치 여부.
- `spec/2-navigation/_product-overview.md`(`NAV-WF-04`), `spec/3-workflow-editor/3-execution.md`
  (§2.2/R-2.2 테스트 데이터셋 권한 모델, `:753` 인용 원문), `spec/4-nodes/2-flow/1-workflow.md`(sub-workflow
  노드의 외부 `config.workflowId` 참조), `spec/conventions/cross-node-warning-rules.md`(§5 3중 가드) 대조.
- `codebase/backend/src/modules/workflows/workflows.service.ts` 의 `duplicate()`(현 미완성 구현) ·
  `exportWorkflow()`/`importWorkflow()`(UUID 재매핑 기존 패턴) 를 직접 읽어 spec 서술과 코드 사실관계 대조.
  `codebase/frontend`의 duplicate 호출부(`workflows/page.tsx`)를 읽어 응답 타입 의존성 확인.
  `git cat-file -t`/`git log`로 Rationale 이 인용하는 `8ff4e8564`·`db496a3c2` 커밋 실존·내용 확인.
- 전체 `spec/**` 에서 `duplicate`/`복제`/`NAV-WF-04` grep — 번들 밖 숨은 상충 서술 여부.

## 발견사항

없음 — CRITICAL·WARNING 급 cross-spec 충돌을 발견하지 못했다.

## 확인했으나 충돌 없음 (근거 포함)

- **데이터 모델**: `복제` 행이 나열하는 컬럼(`workspace_id, name, description, is_active, tags, folder_id,
  settings, current_version, created_by` / node 의 `container_id`·`tool_owner_id` / edge 의
  `source_node_id`·`target_node_id`)은 `spec/1-data-model.md` §2.4 Workflow·§2.6 Node·§2.7 Edge 필드
  정의와 정확히 일치한다. `Trigger`(§2.8, `workflow_id` FK)·`WorkflowTestDataset`(§2.13.3, `workflow_id`
  FK ON DELETE CASCADE)·`WorkflowVersion`(§2.15)을 복제 범위 밖으로 명시한 것도 이 엔티티들의 FK 구조와
  모순되지 않는다(단지 새로 INSERT 하지 않을 뿐). `Execution`(§2.13)은 `workflow_version` 을 참조하는
  FK 가 없어 "버전 이력 미승계" 가 실행 이력 조회를 깨뜨리지 않는다는 서술도 실측과 일치.
- **참조 무결성**: edge 재매핑(`source_node_id`/`target_node_id` → 사본 UUID)은 원본이 이미 만족한
  `(source_node_id, source_port, target_node_id, target_port)` UNIQUE·`source_node_id != target_node_id`·
  "같은 workflow_id 소속" 제약(§2.7)을 bijective 재매핑이므로 그대로 보존한다. `chk_node_placement`(둘 다
  set 금지)도 동일 논리로 보존됨.
- **Sub-workflow 외부 참조**: `spec/4-nodes/2-flow/1-workflow.md` 의 `config.workflowId` 는 캔버스 **밖의
  다른 Workflow** 를 가리키는 참조라 `container_id`/`tool_owner_id`/엣지 endpoint(캔버스 **안**의 노드 참조)
  재매핑 대상에 포함되지 않는다. target 의 "config 는 원본 그대로" 서술은 이 필드를 건드리지 않는다는
  뜻과 정확히 부합 — export(§1.5 표, "노드 간 참조" 만 인덱스로 치환)·import 도 동일하게 `config.workflowId`
  를 원본 값 그대로 옮기는 기존 동작이라 새 비일관성이 아니다.
- **API 계약**: 라우트(`POST /api/workflows/:id/duplicate`)·응답 타입(`Promise<Workflow>`, 코드 확인)을
  바꾸지 않는다. frontend `duplicateMutation`(`workflows/page.tsx:260`)은 응답 바디를 쓰지 않고 목록 쿼리만
  invalidate 하므로, 노드/엣지가 응답에 포함되지 않아도 소비 측 계약을 깨지 않는다.
- **요구사항 ID**: `NAV-WF-04`(`spec/2-navigation/_product-overview.md:51`, "워크플로우 생성/복제/삭제
  기능")는 저장소 전체에서 이 한 곳에만 정의되고 target 은 이를 그대로 인용만 한다 — ID 재정의·충돌 없음.
- **상태 전이**: `workflow.is_active` 사본 초기값 `false` 는 `data-flow/11-workflow.md` §3.1 상태
  다이어그램(`[*] --> Inactive`)과 일치. "Manual Trigger 정확히 1개" 불변식(§1.1 saveCanvas DTO 검증)은
  Manual Trigger 가 `Node.category='trigger'` 인 **노드**(§2.6 Node.type 표 확인)이므로 "전체 nodes 복제"에
  자동 포함되어 재발급 없이도 원본의 개수(1개)가 사본에 그대로 전이된다 — "기각한 대안(Manual Trigger
  자동 생성)"이 근거로 든 것과 동일 불변식.
- **RBAC**: target 은 권한 모델을 바꾸지 않는다. §4 외부 의존 표의 "editor 이상이 CRUD 가능"은 기존
  워크스페이스 RBAC 그대로이며, `duplicate()` 코드가 `findById(id, workspaceId)` 로 원본을 요청자의 현재
  workspaceId 범위 안에서만 조회하므로 사본의 `workspace_id` 는 항상 원본과 동일(요청 컨텍스트에 이미
  scoping 됨) — 문서가 이 필드를 명시적으로 나열하지 않아도 실제로 모호성이 없다.
- **계층 책임**: `WorkflowsService` 가 `NodesService`/`EdgesService` 를 거치지 않고 직접 node/edge row 를
  쓰는 것은 §1.1 `create()`(Manual Trigger 직접 INSERT)·`saveCanvas`(노드 전체 동기화/엣지 전부 교체)·
  기존 `exportWorkflow`/`importWorkflow`(코드 확인: `nodeRepository`/`edgeRepository` 직접 사용, UUID
  사전생성 → 배치 insert 패턴)와 동일한 기존 계층 경계다. 새 `duplicate()` 가 이 패턴을 재사용하는 것은
  계층 위반이 아니라 기존 결정의 연장.
- **graph-warning-rules 3중 가드와의 관계**: `spec/conventions/cross-node-warning-rules.md` §5 는
  severity `error` 규칙을 "workflow save endpoint"(`saveCanvas`)에서 가드하도록 요구하는데, target 의
  duplicate 는 이 가드를 거치지 않는다. 그러나 이는 **새로운 우회가 아니다** — 이미 구현·문서화된
  `importWorkflow` 조차 동일하게 `evaluateGraphWarnings` 를 호출하지 않는 선례가 있고(§1.5 표에 언급 없음,
  코드 확인), duplicate 는 원본 그래프를 구조 변경 없이 그대로 복사하므로 원본이 마지막 저장 시점에 이미
  통과한 상태를 동일하게 상속한다(신규 위반을 만들 수 없는 구조). §5 의 3중 가드는 "대화형 편집·저장
  경로"에 대한 규정이지 벌크 복제/가져오기 경로에 대한 규정이 아니라는 기존 해석과 상충하지 않는다.
- **잔여 stale 서술 없음**: `spec/**` 전체에서 "메타 row만 복제"/구 문구 재검색 결과, `11-workflow.md`
  Rationale 안에서 철회 대상으로만 인용되고 그 외 잔존처는 없다. `spec/3-workflow-editor/3-execution.md:753`
  ("workflows 의 duplicate 선례")도 새 Rationale 이 "소유권 패턴 선례" 로 스코프를 한정해 인용하므로
  §1.5 의 신규 계약과 모순되지 않는다.
- **Rationale 인용 사실관계**: `db496a3c2`·`8ff4e8564` 커밋은 `git cat-file -t`/`git log` 로 실존·내용
  일치를 확인했다(허구 이력 아님).
- **1차(`--spec`) 라운드 INFO 반영**: `review/consistency/2026/07/30/16_45_59/cross_spec.md` 가 남긴 INFO
  2건(Trigger/WorkflowTestDataset 제외 범위 명시, workflow-list §3 API 표 각주 동기화)은 커밋된 본문
  (`f71839fe6`)에 모두 반영되어 이번 라운드에서 재발 없음.

## 요약

target 은 `spec/data-flow/11-workflow.md` §1.5/§2.1 + 신설 `## Rationale` 4개 절과 `spec/2-navigation/
1-workflow-list.md` §2.6/§3 뿐이며(폴더 내 나머지 13개 데이터플로우 문서는 이번 커밋에서 미변경), 데이터
모델(`spec/1-data-model.md`)·API 계약(코드+frontend 소비부 실측)·요구사항 ID(`NAV-WF-04`)·상태 전이
(Manual Trigger 불변식)·RBAC·계층 책임(`WorkflowsService` 직접 쓰기 선례)·기존 graph-warning 3중 가드
컨벤션까지 전 영역을 저장소 원본 대조로 재검증한 결과 **CRITICAL·WARNING 급 cross-spec 충돌이 없다**.
1차 `--spec` 라운드가 남긴 INFO 2건도 커밋 본문에 모두 반영되어 재발하지 않았다. 코드 구현
(`WorkflowsService.duplicate()` 재작성)에 착수해도 cross-spec 관점의 차단 사유가 없다.

## 위험도
NONE
