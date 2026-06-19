# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-c1-spec-drift.md`
검토 일시: 2026-06-19

---

## 발견사항

### [INFO] ISP 부분인터페이스 명칭(CoreEngineDriver / InteractionEngineDriver / ReentryStateDriver / AiTurnEngineDriver / RetryEngineDriver)은 spec 에 신규 도입되나 기존 사용처 없음
- target 신규 식별자: `CoreEngineDriver`, `InteractionEngineDriver`, `ReentryStateDriver`, `AiTurnEngineDriver`, `RetryEngineDriver`
- 기존 사용처: spec 전체에서 0건. `ENGINE_DRIVER` 토큰명과 `EngineDriver` 복합 인터페이스 이름은 `/spec/5-system/4-execution-engine.md` L1465, L193, `/spec/data-flow/3-execution.md` L172, `/spec/4-nodes/6-presentation/0-common.md` L426 등에서 이미 사용 중.
- 상세: target 초안(변경 1d)이 "ISP 5-부분인터페이스 산문 삽입"을 예고하지만, 5개 부분 인터페이스 명칭이 spec 본문에 직접 기재될 경우 기존 `EngineDriver`(단일 복합 인터페이스) 명칭과 혼용될 수 있다. 현재 spec 은 `EngineDriver`(복합) 단일 이름만 사용하므로, 삽입 산문이 부분 인터페이스 이름을 spec SoT 로 올리면 기존 문장의 `EngineDriver` 참조와 의미 레이어가 달라진다.
- 제안: 삽입 산문에서 부분 인터페이스 5개 이름을 나열할 때 "(코드 레벨 ISP 분해 — spec SoT 는 단일 `EngineDriver` 계약)" 한 줄을 명시하면 혼동을 방지할 수 있다. 기존 참조 수정은 불필요.

### [INFO] `executeSync` 진입점 명칭을 W-6 callout 에 추가할 경우 기존 spec 과 일치 여부 확인 필요
- target 신규 식별자: `executeSync` (변경 2에서 진입점 명시로 추가 예정)
- 기존 사용처: `/spec/data-flow/3-execution.md` L18, L178, L239, L320 에 `executeSync` 기술됨. `/spec/4-nodes/2-flow/1-workflow.md` L75, L103 에는 `executeInline`/`executeAsync` 두 메서드만 명시되어 `executeSync` 가 없음.
- 상세: target 변경 2는 W-6 callout 에 "`executeInline`/`executeSync`/`executeAsync`" 세 진입점을 명시한다. 동일 파일 §4 L103 은 `executeInline`·`executeAsync` 만 열거하므로, 변경 2 적용 후 L75 callout 과 §4 의 진입점 목록이 달라져 독자 혼선이 생길 수 있다.
- 제안: 변경 2 적용 시 §4 L103 도 `executeSync` 포함 여부를 검토하거나, W-6 callout 에 "(`executeSync` 는 data-flow §3 기술 — sync 모드 내부 직접 실행 경로)" 교차 참조를 추가.

### [INFO] `button_continue` data shape 에 `selectedItem?` 추가 — node-output.md 와 정합하나 0-common.md 와 현재 불일치 상태
- target 신규 식별자: `{ buttonId, buttonLabel, url?, selectedItem? }` (변경 6 — `button_continue` shape 확장)
- 기존 사용처: `/spec/conventions/node-output.md` L259 에 이미 `{ buttonId, buttonLabel, url?, selectedItem? }` 로 정의됨. `/spec/5-system/4-execution-engine.md` L186 에도 동일 shape. 그러나 변경 대상인 `/spec/4-nodes/6-presentation/0-common.md` L131 은 아직 `{ buttonId, buttonLabel, url }` (구 형태).
- 상세: 신규 식별자 도입이 아니라 stale 항목의 동기화이며 기존 node-output.md 기술과 의미가 정합한다. 충돌 없음.
- 제안: 없음. 변경 6 적용 후 세 파일(node-output.md / 0-common.md / execution-engine.md) 이 동일 shape 로 수렴된다.

### [INFO] `WORKFLOW_FORBIDDEN_WORKSPACE` — spec 에 이미 등재되어 있고 target 기술과 의미 동일
- target 신규 식별자: `WORKFLOW_FORBIDDEN_WORKSPACE` (변경 2, 3에서 "enum 미등재 inline guard" 명시)
- 기존 사용처: `/spec/4-nodes/2-flow/1-workflow.md` L75 에 이미 존재. 의미 동일(cross-workspace 차단 시 throw).
- 상세: target 이 §3.2 에 추가하는 것은 기존 L75 의 기술과 동일한 코드를 error-handling.md 표에 등재하는 것으로, 신규 식별자가 아닌 기존 코드의 추가 등재다. 의미 충돌 없음.
- 제안: 없음.

### [INFO] `LlmCallRecord` / `TurnDebugEntry` — spec 에 신규 도입되나 기존 필드 기술과 정합하고 충돌 없음
- target 신규 식별자: `LlmCallRecord`, `TurnDebugEntry` (변경 5 — canonical SoT 명시)
- 기존 사용처: spec 전체에서 해당 타입명 0건. 관련 필드(`llmCalls`, `turnDebug`, `requestPayload`, `responsePayload`, `durationMs`)는 `/spec/4-nodes/3-ai/1-ai-agent.md` §8, `/spec/4-nodes/3-ai/0-common.md` §6 에 이미 기술되어 있음.
- 상세: 타입명이 새로 도입되나 기존 필드 기술과 의미가 정합하며 다른 의미로 사용 중인 동명 식별자가 없다.
- 제안: 없음. target 의 canonical SoT 명시로 일관성이 향상된다.

### [INFO] `mcpDiagnostics?` 를 `meta.turnDebug` 스키마 항목에 추가 — 기존 §7 기술과 정합
- target 신규 식별자: `mcpDiagnostics?` (변경 5b — `meta.turnDebug[i]` 항목에 추가)
- 기존 사용처: `/spec/4-nodes/3-ai/0-common.md` §7 L112 에서 이미 `meta.turnDebug[i].mcpDiagnostics` 언급. `/spec/4-nodes/3-ai/1-ai-agent.md` L1065, L1071 에도 동일 참조.
- 상세: §6 의 turnDebug 스키마 예시 행(L106)에만 `mcpDiagnostics?` 가 누락되어 있던 것을 추가하는 것으로, 기존 §7 기술과 의미가 동일하다. 식별자 충돌 없음.
- 제안: 없음.

---

## 요약

target 문서(spec-draft-c1-spec-drift.md)가 도입하는 신규 식별자 중 기존 사용처와 의미가 충돌하는 경우는 없다. ISP 부분인터페이스 5종 명칭(`CoreEngineDriver` 등)은 spec 에 미등재 상태라 삽입 산문 작성 시 기존 `EngineDriver` 단일 복합 인터페이스 이름과의 레이어 혼용 가능성이 있으나 WARNING 수준에 달하지 않는다. `WORKFLOW_FORBIDDEN_WORKSPACE`, `button_continue` shape 확장, `LlmCallRecord`/`TurnDebugEntry` 명시, `mcpDiagnostics?` 추가는 모두 기존 spec 기술과 정합하거나 stale 항목의 동기화다. `executeSync` 진입점 열거 시 동일 파일 §4 와의 일관성을 확인하는 편집 조율이 권장된다.

## 위험도

NONE
