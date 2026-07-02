# Cross-Spec 일관성 검토 — target: spec/4-nodes/3-ai/1-ai-agent.md (impl-done)

## 검토 대상 요약

- 검토 모드: `--impl-done`, scope=`spec/4-nodes/3-ai/1-ai-agent.md`, diff-base=`origin/main`
- `git diff origin/main...HEAD --stat` 결과 실제 변경 파일은 **`codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` 단 1개**이며, `spec/**` 는 이번 변경에서 전혀 수정되지 않았다 (`git diff origin/main...HEAD -- spec/` 결과 empty).
- 변경 내용은 M-7 클러스터의 일부로, `AiTurnExecutor` 내부에 `narrowResumeState(state: Record<string, unknown>): ResumeState` private 헬퍼를 신설하고, 기존 3곳에 흩어져 있던 `state as ResumeState` 인라인 캐스트를 이 헬퍼 호출로 치환한 것이다. 또한 `buildAiNodeRefFromState` / `threadHolderFromState` 시그니처를 `Record<string, unknown>` → `ResumeState` 로 좁혔다.
- 런타임 동작 변화 없음 (컴파일 타임 타입 좁히기만, `state` 는 재할당되지 않는다는 전제하의 no-op 캐스트). 신규 엔티티·필드·API·요구사항 ID·상태 전이·권한 모델·계층 경계 변경 없음.

## 발견사항

없음. 아래는 점검 관점별로 확인한 근거다.

- **데이터 모델 충돌**: 신규/변경 엔티티·필드 없음. `ResumeState`/`RetryState` 는 기존 M-7 클러스터(선행 커밋 `bb4ddf6b9`, `7dac23944`)에서 이미 도입된 in-memory(비영속) 타입이며 `spec/1-data-model.md` 의 DB 엔티티와 무관. 해당 이름의 spec 언급도 없음(`grep -rn "ResumeState" spec/` 0건).
- **API 계약 충돌**: endpoint·요청/응답 shape 변경 없음. private 메서드 시그니처만 변경.
- **요구사항 ID 충돌**: 신규 요구사항 ID 부여 없음.
- **상태 전이 충돌**: AI Agent 노드의 turn/resume 상태 전이 로직 자체는 변경되지 않았다 (기존 `state as ResumeState` 캐스트를 헬퍼 호출로 치환했을 뿐, 분기·조건은 그대로).
- **권한·RBAC 모델 충돌**: 해당 없음 (이 코드 경로는 권한 로직과 무관).
- **계층 책임 충돌**: 변경이 `AiTurnExecutor` 클래스 내부(같은 파일, 같은 계층)에 한정되어 있어 코드베이스 영역 간 책임 분할에 영향 없음.

target 문서(`spec/4-nodes/3-ai/1-ai-agent.md`) 자체가 이번 diff 로 수정되지 않았으므로, "target 이 다른 spec 영역과 충돌"할 표면이 존재하지 않는다. 이번 커밋은 순수 코드 리팩터(타입 안전성 인프라 정리)이며 spec 변경을 동반하지 않는 M-7 시리즈의 연속이다.

## 요약

이번 변경은 `spec/4-nodes/3-ai/1-ai-agent.md` 를 포함해 `spec/**` 어디도 수정하지 않은 순수 내부 리팩터(private 헬퍼 추출을 통한 `ResumeState` 캐스트 일원화)이며, git diff 상 유일한 변경 파일은 `ai-turn-executor.ts` 다. 신규 데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 경계 변경이 전혀 없어 Cross-Spec 충돌 표면 자체가 존재하지 않는다.

## 위험도

NONE

STATUS: OK — cross_spec.md written, 0 CRITICAL, 0 WARNING
