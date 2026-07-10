# 변경 범위(Scope) 리뷰

## 점검 대상 요약

`plan/in-progress/ai-usage-attribution-hardening.md` 가 선언한 작업 범위는 명확히 두 항목이다:

- **B1**: `ai-turn-executor.ts` resume `llmContext` 상수에 `LlmCallContext` 명시 타입 주석 추가 (INFO#1 후속)
- **C1**: AI Agent 자동 메모리(`summary_buffer`) 롤링 요약 압축 chat 에 `llmContext`(attribution) 배선 — single-turn(`context.*`) + multi-turn resume(`state.*`)

변경된 9개 파일을 이 두 항목 기준으로 대조했다.

## 발견사항

- **[INFO]** 타 작업(선행 PR)의 plan 파일 교차 갱신
  - 위치: `plan/in-progress/resume-llm-usage-attribution.md`
  - 상세: 본 PR 코드와 직접 관련 없는 **다른 브랜치/작업**(`elastic-shannon-e52824`, `claude/ie-resume-llm-attribution-c82918`)의 plan 문서를 함께 수정했다. 내용은 (a) "최종 /ai-review INFO#1" 체크박스를 `[x]` 로 갱신하며 "후속 plan `ai-usage-attribution-hardening.md` B1 로 처리(PR-1)" 주석 추가, (b) "잔여 follow-up" 섹션에 본 PR(C1) 완료 후 이관될 spec 정정 항목을 신규 추가하는 것으로, 순수 텍스트/추적 갱신이며 코드·spec 실질 변경은 없다.
  - 제안: 이 프로젝트의 plan 라이프사이클 관례(선행 plan cross-ref 로 follow-up 추적)에 부합하는 의도적 문서 갱신으로 보이며, `ai-usage-attribution-hardening.md` 자체의 `precedent` 필드도 이 관계를 명시하고 있어 정합적이다. Scope 위반이라기보다 관례적 bookkeeping — 별도 조치 불필요. 다만 리뷰어가 "이 파일이 왜 diff 에 있는지" 즉시 알 수 있도록 커밋 메시지/PR 설명에 "cross-ref: 선행 plan 갱신" 한 줄을 명시하면 좋다.

## 코드 변경 세부 대조

- `CHANGELOG.md`: C1 을 설명하는 Unreleased 항목 1개 추가. B1/C1 범위와 정확히 일치, 포맷도 기존 항목 패턴 준수.
- `codebase/backend/src/nodes/ai/shared/agent-memory-injection.ts`: `BuildSummaryBufferArgs` 에 `llmContext?: LlmCallContext` 추가 + `llmService.chat(...)` 3번째 인자로 forward. C1 핵심 배선, 무관 리팩토링 없음. `chat()` 호출부 멀티라인 재포맷은 3번째 인자 추가로 인한 불가피한 변경(순수 포맷팅 아님).
- `codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts`: `injectMemoryContext` 인자에 `llmContext?` 추가, `buildSummaryBufferUpdate` 호출에 forward. C1 정확히 일치. 다른 메서드/로직 무변경.
- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`: (1) single-turn 경로 `context.*` 조립, (2) multi-turn resume 경로 `state.*` 조립 — 둘 다 C1. (3) 기존 resume `llmContext` 상수에 `: LlmCallContext` 타입 주석 — B1. import 변경(`LlmCallContext` 추가)은 이 세 변경에 필요한 최소 범위.
- `*.spec.ts` (3개: `ai-agent.memory.spec.ts`, `ai-memory-manager.spec.ts`, `agent-memory-injection.spec.ts`): 각각 C1 배선을 고정하는 회귀 테스트 추가/보강. `ai-memory-manager.spec.ts` 의 `updateSummaryState: jest.fn()` mock 추가는 신규 테스트가 압축 트리거 경로(`update.summarized && conversationThreadService`)를 타면서 실제로 필요해진 fixture 보강이며 무관한 변경 아님.
- `plan/in-progress/ai-usage-attribution-hardening.md`: 본 작업 신규 plan 문서 — 범위/테스트/워크플로 기록. 관례 준수.

불필요한 리팩토링, 포맷팅 전용 diff, 주석 잡음, 미사용 임포트, 설정 파일 변경, 요청 외 기능 확장은 발견되지 않았다. spec/ 디렉토리는 건드리지 않았고(개발자 read-only 규약 준수), 대신 spec drift 를 plan 문서에 명시적으로 기록해 후속 PR-2 로 이관한 처리도 scope 관리 관점에서 적절하다.

## 요약

변경분은 plan 이 선언한 B1(명시 타입 주석)·C1(메모리 압축 chat attribution 배선) 두 항목에 정확히 대응하며, 프로덕션 코드 3파일 + 대응 테스트 3파일 + CHANGELOG + 신규 plan 문서로 구성된 응집도 높은 diff다. 유일한 특이사항은 선행(별개) 작업의 plan 문서를 교차 갱신한 것인데, 이는 코드 변경이 아니라 이 프로젝트의 plan 추적 관례에 부합하는 문서 bookkeeping이라 scope 위반으로 보기 어렵다.

## 위험도

NONE
