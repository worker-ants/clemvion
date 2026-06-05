# 아키텍처(Architecture) 리뷰 결과

리뷰 대상: 26개 파일 (spec 문서 변경, 일관성 검토 산출물, 실행엔진/RAG/에이전트메모리 등)
리뷰 일시: 2026-06-05

---

## 발견사항

### [WARNING] `_resumeCheckpoint` allow-list 확장 — 합집합 방식의 런타임 polymorphism 위험
- 위치: `spec/5-system/4-execution-engine.md §1.3` 변경분, `spec/4-nodes/3-ai/3-information-extractor.md §_resumeState 테이블`
- 상세: `ai_agent` + `information_extractor` 두 핸들러의 runtime state 합집합을 단일 allow-list 에 담고, `buildRetryReentryState` 공유 재구성기가 "각 핸들러의 `processMultiTurnMessage`(polymorphic)가 자기 필드만 읽는다"는 위임에 의존한다. 이는 Open-Closed Principle 에 부분적으로 반한다 — 새 `ai_conversation` 핸들러가 추가될 때마다 엔진 레벨 allow-list 를 수정해야 하고, allow-list 에 미등록된 핸들러가 silently graceful-reset 되는 정책은 확장 시 발견이 어렵다. 또한 `buildRetryReentryState` 가 두 shape 의 합집합을 채울 때 IE 전용 필드(`partialResult`/`collectionRetryCount`) 기본값이 `ai_agent` 재구성 시에도 적재되는지 여부가 명시되지 않아, 향후 핸들러 추가 시 불필요한 필드가 축적(coupling)될 수 있다.
- 제안: 핸들러별 `getCheckpointFields(): string[]` 인터페이스를 도입해 allow-list 를 엔진에 하드코딩하지 않고 핸들러가 자신의 체크포인트 필드를 선언하도록 역전 (DIP). 신규 핸들러 추가 시 엔진 수정 없이 지원 가능해진다. 현재 규모(2개 핸들러)에서는 즉각 리팩토링 의무는 없으나 spec 에 "신규 핸들러 지원 방법: 핸들러가 allow-list 에 자기 필드를 등록한다"는 확장 원칙을 명시하면 충분하다.

---

### [WARNING] `Execution.conversation_thread` 단일 컬럼 — two-purpose SoT 분리 원칙의 경계 유의
- 위치: `spec/conventions/conversation-thread.md §4·§8.4`, `spec/5-system/4-execution-engine.md §6.2`
- 상세: 이번 변경이 "durable park resume 스냅샷"과 "실행 이력 thread view (NodeExecution 분산 저장 derived view)"를 명확히 소비처 분리(§8.4)한 것은 아키텍처적으로 올바르다. 그러나 `Execution.conversation_thread` 컬럼은 park 마다 last-write 로 덮어쓰는 구조이므로, v2 에서 multi-thread (§7 로드맵) 를 도입할 때 단일 컬럼이 다중 thread 키를 수용해야 하는 확장 문제가 발생할 수 있다. 현재 v1 은 단일 `id: 'default'` thread 이므로 당장은 문제 없지만, thread key 를 컬럼 내 JSON 맵으로 설계해 두지 않으면 v2 전환 시 마이그레이션 비용이 증가한다.
- 제안: 컬럼 내 저장 형태를 `ConversationThread` 객체 직렬화가 아닌 `{ [threadId: string]: ConversationThread }` 맵으로 두어 v2 multi-thread 확장에 대비하는 안을 spec 의 §8.4 에서 검토 권장 (현행 단일 thread 는 `{ default: {...} }` 로 저장해도 하위호환). 현재 스키마 확정 전에 결정하는 것이 마이그레이션 비용을 줄인다.

---

