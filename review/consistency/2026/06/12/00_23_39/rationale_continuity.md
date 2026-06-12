### 발견사항

- **[WARNING]** V093 creds 출처 우선순위에 `ws default chat` 경로 포함 — 기각된 piggyback 재도입 위험
  - target 위치: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §범위 1 V093 설명 `(1) embedding_llm_config_id → (2) ws default chat → (3) ws default embedding`
  - 과거 결정 출처: `spec/1-data-model.md §2.16 Rationale (ModelConfig 통합)` — "이전엔 embedding 이 chat 용 LLMConfig 를 빌려 썼다(같은 row 가 역할에 따라 chat/embedding). embedding 모델은 차원이라는 고유 불변속성을 가지므로 1급 row(kind=embedding)가 정합적이다." 와 `spec/5-system/8-embedding-pipeline.md §5.2` — "chat 용 LLMConfig piggyback 도, KB 의 bare embedding_model 문자열도 아닌 자체 1급 설정이 소유한다."
  - 상세: V091(점진적 전환)의 Rationale 에서 chat config piggyback 은 임베딩 1급화로 대체해야 할 기각된 설계다. V093 repoint 가 `ws default chat` 을 2순위 폴백으로 사용하는 것은 동일 piggyback 패턴을 마이그레이션 경로에서 다시 채택하는 것이다. V093 의 목적은 legacy `embedding_llm_config_id` / `embedding_model` 컬럼이 가리키던 설정을 `kind=embedding` ModelConfig 로 재구성해 pin 하는 것인데, chat config (provider/api_key/base_url) 에서 embedding config 를 find-or-create 하는 로직이 "임베딩 1급화" 원칙과 충돌하지 않으려면 새 Rationale 이 필요하다. 특히 `ws default chat` config 에서 파생한 `kind=embedding` find-or-create 는 "embedding 은 chat config 와 다른 1급 불변속성(dimension)을 가진다"는 invariant 하에서 dimension 을 어떻게 결정하는지(probe? embedding_dimension 캐시?) 가 명시되지 않으면 암묵적 invariant 충돌이 된다.
  - 제안: V093 설명에 "ws default chat 폴백 시 이미 KB.embedding_dimension 이 있으면 그 값을 dimension SoT 로 사용하고, 없으면 probe embed 필수" 라는 조건을 명시하거나, chat config 경유 repoint 에 대한 별도 Rationale 항(`spec/5-system/8-embedding-pipeline.md ## Rationale` 또는 plan Rationale 주석)을 추가하라. 그렇지 않으면 V093 경로를 `(1) embedding_llm_config_id → (2) ws default embedding` 2단계로 단순화해 chat piggyback 경로를 완전히 제외하라.

- **[CRITICAL]** 에러코드 HTTP status 충돌 — `MODEL_CONFIG_NOT_FOUND` 는 spec 이 404 로 확정했으나 plan 은 400 유지를 선언
  - target 위치: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §사용자 확정 결정 — "LLM_CONFIG_NOT_FOUND(현 400) → MODEL_CONFIG_NOT_FOUND 리네임하되 llm.service.ts resolve 경로는 HTTP 400 유지"
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.3` 표 — `MODEL_CONFIG_NOT_FOUND | ... | 404`
  - 상세: spec 의 에러 코드 카탈로그는 `MODEL_CONFIG_NOT_FOUND` 의 HTTP status 를 **404** 로 이미 확정하고 있다. plan 은 "HTTP 400 유지(status 변경 breaking 회피)"를 사용자 확정 결정으로 선언하고 있어 두 문서가 직접 충돌한다. 구현이 plan 의 결정을 따르면 spec 에 등재된 카탈로그와 실제 HTTP status 가 달라져 spec 이 거짓이 된다. 이는 `spec/conventions/error-codes.md §2` 의 "rename 은 breaking change — deprecated alias·이중 발행·마이그레이션 부담"과도 맞닿아 있다. 현재 `LLM_CONFIG_NOT_FOUND` 가 400 이었다면, spec 은 그 rename 대상인 `MODEL_CONFIG_NOT_FOUND` 를 404 로 다르게 정의했으므로 단순 rename 이 아니라 HTTP status 도 함께 변경하도록 spec 이 이미 설계된 것이다.
  - 제안: 두 경로 중 하나를 택해야 한다. (A) spec 의 404 를 따라 구현하면 `llm.service.ts` resolve 경로도 404 로 바꿔야 하며, breaking change Rationale 을 plan 과 spec `## Rationale` 에 명시한다. (B) 400 유지가 breaking 방지 때문이라면, spec `3-error-handling.md §1.3` 의 `MODEL_CONFIG_NOT_FOUND` HTTP status 를 400 으로 수정하고 그 결정 근거(backward compat)를 `## Rationale` 에 기록해야 한다. plan 이 spec 과 다른 HTTP status 를 결정했다면 반드시 spec 갱신이 선행 또는 병행돼야 한다.

