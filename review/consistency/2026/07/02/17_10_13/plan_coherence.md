# Plan 정합성 검토 — spec/4-nodes/3-ai/1-ai-agent.md (impl-done, M-7 relay 클러스터)

## 검토 개요

- 검토 모드: impl-done, diff-base `origin/main`
- target 문서: `spec/4-nodes/3-ai/1-ai-agent.md` — 실제로는 본 target 에 diff 없음 (prompt 상 "구현 대상 spec 영역: (없음)")
- 실제 코드 변경: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — `narrowResumeState(state: Record<string, unknown>): ResumeState` 단일 진입점 신설, `buildAiNodeRefFromState`/`threadHolderFromState` 시그니처를 `Record<string, unknown>` → `ResumeState` 로 좁히고, 여러 호출부의 산발적 `state as ResumeState` 캐스트를 이 헬퍼 호출로 치환. 주석에 "컴파일 타임 캐스트만 — 런타임 no-op" 명시된 순수 내부 리팩터링(M-7 클러스터 연속 작업, 선행 커밋 `27225ae39`~`7dac23944`).

## 관련 plan 대조

- `plan/in-progress/ai-agent-tool-connection-rewrite.md` — "의존성·리스크" 절에 "multi-turn 도중 도구 호출 → blocking 노드(form/buttons) 진입 시 AI Agent 의 `_resumeState` 관리 복잡도 증가"라는 리스크 메모가 있음. 이번 변경은 `_resumeState` 의 필드 구조·정책을 바꾸지 않고 기존 산발적 캐스트를 단일 헬퍼로 일관화(오히려 복잡도 완화 방향)한 것이라, 이 plan 이 "결정 필요"로 남긴 항목(도구 등록 모델 a/b/c, 도구 시그니처 위치, 실행 컨텍스트, 결과 라우팅, ND-AG-21 우선순위)과 접점이 없음. 충돌 없음.
- `plan/in-progress/ai-context-memory-followup-v2.md` — `_resumeState`/`ResumeState` 관련 항목(멀티턴 누적 압축, watermark 등)은 전부 `[x]` 완료 표기. 미완료 항목("Batch 2 후속" 2건)은 `node-output.md`/`3-information-extractor.md` 의 `meta.memory`·`lastExtractionTurnSeq` 명명 정정으로, 본 변경(`narrowResumeState` 헬퍼, `buildAiNodeRefFromState`/`threadHolderFromState` 타입 시그니처)과 대상 필드·파일이 겹치지 않음. 충돌 없음.
- 그 외 in-progress plan(`cafe24-*`, `chat-channel-*` 등)은 target 영역(AI Agent 노드)과 무관.

## 발견사항

없음. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 유형에도 해당하는 항목을 찾지 못함.

## 요약

이번 변경은 `ai-turn-executor.ts` 내부의 `state as ResumeState` 반복 캐스트를 `narrowResumeState` 단일 헬퍼로 통합하고 두 개 private 메서드의 파라미터 타입을 `Record<string, unknown>` 에서 `ResumeState` 로 좁힌 순수 컴파일타임 리팩터링이며, target spec 문서 자체에는 diff 가 없다. `_resumeState` 를 다루는 두 진행 중 plan(`ai-agent-tool-connection-rewrite.md`, `ai-context-memory-followup-v2.md`) 의 미해결 결정·미완료 항목과는 대상 필드·파일이 겹치지 않아 결정 우회나 후속 항목 무효화가 발생하지 않는다. Plan 정합성 관점에서 이슈 없음.

## 위험도

NONE

STATUS: OK