### [INFO] `summaryModel` / `extractionModel` — 레이어 책임 분리 관점의 적절성
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §12.12`, `spec/5-system/17-agent-memory.md §3`
- 상세: 두 optional 필드가 노드 config 에 위치해 "노드 레이어(프레젠테이션/설정)" 가 "비즈니스 레이어(요약·추출 LLM 선택)" 를 직접 지정하는 형태다. `llmConfigId` (provider/credential) 는 노드 것을 그대로 재사용하고 모델 ID 문자열만 분리한 점은 provider coupling 을 낮춘 좋은 설계다. fallback 체인(`[전용필드] → [노드 model] → [llmConfig 기본]`)이 명확해 하위호환을 지키고, 미설정 시 기존 동작을 100% 보존하는 점도 안전하다. 레이어 책임 측면에서 큰 위반은 없다.
- 제안: `llmConfigId` 재사용 정책(provider는 노드 것, 모델만 분리)이 spec 본문에 명시되어 있으나, 향후 추출 전용 provider(예: 다른 워크스페이스의 LLMConfig) 를 지정하려는 요구가 생길 경우 이 설계는 확장이 어렵다. 현재는 적절한 trade-off 이므로 INFO 수준이나, v2 로드맵에 "provider 분리 요구 발생 시 `extractionLlmConfigId` 별도 필드 추가" 가능성을 메모 권장.

---

### [INFO] RerankConfig — LLMConfig 와의 sibling 모델 일관성 확인
- 위치: `spec/1-data-model.md §2.16.1`, `spec/2-navigation/6-config.md Part C`, `spec/5-system/1-auth.md §3.2`
- 상세: RerankConfig 가 LLMConfig 와 동일 패턴의 sibling 리소스로 설계된 것은 일관된 아키텍처 패턴을 따른다. SSRF 가드·secret-store transformer 재사용, CRUD + set-default API 패턴, auth 권한 매트릭스(Editor+)가 LLMConfig 와 동형이다. 이 수평 확장은 Open-Closed 원칙을 준수한다. Part C Rerank 설정 화면이 독립 섹션으로 분리된 점도 적절한 모듈 경계다.
- 제안: 별도 조치 불요. 단 `rerank_config.reveal` (평문 api_key 노출) 액션이 auth 권한 매트릭스에 없는 점이 LLMConfig 와 비대칭이다 — RerankConfig 에 API Key 가 있으므로 `rerank_config.reveal` 권한도 Owner/Admin 한정으로 등재할지 검토 권장 (`spec/5-system/1-auth.md §3.2`).

---

### [INFO] `active_running_ms` 누적 타임아웃 — 비원자성 read-check-then-act 허용 근거의 명시성
- 위치: `spec/5-system/4-execution-engine.md §8·Rationale`, §4.2 주석
- 상세: `assertActiveTimeWithinLimit` (판정) 과 `updateExecutionStatus` (누적) 사이 잠금 없는 read-check-then-act 를 "BullMQ dedup 으로 active 세그먼트가 항상 1개" 라는 불변식으로 보호하는 설계는 합리적이다. 이 불변식이 아키텍처 다른 레이어(BullMQ 큐 레이어)에 의존하는 것을 명시적으로 기록한 점도 좋다. Graceful Shutdown 시 under-count 허용 결정과 PR3 에서 해소 예정임도 문서화되어 있다.
- 제안: "PR2b+ 재진입 경로 추가 시 이 불변식 재검증" 이 §4.2 주석에만 있고 §8 Rationale 에도 링크가 있어 이중으로 언급된다. 단일 SoT 를 §Rationale 로 지정하고 §4.2 는 링크만 남기는 편이 중복을 줄인다.

---

### [INFO] Agent Memory 관리 API — 레이어 책임 분리 적절
- 위치: `spec/5-system/17-agent-memory.md §6`, `spec/2-navigation/16-agent-memory.md`
- 상세: API 계약(§6)과 UI 동작(nav/16)의 SoT 분리가 명확하다. `workspace_id` 격리를 인증 미들웨어 주입으로 강제하고 쿼리/바디로 받지 않는 설계는 레이어 책임 분리의 모범 사례다. hard delete 정책과 embedding 벡터 응답 제외 결정도 데이터 레이어와 프레젠테이션 레이어 경계를 적절히 정의했다.
- 제안: `GET /agent-memories/scopes` 와 `GET /agent-memories` 두 엔드포인트가 동일 컨트롤러에 있는지 별도 컨트롤러인지 spec 에 언급이 없다. LLMConfig 와 동형 CRUD 패턴이므로 별도 컨트롤러(`AgentMemoryController`)로 분리하는 것이 단일 책임 원칙상 자연스럽다 — 현재 구현이 이미 그렇게 되어 있을 것이므로 확인 수준의 INFO.

---

### [INFO] `EXECUTION_TIME_LIMIT_EXCEEDED` 에러 코드 — cross-cutting 문서 동기화 완결
- 위치: `spec/5-system/3-error-handling.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md`, `spec/data-flow/0-overview.md`, `spec/0-overview.md`
- 상세: 신규 에러 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 error-handling, external-interaction-api, chat-channel-adapter, overview 에 걸쳐 일관되게 동기화된 점은 cross-cutting concern 의 단일 진실 원칙을 잘 준수한다. `EXECUTION_TIMEOUT` (Code 노드 스크립트) 과의 의미 분리도 명확히 기록됐다.
- 제안: 별도 조치 불요.

---

## 요약

이번 변경 세트는 RAG 리랭킹 구현 완료 후 spec 정합화, AI Agent 요약·추출 전용 모델 옵션 도입, `Execution.conversation_thread` durable park resume 컬럼 채택, `information_extractor` checkpoint 지원 확장, Agent Memory 관리 API/UI spec 신설, 실행 엔진 active-running 누적 타임아웃 구현 완료 반영 등 여러 도메인에 걸친 spec 동기화다. 아키텍처 측면에서 레이어 책임 분리(API 계약 vs UI SoT, 실행 이력 vs durable resume 스냅샷), 모듈 경계(RerankConfig sibling 패턴), 에러 코드 cross-cutting 동기화는 모두 일관된 원칙을 따르고 있다. 주요 주의사항은 두 가지다: 첫째, `_resumeCheckpoint` allow-list 가 핸들러 합집합 방식으로 확장됨에 따라 신규 핸들러 추가 시 엔진 레이어를 수정해야 하는 OCP 위반 가능성이 잠재해 있으므로 핸들러 자기 선언 방식으로의 전환을 중장기 로드맵에 넣을 필요가 있다. 둘째, `Execution.conversation_thread` 컬럼이 v1 단일 thread 에 최적화된 구조라 v2 multi-thread 전환 시 스키마 재설계 비용이 발생할 수 있으므로 저장 형태를 맵 구조로 미리 정의하는 방안을 검토하면 확장 비용을 낮출 수 있다.

---

## 위험도

LOW
