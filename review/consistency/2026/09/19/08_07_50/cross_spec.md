# Cross-Spec 일관성 검토 — `spec/3-workflow-editor/` (impl-prep, entity-schema-declaration-drift)

## 검토 범위에 대한 메모

이번 `--impl-prep` 호출의 실질 대상은 `plan/in-progress/entity-schema-declaration-drift.md`
(엔티티 `@Index`/`@Unique`/`@Check`/`onDelete` 선언 8곳을 실제 DB(Flyway V001~V132)에 맞게 정정 —
`synchronize: false` 라 동작 변화 없음, `spec_impact: none`)다. scope 키워드는
`spec/3-workflow-editor/`(`node.entity.ts`·`workflow-assistant-session.entity.ts` 가 `1-node-common.md`·
`4-ai-assistant.md` 의 `code:` 에 걸림)이지만, 판정 대상 여섯 파일 모두 `spec/1-data-model.md` 의
`code:` 패턴에도 걸린다는 것이 프롬프트 말미 "(main 추가)" 절의 명시 지시다. 아래는 그 네 가지
판정 항목(계획 처분 vs spec 일치, 규칙의 선례 연속성, 새 식별자 충돌, 진행 중 plan 충돌)을 실제
spec 본문 대조로 검증한 결과다. `spec/3-workflow-editor/0-canvas.md`·`2-edge.md`·`3-execution.md`
본문(제공된 번들)에 대한 통상적 cross-spec 관점(RBAC·API 계약 등)도 표본 점검했다.

## 발견사항

- **[INFO]** `12-workspace.md` Rationale 이 이미 "해소됨"으로 서술한 결함이 코드에는 변형된 형태로 남아 있었다
  - target 위치: (계획 파일) `plan/in-progress/entity-schema-declaration-drift.md` 발견 #4 — `workspace.entity.ts` `@Index(['ownerId', 'type'])`
  - 충돌 대상: `spec/data-flow/12-workspace.md` §"personal 워크스페이스 유일성 (owner 당 1개)" — "과거의 broad `@Unique(['ownerId', 'type'])` 엔티티 데코레이터는 **의미상 부정확**했다" (과거형 서술)
  - 상세: 스펙은 이 오류를 **과거에 이미 고친 것**으로 서술한다(broad `@Unique` → V109 부분 유니크 인덱스로 대체됐다는 서사). 그런데 계획이 발견한 실제 코드는 `@Unique` 가 아니라 **같은 이름 계열의 `@Index`**(비유일)로, 여전히 DB 에 없는 인덱스를 선언 중이다. 즉 이전 수정이 `@Unique` 를 지우면서 형제 `@Index` 를 놓쳐, 스펙의 "정정 완료" 서사와 코드의 실제 상태가 어긋나 있었다 — spec 문서끼리의 모순은 아니고 spec(서사) vs code(잔재)의 어긋남이지만, 이 스펙 문단이 근거로 인용되는 대상이라 기록해 둔다.
  - 제안: 계획대로 `@Index(['ownerId','type'])` 를 V109 부분 유니크 인덱스 선언으로 교체하면 스펙 서사가 비로소 정확해진다. 별도 spec 수정은 불필요(내용은 이미 맞다 — 다만 "완전히 해소됨"이라는 과거형 단정이 이번 PR 이전까지는 근사였다는 점만 인지). `spec_impact: none` 유지로 충분.

