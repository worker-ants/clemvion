## 발견사항

### [INFO] `data-flow/6-knowledge-base.md` 의 embed 호출 표기에 `inputType` 미반영
- **target 위치**: `spec/5-system/8-embedding-pipeline.md §5.4`, `spec/5-system/9-rag-search.md §임베딩 정책`, `spec/5-system/7-llm-client.md §3.3 / §8.3`
- **충돌 대상**: `spec/data-flow/6-knowledge-base.md` §1.2 (라인 73: `embed(texts[]) via LlmService`), §1.3 (라인 117: `embed(query) — ...`), §1.4 (라인 134: `embed(query)`)
- **상세**: target 이 정의한 `inputType:'document'`(적재) / `inputType:'query'`(검색) 이분을 9-rag-search 와 17-agent-memory 에는 반영했으나, 동일한 흐름을 mermaid 시퀀스 다이어그램으로 재기술하는 `data-flow/6-knowledge-base.md` 는 구버전 표기(`embed(texts[])`, `embed(query)`)를 그대로 유지해 **표기 불일치**가 발생한다. `embed(texts[], inputType:'document')`, `embed(query, inputType:'query')` 로 동기화가 필요하다. 기능적 충돌은 아니며 코드 동작을 잘못 설명하는 수준.
- **제안**: `data-flow/6-knowledge-base.md §1.2` 라인 73 을 `embed(texts[], inputType:'document')`, §1.3 라인 117 / §1.4 라인 134 를 `embed(query, inputType:'query')` 로 갱신. 또는 mermaid 코멘트(`Note`)로 inputType 구분을 부기해도 충분.

---

### [INFO] `spec/5-system/8-embedding-pipeline.md §5.4` 의 `LlmService.embed` 시그니처 표기와 `7-llm-client.md §8.3` 간 파라미터 순서 미세 차이
- **target 위치**: `spec/5-system/8-embedding-pipeline.md §5.4` — "`LlmService.embed(config, texts, model?, opts?, inputType)`"
- **충돌 대상**: `spec/5-system/7-llm-client.md §8.3` — "`embed(config, texts, model?, opts?, inputType?)`"
- **상세**: 두 곳에서 `LlmService.embed` 시그니처를 표기하는데 §5.4 는 `inputType` 뒤에 `?` 가 없고 §8.3 은 `inputType?` (선택) 로 기술한다. 실제 코드·§8.3 정의 기준으로 `inputType` 은 optional 이므로 §5.4 의 표기가 `?` 를 누락한 것이다. 동작 충돌은 아니나 시그니처를 참조하는 개발자에게 혼동을 줄 수 있다.
- **제안**: `spec/5-system/8-embedding-pipeline.md §5.4` 의 시그니처를 `LlmService.embed(config, texts, model?, opts?, inputType?)` 로 정정.

---

### [INFO] `spec/2-navigation/5-knowledge-base.md` 임베딩 모델 변경 경고와 `embedding_dimension` reset 흐름 간 암묵적 공백
- **target 위치**: `spec/2-navigation/5-knowledge-base.md §2.2` — "임베딩 모델 변경 경고" 블록
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §7.3` 및 `spec/1-data-model.md §2.11 KnowledgeBase.embedding_dimension` (재임베딩 시 `embedding_dimension = NULL` reset)
- **상세**: target 은 "임베딩 모델을 다른 값으로 바꾸면 인라인 경고 표시, 재임베딩은 자동 트리거 안 함" 을 명시했다. 그런데 §2.11 / §7.3 에 따르면 KB 전체 재임베딩 시작 시 `embedding_dimension = NULL` reset 이 일어난다. 모델 변경 후 재임베딩을 하지 않고 검색하면 구 차원 벡터와 신 query 벡터 간 불일치가 발생하는데, target 의 경고 문안에는 이 시나리오에 대한 안내가 없다. 기능적 모순은 아니나 UX 흐름 설명의 완전성에 공백이 있다.
- **제안**: target §2.2 경고 문안에 "재임베딩 전 검색 시 구 모델 차원 기준으로 검색이 동작해 정확도가 저하될 수 있다"는 한 줄 추가. 또는 §7.3 재임베딩 절차를 참조하는 링크로 대체 가능. 필수는 아님.

---

## 요약

이번 변경(`spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/17-agent-memory.md`, `spec/2-navigation/5-knowledge-base.md`)은 `LLMClient.embed` 시그니처에 `inputType:'query'|'document'` 위치 인자를 추가하고, e5/Gemini 비대칭 입력 처리 및 한국어 추천 배지를 정의하는 작업이다. 핵심 영역(7·8·9·17·KB 화면 spec) 간에는 데이터 모델·API 계약·상태 머신·RBAC·계층 책임 관점에서 직접 충돌이 발견되지 않는다. 각 spec 은 `inputType` 을 서로 올바르게 교차 참조하고 있으며, 새 파라미터 추가는 기존 호출부 하위 호환(`inputType` 생략 시 `'document'`)을 유지해 인터페이스 계약을 깨지 않는다. 유일한 불일치는 (1) `data-flow/6-knowledge-base.md` 의 mermaid 다이어그램이 구 버전 `embed(texts[])` / `embed(query)` 표기를 유지해 `inputType` 구분이 반영되지 않은 것과, (2) `8-embedding-pipeline.md §5.4` 에서 `inputType` 의 `?` optional 마커가 누락된 것으로, 모두 INFO 수준의 명명·표기 비일관성이다.

## 위험도
LOW
