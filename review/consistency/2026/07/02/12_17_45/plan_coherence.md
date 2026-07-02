# Plan 정합성 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 발견사항

없음.

target 구현 변경(`utils/resume-state.schema.ts` 신설 + `ai-turn-orchestrator.service.ts` /
`execution-engine.service.ts` / `retry-turn.service.ts` / `handler-output.adapter.ts` 의
`_resumeState`/`_resumeCheckpoint`/`_retryState` 구조 단언을 `ResumeState`/`ResumeCheckpoint`/
`RetryState` zod-파생 타입으로 대체)은 `plan/in-progress/refactor/03-maintainability.md` §M-7
"RESUME-STATE 클러스터" 항목과 정확히 일치한다:

- 해당 plan 은 이 작업을 "본 PR" 로 명시하고 사용자 결정(2026-07-02: "런타임 경계에서 parse 하지
  않고 스키마는 allow-list 문서화·타입 파생·단위 테스트 oracle 로만 사용")을 이미 기록해 두었다.
  target 코드의 주석("behavior-preserving — 본 스키마는 런타임 경계에서 parse/safeParse 하지
  않는다")과 정확히 합치하며, 이 결정을 우회하거나 새로 내리는 부분이 없다 (관점 1 — 충돌 없음).
- 선행 조건인 "첫 클러스터 (PR #782, 머지)" — `utils/to-record.ts`(`isRecord`/`toRecord`)의
  도입 — 은 이미 완료 상태로 plan 에 기록돼 있고, target diff 의 `handler-output.adapter.ts` 가
  `isRecord` 를 import 해 재사용하는 것으로 그 선행 산출물과 정합됨을 확인했다 (관점 2 — 미해소
  선행 plan 없음).
- plan 은 본 클러스터를 "6곳 구조 단언 전환" + 테스트 갱신으로 명시적으로 스코프하고, "후속
  클러스터"(LOAD-BEARING/STORE-PRESERVE/`ai-turn-executor.ts`/relay 시그니처 통일 등)를 별도
  항목으로 이미 남겨 두었다. target 변경이 이 후속 항목들을 무효화하거나 새 후속 항목을 만들어야
  하는 정황은 없다 — plan 자체가 그 경계를 앞서 설계해 두었다 (관점 3 — 후속 항목 누락 없음).
- `plan/in-progress/execution-engine-residual-gaps.md` 에는 resume-state/`_resumeState`/
  `_resumeCheckpoint`/`_retryState` 관련 언급이 전혀 없어 충돌·의존 가능성도 없다.

## 참고 (검토 메모, 비항목)

- 이번 orchestrator payload 의 "plan/in-progress 문서 모음" 에는 정작 본 target 과 가장 밀접한
  `plan/in-progress/refactor/03-maintainability.md` 가 포함돼 있지 않았다 (포함된 6개 plan —
  `ai-agent-tool-connection-rewrite.md` / `ai-context-memory-followup-v2.md` /
  `cafe24-backlog-residual.md` / `chat-channel-discord-gateway.md` /
  `chat-channel-slack-socket-mode.md` / `chat-channel-visual-ssr-png.md` — 는 모두 target 과
  무관). 이번 검토는 워크트리의 실제 `plan/in-progress/refactor/03-maintainability.md` 를 직접
  확인해 정합성을 검증했으므로 결론에는 영향 없으나, payload 선택 로직이 target spec 경로
  (`execution-engine`)와 대응하는 plan 디렉토리(`plan/in-progress/refactor/`, 폴더 형태라 단일
  파일 glob 에서 누락됐을 가능성)를 놓쳤을 수 있다는 점은 orchestrator 측에 참고 메모로 남긴다.

## 요약

target 의 execution-engine resume-state 구조 단언 리팩터링은 `plan/in-progress/refactor/03-maintainability.md`
M-7 "RESUME-STATE 클러스터" 항목이 사전에 정의·결정한 범위·정책(behavior-preserving, 런타임
parse 미적용, allow-list 6곳 전환, 후속 클러스터 분리)과 완전히 일치한다. 미해결 결정 우회,
미해소 선행 조건, 누락된 후속 항목 어느 것도 발견되지 않았다. Plan 정합성 관점에서 이 변경은
사전 합의된 궤도 위의 정상 진행이다.

## 위험도
NONE
