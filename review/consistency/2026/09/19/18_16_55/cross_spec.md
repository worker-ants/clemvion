# Cross-Spec 일관성 검토 — cross_spec

## 검토 대상 요약

- 검토 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
- scope(`spec/2-navigation/`) 델타: 0개 파일 (정상 — 코드 전용 PR)
- 실제 구현 diff: TypeORM 엔티티 8개 파일의 컬럼 선언 정정 + 신규 e2e 가드 테스트(`entity-schema-declarations.e2e-spec.ts`) + plan 문서 2건. `git -C <worktree> diff origin/main...HEAD --stat` 로 직접 실측.
- 변경 엔티티: `AlertRule.workspaceId`, `WorkspaceInvitation.workspaceId`, `IntegrationUsageLog.nodeExecutionId`/`workflowId`, `LlmUsageLog.workspaceId` (모두 `type: 'uuid'` 추가) · `Node.category`/`Edge.type` (`enumName` 추가) · `ModelConfig.kind` (`default: 'chat'` 추가) · `WorkflowAssistantSession.lastInteractionAt` (`default: () => 'now()'` 추가). `synchronize: false` 환경이라 실제 DB 스키마는 변경 없음 — TypeORM 선언을 이미 존재하는 실제 DB 스키마에 맞춰 정정하는 것뿐.

## 발견사항

없음.

이유:

- 변경된 8개 엔티티(AlertRule, WorkspaceInvitation, IntegrationUsageLog, LlmUsageLog, ModelConfig, Node, Edge, WorkflowAssistantSession) 중 어느 것도 `spec/2-navigation/2-trigger-list.md` · `3-schedule.md` (이번에 직접 읽을 수 있었던 두 문서)가 정의하는 엔티티·API·상태 머신·RBAC 와 겹치지 않는다. Trigger·Schedule 엔티티/필드는 이번 diff 에 없다.
- 컬럼 타입 정정(`type: 'uuid'`, `enumName`, `default`)은 **이미 존재하는 실제 DB 스키마 값을 TypeORM 선언에 반영**하는 것으로, 신규 필드·신규 API·신규 상태·신규 권한을 추가하지 않는다. `spec/1-data-model.md` 조회 결과 `ModelConfig.kind`(chat/embedding/rerank) 서술과 이번 `default: 'chat'` 추가가 모순되지 않으며, `node_category` / `edge_type` enum 타입 이름은 spec 어디에도 텍스트로 노출되지 않아(grep 0건) 정합 여부를 다툴 대상 자체가 없다.
- 요구사항 ID·권한·계층 책임 축은 이번 diff 와 무관 — 손댄 파일이 모두 `codebase/backend/src/modules/*/entities/*.entity.ts` + 테스트/plan 뿐이다.
- 앞선 `--impl-prep spec/2-navigation/` (`review/consistency/2026/09/19/16_54_09`)에서 이미 BLOCK:NO(Critical 0)로 통과했고, 그 세션의 WARNING(plan 이름 한 단어 차이)은 이후 커밋·트래커에서 "인덱스·제약 층" vs "컬럼 층"으로 구분 표기해 해소됐다(`plan/in-progress/entity-column-declaration-drift.md` 참고). 그 WARNING 은 naming/plan-coherence 축이라 본 cross-spec 관점의 재확인 대상이 아니다.

## 요약

이번 diff 는 TypeORM 엔티티 8곳의 컬럼 선언(`uuid` 타입 명시·enum 타입 이름·기본값)을 실제 Postgres 스키마와 일치시키는 순수 ORM 메타데이터 정정이며, `synchronize: false` 환경에서 런타임 스키마 자체는 바뀌지 않는다. 손댄 엔티티는 Trigger·Schedule 을 포함해 `spec/2-navigation/` 이 소유하는 어떤 엔티티·API·상태 머신·RBAC 규칙과도 교집합이 없고, 새로 노출되는 필드·엔드포인트·요구사항 ID 도 없다. Cross-Spec 관점에서 이 변경이 다른 spec 영역과 충돌할 표면 자체가 존재하지 않는다.

## 위험도

NONE
