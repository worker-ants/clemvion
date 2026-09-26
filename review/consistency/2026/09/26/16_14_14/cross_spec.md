# Cross-Spec 일관성 검토 — `spec/3-workflow-editor/4-ai-assistant.md`

## 검토 범위에 대한 제약

이번 호출의 prompt 번들은 `spec/3-workflow-editor/4-ai-assistant.md`(target, 전문) ·
`spec/5-system/2-api-convention.md`(전문) · `spec/conventions/swagger.md`(일부) ·
`spec/0-overview.md`(전문) 만 실 내용을 담았고, 그 외 `spec/**` 는 전부
"본문 생략됨 — 컨텍스트 예산 초과" 로 절단되어 있었다(1-data-model.md 109,713자 포함).
번들만으로는 target 이 인용하는 다수 영역(`1-data-model.md`·`0-canvas.md`·
`5-system/6-websocket-protocol.md`·`5-system/13-replay-rerun.md`·
`5-system/14-external-interaction-api.md` 등)과의 대조가 불가능했으므로,
worktree 의 실제 `spec/**` 파일을 직접 읽어(파일시스템 접근) 아래 발견사항을 교차 확인했다.
번들 절단 자체는 별도 이슈로 다루지 않는다(기존에 알려진 예산 한계, `feedback_consistency_spec_mode_budget` 계열).

## 발견사항

