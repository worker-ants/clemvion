# Rationale 연속성 검토 — entity-schema-declaration-drift

## 검토 범위 정정

프롬프트의 명목 target 은 `spec/2-navigation/` 이었으나 그 영역의 델타는 0개였다. 실제 구현 diff(7파일
/ 588줄)는 6개 엔티티(`edge` · `integration-expiry-dispatch` · `node-execution` · `node` ·
`workflow-assistant-session` · `workspace`)의 인덱스·제약·FK 선언을 실제 DB(Flyway 마이그레이션)에
맞추는 정정 + 회귀 e2e 가드(`entity-schema-declarations.e2e-spec.ts`) 신설이었다. 프롬프트 하단
"판정할 것" 지시에 따라 이 diff 를 대상으로 `spec/1-data-model.md` · `spec/data-flow/12-workspace.md`
· `spec/5-system/5-expression-language.md §8.3.2` 의 Rationale 과 대조했다.

## 발견사항

- **[INFO]** `spec/1-data-model.md` §2.2 Workspace `owner_id` 행이 이번 diff 가 명시화한 `ON DELETE
  CASCADE` 동작을 아직 서술하지 않는다
  - target 위치: `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts` — `@ManyToOne(() => User, { onDelete: 'CASCADE' })` 추가
  - 과거 결정 출처: `spec/1-data-model.md` §2.2 Workspace 표 104행 `| owner_id | UUID | FK → User |`(CASCADE 미기재). 같은 문서 §2.13.3 WorkflowTestDataset 539행은 `FK → User (ON DELETE CASCADE)` 로 삭제 동작을 괄호 표기하는 관례를 이미 쓰고 있어 Workspace 행만 예외로 남는다
  - 상세: 이번 diff 는 `V001__initial_schema.sql` 의 `owner_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE` 를 그대로 코드에 반영한 것뿐이라(실측 확인) 동작 변화는 없다 — «기각된 대안의 재도입» 도 «결정의 무근거 번복» 도 아니다. 다만 spec 표만 침묵해 "코드는 명시, spec 은 침묵" 상태가 남는다. 이 자체는 이번 diff 가 새로 만든 문제가 아니라 기존 spec 의 완성도 갭이 이번 diff 로 인해 눈에 띄게 된 것이다
  - 처리 현황: developer 자신이 `plan/in-progress/entity-schema-declaration-drift.md` 착수 전 검토(2차 impl-prep, `review/consistency/2026/09/19/08_33_13`)에서 이미 WARNING 으로 잡아 `plan/in-progress/spec-draft-nullable-notation-followups.md` 4683행에 planner 항목으로 등재했다(수정 방식까지 명시: `FK → User (ON DELETE CASCADE)` 로 맞춘다). spec 쓰기는 developer 권한 밖이라 트래커 위임은 올바른 처리다
  - 제안: 이미 트래커에 있으므로 추가 조치 불요 — 후속 planner 턴에서 §2.2 104행만 정정하면 닫힌다

- **[정보 확인 — 위반 없음]** Node 라벨 인덱스 제거는 기존 Rationale 을 재확인할 뿐 위반이 아니다
  - target 위치: `codebase/backend/src/modules/nodes/entities/node.entity.ts` — `@Index('IDX_node_workflow_label', ['workflowId', 'label'])` 제거
  - 과거 결정 출처: `spec/5-system/5-expression-language.md` §8.3.2 "노드 라벨 유니크 정책 … DB unique 제약은 두지 않는다"(앱 레이어 + 런타임 `#N` 안전장치) + `spec/1-data-model.md` §3 인덱스 전략 표(Node 행 셋 중 라벨 인덱스는 애초에 없음)
  - 상세: 제거된 인덱스는 어떤 마이그레이션도 만든 적이 없는 "오해성 선언"이었다(실측: `grep IDX_node_workflow_label migrations/*.sql` 0건). 제거는 이미 문서화된 "DB 제약 없음" 정책을 코드가 뒤늦게 따라잡은 것이지, 기각된 대안(DB 유니크)을 되살리거나 새로 폐기하는 결정이 아니다
  - 제안: 없음(정합)

- **[정보 확인 — 위반 없음]** Workspace 부분 유니크 인덱스 교체는 기존 Rationale 을 그대로 구현한다
  - target 위치: `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts` — `@Index(['ownerId','type'])` → `@Index('uq_workspace_personal_owner', ['ownerId'], { unique: true, where: "type = 'personal'" })`
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` "### personal 워크스페이스 유일성 (owner 당 1개)" — "과거의 broad `@Unique(['ownerId','type'])` … 는 의미상 부정확했다 … 제거했다 … 부분 유니크 인덱스 `uq_workspace_personal_owner ON workspace (owner_id) WHERE type='personal'`(V109)로 DB 레벨 강제"
  - 상세: 새 선언은 이름·컬럼·조건·유일성 모두 V109 마이그레이션(`CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_workspace_personal_owner ON workspace (owner_id) WHERE type = 'personal'`)과 정확히 일치(실측 대조). 이 Rationale 이 "제거하라"고 명시한 broad 안을 다시 들여온 것이 아니라, Rationale 이 이미 채택한 안을 코드가 뒤늦게 반영한 것
  - 제안: 없음(정합)

- **[정보 확인 — 위반 없음]** 나머지 다섯 곳(WorkflowAssistantSession 인덱스 컬럼, NodeExecution partial 조건, IntegrationExpiryDispatch 제약 이름, Edge/Node CHECK 표현식·이름)도 각각 V019 · V095 · V009 · V001 마이그레이션과 1:1 대조 완료 — 전부 "선언을 실재에 맞춘다"는 단일 원칙(plan 문서 "규칙" 절)의 기계적 적용이며, 새로운 설계 결정이나 과거 결정 번복이 아니다. 관련 spec 문서(`spec/1-data-model.md` §3 인덱스 전략, `spec/data-flow/7-llm-usage.md` "이력" 절의 동일 클래스 선례)와도 서술 방향이 일치한다

## 요약

이번 diff 의 성격은 "엔티티 데코레이터 선언을 실제 DB(Flyway 마이그레이션) 상태에 맞추는 정정"이며
`synchronize: false` 라 런타임 동작 변화가 없다(개발자 plan 문서가 명시). 대조 가능한 세 Rationale 출처
(`spec/1-data-model.md` §3 인덱스 전략, `spec/data-flow/12-workspace.md` "personal 워크스페이스
유일성", `spec/5-system/5-expression-language.md` §8.3.2 "노드 라벨 유니크 정책")를 모두 직접 마이그레이션과
대조한 결과, 여덟 곳의 정정 전부가 기존에 기록된 결정을 재도입·위반·무근거 번복하는 것이 아니라 오히려
그 결정을 코드가 뒤늦게 따라잡는 방향이었다. 유일하게 남는 항목은 `spec/1-data-model.md` §2.2 Workspace
`owner_id` 행이 이번에 명시화된 `ON DELETE CASCADE` 를 아직 서술하지 않는 것인데, 이는 developer 자신이
착수 전 검토에서 이미 발견해 planner 트래커(`spec-draft-nullable-notation-followups.md` 4683행)에
등재했고 개발 권한 밖이라 위임한 것으로, 은폐된 drift 가 아니라 정상적으로 처리 중인 항목이다. Rationale
연속성 관점에서 이 PR 이 새로 만드는 위험은 없다.

## 위험도

NONE
