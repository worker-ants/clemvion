# Plan 정합성 검토 — target: `spec/3-workflow-editor/`

## 전제 확인

- `spec/3-workflow-editor/` 는 이 브랜치(diff-base `origin/main`)에서 **델타 0** — 이번 PR 은 `codebase/backend/src/modules/*/entities/*.entity.ts` 9곳 컬럼 선언 정정 + `entity-schema-declarations.e2e-spec.ts` 컬럼 층 가드 확장뿐이다. `git -C <worktree> diff --stat origin/main...HEAD` 로 확인 — frontend·workflow-editor 코드 변경 없음.
- 관련 plan 은 `plan/in-progress/entity-column-declaration-drift.md`(이 작업 본체, `spec_impact: none`)와 `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커, 항목 추가만).
- 이번 정정 9곳 중 `spec/3-workflow-editor/` 관련 엔티티는 `nodes/entities/node.entity.ts`(`category` 컬럼에 `enumName: 'node_category'` 추가) · `edges/entities/edge.entity.ts`(`type` 컬럼에 `enumName: 'edge_type'` 추가) · `workflow-assistant/entities/workflow-assistant-session.entity.ts`(`last_interaction_at` 에 `default: () => 'now()'` 추가) 셋이다. plan 문서 자체가 밝히듯 이 변경은 **enum 값·API 계약을 바꾸지 않고** TypeORM 스키마 비교기가 실제 DB 와 같은 이름/기본값을 인지하도록 선언을 맞추는 것뿐이며, `default` 선언의 유일한 런타임 영향(insert 후 `RETURNING`)은 전체 e2e 로 검증됐다고 plan 에 기록돼 있다.

## 점검 결과

1. **미해결 결정과의 충돌** — 없음. `spec/3-workflow-editor/*.md` 를 grep 했을 때(`결정 필요`·`TBD`·`미해결`·`추후 결정`) 이번 diff 와 관련된 미해결 결정 표시는 없다(`_product-overview.md` ED-AI-12 의 "미해결 질문(openQuestions)"·`4-ai-assistant.md` 의 `WORKFLOW_REVIEW_REQUIRED` 는 제품 기능 설명일 뿐 이 작업과 무관). entity-column-declaration-drift.md 의 사용자 결정("고치고 가드 확장")은 이미 합의됐고 target 문서와 상충하지 않는다.
2. **선행 plan 미해소** — 없음. target 문서가 이번 컬럼 정정에 의존하는 전제(예: `node_category`/`edge_type` enum 이름, `workflow_assistant_session.last_interaction_at` 기본값)를 서술한 곳이 없다 — `spec/3-workflow-editor/2-edge.md`(엣지 타입·색상 규칙)는 제품 레벨 개념만 다루고 DB enum 이름을 언급하지 않는다. `4-ai-assistant.md` 에도 `last_interaction_at`/`now()` 관련 서술 없음(grep 0건).
3. **후속 항목 누락** — 실질적 충돌은 없으나 참고용 연결 하나: `plan/in-progress/marketplace-and-plugin-sdk.md` Phase D 레이어3 항목이 "`NodeCategory` DB enum 마이그레이션 필요(현재 `custom` 미포함 — `node.entity.ts` enum)"를 미착수 TODO 로 갖고 있다. 이번 diff 는 `NodeCategory` 의 enum **값**은 그대로 두고 `enumName: 'node_category'` 만 명시했다 — 오히려 그 미래 마이그레이션이 타겟팅할 실제 DB 타입 이름을 지금 코드로 확정해 준다(이전엔 TypeORM 추론 이름에 의존해 암묵적이었다). target 문서(`spec/3-workflow-editor`)에는 이 사실을 반영할 내용이 없고 반영할 필요도 없다 — 순수 백엔드 스키마 선언 층 이슈라 워크플로우 에디터 스펙의 서술 대상이 아니다. WARNING 으로 올릴 사안은 아니며, 후속 착수자를 위한 참고 메모로만 남긴다.

## 발견사항

- **[INFO]** `NodeCategory` enum 이름이 이번 커밋으로 명시적으로 고정됨
  - target 위치: 해당 없음(`spec/3-workflow-editor/*.md` 는 이 사실을 서술하지 않으며 서술할 필요도 없음)
  - 관련 plan: `plan/in-progress/marketplace-and-plugin-sdk.md` Phase D 레이어3 — "`NodeCategory` DB enum 마이그레이션 필요(현재 `custom` 미포함)"
  - 상세: `codebase/backend/src/modules/nodes/entities/node.entity.ts` 의 `category` 컬럼이 이번 diff 로 `enumName: 'node_category'` 를 명시했다(값 추가 아님, 이름 고정뿐). 마켓플레이스 plan 이 나중에 `custom` 값을 추가하는 마이그레이션을 작성할 때 대상 타입 이름을 코드에서 바로 확인할 수 있게 됐다 — 충돌이 아니라 그 작업의 전제 하나가 이번에 명확해진 것.
  - 제안: 별도 조치 불필요. 마켓플레이스 plan 착수 시 참고만 하면 된다.

## 요약

이번 PR 은 `spec/3-workflow-editor/` 를 전혀 변경하지 않았고(델타 0), 실제 코드 diff 도 그 스펙이 서술하는 프론트엔드/워크플로우 에디터 동작이 아니라 백엔드 엔티티 컬럼 선언(TypeORM ↔ 실제 DB 정합)에 국한된다. `plan/in-progress/entity-column-declaration-drift.md` 는 사용자 결정이 이미 합의된 상태로 진행 중이며 `spec_impact: none` 이 실측(그 어떤 target 서술도 이 컬럼 정정에 의존하지 않음)과 일치한다. `plan/in-progress/marketplace-and-plugin-sdk.md` 의 `NodeCategory` 마이그레이션 TODO 와 약하게 연결되지만 상충이나 후속 누락은 없다 — 참고용 INFO 하나만 남긴다. Plan 정합성 관점에서 이 target 변경(정확히는 무변경)은 문제가 없다.

## 위험도

NONE
