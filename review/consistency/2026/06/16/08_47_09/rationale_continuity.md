# Rationale 연속성 검토 결과

대상 문서: `spec/2-navigation/6-config.md`

---

## 발견사항

### 1. INFO — Rerank `defaultModel` 자유 입력의 R-1 예외가 본문에서 명시되나 Rationale 에 별도 항이 없음

- **target 위치**: §B.6.2 "기본 모델" 행 — "기본 리랭커 모델 ID 자유 입력 (예: `dragonkue/bge-reranker-v2-m3-ko` …). 리랭커 provider 는 표준 model-list API 가 없어 Chat/Embedding 탭과 달리 자유 입력"
- **과거 결정 출처**: 본 문서 `## Rationale R-1` — "잘못된 모델 ID 가 저장되면 실제 호출 시점에 `LLM_MODEL_NOT_FOUND` 로 실패" 하므로 select-only 를 강제하며, `spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델` 에도 동일 결정을 적용한다고 명시.
- **상세**: R-1 은 select-only 원칙을 Chat·Embedding 에 명시 적용하면서 Rerank 가 "표준 model-list API 부재" 이유로 예외임을 본문에서만 설명한다. R-1 내부에 "Rerank 는 model-list API 부재로 자유 입력 예외" 라는 항이 없어, R-1 만 읽는 독자가 예외 범위를 파악하기 어렵다.
- **제안**: R-1 끝에 "단, Rerank(`kind=rerank`) 는 표준 model-list API 가 없어 본 결정이 적용되지 않으며 자유 입력을 허용한다" 한 줄 추가해 예외 범위를 Rationale 안에 명시한다.

---

### 2. INFO — R-3 번복 항의 "연결 테스트 미제공" 참조가 R-3 자신을 다시 가리키는 자기참조

- **target 위치**: §B.6.2 마지막 bullet — "연결 테스트 미제공: … ([Rationale R-3](#r-3-번복--modelconfig-단일-화면-통합))"
- **과거 결정 출처**: `spec/5-system/7-llm-client.md ## Rationale` — "왜 RerankClient 를 LLMClient 와 분리된 별도 인터페이스로 둔 것인가"에서 rerank API shape 차이를 설명하나, 연결 테스트 미제공 결정의 직접 근거는 LLM Client spec 의 해당 항에 있다.
- **상세**: R-3 자체는 "설정 테이블·화면 통합" 결정이고, "연결 테스트 미제공" 근거는 "표준 model-list/test API 부재" 라는 별도 사유다. §B.6.2 가 R-3 를 자기참조하면 독자가 R-3 를 봐도 연결 테스트 미제공의 직접 근거를 찾기 어렵다.
- **제안**: §B.6.2 의 참조를 "(리랭커 API shape 에 표준 test endpoint 부재 — [LLM Client §4](../5-system/7-llm-client.md))" 로 수정하거나, R-3 에 연결 테스트 미제공 결정을 분리 항으로 추가한다.

---

### 3. INFO — R-5 (`max_tokens` 4096 정정) 의 AI Agent 노드 파급 범위가 spec 내 교차 검증 없이 단방향 선언

- **target 위치**: `## Rationale R-5` — "AI Agent 노드 설정 패널 예시(`spec/4-nodes/3-ai/1-ai-agent.md`)의 `maxTokens` 예시값도 동일하게 4096 으로 동반 갱신"
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md` Rationale (별도 검토 대상).
- **상세**: R-5 는 본 문서가 AI 노드 spec 의 예시값을 "동반 갱신했다"고 선언하지만, AI 노드 spec 이 갱신됐는지 역방향으로 확인할 근거가 payload 에 없다. 동반 갱신이 실제로 이뤄지지 않았다면 두 spec 간 숫자 불일치가 남는다.
- **제안**: R-5 의 "동반 갱신" 선언이 실제로 반영됐는지 `spec/4-nodes/3-ai/1-ai-agent.md` 를 점검한다. 미반영 시 해당 spec 도 함께 수정하거나 R-5 에 "반영 완료" 여부를 명시한다.

---

## 요약

`spec/2-navigation/6-config.md` 는 과거 Rationale 에서 기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 항목이 없다. R-1(select-only), R-2(AuthConfig wiring·마스킹·Admin+ 가드), R-3(ModelConfig 단일화 번복), R-4(cohere Base URL API optional), R-5(max_tokens 4096 정정), R-6(소스 IP·응답 코드 추가) 모두 기각 사유를 명기하거나 기존 Rationale 의 원칙 범위 내에서 확장·번복 근거를 동반하고 있다. 발견된 세 건은 모두 INFO 수준의 Rationale 보완 제안으로, Rerank 자유 입력의 R-1 예외 미명시, 연결 테스트 미제공의 자기참조 링크, AI Agent 노드 연동 선언의 단방향성이다. 기각된 결정(piggyback 임베딩, sibling RerankConfig, inline auth 필드, 사용자 입력 Bearer Token, 환경별 conf 파일, `/toggle` 별도 endpoint)은 모두 현 spec 에서 재채택되지 않았다.

---

## 위험도

LOW
