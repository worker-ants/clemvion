# Cross-Spec 일관성 검토 — entity-schema-declaration-drift (`--impl-prep spec/3-workflow-editor/`)

## 검토 범위 확인

이 구현 계획(`plan/in-progress/entity-schema-declaration-drift.md`)은 spec 을 바꾸지 않는 코드 전용 정정이다
(`synchronize: false` 라 TypeORM 데코레이터 정정이 실제 DB 스키마를 바꾸지 않음, `spec_impact: none`). 대상 여섯
엔티티 파일이 걸리는 spec 은 `spec/3-workflow-editor/` 한 곳이 아니라 `spec/1-data-model.md`(§2 Workspace/Node
표, §3 인덱스 전략) · `spec/data-flow/12-workspace.md`(personal 워크스페이스 유일성) · `spec/data-flow/7-llm-usage.md`
(과거 `llm_config_workspace_default_unique` 이력) · `spec/5-system/5-expression-language.md`§8.3.2(노드 라벨
유일성 = 앱 레이어) 에 걸쳐 있다는 것을 orchestrator 가 프롬프트 말미에 명시했으므로, 이 넷을 실제로 열어 계획의
처분과 대조했다.

## 발견사항

- **[WARNING]** Workspace→User FK 의 `ON DELETE CASCADE` 가 `spec/1-data-model.md` §2 Workspace 표에는 여전히 명시되지 않는다
  - target 위치: `plan/in-progress/entity-schema-declaration-drift.md` 발견 #8 — `workspace.entity.ts` 의
    `@ManyToOne(() => User)` 에 `{ onDelete: 'CASCADE' }` 를 추가해 실제 DB(`V001__initial_schema.sql:41`
    `owner_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE`)와 코드를 맞추는 항목
  - 충돌 대상: `spec/1-data-model.md:104` (`| owner_id | UUID | FK → User |` — 삭제 동작 미기재).
    같은 파일의 다른 User-FK 행들은 삭제 동작을 괄호로 명시하는 것이 확립된 관례다 — `:539`
    `FK → User (ON DELETE CASCADE)`, `:695`/`:714`/`:772` `FK → User (cascade[…])`, `:888`
    `FK → User (**SET NULL** — …)`. Workspace 행만 이 관례에서 빠져 있다.
  - 상세: 이 결함이 아니었다면 사소한 문서 완결성 문제로 넘어갈 수 있었겠지만, 같은 파일에 **2026-09-18 새로
    추가된** "쓸 인덱스가 없는 FK 서른하나의 처분" 절(`spec/1-data-model.md:1019-1082`)이 정확히 이 종류의 FK를
    다룬다: "`user` 를 가리키는 13개(그중 NO ACTION 여섯은 참조 행이 있는 사용자의 삭제를 거부한다 — 사용자
    삭제는 지금 스키마가 받아 주지 않는 동작이다. 사용자 삭제를 더하는 변경은 이 13개의 처분부터 다시 정해야
    한다)"(`:1064-1065`). `workspace.owner_id`는 이 13개 중 하나이면서 NO ACTION 이 아니라 CASCADE 인 쪽이다 —
    즉 향후 "사용자 삭제" 기능을 검토할 사람이 §2 표만 보고 이 FK 가 CASCADE 라는 사실(User 삭제 시
    Workspace → Workflow → Node/Edge/Execution → AssistantSession/AssistantMessage 까지 연쇄 소실됨,
    `4-ai-assistant.md` Rationale "채팅 히스토리 서버 영속화 구성" 항목 5의 cascade 목록과 동일 계열)을
    놓칠 위험이 있다. 이 PR 이 코드 데코레이터에 CASCADE 를 명시적으로 적어 넣는 순간, "코드는 명시적, spec 은
    침묵"이라는 비대칭이 새로 생긴다(기존에는 코드도 spec 도 둘 다 침묵이라 비대칭이 없었다).
  - 제안: developer 는 `spec/` 쓰기 권한이 없으므로 이번 PR 에서 직접 고치지 말고, 이미 같은 클래스의 다른
    두 항목(`0-canvas.md` §8.1 change_summary · assistant 사전 키 3종)을 등재한
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "`spec/1-data-model.md:104` Workspace
    owner_id 행에 `(ON DELETE CASCADE)` 주석 추가 — §'쓸 인덱스가 없는 FK 서른하나의 처분' 절과 동기화"
    항목으로 등재해 planner 턴을 기다리는 것을 권장. 이번 PR 자체를 막을 필요는 없다(동작 변화 없음, 신규
    모순 아님 — 기존 침묵의 연장).

