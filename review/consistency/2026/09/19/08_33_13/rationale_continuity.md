# Rationale 연속성 검토 — entity-schema-declaration-drift (impl-prep, scope=spec/3-workflow-editor/)

## 대상 확인

`plan/in-progress/entity-schema-declaration-drift.md` (spec_impact: none) 이 정정하려는 여덟 곳
(여섯 파일)을 각각 `spec/1-data-model.md` §2·§3, `spec/data-flow/12-workspace.md`,
`spec/5-system/5-expression-language.md §8.3.2`, 그리고 번들에 포함된 `spec/3-workflow-editor/`
문서들(`4-ai-assistant.md`·`0-canvas.md`·edge 문서)의 `## Rationale` 과 대조했다. 결론부터: **여덟
항목 모두 과거 Rationale 이 이미 명시적으로 확정해 둔 결정을 코드가 아직 못 따라간 잔재를 되돌리는
것**이며, 어느 항목도 기각된 대안을 재도입하거나 원칙을 새로 위반하지 않는다.

## 항목별 대조

1. **WorkflowAssistantSession 인덱스에 `userId` 추가** — `spec/1-data-model.md` §3 「인덱스 전략」이
   이미 `AssistantSession | (workflow_id, user_id, status, last_interaction_at DESC)` 로 4컬럼을
   명시한다(1-data-model.md:943). 현재 엔티티는 `@Index(['workflowId','status','lastInteractionAt'])`
   로 `user_id` 가 빠져 있다(workflow-assistant-session.entity.ts:20). 계획의 정정은 이미 문서화된
   모양으로 코드를 맞추는 것 — 새 결정이 아니다. `4-ai-assistant.md` Rationale 의 「Cascade 삭제」
   항목(L866, ai-assistant.md)은 FK onDelete 얘기이고 이 인덱스 모양과 무관하다.

2. **NodeExecution 인덱스에 `WHERE status IN (...)` 부분조건 추가** — `spec/1-data-model.md` §3 이
   `NodeExecution | (execution_id, status) WHERE status IN ('waiting_for_input','running')` 를
   V095 인덱스로 이미 명시한다(1-data-model.md:919). 엔티티 코드 자체의 JSDoc 도 이미 이 사실을 서술
   하면서 데코레이터(`@Index(['executionId','status'])`)만 `where` 를 빠뜨렸다(node-execution.entity.ts:28-37,
   자기모순). 문서·코드 주석·마이그레이션 3자가 이미 합의한 사실을 데코레이터에 반영하는 정정이다.

3. **Node 의 `IDX_node_workflow_label` 제거** — `spec/5-system/5-expression-language.md §8.3.2`
   가 "노드 라벨 유니크는 앱 레이어 + 런타임 `#N` 안전장치로 보장 — DB unique 제약은 두지 않는다"
   고 명시하고, `spec/1-data-model.md` §3 의 Node 인덱스 목록에도 `(workflow_id, label)` 항목이
   없다(1-data-model.md:906-908, `(workflow_id)`·`(container_id)`·`(tool_owner_id)` 셋뿐). 엔티티
   자신의 주석도 "과거 `@Unique('UQ_node_workflow_label')` … 제거했다" 고 이미 선언한 **바로 아래
   줄**에 동일 계열의 `@Index('IDX_node_workflow_label', …)` 가 남아 자기모순 상태다(node.entity.ts:24-29).
   제거는 이미 확정된 결정("DB 제약 없음")을 완성하는 것이다.

4. **Workspace `@Index(['ownerId','type'])` → V109 부분 유니크로 교체** — 이것이 가장 명시적인
   선례다. `spec/data-flow/12-workspace.md` 「personal 워크스페이스 유일성」Rationale(L446-469)이
   정확히 이 사안을 다룬다: "과거의 broad `@Unique(['ownerId','type'])` 엔티티 데코레이터는 의미상
   부정확했다 … 이 데코레이터는 **제거했다**. personal 유일성은 부분 유니크 인덱스
   `uq_workspace_personal_owner ON workspace (owner_id) WHERE type='personal'`(V109) 로 DB 레벨
   강제한다." 즉 과거에 `@Unique` 를 없앤 것은 이미 기록된 결정이다. 그런데 엔티티 코드를 보면 그
   결정을 설명하는 주석 바로 아래 줄에 **비-유니크** `@Index(['ownerId','type'])` 가 남아 있고
   (workspace.entity.ts:13-20), 주석 자체도 "DB 강제가 필요하면 … 도입한다"는 V109 **이전** 미래형
   문장에 멈춰 있다 — V109 는 이미 배포됐다. 계획의 교체(V109 인덱스로 대체 + 주석 정정)는 기각된
   대안(broad UNIQUE/비유니크 INDEX)을 다시 없애고 이미 채택된 대안(부분 유니크)으로 코드를 맞추는
   것 — 대안의 재도입이 아니라 **재도입된 잔재를 다시 걷어내는** 방향이다.

