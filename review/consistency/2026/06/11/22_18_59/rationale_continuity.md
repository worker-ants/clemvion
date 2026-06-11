# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-update-embedding-testconnection.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-11

---

## 발견사항

### [INFO] `LlmService.testConnection` 의 kind-agnostic 설정 조회 변경 — 서비스 레이어 코드 주석과의 미묘한 표현 불일치
- **target 위치**: 제안 변경 §1 (`spec/5-system/7-llm-client.md §8.3` 추가 내용), 레이어 구분 절
- **과거 결정 출처**: `spec/5-system/7-llm-client.md §8.3` 현행 코드 블록 주석 `// 기존 chat / testConnection / resolveConfig 유지`
- **상세**: 현행 §8.3 주석은 서비스 레이어에 `testConnection`이 이미 존재한다고 기술하되, 해당 메서드가 `kind`에 따라 분기하는 logic을 별도로 명시하지 않는다. target은 이 메서드에 embedding 분기(`client.embed(...)` 경유 dimension 추출)를 추가하고 설정 조회 경로를 `ModelConfigService.findEntity`(kind 무관)로 교체하는 것을 제안한다. 이 변경 자체는 합의된 Rationale과 충돌하지 않으나, 목표 spec 문서에 기존 `// 기존 chat / testConnection / resolveConfig 유지` 주석 문구가 "기존 chat 고정 경로 유지"로 오독될 수 있다. target이 해당 주석을 적절히 보강하도록 명시하고 있어 의도는 명확하나, spec 반영 시 주석 문구를 `// 기존 chat / embed / testConnection / resolveConfig 유지` 또는 본문 설명과 병행 기술하는 것이 좋다.
- **제안**: §8.3 코드 블록 주석을 `// 기존 chat / embed / testConnection / resolveConfig 유지 (testConnection은 kind별 probe 분기 — 아래 표)` 와 같이 수정해 Rationale과 본문이 일관하도록 한다.

### [INFO] `EmbedResponse` (Planned) 와의 독립성 — 이미 합의된 원칙이나 Rationale 추가는 정합
- **target 위치**: 제안 변경 §2 Rationale 항목 "testConnection dimension 추출이 EmbedResponse(Planned)와 독립인 이유"
- **과거 결정 출처**: `spec/5-system/7-llm-client.md ## Rationale` — "왜 `LlmService.embed` 에 `opts`/`inputType` 을 위치 인자로 추가했나": `EmbedResponse`가 Planned인 동안 객체화를 미루는 결정이 기록됨
- **상세**: target의 추가 Rationale은 기존 "EmbedResponse 도입 전 객체화 미연기" 원칙을 위반하지 않는다. 오히려 서비스 레이어에서 벡터 길이를 평범하게 추출하는 방식이 `LLMClient.embed` 인터페이스를 건드리지 않음을 명시해 기존 합의를 강화한다. 충돌 없음.
- **제안**: 이 항목은 현행 Rationale 원칙과 잘 정렬되어 있으므로 그대로 반영해도 된다.

### [INFO] `KnowledgeBase.embedding_dimension` probe 저장 금지 원칙 — target이 정확히 준수하나, 표현 강도 확인 필요
- **target 위치**: 핵심 구분 표, 제안 변경 §3 (`6-config.md §B.3`), Rationale "두 probe 분리 유지"
- **과거 결정 출처**: `spec/5-system/9-rag-search.md ## Rationale` — "왜 probe(임베딩 테스트) 차원을 미리 저장하지 않나": `embedding_dimension`은 적재 경로만이 race-free하게 채우는 파생 캐시이며, probe 로 얻은 값을 미리 저장하면 stale 오답 위험이 있다는 invariant가 명시적으로 기록됨
- **상세**: target은 이 invariant를 명시적으로 인식하고 준수한다. 변경 대상 필드가 `ModelConfig.dimension`(모델 출력 차원 SoT)이며, `KnowledgeBase.embedding_dimension`(파생 캐시)에는 쓰지 않는다고 명문화한다. 9-rag-search Rationale이 금지한 것("KB probe 차원 미리 저장 금지")과 target의 변경 범위("ModelConfig.dimension 자동 저장")는 서로 다른 필드이므로 충돌하지 않는다. 단, §B.3 추가 텍스트에서 "저장 대상은 `ModelConfig.dimension`이며, `KnowledgeBase.embedding_dimension`에는 쓰지 않는다"는 구분이 충분히 명시되어 있다면 문제없다.
- **제안**: 제안 변경 §3 (`6-config.md §B.3`)의 마지막 문장이 이미 해당 구분을 명시하고 있으므로 그대로 반영 가능하다.

---

## 요약

target 문서(`spec-update-embedding-testconnection.md`)는 기존 spec Rationale에서 합의된 세 가지 핵심 원칙 — (1) `KnowledgeBase.embedding_dimension` probe 저장 금지(9-rag-search Rationale), (2) `LLMClient` 인터페이스의 평탄한 시그니처 유지 및 `EmbedResponse` Planned 동결(7-llm-client Rationale), (3) ModelConfig 단일화·kind 판별 통합(6-config R-3, 1-data-model §2.16 Rationale) — 을 모두 인식하고 준수한다. 변경 대상 필드(`ModelConfig.dimension`)와 기존 probe 금지 대상 필드(`KnowledgeBase.embedding_dimension`)를 명확히 구분한 점이 핵심 위험을 제거한다. 발견된 항목은 모두 INFO 등급이며, §8.3 주석 문구의 표현 개선 권고 외에 Rationale 원칙과 충돌하거나 기각된 대안을 재도입하는 사례는 없다.

---

## 위험도

NONE
