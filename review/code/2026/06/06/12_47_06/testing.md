# Testing Review

## 발견사항

### **[INFO]** graph 모드 inputType='query' 계약 테스트 추가 — 적절하고 핵심적인 회귀 가드
- 위치: `rag-search.service.spec.ts` L39–45 (diff)
- 상세: 비대칭 임베딩 모델(e5 계열 등)에서 query/passage 공간이 어긋나면 유사도가 무너진다. 이 계약이 vector 경로에는 이미 `"should pass each KB's embeddingModel to llmService.embed"` 테스트로 고정되어 있었고, 이번 변경에서 graph 경로(`searchGraphKb`)에도 동일 계약을 `routes graph KB through searchGraphKb` 테스트 내 expect 로 추가했다. 두 검색 경로의 서명이 동일한 5-인자 패턴 `(config, texts, model, opts, inputType)` 임을 단일 테스트로 입증한다. 올바른 접근.
- 제안: 없음. 추가된 어설션은 최소하고 의도가 명확하다.

---

### **[INFO]** `LocalClient.embed` 상속 경로 회귀 가드 신규 파일 생성 — 설계·격리 모두 양호
- 위치: `local.client.spec.ts` (신규)
- 상세: `LocalClient`는 `OpenAIClient`를 단순 상속(`super()` 위임)하므로 embed 로직은 부모가 전부 담당한다. 이 파일은 그 상속 경로가 `LocalClient` 인스턴스에서도 깨지지 않음을 독립적으로 고정한다 — 부모 테스트와 중복이 아닌 상속 계약 검증이다. 4개 케이스(query prefix, document prefix, 기본값 document, 대칭 모델 무prefix)가 정확히 경계 상황을 커버한다.
- Mock 패턴: `@ts-expect-error`로 내부 SDK 교체 — `openai.client.spec.ts`와 동일한 관용구. `beforeEach` 없이 헬퍼 함수 `makeEmbedClient`로 격리해 테스트 간 상태 오염 없음. 적절.
- 제안: 없음.

---

### **[INFO]** `applyEmbeddingInputPrefix` 멱등성-없음 계약 테스트 — 의도 문서화 관점에서 타당
- 위치: `embedding-input-type.spec.ts` L861–877 (diff)
- 상세: 이 테스트는 함수가 "멱등이 아님"을 명시적으로 고정한다. 이중 prefix 누적은 버그가 아니라 의도된 설계이며, 호출자가 중복 호출 금지 책임을 진다는 계약을 문서화한다. 테스트 명칭이 "(정책)"으로 끝나 의도가 명확하다.
- 커버리지 관점: 기존 `applyEmbeddingInputPrefix` 케이스들이 단순 변환을 검증하지만 이중 적용 시나리오는 없었다. 추가하는 것이 적절.
- 잠재 우려: 멱등성 없음을 "정책"으로 고정하면 향후 dedup 로직을 무심코 추가했을 때 이 테스트가 깨지며 경고가 된다 — 그것이 목적이므로 올바른 설계다.
- 제안: 없음.

---

### **[INFO]** `LlmService.embed` inputType 배치 전파 + withTimeout 경유 테스트 추가 — 경로별 커버리지 완성
- 위치: `llm.service.spec.ts` L1027–1087 (diff)
- 상세: 기존 배치 분할 테스트는 model·배치 크기를 검증했으나 `inputType` 전파는 누락되어 있었다. 두 케이스(일반 경로·withTimeout 경로)를 추가해 두 코드 경로 모두 `inputType`이 최종 `client.embed()` 호출로 흘러가는지 고정한다. withTimeout 경로는 클로저로 인자를 잡아야 하므로 별도 케이스 분리가 맞다.
- 제안: 없음.

---

### **[INFO]** `EmbeddingModelCombobox` 한국어 추천 배지 렌더 테스트 추가 — 계층 분리 명확
- 위치: `embedding-model-combobox.test.tsx` L1114–1150 (diff)
- 상세: 순수 분기 로직은 `embedding-model-recommendation.test.ts`의 `formatEmbeddingOptionLabel`에서 단위 검증하고, combobox 테스트는 컴포넌트가 그 라벨을 실제 DOM option 텍스트로 렌더하는지만 확인한다. 책임 분리가 적절하다. `optionText()` 헬퍼가 해당 테스트 내에서만 선언되어 다른 테스트에 영향 없음(격리 양호).
- 제안: 없음.

---

### **[INFO]** `formatEmbeddingOptionLabel` 순수함수 신규 테스트 스위트 — 커버리지 완전
- 위치: `embedding-model-recommendation.test.ts` L1802–1852 (diff)
- 상세: 추천/비추천·name≠id·name=id·name 빈값·i18n 비의존 배지 주입 등 6개 케이스가 함수의 모든 분기를 커버한다. 특히 배지 문구를 호출자 주입으로 설계하고 그 계약을 테스트에서 직접 검증하는 방식이 테스트 용이성(의존성 주입) 원칙을 잘 따른다.
- 제안: 없음.