5. **integration_expiry_dispatch 의 명시적 유니크 이름 제거** — `spec/data-flow/5-integration.md`
   가 이 제약을 `UNIQUE (integration_id, threshold, token_expires_at)` 로만 서술하고 특정 이름을
   요구하지 않는다(5-integration.md:341). 실제 DB(V009)도 이름 없는 자동 생성 제약이라, 이름을
   제거해 다른 여섯 `@Unique` 와 통일하는 것은 spec 어디와도 충돌하지 않는다.

6·7. **Edge/Node `@Check` 따옴표 제거 + 이름 명시** — `spec/1-data-model.md` 는 두 CHECK 를 각각
   "자기 자신으로의 연결 불가"(L231)·"container_id/tool_owner_id 동시 불가"(L176) 로 서술할 뿐 SQL
   표현이나 이름을 규정하지 않는다. 다른 CHECK 의 선례(`chk_login_history_event`, L726)가 이미
   명시적 이름 표기를 쓰고 있어, 두 제약에 이름을 붙이는 것은 기존 관례와 정합적이다. 따옴표 제거는
   실제로 작동하지 않던 선언을 고치는 순수 버그 수정이라 Rationale 대상이 아니다.

8. **Workspace.owner FK 에 `onDelete: 'CASCADE'` 명시** — `spec/1-data-model.md` §2.2 Workspace
   표는 `owner_id | UUID | FK → User` 로만 적고 onDelete 동작을 규정하지 않는다(1-data-model.md:104).
   실제 DB(V001)는 이미 CASCADE 다. `1-data-model.md` Rationale 의 "쓸 인덱스가 없는 FK 서른하나의
   처분" 절이 언급하는 "`user` 를 가리키는 13개(그중 NO ACTION 여섯)"는 별도의 FK 집합을 가리키는
   집계 문장이고 `workspace.owner_id` 를 CASCADE 아님으로 재분류하지 않는다 — `owner_id` 는 이미
   CASCADE 라 그 "NO ACTION 여섯" 에 속하지 않는다. `synchronize: false` 라 메타데이터 정정은 실행 중
   FK 동작에 영향을 주지 않으므로 이 항목도 사실 정합화일 뿐 결정 번복이 아니다.

## 규칙("선언은 실재하는 것만, 실재하면 그대로") 자체의 연속성

plan 이 세운 규칙은 새로 만든 것이 아니라 두 기존 Rationale 을 일반화한 것이다: (a)
`data-flow/12-workspace.md` 의 "대응 마이그레이션이 없어 … DB 레벨에서 강제되지 않는 미적용
선언이었다. 이 데코레이터는 제거했다" 및 (b) plan 이 인용한 `data-flow/7-llm-usage.md` 의
`llm_config_workspace_default_unique` "이력" 선례. 두 선례 모두 "DB에 실재하지 않는 선언은
제거한다"는 동일 원칙이며, 이번 여덟 곳은 그 원칙이 아직 완결되지 않은 잔여 사례들이다. 원칙과
거리가 있는 항목은 없다.

## 새 식별자 충돌 여부

`entity-schema-declarations.e2e-spec.ts` 는 grep 상 기존 테스트 파일과 이름이 겹치지 않는다. plan
이 새로 적어 넣는 인덱스·제약 이름(`idx_workflow_assistant_session_wf_user_active`,
`idx_node_execution_exec_status_active`, `uq_workspace_personal_owner`, `chk_no_self_loop`,
`chk_node_placement`)은 전부 **이미 DB 카탈로그에 존재하는 이름**을 코드에 옮기는 것이라 새 이름을
발명하지 않는다 — 이름 충돌 위험 없음.

## 발견사항

없음. 검사한 여덟 항목·규칙·식별자 전부 기존 Rationale 과 정합적이다.

## 요약

이 변경은 spec Rationale 을 다시 쓰는 작업이 아니라, 이미 사용자 승인을 받아 `## Rationale` 에
기록된 결정들(특히 `data-flow/12-workspace.md` 「personal 워크스페이스 유일성」·
`5-system/5-expression-language.md §8.3.2` 「노드 라벨 유니크는 앱 레이어」·`1-data-model.md §3`
의 AssistantSession/NodeExecution 인덱스 서술)을 엔티티 데코레이터가 아직 못 따라간 여덟 군데의
잔재를 걷어내는 작업이다. 기각된 대안(broad `@Unique`, 이름 있는 유니크, 미적용 CHECK 등)을 다시
채택하는 곳은 없고, 오히려 과거에 "제거했다"고 선언된 대안의 **흔적**이 코드에 남아 있던 것을
계획이 마저 치운다. 새 Rationale 을 쓰지 않고도 무방한 이유는 spec_impact: none 그대로 — 이 변경은
spec 의 기존 서술을 바꾸지 않고 코드를 그 서술에 맞춘다.

## 위험도

NONE
