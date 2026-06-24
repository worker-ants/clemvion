# 신규 식별자 충돌 검토 — C-2 2차 슬라이스 (ai-turn-executor.ts 잔여 god-method 분해)

**검토 범위**: `03-maintainability C-2` 2차 슬라이스 — `executeSingleTurn` tool-loop/completion 단계와 `processMultiTurnMessage` (~768줄) 를 spec §6.1/§6.2 정렬 private 메서드로 분해.

도입 예정 신규 식별자 (plan `03-maintainability.md §C-2 개선 방안 1` 기준):
- `buildTurnMessages` (§6.2 d.5/d.6)
- `executeToolBatch` (기존 메서드 확대)
- `classifyTurnResult` (§6.2 3 판정)
- `handleTurnCompletion` (turn push·checkpoint)

---

## 발견사항

### [INFO] `executeToolBatch` 와 기존 `executeProviderToolBatch` 간 역할 경계 불명확

- target 신규 식별자: `executeToolBatch` — §6.2 단계 정렬 multi-turn 도구 실행 메서드
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-c2-toolloop-multiturn-0747ef/codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:794` — `private async executeProviderToolBatch(args: {...})` 가 동일 클래스 `AiTurnExecutor` 내에 존재하며 single-turn 및 multi-turn 양 경로(`executeSingleTurn:1343`, `processMultiTurnMessage:2232`)에서 호출됨
- 상세: plan 이 `executeToolBatch` 를 "기존 메서드 확대" 로 기술하고 있어 `executeProviderToolBatch` 를 리네임하는 방향과 `executeToolBatch` 를 신규 wrapper 로 추가하는 방향이 모두 가능. 두 이름이 동일 클래스 내에 공존하면 역할 혼동이 발생함. 동일 이름 충돌은 아니나 의미 근접으로 혼선 유발 가능.
- 제안: (a) `executeProviderToolBatch` 를 `executeToolBatch` 로 리네임해 단일 이름으로 통합하거나, (b) 신규 메서드를 `executeMultiTurnToolBatch` 로 명명해 single-turn 경로 (`executeProviderToolBatch`) 와 multi-turn 경로를 명확히 구분. 어느 쪽이든 메서드 doc 에 §6.1/§6.2 단계번호 명기.

### [INFO] `classifyTurnResult` 와 동일 패키지의 `classify*` prefix 공유

- target 신규 식별자: `classifyTurnResult` — `AiTurnExecutor` 내 private 메서드, §6.2 3 판정
- 기존 사용처:
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-c2-toolloop-multiturn-0747ef/codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts:98` — `classifyToolCalls` (도구 종류 분류)
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-03-c2-toolloop-multiturn-0747ef/codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1049` — `classifyLlmError` (LLM 에러 분류)
- 상세: 세 메서드는 각각 다른 클래스에 속하고 TypeScript 레벨 이름 충돌은 없음. 의미도 `classifyToolCalls` = 도구 종류 분류, `classifyLlmError` = LLM 에러 분류, `classifyTurnResult` = turn 종결 판정으로 각각 다름. 그러나 동일 패키지(ai-agent 디렉토리 및 인접 실행엔진 모듈)에 `classify*` prefix 3개가 공존해 독자가 관계를 오해할 수 있음.
- 제안: 대안 명명 — `determineTurnOutcome` 또는 `resolveTurnCompletion`. 기술적 충돌이 아니므로 현행 `classifyTurnResult` 유지도 무방하나, 메서드 doc 에 "§6.2 turn 종결 3 판정 — classifyToolCalls(도구 분류)·classifyLlmError(에러 분류)와 별개" 를 명기하면 혼동 차단.

---

## 충돌 없음 확인 항목

- **`buildTurnMessages`**: codebase 전체 grep 결과 기존 사용처 없음. 기존 `buildSingleTurnMessages` (§6.1 single-turn 전용, `:977`) 와 명명 영역 충돌 없음.
- **`handleTurnCompletion`**: codebase 전체 grep 결과 기존 사용처 없음. 충돌 없음.
- **요구사항 ID 충돌**: 없음 (spec 변경 불요, 신규 ID 미부여).
- **엔티티/타입명 충돌**: 없음 (private 메서드 추가, 공개 타입 미변경).
- **API endpoint 충돌**: 해당 없음 (내부 리팩토링).
- **이벤트/메시지명 충돌**: 해당 없음.
- **환경변수·설정키 충돌**: 해당 없음.
- **파일 경로 충돌**: 해당 없음 (신규 파일 미생성, `ai-turn-executor.ts` 내부 분해).

---

## 요약

이번 C-2 2차 슬라이스가 도입하는 4개 신규 메서드명(`buildTurnMessages`, `executeToolBatch`, `classifyTurnResult`, `handleTurnCompletion`) 은 기존 spec·codebase 어디에도 동일 이름으로 등록되어 있지 않아 CRITICAL/WARNING 수준의 식별자 충돌은 존재하지 않는다. `executeToolBatch` 는 동일 클래스 내 기존 `executeProviderToolBatch` 와 역할 경계가 불명확해질 수 있고, `classifyTurnResult` 는 동일 패키지 내 `classifyToolCalls`·`classifyLlmError` 와 `classify*` prefix 를 공유해 독자가 혼동할 여지가 있다. 두 사항 모두 INFO 수준으로, 메서드 doc 에 §6.1/§6.2 단계번호와 역할 구분을 명기하는 것만으로 충분히 해소된다.

## 위험도

NONE

---

STATUS: OK
