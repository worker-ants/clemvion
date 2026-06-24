### 발견사항

- **[WARNING]** `refactor/02-architecture.md` M-1 planner 후속 항목과 target 의 "변경 불요" 결론 간 미동기
  - target 위치: `spec-draft-m1-residual-sync.md` §파일 2 — "변경 불요 — `FORM_SUBMITTED_*` 상수의 SoT 파일 경로 갱신 대상 부재"
  - 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/plan/in-progress/refactor/02-architecture.md` L131 — M-1 planner 후속 SPEC-DRIFT 항목: "`interaction-type-registry.md` frontmatter·§12.6 SoT 참조 경로 갱신(`FORM_SUBMITTED_*` 이동 반영)"
  - 상세: plan 의 M-1 planner 후속 목록은 `interaction-type-registry.md` 갱신을 명시 작업 항목으로 열거한다. target(`spec-draft-m1-residual-sync.md`)은 grep 전수 조사 결과 "해당 SoT 경로 표기가 존재하지 않아 갱신 대상 없음"으로 결론내리고 "변경 불요"를 선언한다. 이는 미결 결정을 우회하는 충돌이 아니라 조사 기반 폐기(investigation-led dismissal)이지만, plan 에는 이 조사 결과가 반영되지 않아 후속 작업자가 중복 조사하거나 이미 폐기된 항목을 재시도할 수 있다.
  - 제안: plan `refactor/02-architecture.md` L131 의 "`interaction-type-registry.md` frontmatter·§12.6 SoT 참조 경로 갱신" 항목에 "(→ `spec-draft-m1-residual-sync.md` 조사 결과 변경 불요 — 해당 경로 표기 부재 확인)" 주석을 추가하거나, target 실행 후 해당 항목을 명시적으로 "N/A" 처리한다. plan 쪽 갱신이 적합하다.

- **[INFO]** `ai-context-memory-followup-v2.md` 완료 항목 내 stale 핸들러 참조
  - target 위치: 해당 없음 (target 이 직접 참조하지 않음)
  - 관련 plan: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/plan/in-progress/ai-context-memory-followup-v2.md` L22 — "[x] 멀티턴 누적 messages 물리 축소 … 구현: `agent-memory-injection.ts` (순수 함수) + `ai-agent.handler.ts` 멀티턴 경로 배선."
  - 상세: M-1 3단계 완료로 멀티턴 경로 배선이 `ai-agent.handler.ts` 에서 `AiTurnExecutor` 로 이전됐다. 그러나 해당 항목은 이미 [x] 완료 처리된 이력 기술이므로 미결 결정·후속 항목과 무관하다. target 이 추가하는 doc-sync 는 이 이력 기술과 행위 계약 면에서 충돌하지 않는다.
  - 제안: 필요 시 추적용 메모로만 남긴다. 행위 정합·차단 필요 없음.

### 요약

target 문서(`spec-draft-m1-residual-sync.md`)는 `refactor/02-architecture.md` M-1 planner 후속으로 명시된 SPEC-DRIFT 항목들 중 PR #685 미반영분을 편집안으로 정리한 것으로, 미결 결정을 우회하거나 선행 plan 미해소 사전조건을 무시하는 충돌은 없다. 단 하나의 주의사항은 plan 이 `interaction-type-registry.md` 갱신을 작업 항목으로 열거하고 있으나 target 이 조사 결과 "변경 불요(대상 부재)"로 폐기했는데 이 결론이 plan 에 반영되지 않은 점이다. 이는 후속 작업자의 중복 작업 가능성을 낳는 WARNING 수준 비동기로, plan 쪽에 "변경 불요 확인" 주석을 추가해 해소하는 것이 적합하다.

### 위험도

LOW
