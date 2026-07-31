### 발견사항

- **[CRITICAL] Viewer 의 워크플로우 수동 실행 권한 — RBAC 요약표가 스스로 지목한 "정식" 매트릭스·실제 코드와 정반대**
  - target 위치: `spec/data-flow/12-workspace.md` §3.2 "RBAC 매트릭스 (요약)" (viewer 행 "실행" 열 = `✓ (수동 실행 only)`, 표 바로 아래 각주: "정식 권한 매트릭스는 `spec/5-system/1-auth.md §3.2`. 본 표는 데이터 변경 권한 관점의 요약이다.")
  - 충돌 대상:
    - `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스" — `Workflow 실행 | ✅ | ✅ | ✅ | —` (Viewer = 권한 없음)
    - `spec/2-navigation/9-user-profile.md` §4.2 "역할 권한 매트릭스" — `워크플로우 실행 | ✅ | ✅ | ✅ | ❌` (Viewer = 불가)
    - 실제 코드: `codebase/backend/src/modules/workflows/workflows.controller.ts` `POST :id/execute` 가 `@Roles('editor')` 가드. `codebase/backend/src/common/guards/roles.guard.ts` 의 `ROLE_HIERARCHY`(viewer=1 < editor=2) 상 viewer 는 403.
  - 상세: data-flow 표는 자신이 "정식"이라 지목한 `1-auth.md §3.2` 를 포함해, 독립적인 두 문서(정식 auth RBAC 매트릭스, 내비게이션 화면 RBAC 매트릭스)와 실제 RBAC 가드 코드 셋 다 "Viewer 는 워크플로우를 실행할 수 없다"에 합의하는데, 유일하게 이 표만 반대(`✓`)로 적었다. 표의 다른 셀(예: viewer 의 "워크플로우 CRUD" = `view`)은 auth.md 와 정확히 정합하므로, 이 한 셀만의 국소적 오기로 보인다.
  - 제안: `spec/data-flow/12-workspace.md` §3.2 viewer 행 "실행" 셀을 `✗` 로 정정 (다른 `✗` 셀과 동일 표기, "데이터 변경 권한 관점 요약"이라는 표 자체 프레이밍과도 정합). `1-auth.md`·`9-user-profile.md` 는 이미 정확하므로 별도 갱신 불요.

- **[WARNING] 같은 RBAC 요약표의 "LLM Config / Integration" 병합 열이 Editor 의 Model Config 전권(CRUD)을 "view" 로 축소 서술**
  - target 위치: `spec/data-flow/12-workspace.md` §3.2 표, editor 행 "LLM Config / Integration" 열 = `view`
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 — `Model Config | CRUD | CRUD | CRUD | R` (Editor = CRUD 전권). 코드 `codebase/backend/src/modules/model-config/model-config.controller.ts` 의 `POST /`, `PATCH :id`, `PATCH :id/set-default`, `DELETE :id` 가 모두 `@Roles('editor')`.
  - 상세: 이 열은 "LLM Config"와 "Integration"을 하나로 합쳤는데, Editor 의 실제 권한은 리소스마다 다르다 — Model Config = CRUD 전권, Integration(Org-scope) = R(조회)만, Integration(Personal) = 본인 것만 CRUD (`0-overview.md §6.1` 의 "editor 는 route guard floor" 각주 및 `1-auth.md §3.2` 행 참조). 병합 열에 단일 라벨 `view` 를 붙이면 "Editor 는 LLM Config 도 조회만 가능"으로 오독되어, 위 CRITICAL 항목과 같은 패턴(실제로는 가능한데 문서가 축소 표기)의 혼동을 유발한다.
  - 제안: 열을 "LLM Config" / "Integration" 두 열로 분리하거나, 각주에 "Model Config=CRUD, Integration(Org)=view, Integration(Personal)=own" 처럼 리소스별 값을 명시.

- **[WARNING] BullMQ 큐 카탈로그가 스스로 선언한 "SoT → 코드 레지스트리 동기화" 계약이 현재 깨져 있음 (`agent-memory-extraction` 큐 누락)**
  - target 위치: `spec/data-flow/0-overview.md` §1.2 핵심 사실 표 ("현재 등록된 큐 (18개)" 목록에 `agent-memory-extraction` 포함) 및 §4 "BullMQ 큐 카탈로그" 말미 ("`MONITORED_QUEUES` 는 본 표를 SoT 로 삼는다 — 큐 추가/삭제 시 **본 카탈로그를 먼저 갱신하고** 그 레지스트리를 동기화한다.")
  - 충돌 대상: `codebase/backend/src/modules/system-status/system-status.constants.ts` 의 `MONITORED_QUEUES` (17개 항목만 등록) — `AGENT_MEMORY_EXTRACTION_QUEUE`(`codebase/backend/src/modules/agent-memory/queues/agent-memory-extraction.queue.ts:15`, 값 `'agent-memory-extraction'`)가 import·등재되어 있지 않음.
  - 상세: data-flow 문서가 명시적으로 "이 카탈로그가 SoT 이고 큐가 늘면 레지스트리를 동기화해야 한다"는 불변식을 선언했는데, 그 불변식이 이미 위반된 상태다 — 시스템 상태 화면(`/system-status`)이 agent-memory-extraction 큐의 적체·실패를 노출하지 않는다. 엄밀히는 spec-vs-code 정합성이라 "Cross-Spec"(spec 영역 간) 범주의 경계에 있지만, target 문서 자신이 선언한 spec↔코드 동기 계약이 대상이라 함께 보고한다.
  - 제안: `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `AGENT_MEMORY_EXTRACTION_QUEUE` 항목 추가(그룹 예: `knowledge-base` 또는 신규 그룹). 의도적 제외라면 그 사유를 data-flow §4 각주에 명시해 선언과 실제 상태를 일치시킬 것.