- **[CRITICAL]** "실행 중 편집 도구 거부"(ED-AI-19)가 PRD 에는 이행된 필수 요구사항으로, 상세 스펙에는 미구현 계획으로 상반되게 적혀 있다
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §12.2 (`(계획) 실행 중 ... 편집 도구를 shadow 단계에서 ASSISTANT_WORKFLOW_RUNNING 에러로 거부하는 가드는 아직 미구현이다 — 현재 코드에는 해당 에러코드·차단 로직이 없어 실행 중에도 편집 도구가 호출될 수 있다`) · §4.1.1 "실행 상태별 동작" 표의 `running`/`waiting_for_input` 행("§12.2 의 실행 중 편집 도구 거부(현재 미구현, 계획)는 어느 경우에도 read 도구에는 적용되지 않는다")
  - 충돌 대상: `spec/3-workflow-editor/_product-overview.md` §10.4 `ED-AI-19`("워크플로우 실행 중(Run 상태)에는 편집 도구가 거부되고 사용자에게 안내" — 우선순위 **필수**, 별도 "(계획)"·"미구현" 표기 없음) · 같은 문서 §10.9 도입부("실행 자체는 사용자가 `Run` 버튼으로 수행하고(§10.4 ED-AI-19 **유지**)") · `ED-AI-38`("...편집 도구(§10.4 ED-AI-19)의 '실행 중 거부' 정책은 read 에는 적용되지 않음")
  - 상세: PRD(`_product-overview.md`)는 ED-AI-19 를 다른 미구현 항목처럼 "(계획)"·"백로그" 등으로 표시하지 않고 무조건 "필수"로만 표기했고, §10.9 도입부는 "ED-AI-19 유지"라는 표현으로 이미 작동 중인 안전장치인 것처럼 서술한다. 그런데 이 항목의 상세 스펙인 target 문서는 정확히 같은 기능을 "(계획)"·"아직 미구현" 이라고 두 곳에서 명시한다. 실제 코드에도 `ASSISTANT_WORKFLOW_RUNNING` 문자열이 전무하고(`grep` 0건, `codebase/backend/src`), `plan/**` 에도 이 갭을 추적하는 항목이 없다(`grep` 0건). PRD 만 읽는 사람(기획·QA·타 영역 스펙 작성자)은 "실행 중에는 편집이 거부된다"를 사실로 전제하게 되지만, 실제로는 실행 중에도 Assistant 의 `add_node`/`update_node`/`remove_edge` 등이 그대로 통과한다 — 두 영역이 같은 요구사항 ID 에 대해 정반대의 "현재 상태"를 주장하는 직접 모순이다.
  - 제안: `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행과 §10.9 도입부·ED-AI-38 인용부에 target §12.2 와 동일한 "(계획, 미구현)" 캐비엇을 명시하거나, 반대로 실제로 이 가드를 구현할 계획이라면 `plan/in-progress/`에 추적 항목을 만들어 두 문서가 같은 사실(무엇이 이미 되어 있고 무엇이 안 되어 있는지)을 가리키도록 동기화한다. `project-planner` 턴이 필요하다.

- **[WARNING]** `GET /api/workflow-assistant/sessions/latest` 엔드포인트가 target 문서의 REST API 인벤토리에서 전부 누락됨
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §6 "REST API (세션/메시지 관리)" 표 — `sessions`(GET/POST) · `sessions/{id}`(GET/PATCH/DELETE) · `sessions/{id}/messages`(POST) 6개 행만 있고 `latest` 관련 행이 없다. 문서 전체에 "latest" 문자열이 0건(`grep -n "latest" spec/3-workflow-editor/4-ai-assistant.md` 결과 없음)
  - 충돌 대상: `spec/data-flow/11-workflow.md` L116 (`> **세션 조회 (read 경로)**: 패널을 열 때마다 GET /api/workflow-assistant/sessions/latest?workflowId=… 가 primary lookup 으로 실행돼 기본 선택 세션을 결정한다(없으면 null) — V019 의 (workflow_id, user_id, status, last_interaction_at DESC) 인덱스가 이 쿼리를 위해 존재한다`) · 실제 구현 `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:88` (`@Get('sessions/latest')`, `ApiOkWrappedNullableResponse` 사용, 없으면 `null`)
  - 상세: data-flow 문서는 이 엔드포인트를 "패널을 열 때마다" 실행되는 **1차 조회 경로**로 명시하고 전용 DB 인덱스까지 근거로 들지만, API 계약을 정의해야 할 target 문서의 §6 (엔드포인트 인벤토리, "세션/메시지 관리")에는 존재 자체가 빠져 있다. 이 라우트는 `sessions/latest` 가 `sessions/:id` 보다 먼저 선언돼야 하는 라우트 순서 함정까지 갖고 있어(`workflow-assistant.controller.ts:85-87` 주석), 계약 문서화 우선순위가 오히려 더 높은 엔드포인트다. 지금 진행 중인 e2e 작업(`plan/in-progress/assistant-e2e-contract-gaps.md`)이 바로 이 엔드포인트의 `null` 응답·200 상태·라우트 순서 회귀를 가르는 테스트를 추가하는 작업인데, 그 계약의 SoT 가 `4-ai-assistant.md` 가 아니라 `data-flow/11-workflow.md` 한 곳에만 존재하는 상태다.
  - 제안: target §6 표에 `GET /api/workflow-assistant/sessions/latest?workflowId={id}` 행을 추가하고(응답: 최근 활성 세션 또는 `null` — `api-convention.md §5.4` 의 "상시 존재 필드는 null" 규칙과 일치하는 `{data: <AssistantSessionDto> | null}`), §6.1 "세션 자동 선택 규칙"에서 이 엔드포인트를 구체적으로 인용하도록 정정한다. `spec_impact: none` 인 현재 test-only 작업 범위 밖이므로 별도 `project-planner` 턴에서 처리 권장.

- **[WARNING]** target 의 "모든 엔드포인트는 editor 이상" 이라는 일괄 RBAC 서술이 조회/변경을 분리하는 일반 RBAC 패턴 및 실제 라우트 구성과 어긋남
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §6 하단("모든 엔드포인트는 `editor` 이상 역할이 필요하고, `workspace_id`는 JWT에서 주입된다") · §5.1 SSE 엔드포인트 표의 `Role: editor 이상`
  - 충돌 대상: `spec/data-flow/12-workspace.md` §4 RBAC 요약표(`editor`=워크플로우 CRUD ✓/Model Config ✓, `viewer`=워크플로우 "view"/Model Config "view" — 즉 **조회는 viewer 이상, 변경만 editor 이상**이 이 저장소의 일반 패턴) 및 실제 컨트롤러(`workflow-assistant.controller.ts`)의 `@Roles('editor')` 적용 범위 — `POST sessions`·`PATCH sessions/:id`·`DELETE sessions/:id`·`POST sessions/:id/messages` 4곳에만 붙어 있고, 조회 3곳(`GET sessions`·`GET sessions/latest`·`GET sessions/:id`)에는 `@Roles` 데코레이터가 없다(해당 저장소 규약상 `@Roles` 미부착 라우트는 `RolesGuard` 가 멤버십만 검증하고 role 계층 비교는 하지 않으므로 viewer 도 통과 — `data-flow/12-workspace.md` "멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관" 절)
  - 상세: 이 저장소의 RBAC 관례는 "조회는 낮은 role(viewer)도 허용, 변경만 editor+ 요구"를 기본형으로 삼는다(§4 표 자체가 그 구분을 보여준다). target 문서가 세션/메시지 도메인 전체를 예외적으로 "조회 포함 editor 전용"으로 규정하려면 그 근거(예: "Assistant 패널은 애초에 editor 이상만 진입 가능한 UI라 read 라우트도 editor 로 좁힌다")가 Rationale 에 있어야 하는데 target 문서 어디에도 그 근거가 없다. 게다가 실제 라우트 구성은 그 "editor 전용" 서술과도 어긋나(조회 3개는 `@Roles` 미부착) 있어, 문서의 RBAC 서술이 (a) 이 저장소의 일반 RBAC 패턴과도, (b) 실제 구현과도 동시에 안 맞는 상태다.
  - 제안: (1) 조회 라우트에도 정말 editor+ 를 강제할 의도라면 `@Roles('editor')` 를 3개 GET 핸들러에 추가하고 그 의도를 target 문서 Rationale 에 남긴다, 또는 (2) viewer 의 세션 열람을 허용할 의도라면 §6 서술을 "편집·메시지 전송(POST/PATCH/DELETE, `messages`)은 editor 이상, 조회(GET)는 워크스페이스 멤버 이상"으로 정정한다. 어느 쪽이든 `data-flow/12-workspace.md` §4 표와 표현이 맞물리도록 `project-planner` 턴에서 결정한다.

## 요약

target 문서(`4-ai-assistant.md`) 자체의 API 표면·SSE 프로토콜·Shadow 검증 규칙·요구사항 ID(ED-AI-*) 상호 참조는 대체로 정합적이며, 컨테이너 중첩 깊이(§11.2.1/§12.1)·마스킹 좌표계(EIA §R17)·Re-run 비트리거(RR-PL-07) 같은 교차 인용은 인용처와 어긋나지 않았다. 다만 세 갈래에서 실질적 불일치를 확인했다 — ① "실행 중 편집 거부" 요구사항(ED-AI-19)의 이행 여부를 PRD 와 상세 스펙이 정반대로 서술하는 직접 모순(CRITICAL), ② 실제로 primary 세션 조회 경로로 쓰이는 `/sessions/latest` 가 target 의 REST API 인벤토리에서 통째로 빠져 SoT 가 `data-flow` 문서 한 곳에만 존재하는 문제, ③ "모든 엔드포인트 editor 이상"이라는 일괄 RBAC 서술이 이 저장소의 조회/변경 분리 RBAC 관례 및 실제 라우트 구성과 어긋나는 문제. ②·③ 은 현재 진행 중인 test-only 작업(`assistant-e2e-contract-gaps`, `spec_impact: none`)이 다루는 엔드포인트와 정확히 겹치므로, 이번 작업 자체를 막을 필요는 없지만 발견된 스펙 불일치는 별도 `project-planner` 턴에서 정리할 필요가 있다. 번들 예산 절단으로 다수 spec 영역은 파일시스템 직접 열람으로 보완했다.

## 위험도

HIGH
