이제 스펙 파일과 핸들러 출력 구조를 비교 분석하겠습니다.

---

### 발견사항

- **[WARNING]** 핸들러 출력 구조와 Spec 문서 불일치
  - 위치: `ai-agent.handler.ts:635–676` (single turn 출력), `spec/4-nodes/3-ai-nodes.md:285–315`
  - 상세: Spec 출력 예시는 평탄(flat) 구조 `{ "response": "...", "metadata": {...} }`를 기술하나, 핸들러는 CONVENTIONS §8 네스팅 구조 `{ config, output: { result: { response, endReason, turnCount } }, meta, port, status }`를 반환한다. `aiAgentNodeOutputSchema` 주석(line 340)에는 여전히 "legacy bare object (no `config/output` wrapper)" 라고 기술되어 있어, 다운스트림 노드에서 `$node["AI Agent"].output.response`로 접근하는 표현식이 런타임에 `undefined`를 반환할 위험이 있다. 정보 추출기 Spec은 `$node["Info Extractor"].output.result.extracted.*` 패턴을 사용하므로, AI Agent도 동일하게 `.result.*` 경로가 되어야 한다면 Spec과 자동완성 힌트 스키마가 모두 잘못된 경로를 안내하고 있다.
  - 제안: (1) `aiAgentNodeOutputSchema` 주석을 실제 핸들러가 반환하는 네스팅 구조에 맞게 갱신하거나, (2) 실행 엔진이 `output.result`를 `output`으로 언래핑한다면 그 사실을 명시적으로 문서화하고 Spec 출력 예시를 `output.result.response` 경로로 갱신한다.

---

- **[WARNING]** Multi-turn 첫 턴 동작: Spec vs. 구현 불일치
  - 위치: `spec/4-nodes/3-ai-nodes.md:257–259`, `ai-agent.handler.ts:679–770` (`executeMultiTurn`)
  - 상세: Spec의 Multi Turn §1.a는 "Single Turn과 동일하게 RAG 검색 + LLM 호출 + Tool/Condition 처리 수행"을 명시하나, 핸들러의 `executeMultiTurn()`은 LLM을 전혀 호출하지 않고 즉시 `waiting_for_input`을 반환한다. 테스트(`"returns waiting_for_input immediately without calling LLM"`)가 이 동작을 검증하고 있다. Spec을 기준으로 클라이언트를 구현하면 대화 흐름이 달라진다.
  - 제안: Spec을 "첫 실행 시 LLM 호출 없이 곧바로 `waiting_for_input`으로 전환"으로 수정하거나, 기획 의도가 Spec대로라면 핸들러 동작을 일치시켜야 한다.

---

- **[WARNING]** `endReason: 'out'` 이 Spec 열거값에 미포함
  - 위치: `ai-agent.handler.ts:647`, `spec/4-nodes/3-ai-nodes.md:428`
  - 상세: 핸들러는 single_turn 정상 완료 시 `endReason: 'out' as const`를 반환하나, Spec의 `endReason` enum은 `condition | user_ended | max_turns | error`로 정의되어 있어 `'out'`이 포함되어 있지 않다. 이 값을 열거형으로 파싱하거나 switch-case로 처리하는 클라이언트 코드에서 미처리 케이스가 발생한다. Plan 문서(line 51)에도 INFO #5로 기록되어 있다.
  - 제안: Spec `endReason` enum에 `'out'`을 추가하거나, single_turn 출력에서 `endReason`을 제거하고 포트 라우팅(`port: 'out'`)으로만 완료를 표현한다.

---

