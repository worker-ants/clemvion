# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-fk-remaining-dispositions.md`

## 검증 절차 요약

번들이 예산 초과로 핵심 대상 파일(`spec/1-data-model.md` §3·§2.24·`## Rationale`, `spec/conventions/migrations.md`,
`codebase/backend/migrations/README.md`, `spec/data-flow/{11-workflow,7-llm-usage,10-triggers,6-knowledge-base,12-workspace,2-auth}.md`,
`plan/complete/spec-draft-deletion-cascade-indexes.md`·`spec-draft-graph-fk-indexes.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`)
를 담지 못해, 위 파일 전부를 절대경로로 직접 열어 draft 의 주장(S1~S4·처분 표·V121~V130 명명·전수 카운트)을 원문과 대조했다. 추가로
`codebase/backend/migrations/V019__workflow_assistant.sql`·`V089__model_config_kind_default_unique.sql`·
`workflow-assistant-session.entity.ts` 를 열어 draft 가 인용한 실측(카탈로그 대조)을 직접 확인했다.

## 발견사항

- **[WARNING]** 새 처분이 인접 Rationale 절("Trigger `(workflow_id)` 인덱스")의 "나머지 여섯" 목록을 갱신하지 않는다
  - target 위치: `plan/in-progress/spec-draft-fk-remaining-dispositions.md` §S3 (`spec/1-data-model.md` `## Rationale` 정정 세 곳), 처분 표의 `auth_config.workspace_id`(V127) · `knowledge_base.workspace_id`(V128) · `integration_oauth_state.workspace_id`/`integration_oauth_preview.workspace_id`(마, 비대상)
  - 충돌 대상: `spec/1-data-model.md` `## Rationale` → "Trigger `(workflow_id)` 인덱스 (2026-09-18)" 절, 특히 "**같은 클래스 전수 — 나머지 여섯은 이 결정에 넣지 않았다.**" 문단 — 그 여섯 중 넷(`auth_config.workspace_id` · `knowledge_base.workspace_id` · `integration_oauth_state.workspace_id` · `integration_oauth_preview.workspace_id`)이 정확히 이 draft 가 처분하는 대상이다
  - 상세: 같은 문서의 바로 위 절("삭제 연쇄의 FK 인덱스 다섯")은 이 정확한 패턴 — 자신이 "Trigger 인덱스" 절의 "나머지 여섯" 중 하나(`integration_usage_log.workflow_id`)를 재검토했을 때 — 을 만나자 "**아래 «Trigger `(workflow_id)` 인덱스» 절과의 관계**" 라는 별도 문단을 두어 "그 절의 문장은 그 범위에서 참이라 고치지 않는다" 고 명시적으로 밝혔다(이미 이 저장소의 확립된 관례). 이번 draft 의 S3 는 "삭제 연쇄의 FK 인덱스 다섯" 절에는 세 곳을 정정하면서도, 같은 문서의 "Trigger `(workflow_id)` 인덱스" 절이 열거한 "나머지 여섯" 중 넷을 이번에 처분하는데도 그 절에는 아무 정정/관계 문단을 추가하지 않는다. 문장 자체는 "그 결정에서는 안 넣었다" 는 뜻이라 여전히 참이지만(하드 모순은 아님), V127·V128·마 disposition 이 머지된 뒤 그 절만 읽는 독자는 "나머지 여섯이 아직 미해결" 이라고 오인할 수 있다 — 바로 위 절이 스스로 세운 관례를 이번 draft 가 비대칭적으로 적용하지 않는 것이 갭이다.
  - 제안: S3 정정 목록에 네 번째 항목을 추가 — "Trigger `(workflow_id)` 인덱스" 절 "나머지 여섯" 문단 뒤(또는 그 문단 안 해당 FK 옆)에 "`auth_config.workspace_id`·`knowledge_base.workspace_id` 는 위 «쓸 인덱스가 없는 FK 서른하나의 처분» 절이 조회 경로 이유로 인덱스를 뒀다(V127·V128). `integration_oauth_state`·`integration_oauth_preview` 의 `workspace_id` 는 같은 절이 비대상(마)으로 남겼다. 이 문장은 V111 시점 결정 범위에서는 그대로 참이다." 정도의 addendum 한 문장을 붙인다.

## 요약

Cross-Spec 관점에서 이 draft 는 매우 꼼꼼하게 자기 인용을 검증하고 있다 — 새 V121~V130 은 기존 마이그레이션(V120 까지)과 충돌하지 않고, 제안 인덱스 이름(`idx_edge_target_node_id` 등)은 코드베이스 전수에 미사용이며, `AssistantSession` 인덱스 정정은 `V019__workflow_assistant.sql` 실제 정의 및 `data-flow/11-workflow.md` 의 기존 서술과 정확히 일치한다(오히려 `spec/1-data-model.md` §3 의 기존 오기를 바로잡는다). `model_config` partial UNIQUE 서술은 `V089` 마이그레이션과 일치하고, `LlmUsageLog`·`Trigger`·`KnowledgeBase`·`WorkflowAssistantSession` 관련 data-flow sink 행에 대한 S4 삽입 지점도 실제 문서 원문 앵커와 정확히 맞는다. 31개 처분 표는 `plan/complete/spec-draft-deletion-cascade-indexes.md` 부록의 "빈 처분" 28행 + 이번에 새로 찾은 3개(부분 인덱스 오판정 보정)로 정확히 재구성되며 산술(10+13+3+4+1=31)도 항목별 나열과 정합한다. 트래커(`spec-draft-nullable-notation-followups.md`)의 "28개 남음" 항목을 닫는 근거도 정확하다. 유일하게 발견한 갭은 이 저장소가 이미 같은 문서 안에서 실천 중인 관례(선행 Rationale 절이 후속 처분으로 다른 절의 열거를 무효화할 때 "관계" addendum 을 남기는 것)를 이번 draft 가 대칭적으로 적용하지 않는다는 점으로, CRITICAL 급 모순은 아니고 문서 완결성 보강 수준이다.

## 위험도
LOW