---

### **[INFO]** `isKoreanRecommendedEmbeddingModel` — `text-embedding-3` 제거 케이스 비추천 목록 이동
- 위치: `embedding-model-recommendation.test.ts` L1784–1793 (diff)
- 상세: product 결정(text-embedding-3은 한국어 벤치마크 하위)에 따라 추천 목록에서 제거하고 비추천 목록으로 이동했다. 테스트가 구현 변경을 정확히 반영하며 회귀 가드로 작동한다.
- 제안: 없음.

---

### **[WARNING]** `AzureOpenAIClient.embed`의 inputType 전파 테스트 부재
- 위치: `codebase/backend/src/modules/llm/clients/azure-openai.client.ts` — 대응 spec 파일 없음
- 상세: `LocalClient`와 마찬가지로 `AzureOpenAIClient`도 `OpenAIClient`를 상속하고 동일한 `embed` 경로를 사용한다. 이번 변경에서 `LocalClient`는 `local.client.spec.ts`를 신규 추가해 상속 경로를 고정했지만, `AzureOpenAIClient`에는 대응 테스트가 없다. self-host(Ollama/vLLM) e5 모델이 주 실사용 경로이므로 우선순위는 `LocalClient` > `AzureOpenAIClient` 이나, Azure endpoint에서 비대칭 임베딩 모델을 사용하는 시나리오가 있다면 동일 회귀 위험이 존재한다.
- 제안: `azure-openai.client.spec.ts`를 생성하고 `local.client.spec.ts`와 동일 패턴으로 e5 prefix 상속 경로를 고정한다 — 혹은 현재 이슈가 Azure에서 e5를 쓰지 않는다면 INFO로 다운그레이드.

---

### **[WARNING]** `searchVectorGroup` 및 `searchWithRerank` 경로의 embedding 차원 불일치 graceful skip 케이스 미커버
- 위치: `rag-search.service.spec.ts` — `searchVectorGroup` 내 `queryEmbedding.length !== dim` 분기
- 상세: `rag-search.service.ts` L381–386에 "반환된 임베딩의 차원이 기대값과 다를 때 경고 후 빈 배열 반환"하는 방어 코드가 있다. 이 경로를 직접 테스트하는 케이스가 없다. `mock embed`가 잘못된 차원을 반환했을 때 검색 그룹이 조용히 스킵되는지 — 즉 상위 결과 배열에서 해당 그룹이 제외되는지 — 검증되지 않는다. graph KB에도 동일 방어 코드(L456–465)가 있으나 역시 미커버.
- 제안: "embed가 dim이 다른 벡터를 반환하면 해당 그룹/KB를 스킵하고 다른 그룹 결과는 유지"하는 케이스를 추가한다.

---

### **[INFO]** 멀티 KB에서 cross_encoder 리랭크 미실행 테스트 — 잠재적 상태 오염
- 위치: `rag-search.service.spec.ts` L685–698
- 상세: `mockDataSource.query.mockResolvedValue([])` 호출 후 `mockResolvedValueOnce`를 덮어쓰는 패턴이 사용된다. `mockResolvedValue`가 디폴트로 설정되고 `mockResolvedValueOnce`가 이를 일시적으로 오버라이드하는 Jest 동작상 의도대로 작동하지만, 코드 순서가 "전체 디폴트를 설정 후 첫 번째 호출을 오버라이드"라 가독성이 낮다. 다른 테스트들은 `mockResolvedValueOnce` 체이닝으로 명시적 순서를 지정하는데 이 케이스만 다르다.
- 제안: `mockResolvedValueOnce([...메타...]).mockResolvedValue([])` 순서로 통일해 가독성을 높인다.

---

## 요약

이번 변경의 테스트 품질은 전반적으로 높다. 핵심 계약(graph 경로 `inputType='query'` 전파, 배치 분할 시 inputType 보존, withTimeout 경로 투과)이 모두 명시적으로 고정되었으며, 신규 순수함수 `formatEmbeddingOptionLabel`은 모든 분기를 커버하는 6개 케이스로 완전히 검증된다. `LocalClient` 상속 회귀 가드 파일 신설은 올바른 계층 설계 결정이다. 주요 갭은 두 가지: (1) `AzureOpenAIClient`의 e5 prefix 상속 경로 미커버 — LocalClient와 동일 위험이지만 실용 우선순위가 낮다, (2) 임베딩 차원 불일치 시 graceful skip 방어 분기 미커버 — 조용히 검색 그룹이 제외되는 경로가 테스트 없이 묻힐 수 있다. 테스트 격리·가독성·Mock 적절성은 전 파일에서 양호하다.

## 위험도

LOW
