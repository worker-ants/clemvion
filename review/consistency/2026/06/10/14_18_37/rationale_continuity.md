# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-unified-model-management.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] R-3 번복 선언은 있으나 `7-llm-client.md` Rationale 의 "별개 DB 테이블" 전제 갱신이 명시적으로 선언되지 않음

- **target 위치**: 변경 2 `### Rationale 개정 (R-3 번복)`, 변경 3 `spec/5-system/7-llm-client.md` 행
- **과거 결정 출처**: `spec/5-system/7-llm-client.md ## Rationale` — "왜 LLMClientFactory 에 통합하지 않았나" 항: *"LLMConfig 와 RerankConfig 는 **별개 DB 테이블**·별개 워크스페이스 리소스다. … 같은 팩토리에 두면 switch 가 불필요하게 커지고 RerankConfig 의 타입이 LLMConfig 로 오염된다."*
- **상세**: 이 Rationale 은 "별개 DB 테이블"을 `LLMClientFactory`/`RerankClientFactory` 분리 유지의 근거로 명시하고 있다. target draft 는 테이블을 통합(`model_config` 단일)하면서도 팩토리 분리는 유지한다고 밝힌다(변경 3 `§4: 팩토리는 kind로 선택·분리 유지, 테이블만 통합`). 이는 결론 자체는 타당하나, 기존 Rationale 에서 "별개 DB 테이블 → 별도 팩토리"로 연결된 논리 체인의 **전제(DB 분리)가 무너졌으므로** Rationale 을 갱신해야 한다. target 은 변경 3의 표 안에 "Rationale `'별개 DB 테이블이라 분리'` 전제 → `'테이블 통합 후에도 API shape 차이로 RerankClient 분리 유지'`" 로 교체 내용을 적시하긴 했으나, 이 변경이 spec 본문 Rationale 섹션에 실제로 반영된다는 확약이 필요하다. 초안 단계에서 미적용 위험이 있다.
- **제안**: 변경 3 반영 시 `spec/5-system/7-llm-client.md ## Rationale` 의 "왜 LLMClientFactory 에 통합하지 않았나" 항을 직접 수정해, "별개 DB 테이블" 전제 문장을 "테이블이 통합됐음에도 API shape 차이(rerank(query, docs[])·스코어 배열·스트리밍 없음) 가 분리 유지 근거" 로 명시적 교체. 미이행 시 기존 Rationale 이 새 설계와 모순된 채로 남는다.

---

### [WARNING] `9-rag-search.md` Rationale 의 "왜 RerankConfig 를 LLMConfig 와 분리했나" 항이 폐기 대상이나 처리 지시가 단순 갱신/폐기 1줄에 그침

- **target 위치**: 변경 3 표 — `spec/5-system/9-rag-search.md §3.3/§3.3.2` 행: *"'왜 RerankConfig를 LLMConfig와 분리' 항을 통합 근거로 갱신/폐기"*
- **과거 결정 출처**: `spec/5-system/9-rag-search.md ## Rationale` — "왜 RerankConfig 를 LLMConfig 와 분리했나": *"리랭커는 chat/embedding 과 API shape 가 다른 별도 model class. capability flag 로 LLMConfig 에 욱여넣기보다 sibling 리소스가 명확. 단 provider 추상화·SSRF 가드·secret-store 는 재사용."*
- **상세**: 이 항은 분리 결정 근거이므로 통합 후에는 "ModelConfig 통합 이유(관리 포인트 제거)" + "팩토리·인터페이스 분리 유지 이유(API shape 차이)" 두 층위를 명시하는 새 서술로 교체돼야 한다. target 은 "갱신/폐기"라는 방향만 제시하고 실제 대체 서술을 명시하지 않는다. spec 에 반영될 때 이 항이 단순 삭제되면 왜 분리를 유지하는지 근거가 사라진다.
- **제안**: 변경 3 에서 `9-rag-search.md Rationale` 개정 내용을 구체 문안으로 제시하거나, 또는 9-rag-search.md 에 반영될 때 "ModelConfig 단일 테이블로 통합했으나 `RerankClient`/`RerankClientFactory` 는 API shape 차이(`rerank(query, docs[])` vs `embed/chat`) 로 분리 유지" 취지의 새 Rationale 항을 명문화해야 한다.

---

### [WARNING] `8-embedding-pipeline.md` Rationale 의 `listModels type='embedding'` 필터 메커니즘이 `kind='embedding'` 조회로 전환될 때 Rationale 갱신 명시 부재

