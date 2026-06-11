# Cross-Spec 일관성 검토 결과

**대상 문서**: `plan/in-progress/spec-update-embedding-testconnection.md`
**검토 일시**: 2026-06-11

---

## 발견사항

### [WARNING] 9-rag-search Rationale 와의 개념 경계 긴장 — probe 차원 저장 주체 충돌 위험

- **target 위치**: draft §1 "핵심 구분" 표 / §3 제안 변경 (6-config §B.3 추가)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §5 + Rationale "왜 probe(임베딩 테스트) 차원을 미리 저장하지 않나"
- **상세**: `9-rag-search` Rationale 는 "probe 로 얻은 차원을 미리 저장하지 않는다"는 원칙을 `embedding_dimension`(KB 파생 캐시) 기준으로 설명한다. draft 는 이 원칙을 건드리지 않고 **다른 필드**(`ModelConfig.dimension` — 모델 출력 차원 SoT)를 자동 저장한다고 명시하지만, 9-rag-search §5 의 해당 Rationale 텍스트("probe 는 read-only 검증으로 유지한다")는 문면 그대로 읽히면 **모든 probe 경로의 차원 저장을 금지**하는 것처럼 읽힐 여지가 있다. spec 독자가 두 문서를 함께 볼 때 혼동을 일으킬 수 있다.
- **제안**: 9-rag-search Rationale 의 해당 항목에 "(여기서 '저장하지 않는다'는 `KnowledgeBase.embedding_dimension`에 한정된다 — `ModelConfig.dimension` 자동 저장과는 별개)" 등의 한 줄 주석을 추가하거나, 또는 draft §B.3 추가문에 기존 9-rag-search §5 Rationale 가 금지하는 대상과 본 변경의 대상이 다름을 명확히 설명하는 cross-reference 를 강화한다. draft 는 이미 "두 probe 는 대상 필드가 달라 충돌하지 않는다"고 기술하고 있으나 9-rag-search 쪽 업데이트가 없으면 단방향 참조가 된다.

---

### [WARNING] 6-config §B.3 현행 텍스트 vs. draft 제안 변경 사이 chat/embedding 분기 미비

- **target 위치**: draft §3 "제안 변경 3. spec/2-navigation/6-config.md §B.3"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` §B.3 (현행 본문: L179–L184)
- **상세**: 현행 §B.3 은 `chat` 고정 텍스트("간단한 API 호출(예: 모델 목록 조회)로 연결 확인")만 기술하며 embedding 분기가 없다. draft 는 chat/embedding 분기를 추가하고 embedding 연결 테스트 성공 시 `PATCH /api/model-configs/{id} { dimension }` 자동 저장을 명시한다. 변경 자체는 기존 spec 과 모순이 없으나, **현행 §B.5 의 `차원(dimension)` 행**("선택 모델의 벡터 차원(예: 1536/3072). ModelConfig.dimension = SoT — KB 가 이 모델로 임베딩하면 `KnowledgeBase.embedding_dimension`(파생 캐시)에 고정된다")은 `dimension` 이 수동 입력 필드임을 암시하는데, draft §4 가 이를 "연결 테스트(probe embed)로 자동 감지·저장"으로 교체하면 §B.5 의 나머지 섹션("차원 변경 가드" 단락)과 정합성을 재확인해야 한다. 특히 "이미 벡터가 적재된 KB 가 참조하는 embedding 모델의 차원은 사후 변경 불가"라는 가드가 자동 저장 경로에서도 그대로 적용되는지(저장 대상이 `ModelConfig.dimension` 이지 KB 가 아니므로 가드 대상이 아님)를 spec 본문이 명확히 해야 한다.
- **제안**: draft §4 의 교체 행에 "단, 이미 적재된 KB 를 참조하는 embedding 모델의 경우 차원 변경 가드(§B.5 차원 변경 가드)는 `ModelConfig.dimension` 자동 저장과 독립적으로 적용된다" 등 한 줄을 보강하거나, §B.5 차원 변경 가드 단락을 함께 갱신하여 자동 저장 경로에서의 가드 적용 여부를 명시한다.

---

### [WARNING] 7-llm-client §8.3 "기존 chat / testConnection / resolveConfig 유지" 서술과 draft 추가 내용 간 단방향 갱신 위험

- **target 위치**: draft §1 "레이어 구분" 및 §1 "제안 변경 1. spec/5-system/7-llm-client.md §8.3"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` §8.3 (L412 주석: "기존 chat / testConnection / resolveConfig 유지")
- **상세**: 현행 §8.3 LlmService 클래스 정의의 주석 `// 기존 chat / testConnection / resolveConfig 유지` 는 testConnection 이 단순 위임처럼 읽히고 kind 별 분기 전략이 없다. draft 는 이 주석을 "testConnection 은 서비스 레이어에서 kind 별 probe 분기(아래)" 로 보강하도록 제안한다. 내용 자체의 모순은 없으나, §8.3 의 LlmService 코드 블록 안에 `testConnection` 시그니처가 명시되어 있지 않아 draft 에서 제안한 `LlmService.testConnection(configId, workspaceId)` 시그니처가 기존 서술과 어긋나는지 불명확하다. 한편 §7.1 StubLlmClient 의 stub 계약에서 `embed 는 zero 벡터`를 반환한다고 명시되어 있는데, draft 가 embedding testConnection 에서 `client.embed(['connection test'], defaultModel)` 호출 후 `vectors[0].length` 를 dimension 으로 사용하면, stub 환경에서 zero 벡터(길이는 정상이므로 0이 아님)가 반환된 경우 dimension 값이 의도치 않게 저장될 수 있다. stub 응답 차원이 실 모델과 다를 가능성이 있어 e2e 환경에서의 자동 저장 동작을 별도로 명시해야 한다.
- **제안**: (a) draft §8.3 보강 텍스트에 `LlmService.testConnection(configId, workspaceId): Promise<{ success: boolean; dimension?: number }>` 시그니처를 명시한다. (b) §7.1 stub 계약에 "LLM_STUB_MODE 환경에서 embedding testConnection 은 zero 벡터를 반환하므로 dimension 자동 저장이 발생할 수 있다 — e2e 에서 자동 저장 side-effect 를 방지하려면 `/test` endpoint 를 stub-aware 로 처리하거나 dimension 저장 로직을 stub 환경에서 skip 한다" 주석을 추가하는 것을 검토한다.