- **[INFO]** 나머지 일곱 개 정정 항목은 모두 기존 spec 서술과 정확히 일치 — 새 충돌 없음
  - target 위치: `plan/in-progress/entity-schema-declaration-drift.md` 발견 #1~#7
  - 대조 결과 (모두 이미 spec 이 실제 DB 상태를 정확히 서술 중이었고, 이 PR 은 코드만 그 상태로 맞춘다):
    - #1 `WorkflowAssistantSession` 인덱스에 `user_id` 추가 → `spec/1-data-model.md:943`
      `(workflow_id, user_id, status, last_interaction_at DESC)` 와 정확히 일치.
    - #2 `NodeExecution` 부분 인덱스에 `WHERE` 추가 → `spec/1-data-model.md:919`
      `WHERE status IN ('waiting_for_input','running')` 와 정확히 일치.
    - #3 `Node` 의 `(workflow_id, label)` 인덱스 선언 제거 → `spec/5-system/5-expression-language.md:487`
      "노드 라벨 유니크 정책"은 DB 제약이 아니라 "노드 생성/이름변경/캔버스 저장 시" 앱 레이어 차단이라고 명시 —
      DB 인덱스가 없다는 코드 쪽 실측과 정합.
    - #4 `Workspace` 의 broad `@Unique(['ownerId','type'])` → V109 부분 유니크 `uq_workspace_personal_owner`
      로 교체 → `spec/data-flow/12-workspace.md:446-469` "personal 워크스페이스 유일성" 절이 이 정확한 결정과
      근거(과거 broad `@Unique` 는 team 다중 소유까지 막아 "의미상 부정확"했고 대응 마이그레이션도 없었다)를
      이미 기록해 두었다. 이 PR 의 "규칙"(선언은 실재하는 것만, 실재하면 그대로)이 이 Rationale 의 판단과 완전히
      이어진다.
    - #5 `IntegrationExpiryDispatch` 의 `@Unique(name)` 이름 제거 → `spec/data-flow/5-integration.md:341`
      "UNIQUE `(integration_id, threshold, token_expires_at)`" 를 이름 없이 서술 — 일치. 같은 규칙의 선례로
      `spec/data-flow/7-llm-usage.md:187` "이력" 절(`llm_config_workspace_default_unique` 가 `@Index` 선언만
      있고 SQL 마이그레이션이 없었던 사례)도 동일 원칙을 재확인.
    - #6/#7 `Edge`/`Node` 의 `@Check` 식 정정(따옴표 오류로 실제로는 생성 불가능했던 식) → `spec/1-data-model.md:176`
      "container_id 와 tool_owner_id 는 동시에 값을 가질 수 없음 (CHECK 제약)", `:231` "자기 자신으로의 연결
      불가 (`source_node_id != target_node_id`)" 와 의미상 일치(spec 은 SQL 표현이 아니라 의도만 서술하므로
      코드의 따옴표 버그를 감지하지 못했을 뿐 — 두 문서가 서로 모순인 것은 아님).
  - 결론: 발견사항 아님(정보 제공용) — 이 넷은 이미 정확했던 spec 문서에 코드를 맞추는 재확인.

- **[INFO]** 직전 라운드의 BLOCK:YES 는 이미 해소됨 — 재확인만, 재-flag 아님
  - target 위치: `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 키 표
  - 상세: `review/consistency/2026/09/19/08_07_50` 의 Critical(§13 표의 `assistant.edgeAdded`/`edgeRemoved`가
    글로서리 금지어 "엣지"를 쓰는데 실제 사전은 "연결선")은 같은 브랜치의 planner 커밋 `ff530fc8a` 가 정정했다.
    현재 번들(§13, 본 프롬프트 761-803행)은 "연결선 추가"/"연결선 삭제"로 이미 교정돼 있고,
    `codebase/frontend/src/lib/i18n/dict/ko/assistant.ts` 의 `edgeAdded`/`edgeRemoved` 값과 정확히 일치함을
    직접 대조했다. 재-flag 하지 않음.
  - 부수 확인: 사전(`dict/ko/assistant.ts`)에는 spec §13 표에 없는 키 3개(`continueAfterBudgetButton`,
    `continueAfterBudget`, `exampleArrange`)가 실제로 코드에서 쓰이고 있으나(`assistant-message.tsx:236`,
    `assistant-panel.tsx:18,37,200`, `assistant-store.ts:120,434,439`), 이는 이미 같은 커밋이
    `plan/in-progress/spec-draft-nullable-notation-followups.md:4667-4670` 에 "AI 어시스턴트 사전 키 셋이
    spec 에 없다" 로 등재해 둔 항목과 동일하다 — 새 발견 아님, 재-flag 하지 않음.

- 진행 중인 다른 plan 과의 충돌: 없음. `plan/in-progress/marketplace-and-plugin-sdk.md:90` 가 `node.entity.ts`
  를 언급하지만 대상은 `NodeCategory` enum(`custom` 미포함) 확장이라는 별개 축이라 이 PR 의 `@Index`/`@Check`
  정정과 겹치지 않는다. 새로 도입하는 식별자(`entity-schema-declarations.e2e-spec.ts`, 인덱스·제약 이름들)는
  전부 이미 DB 에 존재하는 이름을 코드에 옮기는 것이라 정의상 이름 충돌이 없다(신규 이름 발명 없음).

## 요약

이 계획은 spec 을 바꾸지 않는 순수 코드 정정(TypeORM 데코레이터 ↔ 실제 DB 정합)이며, `--impl-prep` 스코프가
`spec/3-workflow-editor/` 로 좁게 선언되었음에도 orchestrator 가 실제 영향 spec 넷(`1-data-model.md`,
`data-flow/12-workspace.md`, `data-flow/7-llm-usage.md`, `5-system/5-expression-language.md`)을 이미 짚어 두었고,
대조 결과 일곱 개 항목(#1~#7)은 모두 기존 spec 서술과 정확히 일치해 새로운 cross-spec 충돌이 없다. 유일한 관찰
포인트는 여덟 번째 항목(Workspace→User FK 에 `onDelete: 'CASCADE'` 명시)이 `spec/1-data-model.md` §2 Workspace
표의 오래된 침묵(FK 삭제 동작 미기재)과 마주치면서, 같은 파일에 최근 추가된 "사용자 삭제 미지원 — 13개 FK 재검토
필요" 절과의 정합성을 흐릿하게 만든다는 것이다. 이는 이번 PR 이 만든 새 모순이 아니라 기존 문서 공백이 이번
코드 변경으로 조금 더 눈에 띄게 되는 경우이므로 PR 을 막을 사유는 아니며, 트래커 등재로 충분하다. 직전 라운드의
Critical(§13 글로서리 금지어)은 이미 해소가 확인됐다.

## 위험도

LOW