- **target 위치**: 변경 3 표 — `spec/5-system/8-embedding-pipeline.md §5.2/§5.3` 행: *"`listModels type='embedding'` 필터 → `kind='embedding'` 조회 전환 근거 추가"*
- **과거 결정 출처**: `spec/5-system/8-embedding-pipeline.md ## Rationale` (결정: 다중 차원 임베딩 + KB 단위 모델 선택) — `LlmService.listModels: { type?: 'chat'|'embedding' }` 옵션을 서비스 레이어에서 필터링 (V021 결정 사항). 이는 단일 `LLMConfig` 테이블이 chat/embedding 두 역할을 겸하는 전제 위에서 `type` 필터로 구분한 것이다.
- **상세**: 통합 이후 embedding 모델은 `kind='embedding'` ModelConfig row 로 1급화된다. 기존 Rationale 의 `LlmService.listModels type='embedding'` 경로는 "LLMConfig 행 중 embedding 가능한 것을 필터"하는 설계였다. 새 설계는 `kind='embedding'` ModelConfig 목록을 직접 조회하는 구조라 메커니즘이 다르다. target 은 "Rationale 에 전환 근거 추가"를 지시하지만 실제 근거 문안이 초안에 없다.
- **제안**: `8-embedding-pipeline.md Rationale` 에 "`listModels type='embedding'` → `kind='embedding'` ModelConfig 직접 조회로 전환한 이유(1급 row 이므로 별도 필터 불필요, dimension SoT 일원화)" 를 명시적 항목으로 추가하도록 변경 3 지시를 구체화.

---

### [INFO] `spec/2-navigation/6-config.md` R-3 "LLMConfig sibling 분리" 번복 — 내용은 있으나 기존 R-3 문장을 직접 인용해 갱신 확인이 필요

- **target 위치**: 변경 2 `### Rationale 개정 (R-3 번복)`
- **과거 결정 출처**: `spec/2-navigation/6-config.md ## Rationale` R-3: *"리랭커는 API Key·endpoint 를 가진 provider 리소스라 LLMConfig 와 동일 패턴의 sibling 으로 분리했다 (chat/embedding 과 API shape 가 다른 전용 `/rerank` 엔드포인트)."*
- **상세**: target 은 R-3 번복 근거("관리 포인트·UX 통합 이득 > shape 분리 이득")를 충분히 기술하며 새 Rationale 도 함께 작성했다. 번복 의도와 근거가 명시돼 있으므로 Rationale 연속성 관점에서 형식 요건은 충족한다.
- **제안**: spec 반영 시 기존 R-3 텍스트 전체를 삭제하고 target 의 번복 근거 텍스트로 대체(기존 R-3 문장 잔존 시 모순). 확인용 체크리스트에 포함 권장.

---

### [INFO] `9-rag-search.md` "폐기한 대안" 항과 통합 결정의 충돌 잠재성

- **target 위치**: 변경 3 — `spec/5-system/9-rag-search.md §3.3/§3.3.2` 갱신
- **과거 결정 출처**: `spec/5-system/9-rag-search.md ## Rationale` "폐기한 대안" 목록: *"노드 단위 리랭크 설정 — KB 소유권 원칙 위반·설정 분산. 기각."*
- **상세**: target 의 통합은 KB 소유권 원칙 자체를 건드리지 않으므로 이 폐기 대안과 직접 충돌하지 않는다. 확인 차원 언급.
- **제안**: 해당 없음. 9-rag-search.md 갱신 시 이 폐기 항목은 그대로 유지해도 무방하다.

---

## 요약

target draft 는 `spec/2-navigation/6-config.md` R-3("RerankConfig sibling 분리")의 번복을 명시적 근거와 함께 선언하고 있어 결정 번복의 형식 요건(새 Rationale 동반)은 대체로 충족한다. 그러나 번복의 파급 효과가 미치는 두 개의 하위 spec Rationale — `spec/5-system/7-llm-client.md`의 "별개 DB 테이블 → 별도 팩토리" 논리 체인과 `spec/5-system/9-rag-search.md`의 "왜 RerankConfig 를 LLMConfig 와 분리했나" 항 — 에 대해서는 갱신 방향만 제시하고 실제 대체 문안이 없다. 이 상태로 spec 에 반영되면 기존 Rationale 의 전제가 사라진 채 결론만 남거나(팩토리 분리 유지 근거 소실), 분리 이유 항이 단순 삭제되어 후속 독자가 판단 근거를 잃는다. `8-embedding-pipeline.md`의 `listModels type` → `kind` 전환 근거도 문안이 미비하다. 이들은 CRITICAL 수준은 아니나 spec 반영 단계에서 놓치기 쉬운 WARNING 사항이다.

## 위험도

MEDIUM
