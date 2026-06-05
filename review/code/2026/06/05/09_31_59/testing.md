# 테스트(Testing) 코드 리뷰

## 발견사항

### [INFO] `rehydrateConversationThread` — turns 내 개별 아이템 손상 케이스 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/shared/conversation-thread/conversation-thread.types.spec.ts`
- 상세: `rehydrateConversationThread` 의 `turns` 배열 자체가 손상(비-배열)인 경우는 테스트됐으나, 배열 내 개별 아이템이 `null` 이거나 `text` 필드가 누락된 경우 `totalChars` 계산 로직의 `typeof t?.text === 'string'` 분기가 커버되는지 단독 테스트가 없다. 구현 코드에서 `t?.text` 가 `null`, `undefined`, `number` 인 경우 0으로 처리하는 방어로직이 존재하는데, 실제로 해당 경로를 단언하는 케이스가 누락됐다.
- 제안: `turns: [{ seq: 0, text: null }, { seq: 1 }]` 과 같이 text 가 비정상인 turn 이 섞인 경우 `totalChars` 가 0으로 계산되는지 검증하는 케이스를 추가한다.

### [INFO] `rehydrateContext` — 기존 in-memory context 있을 때 early-return 경로 단언 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- 상세: 테스트에서 `ctxSubject().contextService.deleteContext(...)` 를 매 케이스 앞에서 명시적으로 호출해 early-return 경로를 의도적으로 피하고 있다. 하지만 early-return 케이스(이미 컨텍스트가 있을 때 `rehydrateContext` 가 기존 컨텍스트를 그대로 반환하는 경로)에 대한 테스트가 없다. 이 경우 persisted thread 를 무시하는 동작이 의도된 것인지, 혹은 in-memory context 에 이미 더 최신 thread 가 있으므로 덮어쓰지 않는 것인지에 대한 의도를 단언으로 명시할 필요가 있다.
- 제안: deleteContext 없이 rehydrateContext 를 호출했을 때 기존 in-memory thread 가 유지되는 것을 확인하는 케이스를 추가하거나, 최소한 주석으로 의도를 명확히 문서화한다.

### [INFO] `stageConversationThreadSnapshot` — 3개 park 지점(form/button/ai) 호출 여부 통합 검증 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- 상세: `stageConversationThreadSnapshot` 헬퍼 자체의 동작(cloneThread + 값 동등, 참조 분리)은 잘 검증됐다. 그러나 form/button/ai 세 park 지점 각각에서 실제로 `stageConversationThreadSnapshot → updateExecutionStatus` 가 올바른 순서로 호출되는지 확인하는 통합형 단위 테스트가 없다. 헬퍼가 뒤에서 원자 커밋을 보장한다는 spec 약속(§7.5)이 실제 park 진입 흐름 안에서 지켜지는지 검증하는 테스트가 미비하다.
- 제안: form park / button park / ai park 시나리오별로 `updateExecutionStatus` mock 이 호출될 때 `execution.conversationThread` 에 스냅샷이 이미 스테이징돼 있는지 확인하는 케이스를 추가하거나, 기존 통합 테스트에 thread snapshot 단언을 보강한다.

### [INFO] `createContext` — `conversationThread` 옵션 타입 호환성(frozen/readonly turns) 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/src/modules/execution-engine/context/execution-context.service.spec.ts`
- 상세: 테스트에서 `conversationThread` 로 넘기는 객체를 `MutableConversationThread` 타입으로 명시적으로 캐스팅(`as const`)하고 있으나, `ConversationThread`(readonly turns) 를 옵션에 직접 넘겼을 때 타입 에러 없이 처리되는지를 검증하는 케이스가 없다. 인터페이스 계층 사이에서 mutable/readonly 불일치가 발생할 소지가 있으나 컴파일·런타임 모두 단언이 없다.
- 제안: 현재 커버리지 수준에서 치명적 갭은 아니나, `conversationThread` 옵션에 readonly turns 를 가진 `ConversationThread` 를 넘겼을 때 타입 에러가 발생하는지 확인하는 타입 레벨 테스트(또는 `tsconfig` strict 확인)를 보강하면 인터페이스 계약을 명확히 할 수 있다.

### [INFO] 마이그레이션 V083 — 롤백/멱등성 검증 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-durable-resume/codebase/backend/migrations/V083__execution_conversation_thread.sql`
- 상세: 신규 `ALTER TABLE execution ADD COLUMN conversation_thread JSONB NULL` 마이그레이션에 대해 단순 `ADD COLUMN` 이므로 기존 rows 에 NULL 이 채워지는 회귀 없음 동작은 구현 코드에서 단언됐다. 그러나 migration-guard 통과 여부는 커밋 메시지에서만 확인("migration-guard OK")되고 실제 테스트 파일이 존재하지 않는다. 배포 이전 row 에 대한 rehydration 경로(`NULL → 빈 thread`)는 `execution-engine.service.spec.ts` 에서 단위 테스트로 커버됐으므로 이 항목은 낮은 위험도다.
- 제안: 현재 수준에서 수용 가능하나, Flyway/migration-guard 테스트가 CI에서 별도 실행됨을 코드 베이스 내에서 확인 가능한 경우 특이사항 없음. 아니라면 `ADD COLUMN` idempotency(이미 컬럼이 있을 때 재실행 방어) 검증을 마이그레이션 스크립트에 `IF NOT EXISTS` 조건으로 보완하는 것을 고려한다.

## 요약

이번 PR-A1 변경에 대한 테스트 커버리지는 전반적으로 양호하다. `rehydrateConversationThread` 정규화기에 대해 null/undefined·비객체 손상·eviction-aware nextSeq·totalChars 재계산·참조 분리 등 핵심 경계 케이스 13개가 독립적으로 검증되어 있으며, `createContext` 의 thread 옵션 주입(재수화/회귀 가드 2개)과 `rehydrateContext` 의 무손실 복원·NULL 회귀·park 스냅샷 스테이징(3개) 모두 커버됐다. 발견된 사항들은 모두 INFO 수준으로, turns 내 개별 아이템 손상 케이스, early-return 분기의 명시적 단언, 3개 park 지점의 통합 snapshot-before-commit 검증이 없다는 점이 주요 갭이나 현재 구현의 정확성을 위협하는 수준은 아니다. 테스트 격리(각 케이스별 deleteContext 호출)와 가독성(spec 섹션 cross-reference 주석)은 우수하며 745 모듈 전체 green 이 확인된 상태다.

## 위험도

LOW

STATUS: OK
