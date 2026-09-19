# Cross-Spec 일관성 검토 — cross_spec

## 검토 전제 재확인

- 검토 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`.
- `spec/2-navigation/` 델타: **0개 파일** — 이 브랜치는 그 spec 영역을 바꾸지 않았다.
- 실제 구현 diff: **1개 파일 / 179줄** — `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (working tree 절대경로로 직접 확인: `git -C <worktree> diff origin/main -- codebase/backend/test/entity-schema-declarations.e2e-spec.ts`).
- 이 diff 는 순수 e2e 테스트 파일 변경이다 — 신규 엔티티·API endpoint·요구사항 ID·상태 머신·RBAC 규칙을 도입하지 않는다. `ModelConfig` / `WorkflowAssistantSession` 엔티티를 **import** 해 두 컬럼(`kind` 기본값 `chat`, `last_interaction_at` 기본값 `now()`)이 insert 후 왕복하는지 확인하고, 비교기 연결이 실제로 read-only 인지 검증하는 두 테스트를 추가한 것뿐이다.
- 두 테스트가 검증하는 사실은 이미 `spec/1-data-model.md §2.16 ModelConfig`(`kind` default=`chat`, V088)·`§2.20 AssistantSession`(`last_interaction_at` default=`now()`)에 문서화되어 있고, 이번 diff 는 그 문서화된 계약을 코드 레벨에서 재확인하는 방향(테스트 강화)이지 신규 계약 선언이 아니다. 값도 일치한다 (`kind` default `chat`, `now()` 매칭) — 모순 없음.
- 이 도메인(`model-config` / `workflow-assistant`)은 `spec/2-navigation/`(워크플로우 목록·트리거 목록·스케줄 화면)의 데이터 모델·API·RBAC 와 겹치지 않는다. `spec/2-navigation/*.md` 번들을 전량 검토했으나(workflow-list · trigger-list · schedule 등) 이번 diff 가 그 문서들이 정의하는 엔티티·API·요구사항 ID·상태 전이·권한 모델 어느 것과도 접촉하지 않는다.

## 발견사항

없음 — 이번 diff 는 `spec/2-navigation/` 이 정의하는 어떤 영역(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)과도 접촉하지 않으며, 다른 spec 영역(`spec/1-data-model.md §2.16/§2.20`)이 이미 선언한 기본값 계약과도 일치한다(왕복 값 재확인일 뿐 재정의가 아니다). Cross-spec 관점에서 보고할 CRITICAL/WARNING/INFO 항목이 없다.

참고(cross-spec 범위 밖, 정보 전달용): 테스트 파일 주석이 "근거: `plan/complete/column-guard-gaps.md`" 라고 적었으나 실제로는 `plan/in-progress/column-guard-gaps.md` 로 남아 있다(`ls`/`git log` 로 확인). 이는 plan-doc 동기화 이슈이지 spec-대-spec 충돌이 아니므로 본 리포트의 등급 대상에서 제외한다 — plan_coherence 축에서 다룰 사안이다.

## 요약

이번 diff 는 `spec/2-navigation/` 을 전혀 변경하지 않았고(스코프 델타 0), 실제 구현 변경도 그 영역과 무관한 백엔드 e2e 테스트 파일(`entity-schema-declarations.e2e-spec.ts`) 하나뿐이다. 추가된 두 테스트는 `ModelConfig.kind` 기본값(`chat`)과 `WorkflowAssistantSession.last_interaction_at` 기본값(`now()`)이 insert 후 엔티티로 왕복함을 검증하는데, 두 값 모두 `spec/1-data-model.md §2.16`·`§2.20` 이 이미 선언한 계약과 정확히 일치하므로 신규 모순이나 중복 정의가 없다. `spec/2-navigation/` 이 정의하는 워크플로우 목록·트리거 목록·스케줄 화면의 엔티티·API·요구사항 ID·상태 전이·RBAC 어느 것도 이번 diff 와 접촉하지 않아 cross-spec 충돌 표면 자체가 존재하지 않는다.

## 위험도

NONE