- **[INFO] `spec/1-data-model.md` Node 제약조건 목록의 stale 괄호 주석 — Background 의 container_id 미사용 확정과 불일치**
  - target 위치(참조 대상): `spec/1-data-model.md` §2.6 "제약 조건" 목록 — "container_id가 참조하는 노드의 type은 loop, foreach, map 중 하나여야 함 **(Background는 도입 시 추가)**"
  - 충돌 대상: 같은 문서 §2.6 필드 설명 ("Background 는 컨테이너 멤버십을 사용하지 않고 `background` 포트 엣지로 본문을 식별한다") 및 target `spec/data-flow/11-workflow.md` §Rationale "노드 배치 두 축의 mutual exclusion" ("Background 컨테이너는 `container_id` 를 쓰지 않고 `background` 포트 엣지로 본문을 식별하므로 ... 본 제약과 충돌하지 않는다").
  - 상세: `1-data-model.md` 안에서도 필드 설명은 "Background 는 container_id 를 쓰지 않는다"로 이미 확정했는데, 바로 아래 제약조건 bullet 은 옛 상태(Background 지원이 향후 추가될 것처럼 보이는 문구)를 그대로 남겼다. target(data-flow)이 이 결정을 "mutual exclusion" 설계로 재확인하는 시점에, data-model 의 낡은 괄호가 "언젠가 Background 도 container_id 대상에 추가된다"는 오해를 만들 수 있다.
  - 제안: `1-data-model.md` §2.6 제약조건의 "(Background는 도입 시 추가)" 괄호를 제거하거나 "(Background 는 `background` 포트 엣지로 별도 식별 — container_id 미사용, 확정)" 로 갱신해 같은 문서·data-flow 양쪽과 정합시킨다. 부수 작업이라 별도 planner 턴 없이도 처리 가능한 문서 동기화 수준.

### 요약

`spec/data-flow/` (target, 8개 제공 파일 + grep 으로 직접 확인한 8개 생략 파일의 교차참조)은 다른 spec 영역과의 정합성이 전반적으로 매우 높다. Webhook(WH-*)·Chat Channel(CCH-*/R-CC-*)·External Interaction(EIA-*)·Agent Memory(AGM-*)·audit-actions·error-codes 컨벤션 등 수십 개의 요구사항 ID·수치(rate limit·body size·retry 횟수·큐 이름·audit writer 8곳)를 실제 코드·연관 spec 과 대조한 결과 전부 정합했고, 최근 정정 이력(WorkflowVersion.snapshot 의 settings 제외, workflow duplicate 의 캔버스 전체 복제)도 `1-data-model.md`·`2-navigation/1-workflow-list.md`·`2-navigation/_product-overview.md` 전체에 이미 동기화돼 있었다. 다만 `data-flow/12-workspace.md §3.2` 의 RBAC 요약표에서 Viewer 의 "워크플로우 수동 실행" 권한이, 표 자신이 "정식"이라 지목한 `5-system/1-auth.md §3.2` 및 `2-navigation/9-user-profile.md §4.2`, 그리고 실제 `RolesGuard`/`@Roles('editor')` 코드와 정반대(✓ vs 불가)로 기술된 CRITICAL 오류가 하나 발견됐다. 같은 표의 Editor "LLM Config" 권한도 축소 서술돼 추가 혼동 소지가 있다(WARNING). 또한 `0-overview.md` 가 선언한 "BullMQ 큐 카탈로그 = 코드 모니터링 레지스트리의 SoT" 동기 계약이 `agent-memory-extraction` 큐 누락으로 이미 깨져 있다(WARNING, spec-코드 경계). `1-data-model.md` 의 stale 괄호 하나는 INFO 수준 동기화 권고다. 이 네 항목을 제외하면 target 은 spec 전반과 강하게 일관돼 있다.

### 위험도
HIGH