---

### [INFO] 1-data-model.md §2.16 dimension 필드 설명 — "자동 감지 가능" 문맥 부재

- **target 위치**: draft §6 "제안 변경 6. spec/1-data-model.md §2.16 ModelConfig.dimension"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.16 L552
- **상세**: 현행 `dimension` 필드 설명은 "embedding 전용 벡터 차원(384/512/768/1024/1536/3072). pgvector 컬럼 차원과 결합된 SoT — KnowledgeBase.embedding_dimension 은 이 값의 파생 캐시. chat/rerank 는 NULL"으로 수동 입력 방식만 암시한다. draft 는 1줄 주석(`(embedding 연결 테스트 성공 시 probe embed 로 자동 감지·자동 저장 가능 — 상세 [Config §B.3])`)을 추가한다. 이는 모순이 아니라 정보 추가이므로 INFO 수준이지만, 현행 "embedding 전용 벡터 차원(384/512/768/1024/1536/3072)" 의 차원 값 목록이 probe 로 반환될 수 있는 실제 차원 집합을 모두 커버하는지 확인이 필요하다. 예컨대 자가호스팅 Local 모델이 비표준 차원(예: 512, 256)을 반환하는 경우 목록이 exhaustive 가 아닐 수 있다.
- **제안**: 차원 목록을 예시로 표현("예: 384/512/768/1024/1536/3072")하거나, "provider 별 벡터 차원 — 자동 감지 또는 수동 입력" 식으로 소개문을 보강하면 exhaustive 해석을 막을 수 있다.

---

### [INFO] 6-config §3 API 표 L283 현행 응답 shape 기술 미비

- **target 위치**: draft §5 "제안 변경 5. spec/2-navigation/6-config.md §3 API 표"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` §3 Model Config API 표 (L283)
- **상세**: 현행 L283 은 `POST /api/model-configs/{id}/test | 연결 테스트 (chat/embedding 만 — rerank 미제공)` 만 기술하고 응답 shape 가 없다. draft 는 `chat { success }`, `embedding { success, dimension? }` shape 를 추가한다. 변경 자체는 기존 spec 과 충돌하지 않으나, `{ success, dimension? }` 응답 shape 가 API 규약(`spec/5-system/2-api-convention.md`)에 정의된 표준 응답 봉투(`data`, `message` 필드 등)와 일치하는지 확인이 필요하다. 현재 다른 mutation endpoint 들이 성공 응답에 어떤 봉투를 쓰는지 명시되어 있지 않다.
- **제안**: draft 의 응답 shape 표기에 API 규약 봉투 여부를 명시하거나(예: `{ data: { success, dimension? } }` vs flat), 2-api-convention.md 규약을 cross-reference 한다.

---

### [INFO] draft 가 참조하는 plan 경로들의 링크 정합성

- **target 위치**: draft §레이어 구분 · §우선순위 및 연동
- **충돌 대상**: `plan/in-progress/unified-model-management.md §7 W4`
- **상세**: draft 는 `plan/in-progress/unified-model-management.md §7 W4`(forwardRef 순환 의존 정리)를 백로그로 링크한다. CLAUDE.md 규약에 따라 spec 본문에는 plan 파일로의 마크다운 링크가 아닌 백틱 인라인 텍스트로 유지해야 한다는 주의사항이 draft 자신의 §우선순위 및 연동에 이미 명시되어 있어, spec 반영 시 링크가 아닌 인라인 텍스트로 기술해야 한다. 이는 충돌이 아니라 spec 작성 시 준수해야 할 규약 사항이다.
- **제안**: spec 본문 작성 시 plan 파일 경로를 마크다운 링크로 쓰지 않고 백틱 인라인(`plan/in-progress/unified-model-management.md §7 W4`)으로 표기한다. draft 자체에 이미 해당 주의사항이 있어 실행 시 준수될 것으로 보인다.

---

## 요약

target draft 는 `ModelConfig.dimension`(모델 출력 차원 SoT) 자동 저장과 `KnowledgeBase.embedding_dimension`(파생 캐시) 불변 원칙을 명확히 분리하여 기존 spec 과의 개념적 충돌을 피한 설계를 채택하고 있다. 실질적 CRITICAL 충돌은 발견되지 않았다. 다만 `9-rag-search` Rationale 의 "probe 는 read-only" 문구가 KB probe 에 한정됨을 9-rag-search 쪽에서도 명시해야 단방향 참조 문제가 해소되고, `6-config §B.5` 의 차원 변경 가드가 자동 저장 경로에도 적용되는지 spec 에서 명확히 해야 한다. `7-llm-client` StubLlmClient 의 stub 환경 dimension 저장 side-effect 도 e2e 정합을 위해 검토가 필요하다.

---

## 위험도

MEDIUM
