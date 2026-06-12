### 발견사항

- **[CRITICAL]** `MODEL_CONFIG_NOT_FOUND` HTTP 상태 코드 이중 정의 충돌
  - target 신규 식별자: `MODEL_CONFIG_NOT_FOUND` — `llm.service.ts:356` 의 `LLM_CONFIG_NOT_FOUND`(현 400) 를 이 코드로 rename 하되 **HTTP 400 유지**
  - 기존 사용처: `spec/5-system/3-error-handling.md:50` 및 `model-config.service.ts:92-121` 에서 `MODEL_CONFIG_NOT_FOUND` 는 이미 `NotFoundException`(**HTTP 404**)로 발행됨
  - 상세: 동일 코드 문자열 `MODEL_CONFIG_NOT_FOUND` 가 두 발행 경로에서 서로 다른 HTTP status 를 가진다. `model-config.service.ts` 의 `notFound()` 메서드는 `NotFoundException`(404)를 사용하고, spec §1.3 표도 404 로 명시한다. plan 은 `llm.service.ts` 의 rename 경로에서 "HTTP 400 유지"를 결정했다. 클라이언트가 동일 코드를 받고 status 로 분기할 때(또는 spec 을 참조할 때) 혼선이 발생한다.
  - 제안: `llm.service.ts` 의 새 발행 경로도 `NotFoundException`(404)로 전환해 spec §1.3 과 일치시키거나, 아니면 `llm.service.ts` 의 경로만을 위한 별도 코드(`MODEL_CONFIG_NOT_FOUND_LLM` 등)를 신설하지 말고 spec §1.3 의 HTTP status 정의를 404→400 으로 개정해 단일 의미로 통일하는 방향을 project-planner 와 협의한다. 현 plan 이 "400 유지" 를 선택했다면 spec §1.3 표를 404→400 으로 수정해야 한다.

- **[WARNING]** `LLM_CONFIG_INVALID` 가 spec `spec/5-system/7-llm-client.md` 에 3회 남아있음 — `MODEL_CONFIG_INVALID` 와 동일 의미로 spec 안에 혼재
  - target 신규 식별자: `MODEL_CONFIG_INVALID` — `llm-preview.service.ts:39/48/69` 의 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 로 rename
  - 기존 사용처: `spec/5-system/7-llm-client.md:235`, `spec/5-system/7-llm-client.md:257`, `spec/5-system/7-llm-client.md:327·341` — SSRF 가드 설명 및 팩토리 오류 에러 표에서 `LLM_CONFIG_INVALID` 코드명을 계속 사용
  - 상세: plan 의 에러코드 rename 이 백엔드 emit 사이트 + spec `3-error-handling.md` 갱신을 포함하지만, `spec/5-system/7-llm-client.md` 내 `LLM_CONFIG_INVALID` 참조(4개소)는 plan 의 "spec 갱신(→ project-planner 위임)" 작업 범위에 명시되지 않았다. PR4b 이후 `3-error-handling.md` 만 갱신되고 `7-llm-client.md` 가 누락되면 spec 내 코드명 불일치가 잔존한다.
  - 제안: project-planner 위임 spec 갱신 범위에 `spec/5-system/7-llm-client.md` 의 `LLM_CONFIG_INVALID` 참조 4개소 업데이트를 명시적으로 추가한다.

- **[WARNING]** `spec/5-system/8-embedding-pipeline.md:177` 에서 legacy 컬럼 제거를 "V092 에서" 로 서술 — 실제 plan 은 V094
  - target 신규 식별자: V093(repoint), V094(DROP)
  - 기존 사용처: `spec/5-system/8-embedding-pipeline.md:177` — "legacy 컬럼(embedding_llm_config_id·embedding_model)은 V092 에서 제거 예정"
  - 상세: V092 는 이미 `DROP rerank_config` 로 사용됐다(기존 `V092__drop_rerank_config.sql` 확인). 임베딩 legacy 컬럼 DROP 은 plan 에서 V094 로 배정됐다. spec 의 "V092 에서 제거 예정" 서술은 오기(이월 당시 번호 업데이트 누락)이며, 해당 서술이 유지될 경우 마이그레이션 히스토리 추적이 혼란스러워진다.
  - 제안: project-planner 위임 spec 갱신 시 `spec/5-system/8-embedding-pipeline.md:177` 의 "V092" → "V094" 로 수정, `spec/1-data-model.md:539` 의 V092 에 "V093(repoint)·V094(DROP embedding legacy 컬럼)" 추가도 함께 갱신한다.

- **[INFO]** `RERANK_CONFIG_INVALID` — plan 에서 "검토(throw 아님)" 로 표기됐으나 spec 에서 정식 에러코드로 여러 곳에 등재됨
  - target 신규 식별자: plan §범위2 에서 `RERANK_CONFIG_INVALID` 처리를 "200, throw 아님 — 검토" 로 분류
  - 기존 사용처: `spec/5-system/9-rag-search.md:339·368·374`, `spec/2-navigation/6-config.md:239·321`, `spec/data-flow/6-knowledge-base.md:204`
  - 상세: `RERANK_CONFIG_INVALID` 는 검색 실행(rerank 호출) 레이어 전용 에러로 `spec/5-system/9-rag-search.md:374` 에서 `MODEL_CONFIG_INVALID`/`MODEL_CONFIG_NOT_FOUND` 와 레이어가 명시적으로 구분되어 있다. PR4b 가 이 코드를 건드리지 않는다면 충돌은 없으나, plan 표에 "검토" 로만 남겨진 것은 향후 혼선 소지가 있다. 결론을 "변경 없음(현행 유지)" 으로 확정해 plan 에 명시하는 것이 바람직하다.

---

### 요약

신규 식별자 충돌 관점의 핵심 위험은 `MODEL_CONFIG_NOT_FOUND` 의 HTTP status 이중 정의다. 이 코드는 `model-config.service.ts` + `spec/5-system/3-error-handling.md` 에서 이미 404 로 정의·발행되고 있으나, plan 은 `llm.service.ts` rename 경로에서 400 유지를 결정했다. 동일 코드 문자열이 서로 다른 HTTP status 로 두 경로에서 발행되면 클라이언트 분기 로직과 spec 가 불일치한다. 나머지 항목(LLM_CONFIG_INVALID spec 잔존, V092→V094 오기)은 spec 갱신 위임 범위에 추가하면 해소 가능한 경미한 누락이다. `RERANK_CONFIG_INVALID` 는 독립 레이어 코드로 충돌 없음.

### 위험도

HIGH
