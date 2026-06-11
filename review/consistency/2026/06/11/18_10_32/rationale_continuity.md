# Rationale 연속성 검토 — spec/2-navigation/6-config.md

## 발견사항

### 1. [WARNING] Rerank 카드 wireframe 의 "Connected" 표기 — 연결 테스트 미제공 원칙과 불일치

- **target 위치**: `spec/2-navigation/6-config.md` §B.6.1 화면 구조 (line 226, 230)
- **과거 결정 출처**: 동 문서 `## Rationale R-3 (번복)` — "유지되는 것: rerank 호출 계약(전용 `/rerank`)·**연결 테스트 미제공**(표준 model-list API 부재)·provider 1차 tei/cohere 는 그대로다." + §B.6.2 bullet "연결 테스트 미제공" (line 249)
- **상세**: §B.6.1 wireframe 에 표시된 "Connected" 상태 배지는 Chat/Embedding 탭(§B.3)의 Test Connection 버튼 성공 결과 표기와 동일한 문자열이다. R-3 및 §B.6.2 본문은 "표준 model-list/test API 가 없어 연결 테스트를 제공하지 않는다"고 명시하므로, "Connected" 가 어떤 방식으로 산출되는지 설명 없이 wireframe 에 노출되면 R-3 가 보존하기로 한 "연결 테스트 미제공" 원칙과 충돌하는 것으로 오독될 수 있다. "Connected" 가 단순 저장 성공 표식 또는 자격증명 입력 완료 여부를 의미한다면 §B.6.1 또는 §B.6.2 에 명시가 필요하다.
- **제안**: §B.6.1 wireframe 주석 또는 §B.6.2 본문에 "Rerank 카드의 'Connected' 표시는 Test Connection 결과가 아니라 설정이 저장된 상태를 의미한다" 를 한 줄 추가. 또는 wireframe 의 배지를 "Saved" / "설정됨" 등으로 구분해 Chat/Embedding "Connected"(테스트 성공 의미)와 의미 차이를 명확히 한다. Rationale R-3 의 "유지되는 것" 항목에도 이 배지 의미 차이를 보완적으로 기록하면 충분하다.

---

### 2. [INFO] §B.6.2 연결 테스트 미제공 근거 참조가 R-3 (화면 통합 결정) 를 잘못 지목

- **target 위치**: `spec/2-navigation/6-config.md` §B.6.2 마지막 bullet, line 249: `([Rationale R-3](#r-3-번복--modelconfig-단일-화면-통합))`
- **과거 결정 출처**: 동 문서 R-3 본문 — "유지되는 것" 항 안에 연결 테스트 미제공이 부기돼 있으나, R-3 의 핵심 주제는 "설정 테이블·화면 통합"이며, 연결 테스트 미제공의 실질 근거(표준 model-list API 부재)는 R-3 내 한 줄로만 언급된다.
- **상세**: 연결 테스트 미제공은 "화면 통합 결정의 번복" 논리가 아니라 "표준 API 부재"라는 독립 기술 제약에서 비롯된다. §B.6.2 에서 R-3 를 단독 근거로 참조하면 연결 테스트 미제공이 통합 번복 결정의 일부인 것처럼 읽혀 의미가 희석된다. R-3 를 참조하는 형태는 오해를 낳을 수 있다.
- **제안**: §B.6.2 bullet 의 참조를 `(표준 model-list/test API 부재 — R-3 유지 사항)` 처럼 이유를 먼저 쓰고 R-3 를 보조 참조로 두는 방식으로 표현을 개선하거나, R-3 에서 독립된 `R-6. Rerank 연결 테스트 미제공 근거` 항목을 별도로 두는 방안을 고려할 수 있다. 현재 구조에서 기능적 오류는 아니므로 INFO 등급.

---

### 3. [INFO] R-5 (max_tokens 4096) 가 참조하는 AI 노드 spec 연동 약속 — target 내 미검증

- **target 위치**: `spec/2-navigation/6-config.md` R-5 (line 327–329): "AI Agent 노드 설정 패널 예시(`spec/4-nodes/3-ai/1-ai-agent.md`)의 `maxTokens` 예시값도 동일하게 4096 으로 동반 갱신"
- **과거 결정 출처**: 동 문서 R-5 자체가 처음 도입된 결정이며, R-5 는 AI Agent 노드 spec 도 4096 으로 갱신했다고 주장한다.
- **상세**: R-5 는 단순 spec-drift 정정이며 새 결정을 번복하는 성격이 아니다. 다만 R-5 에서 약속한 AI Agent 노드 spec 연동 갱신이 실제로 이루어졌는지는 본 target 문서 내에서 확인 불가능하다. 검증이 누락된 경우 spec 간 정합이 깨진다.
- **제안**: `spec/4-nodes/3-ai/1-ai-agent.md` 의 `maxTokens` 기본값·예시값이 4096 으로 갱신됐는지 별도 확인. 만약 미갱신이라면 R-5 약속이 이행되지 않은 것이므로 연동 spec 수정이 필요하다.

---

## 요약

`spec/2-navigation/6-config.md` 의 Rationale 연속성은 전반적으로 양호하다. R-3 (ModelConfig 단일 화면 통합 번복), R-4 (cohere Base URL), R-5 (max_tokens 정정)는 모두 이전 결정을 명시적으로 식별하고 번복 근거를 함께 기술한다. 데이터 모델 §2.16 Rationale, Webhook §inline auth path 폐지 Rationale 과의 정합도 유지된다. 주의가 필요한 지점은 §B.6.1 wireframe 의 Rerank 카드에 "Connected" 배지가 표시되는데, R-3 및 §B.6.2 본문이 "연결 테스트 미제공"을 명시하고 있어 이 배지가 어떤 상태를 나타내는지 설명이 없으면 합의된 원칙과 표면적으로 충돌하는 것으로 읽힐 수 있다. 이 부분에 한 줄 보충 설명이 추가되면 충분히 해소 가능한 수준이다.

## 위험도

LOW
