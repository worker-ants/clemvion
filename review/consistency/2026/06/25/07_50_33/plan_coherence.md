# Plan 정합성 검토 결과

## 발견사항

### [INFO] 02-architecture.md W#1 defer 항목의 공식 후속 작업임을 plan 에 명기 권장

- target 위치: 검토 모드 설명 ("C-2 후속(W7 SPEC-DRIFT 해소)")
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` line 130 — `W#1 condition toolCallCount++ = pre-existing → behavior-preserving 보존·별건 spec-aligned 수정 위임`
- 상세: 02-architecture.md M-1 3단계 PR 의 ai-review 에서 `condition toolCallCount++` 가 WARNING W#1 로 발견됐고, 당시 "behavior-preserving 보존·별건 spec-aligned 수정 위임" 으로 명시 defer 됐다. 본 target 은 정확히 그 "별건 spec-aligned 수정" 에 해당한다 — 즉 미해결 결정을 우회하는 것이 아니라 합의된 후속 작업이다. plan 03-maintainability.md 의 C-2 항목에는 "1차 슬라이스 완료" 기록과 "2차 슬라이스(별 PR)" 예고만 있고, 이 W7 SPEC-DRIFT 수정이 C-2 후속으로 추적됨이 명기되어 있지 않다.
- 제안: 구현 착수 전 또는 완료 후 plan/in-progress/refactor/03-maintainability.md C-2 항목에 "W7 SPEC-DRIFT 해소 PR (별도 슬라이스: recordMultiTurnNonProviderToolResults condition deferral toolCallCount++ 제거)" 를 한 줄 추가해 02-architecture.md defer 추적과 03-maintainability.md C-2 간 연결고리를 명시한다. 비차단 — 추적성 개선 권장 수준.

---

## 요약

검토 결과 충돌·차단 요인은 없다. 본 target(C-2 후속 W7 SPEC-DRIFT 해소)은 `plan/in-progress/refactor/02-architecture.md` M-1 3단계 ai-review 에서 `W#1 condition toolCallCount++ → 별건 spec-aligned 수정 위임` 으로 명시 defer 된 항목의 공식 후속이다. spec `4-nodes/3-ai/1-ai-agent.md §7.1` 은 `meta.toolCalls` 를 "KB·MCP·일반 도구 합산, 조건 도구 제외" 로 이미 확정 규정하고 있어 "spec 변경 불요" 주장도 spec 원문과 일치한다. 단, 03-maintainability.md C-2 항목에 이 SPEC-DRIFT 수정 슬라이스가 추적되지 않아 plan 간 연결이 암묵적으로만 존재한다 — 완료 후 C-2 항목을 한 줄 갱신해 연결고리를 남기는 것이 권장된다.

## 위험도

NONE
