# 정식 규약 준수 검토 — spec/4-nodes/3-ai/

검토 모드: 구현 완료 후 (--impl-done, scope=spec/4-nodes/3-ai/, diff-base=origin/main)
검토 기준: `spec/conventions/` 전체

---

## 발견사항

### **[WARNING]** `0-common.md` frontmatter `code:` 목록에 신규 shared 모듈 미등록
- target 위치: `/spec/4-nodes/3-ai/0-common.md` — frontmatter `code:` 블록 (line 4–11)
- 위반 규약: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" — `code:` frontmatter 는 해당 spec 과 직접 연관된 구현 파일의 목록이며 spec-impl 정합 검토의 추적 단위
- 상세: 이번 PR 에서 도입된 `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` 는 AI 노드 3종이 공유하는 LLM 호출 trace 도메인 타입(`LlmCallRecord`, `TurnDebugEntry`)을 정의하며, `0-common.md §6 meta.turnDebug` / `spec/5-system/6-websocket-protocol.md §4.4` 가 명세하는 shape 의 canonical 코드 진실이다. `0-common.md` 의 `code:` 목록에 반영되지 않았다. `3-information-extractor.md` 에도 마찬가지로 누락되어 있다.
- 제안: `0-common.md` frontmatter `code:` 에 `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` 추가. `3-information-extractor.md` frontmatter `code:` 에도 동일하게 추가.

---

### **[WARNING]** `LlmCallRecord` 의 SoT 주석이 websocket-protocol spec §4.4 를 가리키나, spec 본문에는 shared 모듈 역방향 참조 없음
- target 위치: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` 파일 레벨 JSDoc 및 `0-common.md §6` (line 106), `1-ai-agent.md §8` (line 1015–1067)
- 위반 규약: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" + `spec/conventions/spec-impl-evidence.md` — 코드 ↔ spec 양방향 추적 가능성
- 상세: `llm-call-record.ts` JSDoc 은 `SoT: spec/5-system/6-websocket-protocol.md §4.4` 를 선언하나, spec 역방향(spec → code)으로는 새 파일을 인지하지 못한다. `0-common.md §6 meta.turnDebug` 설명과 `1-ai-agent.md §8` 디버그 데이터 섹션은 `llmCalls[].requestPayload / responsePayload / durationMs / startedAt / finishedAt` 필드를 기술하지만 `shared/llm-tracing/llm-call-record.ts` 가 그 canonical 구현임을 명시하지 않는다. spec 단독으로는 새 공유 타입이 shape 의 SoT 임을 추적할 수 없다.
- 제안: `0-common.md §6` 표 아래 또는 `meta.turnDebug` 설명 줄에 "> 타입 단일 진실: `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` (`LlmCallRecord`, `TurnDebugEntry`)" 한 줄 추가. 또는 `1-ai-agent.md §8` 서두에 동일 주석 삽입. 둘 중 하나(중복 금지 원칙 준수).

---

### **[INFO]** `TurnDebugEntry.llmCalls` 가 spec 인라인 표현에서 필수처럼 읽히나 구현 타입은 optional
- target 위치: `0-common.md §6` line 106 — `[{ turnIndex, llmCalls, totalDurationMs, toolCalls?, ragSources?, ragDiagnostics? }, ...]`
- 위반 규약: `spec/conventions/node-output.md §11` — 선택적 필드는 `?` 표기
- 상세: spec 인라인 표현에서 `llmCalls` 와 `totalDurationMs` 는 `?` 없이 기술되어 필수처럼 읽힌다. 그러나 신규 `LlmCallRecord.ts` 는 `LlmCallRecord` / `TurnDebugEntry` 의 모든 필드를 optional(`?`)로 선언한다 ("all-optional superset"). 기존 로컬 `LlmCallTrace` 는 필수 필드를 가졌으나 공유 타입에서 relaxation 됐다.
- 제안: `0-common.md §6` 의 `meta.turnDebug` 설명을 `[{ turnIndex, llmCalls?, totalDurationMs?, toolCalls?, ragSources?, ragDiagnostics? }, ...]` 로 수정해 구현 타입과 정합. 의도된 relaxation 임을 강조하려면 "필드 전체 optional — 핸들러가 채울 수 있는 만큼만 채운다" 주석 추가.

---

### **[INFO]** 문서 구조: `_product-overview.md` Rationale 섹션 부재
- target 위치: `/spec/4-nodes/3-ai/_product-overview.md`
- 위반 규약: CLAUDE.md "정보 저장 위치" — spec 문서 3섹션 권장 (Overview / 본문 / Rationale)
- 상세: `_product-overview.md` 는 PRD 성격 문서로 Overview·본문은 있으나 Rationale 섹션이 없다. 이 파일은 이번 PR 에서 수정되지 않은 기존 상태이며, PRD 문서에 Rationale 권장이 적용되는지 conventions 에 명시되지 않았다.
- 제안: PRD 성격 문서(`_product-overview.md`) Rationale 면제를 conventions 에 명시하거나 주요 설계 결정을 Rationale 섹션으로 추가. 이번 PR 범위 외로 backlog 처리 가능.

---

## 요약

`spec/4-nodes/3-ai/` 영역의 spec 문서 자체는 노드 출력 규약(`node-output.md` Principle 3·5·8·11), 에러 코드 표기(`UPPER_SNAKE_CASE`), 문서 명명(`_product-overview.md`, `0-` prefix), API/Swagger DTO 패턴 등 주요 정식 규약을 직접 위반하는 항목은 없다. 이번 PR 이 도입한 `codebase/backend/src/shared/llm-tracing/llm-call-record.ts` 가 `0-common.md` 및 `3-information-extractor.md` 의 frontmatter `code:` 에 미등록되어 spec-impl 양방향 추적에 갭이 생겼고(WARNING 1), 동일 파일의 spec 역방향 참조도 없어 shape 의 canonical 구현이 spec 에서 인식되지 않는다(WARNING 2). 추가로 `meta.turnDebug` 인라인 필드 표현의 optional/required 불일치가 경미하게 존재한다(INFO). 신규 코드 자체의 명명 및 구조는 규약과 일치한다.

## 위험도

LOW