- **[INFO]** `node.entity.ts` 를 동시에 건드리는 별도 in-progress 계획 존재 (병합 순서 주의)
  - target 위치: `codebase/backend/src/modules/nodes/entities/node.entity.ts` (본 계획의 발견 #3·#7 대상 파일)
  - 충돌 대상: `plan/in-progress/marketplace-and-plugin-sdk.md` L90 — `NodeCategory` DB enum 에 `custom` 추가가 필요하다는 별도 backlog 항목(같은 엔티티 파일, 다른 관심사: enum 값 vs 인덱스/CHECK 선언)
  - 상세: 두 계획이 같은 파일의 서로 다른 부분(enum 정의 vs `@Index`/`@Check` 데코레이터)을 건드릴 잠재력이 있다. 실질적 스펙 충돌은 아니며(관심사가 겹치지 않음), marketplace 계획은 아직 backlog 초기 단계라 당장 병합 경합 위험은 낮다. RBAC·데이터 모델 의미 충돌 아님 — 단순 파일 동시 편집 코디네이션 메모.
  - 제안: 조치 불요. 두 계획이 동시에 진행 단계로 올라가면 그때 diff 겹침만 확인.

- **[INFO]** 검증한 4개 판정 항목 — 모두 기존 spec 과 일치, 충돌 없음
  - target 위치: `plan/in-progress/entity-schema-declaration-drift.md` 전체 8개 발견 항목
  - 충돌 대상: `spec/1-data-model.md` §2 Workspace/Node 표·§3 인덱스 전략(AssistantSession·NodeExecution·Node 행) · `spec/data-flow/12-workspace.md` "personal 유일성" · `spec/data-flow/7-llm-usage.md` "이력"(`llm_config_workspace_default_unique`) · `spec/5-system/5-expression-language.md` §8.3.2 · `spec/3-workflow-editor/2-edge.md` §2.2(자기연결 이중 방어)
  - 상세(대조 결과):
    1. `workflow-assistant-session.entity.ts` 색인에 `userId` 추가 ↔ `1-data-model.md` §3 AssistantSession 행이 이미 `(workflow_id, user_id, status, last_interaction_at DESC)` 로 정확히 서술 — 일치.
    2. `node-execution.entity.ts` 의 `where` 절 추가 ↔ 같은 §3 표의 NodeExecution `(execution_id, status) WHERE status IN (...)` 행과 일치.
    3. `node.entity.ts` 의 `IDX_node_workflow_label` 제거 ↔ `5-expression-language.md` §8.3.2 "노드 라벨 유니크 정책"이 "노드 생성/이름변경/캔버스 저장 시 중복이 차단된다"고만 적어 **앱 레이어** 강제이지 DB 제약이 아님을 명시 — 인덱스 제거와 일치. `2-edge.md`·`0-canvas.md` 어디에도 이 인덱스에 의존하는 서술 없음.
    4. `workspace.entity.ts` 를 V109 부분 유니크로 교체 ↔ `12-workspace.md` "personal 워크스페이스 유일성" 절과 완전 일치(위 INFO 항목 참고).
    5. `integration-expiry-dispatch.entity.ts` 의 `@Unique` 이름 제거 ↔ `data-flow/5-integration.md`·`8-notifications.md` 는 컬럼 `(integration_id, threshold, token_expires_at)` 만 서술하고 제약 이름을 규정하지 않음 — 이름 제거가 스펙과 무모순.
    6·7. `edge.entity.ts`/`node.entity.ts` 의 `@Check` 따옴표 제거(표현식만 정정, 의미 불변) ↔ `1-data-model.md` §2.7 Edge "자기 자신으로의 연결 불가" · §2.6(Node) "container_id와 tool_owner_id는 동시에 값을 가질 수 없음" 과 `2-edge.md` §2.2 "DB 레벨 제약과 동일한 invariant" 서술 — 모두 제약의 **존재**만 요구하고 구현 문법은 코드 소관이라 일치.
    8. `workspace.entity.ts` FK 에 `onDelete: 'CASCADE'` 명시 ↔ `1-data-model.md` §2 Workspace 표는 `FK → User` 만 적고 삭제 정책을 규정하지 않음(침묵) — 모순 아님. `1-data-model.md` Rationale "쓸 인덱스가 없는 FK 서른하나의 처분"의 "라. 부모를 지우는 앱 경로가 없다: user 를 가리키는 13개" 서술과도 상충하지 않음(User 삭제 앱 경로 자체가 없으므로 CASCADE 여부가 실질 영향을 주지 않음).
  - 제안: 없음 — 정정 그대로 진행 가능.

- **[INFO]** 규칙("선언은 실재하는 것만, 실재하면 그대로")의 선례 연속성 — 확인됨
  - target 위치: `plan/in-progress/entity-schema-declaration-drift.md` §"규칙"
  - 충돌 대상: `spec/data-flow/7-llm-usage.md` L187 "이력" — "구 `llm_config` 시절의 `llm_config_workspace_default_unique` 는 entity `@Index` 선언만 있고 이를 생성하는 SQL 마이그레이션이 없어(`synchronize: false`) DB 단 강제가 부재했다"
  - 상세: 계획이 인용하는 선례(§Rationale 문구 그대로)가 실제 그 문서에 존재하며 내용도 일치한다. `12-workspace.md` 의 "broad `@Unique(['ownerId','type'])`" 선례도 동일 계열. 규칙이 처음 도입되는 것이 아니라 두 개의 실재 선례를 일반화한 것으로 확인됨 — 근거 조작 없음.
  - 제안: 없음.

- **[INFO]** 새 식별자(e2e 파일명·재사용 제약/인덱스 이름) 충돌 없음
  - target 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (신규), 정정 후 엔티티가 참조할 이름들(`idx_workflow_assistant_session_wf_user_active`·`idx_node_execution_exec_status_active`·`uq_workspace_personal_owner`·`chk_no_self_loop`·`chk_node_placement` 등)
  - 충돌 대상: 없음(검증 완료)
  - 상세: `find codebase/backend -iname '*entity-schema*'` 결과 기존 파일 없음. 인용된 마이그레이션 V001·V009·V019·V095·V109 모두 저장소에 실재. 계획이 "이름은 모두 이미 DB 에 있는 이름"이라 주장한 대로, 새로 붙이는 이름은 생성이 아니라 **기존 DB 객체 이름을 코드에 옮겨 적는 것**뿐이라 신규 식별자 충돌 범주에 해당하지 않음.
  - 제안: 없음.

- **[INFO]** RBAC 표본 점검 — `3-execution.md` §4/§9 의 Editor+ 권한 서술
  - target 위치: `spec/3-workflow-editor/3-execution.md` §4(Stop 버튼 권한), §9(API 표 Editor+ 표기)
  - 충돌 대상: `spec/5-system/1-auth.md` L373 권한 매트릭스 "Workflow 실행" 행
  - 상세: `3-execution.md` 가 "Owner/Admin/Editor ✅, Viewer —" 로 인용한 근거가 `1-auth.md` 의 실제 표와 정확히 일치. RBAC 충돌 없음.
  - 제안: 없음.

## 요약

이번 호출의 실질 대상인 `entity-schema-declaration-drift` 계획(엔티티 데코레이터 8곳 정정, `synchronize: false`
라 동작 불변, `spec_impact: none`)을 `spec/1-data-model.md`·`spec/data-flow/12-workspace.md`·
`spec/data-flow/7-llm-usage.md`·`spec/5-system/5-expression-language.md` §8.3.2·`spec/3-workflow-editor/2-edge.md`
와 항목별로 대조한 결과, 8개 정정 전부가 이미 문서화된 스펙 사실(및 그 스펙이 인용하는 두 개의
실재 선례)과 정확히 일치하며 새로운 모순을 만들지 않는다. 유일하게 기록할 만한 점은 `12-workspace.md`
의 Rationale 이 관련 결함을 과거형("이미 해소됨")으로 서술하지만 실제로는 형제 데코레이터(`@Index`)가
잔존해 있었다는 것인데, 이는 spec-대-spec 모순이 아니라 spec-서사-대-code-잔재의 어긋남이며 이번
정정이 그대로 서사를 사실로 만든다. `spec/3-workflow-editor/` 번들 본문(캔버스·엣지·실행) 자체에
대한 표본 RBAC/API 대조에서도 별다른 이상은 발견되지 않았다. 종합적으로 이 변경을 착수해도 될
정도로 cross-spec 위험은 낮다.

## 위험도

NONE
