# Rationale 연속성 검토 결과

검토 모드: --impl-prep  
대상 spec: `spec/5-system/4-execution-engine.md`  
구현 예정 작업: M-7 execution-engine 내 inline 타입 단언 50+ 곳 → 인터페이스/타입 가드/zod 전환

---

## 발견사항

### [INFO] M-7 Rationale 항목이 nextSeq INCR 결정만 커버 — 타입 단언 리팩토링 부분은 미기록

- **target 위치**: 구현 대상 영역 "(없음)" — 타입 단언 리팩토링은 spec 변경 없이 진행 (plan `spec 갱신: 불요`)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` — `### continuation publish 실패 동기 surface 통일 (C-1·M-7)`
- **상세**: 해당 Rationale 항은 M-7 중 `nextSeq` Redis INCR fail-fast 전환(`Math.random` fallback 제거)만 문서화한다. 이 부분은 이미 완료된 결정이며 §7.4·§9.2 단조성 계약과 일관한다. 50+ inline 타입 단언 → 인터페이스 도입 부분은 계획상 "B — 타입 단언/파싱 전략 규약 없음"으로 분류돼 있어 별도 Rationale 엔트리가 없는 것이 정상이다.
- **제안**: 구현 후 `_resumeCheckpoint`/`_retryState` 등 spec 정의 allow-list 필드를 포함하는 TypeScript 인터페이스가 신설된다면, "allow-list 기준 결정"은 이미 spec `§1.3 보존 예외` + Rationale `### Multi-turn 재시작 재개 — _resumeCheckpoint 보존`·`### retryable error 종결 시 _retryState 보존 (R1 채택)` 이 SoT이므로 별도 Rationale 갱신은 불요. 단 구현 인터페이스가 allow-list 필드를 이탈하면 그때 Rationale 번복 사유를 기록해야 한다.

---

### [INFO] `_resumeCheckpoint`/`_retryState` 타입 정의 시 credential 필드 배제 invariant

- **target 위치**: 구현 착수 시 `_resumeCheckpoint`·`_retryState` 인터페이스 신설 예상 지점 (plan M-7 샘플 `:4717-4718` 등)
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` — `### Multi-turn 재시작 재개 — _resumeCheckpoint 보존`: "credential / context-binding 필드(`llmConfigId`/`workspaceId`/`presentationTools`/`conditions`/`maxTurns` 등)는 미동봉 (`maskSensitiveFields` 와 동일 allow-list 정책; 재개 시 `node.config` 에서 재유도)"; 동일 Rationale `### retryable error 종결 시 _retryState 보존`의 "credential 제거 정책은 `_resumeState` 와 동일"
- **상세**: M-7 이 checkpoint/retryState 구조에 TypeScript 인터페이스를 도입할 경우, `llmConfigId`, `workspaceId`, `presentationTools`, `conditions`, `maxTurns` 같은 credential/config-binding 필드를 인터페이스에 포함하면 `maskSensitiveFields` 경계를 형식적으로 무력화하는 효과가 생긴다 (런타임 behavior 는 유지되더라도 타입 계약이 "이 필드도 체크포인트에 들어갈 수 있다"고 선언하는 셈). 합의된 invariant: allow-list는 `messages/turnCount/model/temperature/maxTokens/knowledgeBases/RAG/MCP/pendingFormToolCall` (ai_agent) + `partialResult`/`collectionRetryCount` (IE 추가분) 이며 `_retryState`에는 추가로 `expiresAt` TTL이 포함된다.
- **제안**: 인터페이스를 신설한다면 Rationale의 allow-list를 정확히 따르고, credential 필드는 타입에 포함하지 않는다. `CHECKPOINT_SCHEMA_VERSION` 정수 필드는 타입에 포함해 스키마 버전 가드 계약을 형식화한다.

---

### [INFO] `§4.4 WebsocketService canonical sink` 금지 조항 — dispatch boundary 인터페이스 도입 시 적용

- **target 위치**: M-7 구현 중 dispatch boundary 1곳 `safeParse` 도입 시 관련 인터페이스
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §4.4` + Rationale `### C-1 god-class strangler-fig 분할`: "추출 서비스도 `ExecutionEventEmitter` 직접 주입을 유지한다 — §4.4 단일 sink 정책이 금지하는 것은 외부 이벤트 sink 추상화이지 엔진 내부 클래스 분할이 아니므로, 본 분할은 이벤트 경로에 추상화 레이어를 새로 도입하지 않는다"
- **상세**: M-7이 dispatch boundary에 타입 가드 함수나 인터페이스를 도입할 때, 그 인터페이스가 우발적으로 `WebsocketService`/`ExecutionEventEmitter`를 감싸는 추상화가 되어서는 안 된다. 타입 단언 제거 목적의 인터페이스는 노드 config/resume-state 데이터 형태만 정의해야 하며 이벤트 sink를 추상화하지 않는다.
- **제안**: 신설 인터페이스의 scope를 "노드 config / resume-state 데이터 형태"로 명확히 한다. `WebsocketService`·`ExecutionEventEmitter` 관련 코드는 타입 개선 대상에서 분리한다.

---

### [INFO] `rawConfig` vs evaluated config 직교성 — 타입 설계 시 혼합 금지

- **target 위치**: M-7 구현 중 노드 config 타입 도입 지점
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale` — `### Engine Raw Config Exposure`: "config + output 양쪽에 같은 evaluated 값을 두는 안은 Principle 1.1 직교성 위반으로 기각한다"; "output.config echo 는 항상 raw(`rawConfig` frozen snapshot)를 유지하며, 재평가 값은 실행에만 쓰이고 echo 에는 반영되지 않는다"
- **상세**: M-7이 노드 config에 대한 TypeScript 인터페이스를 `nodes/<type>/<type>.types.ts`에 도입할 경우, raw config (expression 평가 전 원본) 타입과 evaluated config를 동일 인터페이스로 혼합하면 이 기각된 설계의 부분 재도입이 된다. `ExecutionContext.rawConfig` / `state.rawConfig`는 raw 전용, handler output의 evaluated 값은 분리된 타입이어야 한다.
- **제안**: raw config 인터페이스와 evaluated config 결과는 별개 타입으로 설계한다. 인터페이스 이름에 `Raw`/`Resolved` 등 suffix를 붙여 혼동을 방지한다.

---

## 요약

`spec/5-system/4-execution-engine.md`의 Rationale은 M-7 관련 결정을 `nextSeq` INCR fail-fast (완료) 하나로만 공식 기록하고 있으며, 나머지 50+ 타입 단언 리팩토링은 "spec 규약 없는 구현 재량 영역(B grade)"으로 계획에 명시되어 있다. 기각된 대안의 재도입이나 합의 원칙 직접 위반에 해당하는 발견사항은 없다. 단, M-7 구현 중 `_resumeCheckpoint`/`_retryState` 인터페이스 도입 시 spec Rationale이 정밀하게 정의한 allow-list·credential 배제 invariant·`rawConfig`/evaluated config 직교성·`§4.4` WebsocketService 추상화 금지 제약이 적용되므로, 구현 착수 전 이 네 가지 invariant를 체크리스트로 확인할 것을 권고한다.

## 위험도

LOW
