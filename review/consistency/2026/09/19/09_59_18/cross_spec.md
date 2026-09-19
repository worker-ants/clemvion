# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-data-model-fk-actions.md`

## 발견사항

- **[WARNING]** `parent_node_execution_id` 신규 서술이 다른 spec 이 이미 규정한 두 번째 생산자(Background 노드)를 누락
  - target 위치: `## 변경 — spec/1-data-model.md` §C, `§2.14 NodeExecution` `parent_node_execution_id` 행 추가문 — "이 행을 만든 **Sub-Workflow 노드**의 NodeExecution — **인라인 서브 워크플로우**가 만든 자식 행에 찍혀 ..."
  - 충돌 대상: `spec/4-nodes/1-logic/12-background.md` (88·164·241·246행), `spec/4-nodes/_product-overview.md`(`ND-BG-04`), `spec/5-system/4-execution-engine.md`(393행 "한 서브그래프를 격리된 컨텍스트로 실행 (parentNodeExecutionId 그룹핑)")
  - 상세: `parent_node_execution_id`(entity 프로퍼티 `parentNodeExecutionId`)는 코드상 **두 개의 독립된 생산 경로**를 갖는다 — (1) `workflow.handler.ts` 의 인라인 Sub-Workflow 실행(draft 가 인용한 경로), (2) `background-execution.processor.ts` / `execution-engine.service.ts` (`executeBackgroundSubgraph`)의 Background 노드 서브그래프 실행. 두 번째 경로는 `spec/4-nodes/1-logic/12-background.md` 가 "Background 노드 자체의 NodeExecution ID 로 stamp" 라고 명시적으로 규정하고 있고 `ND-BG-04` 요구사항 항목으로 등재돼 있다. 그런데 draft 가 새로 써 넣는 §2.14 설명 칸은 "Sub-Workflow 노드" · "인라인 서브 워크플로우" 로만 한정해, 이 컬럼이 처음으로 §2 표에 등재되는 순간부터 Background 경로를 배제한 좁은 정의로 고정된다. 참고로 같은 문서 §3 인덱스 표(수정 대상 아님, 기존 서술)의 같은 컬럼 행은 이미 "sub-workflow/loop **등**" 이라고 열어 두고 있어, draft 의 §2.14 서술이 같은 문서 안에서도 §3 보다 더 좁다.
  - 제안: 설명 칸에 Background 경로를 병기한다. 예: "이 행을 만든 **Sub-Workflow 노드 또는 Background 노드**의 NodeExecution — 인라인 서브 워크플로우 · Background 서브그래프가 만든 자식 행에 찍혀 ...". 근거 링크로 `spec/4-nodes/1-logic/12-background.md#4-실행-로직` 을 함께 추가하는 편이 향후 참조자에게 더 정확하다.

- **[INFO]** §11.2 정정문·§3 Workspace 행 추가는 기존 spec 간 이미 존재하던 불일치를 해소 — 참고 기록
  - target 위치: `## 변경 — spec/2-navigation/4-integration.md` §11.2, `## 변경 — spec/1-data-model.md` §E
  - 대조 대상: `spec/data-flow/5-integration.md`(341행) · `spec/data-flow/8-notifications.md`(90행) · `spec/data-flow/12-workspace.md`(199·446~462행)
  - 상세: 두 항목 모두 실측 결과 target 수정문이 **이미 정확한** data-flow 문서 서술과 정확히 일치한다(`UNIQUE (integration_id, threshold, token_expires_at)`, V009 / `uq_workspace_personal_owner ON workspace (owner_id) WHERE type='personal'`, V109 · CONCURRENTLY). 즉 이 두 변경은 새 충돌을 만드는 게 아니라 `4-integration.md`↔`data-flow/*` 사이에 이미 있던 편차, `1-data-model.md §3`↔`data-flow/12-workspace.md` 사이에 이미 있던 누락을 닫는다. 문제 없음 — 참고용 확인 기록.
  - 제안: 없음(조치 불요).

