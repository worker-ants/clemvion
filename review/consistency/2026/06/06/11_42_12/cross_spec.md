# Cross-Spec 일관성 검토 결과

**검토 모드**: `--impl-done` (구현 완료 후 검토)
**대상 영역**: `spec/5-system/` (실제 변경 파일: `7-llm-client.md`, `8-embedding-pipeline.md`, `9-rag-search.md`, `17-agent-memory.md` + `spec/2-navigation/5-knowledge-base.md`)
**기준선**: `origin/main`

---

## 발견사항

### [INFO] `data-flow/6-knowledge-base.md` — inputType 배선 누락
- target 위치: `spec/5-system/8-embedding-pipeline.md §5.4`, `spec/5-system/9-rag-search.md §4 비대칭 입력`
- 충돌 대상: `spec/data-flow/6-knowledge-base.md` L73–74, L117
- 상세: `data-flow/6-knowledge-base.md` 의 시퀀스 다이어그램은 `EP->>LLM: embed(texts[]) via LlmService` / `R->>LLM: embed(query)` 로 기술되어, 비대칭 입력(`inputType`)이 반영되지 않은 상태다. target spec 은 적재 경로를 `inputType:'document'`, 검색 쿼리를 `inputType:'query'` 로 명시했으나 data-flow 다이어그램은 여전히 구 형태를 보여준다. 기능 모순은 아니지만 다이어그램과 spec 본문 간 동기화 편차가 생긴다.
- 제안: `spec/data-flow/6-knowledge-base.md` L73/L117 의 `embed()` 호출 표기에 `(inputType:'document')` / `(inputType:'query')` 주석을 추가해 동기화 권장 (필수 차단 아님).

---

### [INFO] `spec/4-nodes/3-ai/3-information-extractor.md` — persistent recall 경로 inputType 미언급
- target 위치: `spec/5-system/17-agent-memory.md §4 회수 비대칭 입력 블록`
- 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md §7.1 회수(recall — consumer)`
- 상세: target spec(`17-agent-memory.md`)은 회수 경로를 `LlmService.embed(..., 'query')`, 저장 경로를 `inputType:'document'` 로 명시했다. `information-extractor.md §7.1` 의 recall 호출 `AgentMemoryService.recall(..., { embeddingModel })` 은 `17-agent-memory.md` SoT 를 참조하고 있으나, 비대칭 입력 변경 내용이 이 섹션에는 서술되어 있지 않다. IE spec 자체에서는 변경 시사가 없어 검토자에게 가시성이 낮다. 직접 모순은 없음.
- 제안: `information-extractor.md §7.1` 에 "회수 시 `inputType:'query'` — [Spec Agent Memory §4 비대칭 입력 참조]" 한 줄 추가를 권장 (필수 차단 아님).

---

### [INFO] `spec/5-system/7-llm-client.md §8.3` embed() 위치 인자 순서 — `spec/5-system/17-agent-memory.md` 호출 예시 불완전
- target 위치: `spec/5-system/7-llm-client.md §8.3` — `embed(config, texts, model?, opts?, inputType?)`
- 충돌 대상: `spec/5-system/17-agent-memory.md §4` 비대칭 입력 블록 — `LlmService.embed(config, texts, model?, opts?, 'query')`
- 상세: `7-llm-client.md §8.3` Rationale 에는 "opts 가 불필요하고 query 임베딩만 원할 때는 4번째 인자에 `undefined` 를 명시 — `embed(config, texts, model, undefined, 'query')`" 라는 위치 인자 사용 주의사항이 있다. `17-agent-memory.md §4` 의 표현 `LlmService.embed(config, texts, model?, opts?, 'query')` 는 시그니처를 문서화한 것이지 실제 호출 예시가 아니어서, `undefined` 명시 필요성이 드러나지 않는다. 기능 충돌은 없고 spec 간 설명 불일치다.
- 제안: `17-agent-memory.md §4` 의 표현을 `embed(config, texts, model, undefined, 'query')` 호출 예시로 보완하거나, `7-llm-client.md §8.3` 의 Rationale 주의사항을 명시적으로 크로스링크. 필수 차단 아님.

---

### [INFO] `spec/2-navigation/5-knowledge-base.md` 임베딩 모델 변경 경고 — `6-config.md §R-1` 단방향 참조
- target 위치: `spec/2-navigation/5-knowledge-base.md §2.2` 임베딩 모델 변경 경고 블록
- 충돌 대상: `spec/2-navigation/6-config.md §R-1` 마지막 항목 — `spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델 — 동일 결정을 임베딩 모델 선택에도 적용`
- 상세: `6-config.md §R-1` 은 이미 `5-knowledge-base.md §2.2` 임베딩 모델을 역참조하고 있으나, target 의 신규 "임베딩 모델 변경 경고" 블록은 `6-config.md §R-1` 로의 역참조가 없어 연계가 단방향이다. 기능 모순 없음.
- 제안: `5-knowledge-base.md §2.2` 변경 경고 블록에 `6-config.md §R-1` 링크 추가 권장 (선택).

---

## 요약

`spec/5-system/` 변경(7-llm-client, 8-embedding-pipeline, 9-rag-search, 17-agent-memory)과 `spec/2-navigation/5-knowledge-base.md` 변경은 서로 일관되며, 비대칭 임베딩 입력(`inputType`) 배선의 단일 진실 체인(`8-embedding-pipeline §5.4` → `7-llm-client §8.3` → `9-rag-search`, `17-agent-memory`)이 명확하게 구성되어 있다. 한국어 추천 배지(`embedding-model-recommendation.ts`)와 임베딩 모델 변경 경고도 `select-only` 원칙(`6-config.md §R-1`) 및 재임베딩 흐름(`8-embedding-pipeline §7.3`)과 충돌하지 않는다. 발견된 항목은 모두 INFO 등급의 동기화 권장 사항으로, 타 spec 영역과의 직접 모순이나 기능 작동 불가로 이어지는 CRITICAL/WARNING 충돌은 없다. `spec/data-flow/6-knowledge-base.md` 다이어그램의 `embed()` 호출 표기와 `information-extractor.md §7.1` 의 inputType 누락이 가시성 개선 관점에서 동기화를 권장하는 유일한 후속 항목이다.

---

## 위험도

NONE
