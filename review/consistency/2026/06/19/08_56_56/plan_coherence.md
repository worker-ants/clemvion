# Plan 정합성 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
Target: `spec/4-nodes/3-ai/`
분석 기준일: 2026-06-19

---

## 발견사항

### [INFO] `meta.turnDebug[]` shape SoT 지정 — spec 표 vs shared 타입 주석 불일치 가능성

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §6 토큰 회계` — `meta.turnDebug` 설명이 `[{ turnIndex, llmCalls, totalDurationMs, toolCalls?, ragSources?, ragDiagnostics? }, ...]` 형태로 인라인 기술.
- **관련 plan**: 이번 worktree(`llm-record-types-194991`)의 유일 변경 커밋 `f70dbbfa` — `shared/llm-tracing/llm-call-record.ts` 신설(`LlmCallRecord` / `TurnDebugEntry`) + 두 핸들러 로컬 타입 교체.
- **상세**: `llm-call-record.ts` JSDoc 은 `spec/5-system/6-websocket-protocol.md §4.4` 를 SoT 로 지칭하는 반면, AI 노드 spec(`spec/4-nodes/3-ai/0-common.md §6`)은 `TurnDebugEntry` 의 shape 을 인라인으로도 기술하고 있다. `TurnDebugEntry` 에 `toolCalls?` / `ragSources?` / `ragDiagnostics?` 필드가 spec 에는 언급되어 있으나 shared 타입에는 없다. 현재 해당 필드들은 핸들러에서 직접 infer 되므로 런타임 직렬화는 무변이지만, 추후 타입 소비자가 `TurnDebugEntry` 를 imported 타입으로 사용하면 누락 필드를 인식하지 못할 수 있다.
- **제안**: 이번 변경이 type-only 리팩토링이므로 즉시 차단 필요는 없다. `ai-context-memory-followup-v2.md` 의 `§7.1 meta.memory.compactedMessages?` 추가 backlog 작업 시 `TurnDebugEntry` 에도 `toolCalls?` / `ragSources?` / `ragDiagnostics?` 를 추가해 spec 과 타입이 일치하도록 `llm-call-record.ts` 를 갱신하는 것을 권장. `ai-context-memory-followup-v2.md` backlog 에 항목 등재 고려.

---

### [INFO] `ai-agent-tool-connection-rewrite.md` §1 미결 결정과 target spec 내 "재작성 예정" 박스

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §1` (경고 박스 "재작성 예정 (현재 제거됨)") 및 §4 Tool Area 연동 절.
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md §1` — 도구 등록 모델(a/b/c), 도구 시그니처 위치, 도구 호출 실행 컨텍스트, 도구 결과 라우팅, ND-AG-21 우선순위 재확인 등 5개 결정 항목 TBD.
- **상세**: 이번 worktree 변경(`llm-record-types-194991`)은 tool area 와 무관하므로 충돌은 없다. 단, target spec(`1-ai-agent.md`)의 §4 비활성 박스와 plan 의 "결정 기록 (사용자 답변 후 채워질 자리)" 상태가 그대로 유지되고 있음을 확인.
- **제안**: 이번 변경과 무관하므로 조치 불요. 추적 메모로 기록.

---

## 요약

현재 worktree(`llm-record-types-194991`)의 변경은 `shared/llm-tracing/llm-call-record.ts` 신설 및 두 핸들러의 로컬 타입을 shared import 로 교체하는 순수 type-only 리팩토링이다. `spec/4-nodes/3-ai/` 파일은 이 브랜치에서 변경되지 않았으므로, 미해결 결정 우회나 선행 plan 미해소에 해당하는 CRITICAL/WARNING 충돌은 없다. 다만 `TurnDebugEntry` 의 shared 타입 정의가 spec 의 `meta.turnDebug[]` 인라인 기술(`toolCalls?` / `ragSources?` / `ragDiagnostics?` 포함)과 완전히 일치하지 않아 추후 타입 소비자에게 혼선을 줄 수 있는 INFO 수준 추적 항목 2건을 기록한다.

## 위험도

NONE