- **[WARNING]** `mcpDiagnostics` Spec에 정의되어 있으나 핸들러가 반환하지 않음
  - 위치: `spec/4-nodes/3-ai-nodes.md:307–320`, `ai-agent.handler.ts:635–676`
  - 상세: Spec 출력 구조에 `metadata.mcpDiagnostics` 객체(`attempted`, `serverCount`, `toolCalls`, `resourceReads` 등)가 명시되어 있으나, 핸들러의 반환값에는 `meta.ragDiagnostics`만 있고 `mcpDiagnostics`는 없다. MCP 서버가 설정된 노드의 실행 결과를 소비하는 클라이언트가 이 필드에 접근하면 `undefined`를 얻는다.
  - 제안: MCP Provider가 구현될 때 `mcpDiagnostics`를 `meta`에 추가하거나, 현재 미구현 상태임을 Spec에 명시한다.

---

- **[INFO]** `toolNodeIds` / `toolOverrides` — 조용한 Breaking Change
  - 위치: `ai-agent.schema.ts:275–279`, `ai-agent.handler.ts:1305–1308`
  - 상세: 두 config 필드가 스키마에서 제거되었으나 `.passthrough()`로 기존 DB 데이터는 유효성 검증을 통과한다. 핸들러가 이를 읽지 않아 기존에 Tool Area에 도구를 연결한 워크플로우는 검증 오류 없이 도구가 무시된 상태로 실행된다. 이는 "조용한" breaking change로, 사용자가 오작동을 인지하기 어렵다.
  - 제안: 해당 필드가 존재하는 config에 대해 핸들러의 `validate()` 또는 실행 시 WARNING 수준의 로그나 `ValidationResult.warnings`를 추가해 사용자에게 알린다.

---

- **[INFO]** `_resumeState` 내부 상태 필드가 출력에 노출됨
  - 위치: `ai-agent.handler.ts:756`, `ai-agent.handler.ts:1052`
  - 상세: Multi-turn `waiting_for_input` 출력에 `_resumeState: { workspaceId, executionId, nodeId, ... }` 가 포함되어 있다. 실행 엔진이 이를 필터링하지 않고 다운스트림 노드나 클라이언트에 전달한다면 내부 식별자가 노출된다. 접두사 `_`는 비공개 의도를 암시하지만 계약상 명시적 격리 보장이 없다.
  - 제안: 실행 엔진의 핸들러 출력 어댑터(`adaptHandlerReturn`)에서 `_` 접두사 필드를 제거하거나, 엔진이 이를 명시적으로 분리한다는 계약을 문서화한다.

---

- **[INFO]** 조건 도구 `toolCallCount` 계산 정책 비대칭
  - 위치: `ai-agent.handler.ts:570–580` (single_turn), `ai-agent.handler.ts:957–966` (multi_turn)
  - 상세: Single_turn에서 condition tool 처리는 `toolCallCount`를 증가시키지 않으나, multi_turn(`processMultiTurnMessageInner`)에서는 증가시킨다. `maxToolCalls` 제한 도달 시 동일 조건에서 다른 동작을 유발하며, `meta.toolCalls` 값도 모드에 따라 의미가 달라진다. Plan 문서의 WARN #20으로 추적 중이다.
  - 제안: 두 경로의 카운팅 정책을 통일하거나, 차이가 의도적이면 API 명세에 명시한다.

---

### 요약

이 변경사항에서 가장 중요한 API 계약 리스크는 **핸들러 출력 구조의 실제 형태(CONVENTIONS §8 네스팅)와 Spec/자동완성 힌트 스키마(평탄 구조)의 불일치**다. 다운스트림 노드가 `$node["AI Agent"].output.response`로 접근하면 실제 위치인 `output.result.response`(또는 엔진 언래핑 여부에 따라 다른 경로)와 달라 런타임 오류가 발생할 수 있다. 또한 Spec이 Multi-turn 첫 턴에 LLM 호출을 기술하고 있으나 구현은 즉시 대기로 진입하는 동작 차이, `endReason: 'out'` enum 누락, `mcpDiagnostics` 미구현 등 여러 명세-구현 불일치가 존재한다. `toolNodeIds`/`toolOverrides`의 조용한 무시는 기존 워크플로우 사용자에게 디버깅이 어려운 무언의 기능 손실을 초래할 수 있다.

### 위험도

**MEDIUM**