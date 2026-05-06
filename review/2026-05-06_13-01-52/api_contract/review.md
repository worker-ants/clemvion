### 발견사항

---

**[WARNING]** `aiAgentNodeOutputSchema` 주석이 실제 핸들러 반환 형식과 불일치
- **위치**: `ai-agent.schema.ts:376-426` (주석 블록)
- **상세**: 주석은 *"The AI Agent handler returns a legacy bare object (no `config/output` wrapper)"* 라고 명시하나, 핸들러(`ai-agent.handler.ts:640-681`)는 이미 `{ config, output: { result: {...} }, meta }` 중첩 구조로 반환함. 프론트엔드가 이 스키마를 `z.toJSONSchema()`로 직렬화해 `$node["X"].output.<field>` 자동완성 힌트로 사용하므로, 실제 경로는 `$node["X"].output.result.response` 이지만 힌트는 `$node["X"].output.response`를 제안할 수 있음.
- **제안**: 주석을 현재 구조에 맞게 수정하고, 스키마를 `z.object({ result: z.object({ response, endReason, turnCount, ... }) }).passthrough()` 형태로 중첩 구조 반영.

---

**[WARNING]** `buildConditionOutput`이 단일 턴 분기에서도 `config.mode: 'multi_turn'`을 하드코딩
- **위치**: `ai-agent.handler.ts:1191`
- **상세**: `buildConditionOutput`은 `executeSingleTurn` (line 509)과 `processMultiTurnMessageInner` (line 914) 양쪽에서 호출되지만, 반환 객체의 `config.mode`를 항상 `'multi_turn'`으로 고정. 단일 턴에서 조건이 트리거될 경우, 소비자가 `output.config.mode`로 모드를 판단하면 `'single_turn'`이 기대되는 자리에 `'multi_turn'`이 전달됨. 해당 케이스를 검증하는 테스트가 없어 현재는 미탐지.
- **제안**: `buildConditionOutput`에 `mode` 파라미터를 추가하고, 호출 측에서 각 context의 실제 mode를 전달. 또는 `executeSingleTurn`의 조건 분기에서 별도로 `config.mode: 'single_turn'`을 override.

---

**[INFO]** `toolNodeIds` / `toolOverrides` 비활성화가 무음(silent) 처리
- **위치**: `ai-agent.handler.ts:1314-1320`, `ai-agent.schema.ts:293-322`
- **상세**: 스키마에는 필드가 존재하고 DB에 저장된 값도 있지만, 핸들러가 항상 `[]`로 강제하여 등록된 도구를 LLM에 노출하지 않음. API 소비자(워크플로 엔지니어)는 설정이 적용되지 않는다는 피드백을 전혀 받지 못함. 현재는 plan 문서와 주석으로만 문서화됨.
- **제안**: `_resumeState`나 `meta`에 `featureOutFields: ['toolNodeIds', 'toolOverrides']` 같은 필드를 포함시키거나, 최소한 실행 로그에 warning을 기록해 소비자가 설정이 무시됨을 인지할 수 있도록.

---

**[INFO]** `conditionToolCalls`의 `toolCallCount` 증가 방식이 단일/멀티 턴 간 불일치
- **위치**: `ai-agent.handler.ts:575-585` (단일 턴, 미증가) vs `966-974` (멀티 턴, 증가)
- **상세**: 단일 턴에서 조건 도구 호출은 `toolCallCount`를 증가시키지 않지만 멀티 턴에서는 증가. `meta.toolCalls` 값이 모드별로 다른 의미를 가짐. 의도적 차이라면 명시적 주석이 필요.
- **제안**: 설계 의도를 코드 주석으로 명시. 일관성을 원한다면 한쪽으로 통일.

---

### 요약

이 파일들은 HTTP REST API가 아닌 워크플로 노드 내부 데이터 계약을 정의하므로, URL 설계·HTTP 상태 코드·인증·페이지네이션 항목은 해당 없음. 핵심 계약 리스크는 두 가지: ① `aiAgentNodeOutputSchema`의 주석이 현재 핸들러의 중첩 출력 구조(`output.result.*`)를 반영하지 못해 프론트엔드 자동완성 경로가 실제와 어긋날 수 있고, ② `buildConditionOutput`이 단일 턴 조건 분기에서도 `config.mode: 'multi_turn'`을 반환해 소비자의 mode 기반 분기 로직에 오류를 유발할 수 있음. `toolNodeIds`/`toolOverrides` 무음 비활성화는 현재 계획된 범위 내의 조치이나, 소비자 피드백 부재가 디버깅을 어렵게 만드는 단점이 있음.

### 위험도

**MEDIUM**