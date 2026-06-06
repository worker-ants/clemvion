### 발견사항

- **[WARNING]** `LLMClient.embed` 인터페이스 시그니처 확장 — "평탄한 시그니처" 원칙의 경계 해석
  - target 위치: `spec/5-system/7-llm-client.md` §3.1 LLMClient 인터페이스, §3.3 embed 시그니처
  - 과거 결정 출처: `spec/5-system/7-llm-client.md` §3.3 본문 — **"임베딩은 파라미터/응답 객체를 쓰지 않고 평탄한 시그니처를 사용한다"** 가 설계 원칙으로 확정됐다. 이 원칙은 `EmbedResponse`·`EmbedOptions` 같은 래퍼 객체를 금지하는 것으로 명문화됐다 (Rationale 항에는 직접 등재되지 않았으나 §3.3 본문이 사실상 invariant).
  - 상세: target 은 `LLMClient.embed` 에 세 번째 위치 인자 `inputType?: 'query' | 'document'` 를 추가하고, `LlmService.embed` 에 네 번째·다섯 번째 위치 인자 `opts?`/`inputType?` 을 추가한다. 원칙의 금지 대상("파라미터/응답 객체")에 위치 인자 확장이 포함되는지에 대해 target 스스로 "optional scalar 확장은 원칙 범위 내"라고 inline 해설을 추가해 해석을 명확히 했으며, 이 해석이 신규 Rationale 항(§8.3 Rationale 불릿)으로도 추가됐다. 그러나 `LlmService.embed` 의 `opts` 위치 인자는 `opts=undefined` 를 명시해야 `inputType` 만 전달 가능하다는 DX 문제(`embed(config, texts, model, undefined, 'query')`)를 남긴다 — "평탄한 시그니처" 원칙이 의도했던 심플함과 다소 멀어진다. 이 trade-off 가 Rationale 에서 충분히 언급되지 않았다.
  - 제안: 신규 Rationale 항에 `LlmService.embed` 의 5-인자 시그니처에서 `opts` 자리를 `undefined` 로 skip 해야 하는 DX 비용을 명시적 trade-off 로 추가한다. "EmbedResponse 도입 시 객체화 검토"는 이미 있으나, `opts` skip 문제에 대한 언급이 없어 향후 `EmbedOptions` 도입 결정 시 맥락이 불투명해질 수 있다.

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §5.4` 신설 — 신규 결정, 과거 기각 대안 없음
  - target 위치: `spec/5-system/8-embedding-pipeline.md §5.4 비대칭 입력(input_type / prefix)` 및 `## Rationale "결정: 비대칭 입력(input_type / prefix) 배선"`
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md ## Rationale` — 기존 Rationale 에 비대칭 임베딩 입력에 대한 결정이 없었다. §5.4 는 신규 섹션.
  - 상세: §5.4 는 새로운 결정이므로 기각된 대안 재도입 패턴은 없다. Rationale 도 함께 추가돼 있어 무근거 번복 패턴도 없다. `*-instruct` e5 변형을 "보수적으로 제외(no-op)" 처리하는 결정이 Rationale 에 근거와 함께 명시된 점, 도입 이전 색인 데이터의 재임베딩 필요성이 명시된 점 모두 양호하다.
  - 제안: 별도 조치 불필요.

- **[INFO]** `spec/5-system/17-agent-memory.md` — inputType 비대칭 배선 추가
  - target 위치: `spec/5-system/17-agent-memory.md §2 회수(recall) 절` 비대칭 inputType 주석
  - 과거 결정 출처: `spec/5-system/17-agent-memory.md` — agent memory 의 임베딩 모델 출처 원칙("같은 임베딩 모델 출처로 차원 일치")만 확정된 상태였으며, inputType 배선에 대한 이전 결정 없음.
  - 상세: 신규 사실(비대칭 배선) 추가이며, 기존 invariant(같은 모델로 query/passage 차원 일치)와 충돌하지 않는다. "도입 이전 비대칭 모델로 저장된 기존 메모리는 무접두사 상태로 남아 약한 비대칭이 생길 수 있다"는 운영 주의사항과 "KB 와 달리 agent_memory 에는 일괄 재임베딩 경로가 없다"는 invariant 가 inline 으로 명시됐다.
  - 제안: agent memory 재임베딩 부재 trade-off 를 Rationale 절에 한 줄 추가해 두면 향후 일괄 재임베딩 경로 도입 검토 시 맥락이 명확해진다. 강제 필요는 없다.

### 요약

`spec/5-system/` 의 변경(7-llm-client, 8-embedding-pipeline, 9-rag-search, 17-agent-memory)은 비대칭 임베딩 입력(inputType) 배선이라는 단일 신규 결정을 여러 spec 에 전파하는 구조이며, 과거 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 직접 위반하는 사례는 없다. 주목할 긴장점은 `LLMClient.embed` 의 "평탄한 시그니처" 원칙에 위치 인자를 추가하는 것인데, target 이 그 해석을 inline + Rationale 항으로 함께 명시해 번복이 아닌 원칙 범위의 명확화로 처리했다. 다만 `LlmService.embed` 의 5-인자 시그니처에서 `opts` 자리를 `undefined` 로 skip 해야 `inputType` 만 전달 가능한 DX 비용이 Rationale 에 충분히 문서화되지 않은 점이 WARNING 수준의 보완 과제이며, 나머지는 INFO 수준의 제안이다.

### 위험도

LOW