- **[WARNING]** spec 에 V092 제거 예정으로 표기된 legacy 컬럼이 실제론 V093/V094 에서 제거됨 — 버전 번호 불일치로 Rationale 연속성 혼란
  - target 위치: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §범위 1 (V093/V094 작업)
  - 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md §5.5` 주석 — "legacy 컬럼(embedding_llm_config_id·embedding_model)은 **V092** 에서 제거 예정" / `spec/1-data-model.md §2.11` — "[LEGACY — PR4b 제거 예정]"
  - 상세: spec 에는 V092 에서 legacy 컬럼이 제거된다고 기재되어 있으나 V092(`drop_rerank_config`)는 이미 머지됐고 해당 컬럼은 제거되지 않았다. 실제 제거는 PR4b 의 V094 에서 이루어진다. spec 본문의 "V092 에서 제거 예정" 표기는 stale 이며, 이것이 Rationale 문서에 포함된 결정 근거로 읽히면 "V092 까지 존치"라는 과거 결정의 맥락이 틀어진다. 직접적인 기각 대안 재도입은 아니지만 결정의 완료 조건이 잘못 기록돼 후속 검토자를 오도할 수 있다.
  - 제안: spec 갱신 시(project-planner 위임 항목) `spec/5-system/8-embedding-pipeline.md §5.5` 의 "V092 에서 제거 예정" 표기를 "V094(PR4b) 에서 제거" 로 수정하고, `spec/1-data-model.md §2.11` 의 LEGACY 태그도 "PR4b(V094) 에서 제거됨" 으로 완료 표기를 반영하라.

- **[INFO]** V094 비가역 DROP 전 V093 검증 통과 조건에 대한 Rationale 부재
  - target 위치: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §범위 1 — "V093 commit(검증 통과) 후에만 V094 진행"
  - 과거 결정 출처: `spec/0-overview.md ## Rationale "DB 마이그레이션 도구로 Flyway 채택"` — "forward-only 채택: 별도 undo 스크립트는 두지 않는다. 마이그레이션 파일 하단의 `-- DOWN:` 주석으로 충분하고, 자동 undo 체인을 유지하는 비용·리스크 대비 이득이 낮다."
  - 상세: Flyway forward-only 원칙 하에 V094 의 비가역성은 합의된 정책 범위 안이다. 그러나 V093 의 fail-loud RAISE 와 V094 의 단계 분리 근거(어떤 검증 기준을 충족해야 V094 진행 가능한지)가 plan 에만 있고 spec Rationale 에는 기록되지 않는다. forward-only 정책 자체와는 충돌하지 않으나 비가역 DROP 결정을 보강하는 Rationale 이 없다.
  - 제안: spec 갱신 시 `spec/5-system/8-embedding-pipeline.md ## Rationale` 에 "V093 repoint + fail-loud RAISE 로 NULL KB 0건 확인 후 V094 DROP 진행 — 점진적 전환(V091) 완결 패턴"을 한 항으로 추가하면 향후 검토자가 단계 분리 근거를 추적할 수 있다.

---

### 요약

PR4b 의 핵심 Rationale 연속성 위험은 두 가지다. 첫째, `MODEL_CONFIG_NOT_FOUND` 의 HTTP status 가 plan(400 유지)과 spec 카탈로그(404) 사이에서 직접 충돌한다 — 이는 구현 전에 반드시 한 쪽을 확정하고 spec 을 갱신해야 하는 CRITICAL 이슈다. 둘째, V093 repoint 경로가 `ws default chat` config 를 2순위 폴백으로 사용하는 것은 "chat piggyback 은 기각됐다"는 임베딩 1급화 합의와 마찰을 일으키며, 해당 경로에서 dimension 결정 방식이 명확하지 않아 암묵적 invariant 충돌 가능성이 있다. 에러코드 rename 자체는 `spec/conventions/error-codes.md §2` 의 "이름 정확성 향상만을 위한 rename 은 하지 않는다" 원칙과 긴장 관계이나, spec 에서 신규 코드로 이미 카탈로그에 등재된 상태이므로 이 긴장은 구현 전 spec 이 결정한 것으로 봐야 하며 plan 이 그 결정(HTTP 404)을 번복하는 것이 문제다.

### 위험도

HIGH