- **[INFO]** §2.13 `re_run_of` 정정은 `spec/5-system/13-replay-rerun.md` §9.1 과의 기존 불일치를 해소
  - target 위치: `## 변경 — spec/1-data-model.md` §B
  - 대조 대상: `spec/5-system/13-replay-rerun.md` 283행 — "`re_run_of` | UUID | NULL | ... `REFERENCES execution(id) ON DELETE SET NULL`"
  - 상세: replay-rerun.md 는 이미 단수 `execution(id)` 로 정확히 적고 있었고, `1-data-model.md` §2.13 만 복수 `executions(id)` 로 틀리게 적혀 있었다. draft 의 수정("FK → Execution (SET NULL)")은 replay-rerun.md 와 일치하는 방향으로 정정한다. 문제 없음.
  - 제안: 없음(조치 불요).

- **[INFO]** §2.22 `finish_reason` 값 목록 확장은 `spec/data-flow/11-workflow.md` §3.3 · `spec/3-workflow-editor/4-ai-assistant.md` §6.0 과 대조 시 정합
  - target 위치: `## 변경 — spec/1-data-model.md` §D
  - 대조 대상: `spec/data-flow/11-workflow.md`(210~217행) — "일반적으로 stop/tool_calls/error/aborted ... 단, LLM 클라이언트가 반환하는 length/content_filter 도 무가공으로 전파돼 그대로 persist 될 수 있다. stall 자동 복구 ... 중간 row 는 auto_resume_pending 마커"
  - 상세: `ai-assistant.md` §6.0 은 "data-flow/11-workflow.md §3.3 과 동일 목록" 이라며 4값(stop/tool_calls/error/aborted)만 적어 얼핏 draft 의 7값 목록(+length·content_filter·auto_resume_pending)과 어긋나 보이지만, 원 출처인 `data-flow/11-workflow.md` §3.3 본문을 열어 보면 length/content_filter(예외적 pass-through)·auto_resume_pending(중간 row 마커)까지 모두 명시하고 있어 draft 의 7값 목록과 정확히 일치한다. `ai-assistant.md` 의 "동일 목록" 표현이 요약이라 오해 소지가 있을 뿐 실제 모순은 아니다. 문제 없음.
  - 제안: 없음(이 PR 범위 밖) — 다만 `ai-assistant.md` §6.0 이 "동일 목록" 이라 써 놓고 실제로는 부분집합만 나열하는 표현은 별도 기회에 손볼만한 명명·서술 정밀도 이슈(이번 PR 스코프 아님).

## 요약

target draft 는 `spec/1-data-model.md` §2/§3 와 `spec/2-navigation/4-integration.md` §11.2 를 실제 DB·코드에 맞춰 정정하는 사실 정정 PR 이다. 새로 추가되는 서술 대부분(§11.2 재작성, §3 Workspace 행, §2.13 `re_run_of` 테이블명 정정, §2.22 `finish_reason` 값 확장)은 `spec/data-flow/5-integration.md`·`8-notifications.md`·`12-workspace.md`·`11-workflow.md`·`3-workflow-editor/4-ai-assistant.md` 등 인접 spec 이 이미 정확히 적어 둔 서술과 대조했을 때 **정합**하며, 오히려 기존에 존재하던 영역 간 편차(§11.2 dedup 키, `re_run_of` 테이블명, `finish_reason` 값 목록)를 해소한다. 다만 §C 에서 신규 추가되는 `NodeExecution.parent_node_execution_id` 행 설명이 "Sub-Workflow 노드/인라인 서브 워크플로우" 만 언급하고, `spec/4-nodes/1-logic/12-background.md`(`ND-BG-04`)·`spec/5-system/4-execution-engine.md` 가 이미 규정한 두 번째 생산 경로(Background 노드 서브그래프 stamping)를 빠뜨려 신규 서술이 다른 영역의 기존 정의보다 좁다 — 이 컬럼이 §2 표에 처음 등재되는 시점이므로 지금 넓혀 두는 것이 이후 편차를 막는다.

## 위험도

LOW
