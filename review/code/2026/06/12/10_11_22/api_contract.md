### 발견사항

- **[CRITICAL]** `MODEL_CONFIG_DEFAULT_MISSING`(400) 신규 에러 코드가 spec 에만 등재되고 실제 코드베이스 구현 여부가 이 diff 에서 확인되지 않음
  - 위치: `/spec/5-system/3-error-handling.md` line 50, `/spec/conventions/error-codes.md §4`
  - 상세: `3-error-handling.md §1.3` 과 `error-codes.md §4` 에 `MODEL_CONFIG_DEFAULT_MISSING`(400) 를 신규 등재했다. 그러나 이 diff 는 spec 파일과 review 산출물만 포함하며 `error-codes.ts`, `model-config.service.ts`, `llm.service.ts` 의 실제 구현 변경은 포함되지 않는다. consistency 검토 SUMMARY(review/consistency/.../09_01_10/SUMMARY.md) 는 Critical #2 로 "코드베이스에서 `MODEL_CONFIG_DEFAULT_MISSING` 미존재, `llm.service.ts:356` 에서 `LLM_CONFIG_NOT_FOUND` 여전히 발행 중"을 확인했다. spec 이 실제 코드와 불일치한 상태에서 API 클라이언트는 spec 을 보고 `MODEL_CONFIG_DEFAULT_MISSING` 분기를 추가하지만 실제 응답에는 `LLM_CONFIG_NOT_FOUND` 가 올 수 있다.
  - 제안: `error-codes.ts` 에 `MODEL_CONFIG_DEFAULT_MISSING` 추가 + `model-config.service.ts` / `llm.service.ts` throw 경로 전환이 이 PR 에 포함되거나, spec 등재를 "Planned (미구현)" 으로 표기해 spec-ahead 임을 명시해야 한다.

- **[CRITICAL]** `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` rename 이 spec 에는 완료로 기록됐으나 `llm-preview.service.ts` 에서 구 코드명이 여전히 발행 중
  - 위치: `/spec/conventions/error-codes.md §4`, `/spec/5-system/7-llm-client.md` line 235/257/327/341
  - 상세: `error-codes.md §4 Rename 이력` 에 `LLM_CONFIG_INVALID` 를 retired 로 등재하고 `7-llm-client.md` 의 4개 참조를 `MODEL_CONFIG_INVALID` 로 갱신했다. 그러나 consistency 검토 Critical #1 은 `llm-preview.service.ts:39/48/69` 에서 `LLM_CONFIG_INVALID` 가 live 발행 중임을 확인했다. spec 이 구 코드를 "retired, 더 이상 발행되지 않음"으로 선언하는 순간 클라이언트는 `LLM_CONFIG_INVALID` 분기를 제거할 수 있으나 실제로는 여전히 수신할 수 있다.
  - 제안: `llm-preview.service.ts` 의 `LLM_CONFIG_INVALID` 코드 교체를 이 PR 에 포함하거나, spec §4 의 해당 행을 "코드 교체 pending" 으로 조건부 표기해야 한다.

- **[WARNING]** `POST /api/knowledge-bases` 요청 바디에서 `embedding_model` 필드 제거 — 하위 호환성 검증 필요
  - 위치: `/spec/data-flow/6-knowledge-base.md` line 1701 (diff)
  - 상세: `POST /api/knowledge-bases` 요청 바디 spec 에서 `embedding_model` 필드가 제거됐다. 구형 클라이언트나 통합 파트너가 이 필드를 전송할 경우 무시 처리(NestJS `ValidationPipe` transform)되는지, 아니면 `VALIDATION_ERROR` 로 거부되는지 spec 에 명시되지 않았다. 또한 이 필드 제거가 실제 컨트롤러 DTO 에 이미 반영됐는지 이 diff 에서 확인할 수 없다.
  - 제안: KnowledgeBase 생성 DTO 에서 `embedding_model` 필드 제거 상태를 확인하고, spec 에 "unknown 필드는 strip 처리" 또는 "이 필드는 deprecated, 무시됨" 을 명시한다. 외부 API 소비자가 있다면 deprecation notice 가 필요하다.

- **[WARNING]** `MODEL_CONFIG_NOT_FOUND`(404) 적용 범위 축소 — 기존 "default 해석 실패" 경로의 status 변경
  - 위치: `/spec/5-system/3-error-handling.md` line 1439 (diff)
  - 상세: `MODEL_CONFIG_NOT_FOUND` 의 설명에서 "default 해석 실패" 경로가 제거됐고 별도 코드 `MODEL_CONFIG_DEFAULT_MISSING`(400)으로 분리됐다. 이전에 `MODEL_CONFIG_NOT_FOUND`(404)를 받던 "ws default config 없음" 경로의 클라이언트는 이제 `MODEL_CONFIG_DEFAULT_MISSING`(400)을 받게 된다. HTTP 상태 코드와 에러 코드 문자열이 동시에 변경되므로 이중 breaking change 에 해당한다. `error-codes.md §4` 가 이를 이력으로 기록하고 내부 소비자만 있음을 명시한 점은 올바르나, 실제 throw 경로가 전환됐는지 이 diff 에서 확인되지 않는다.
  - 제안: `model-config.service.ts` 의 `resolveConfig` default 경로 throw 전환 여부를 확인한다. `3-error-handling.md §1.3 Rationale` 에 기록된 분리 근거는 충분하나 구현이 선행되지 않으면 spec 이 허위 계약이 된다.

- **[WARNING]** `PATCH /api/knowledge-bases/:id` — `embedding_model_config_id` 변경 시 `embedding_dimension` NULL reset 트리거 조건 변경
  - 위치: `/spec/data-flow/6-knowledge-base.md` line 1725 (diff)
  - 상세: `embedding_dimension` NULL reset 경로 2번이 "구 `embedding_model` 변경 시"에서 "신 `embedding_model_config_id` 변경 시"로 변경됐다. 이는 `PATCH /:id` 의 동작 계약(서버 사이드 이펙트)이 변경된 것이다. 구형 클라이언트가 `embedding_model` 을 PATCH 로 전송해 모델 변경을 시도하면 NULL reset 이 트리거되지 않아 차원 불일치가 발생할 수 있다.
  - 제안: `PATCH /api/knowledge-bases/:id` 에서 `embedding_model` 필드가 무시되는지, 전송 시 오류를 반환하는지 spec 에 명시한다. 또한 `embedding_model_config_id` 변경 시 재임베딩이 자동 트리거되는지 여부도 spec 에 명확히 기술해야 한다.

- **[WARNING]** `POST /api/knowledge-bases/embedding-probe` 요청 파라미터 `llmConfigId`·`embeddingModel` legacy 필드 잔존
  - 위치: `/spec/data-flow/6-knowledge-base.md` line 231 (cross-spec 검토 발견사항 6)
  - 상세: consistency 검토에서 `embedding-probe` 엔드포인트의 request body spec 에 legacy `llmConfigId`·`embeddingModel` 파라미터가 여전히 포함됨이 확인됐다. PR4b 가 legacy step-3 를 코드에서 제거했다면 이 파라미터도 더 이상 유효하지 않으나 spec 이 아직 갱신되지 않아 클라이언트는 이 파라미터가 여전히 동작한다고 오해할 수 있다.
  - 제안: `embedding-probe` 컨트롤러의 실제 DTO 를 확인하고, legacy 파라미터가 제거됐다면 `spec/data-flow/6-knowledge-base.md §1.6` 도 이번 PR 범위에 포함해 갱신한다.

- **[INFO]** `spec/2-navigation/5-knowledge-base.md` — "없으면 임베딩 사용 전 ModelConfig 설정 필요 — `MODEL_CONFIG_NOT_FOUND`" 에러 코드 노출
  - 위치: `/spec/2-navigation/5-knowledge-base.md` line 1415 (diff)
  - 상세: "워크스페이스 기본값 없으면 `MODEL_CONFIG_NOT_FOUND`" 로 기술됐으나, 위 분석에 따르면 default 미설정 경로는 `MODEL_CONFIG_DEFAULT_MISSING`(400)으로 분리됐다. UI spec 과 error handling spec 사이의 코드명 불일치다. 사용자 경험 설계(UI 에러 안내 문구)에는 직접 영향 없으나 프론트엔드 분기 로직 구현 시 혼선을 줄 수 있다.
  - 제안: `spec/2-navigation/5-knowledge-base.md` 의 해당 라인을 `MODEL_CONFIG_DEFAULT_MISSING` 으로 수정한다.

- **[INFO]** `spec/data-flow/7-llm-usage.md` — `EmbeddingService` config 선택 경로 갱신 (API 계약 영향 없음, 내부 경로)
  - 위치: `/spec/data-flow/7-llm-usage.md` line 1749 (diff)
  - 상세: `kb.embeddingLlmConfigId` 를 `resolveEmbedding(kb.embeddingModelConfigId)` 로 갱신한 내부 구현 경로 설명이다. 외부 API 계약에 직접 노출되지 않으나, `resolveEmbedding` 이 `MODEL_CONFIG_NOT_FOUND`(404) 또는 `MODEL_CONFIG_DEFAULT_MISSING`(400) 를 throw 할 수 있어 임베딩 관련 API(KB 생성·검색) 의 에러 응답 계약에 간접 영향이 있다.
  - 제안: KB 생성·검색 엔드포인트의 에러 응답 스펙에 `MODEL_CONFIG_DEFAULT_MISSING`(400)이 가능한 에러 코드로 포함되는지 `spec/data-flow/6-knowledge-base.md §1.x` 에 명시한다.

---

### 요약

이 PR 의 변경은 spec 파일과 review 산출물만 포함하며 실제 백엔드 API 구현 코드 변경은 포함되지 않는다. API 계약 관점의 핵심 위험은 두 가지다. 첫째, `MODEL_CONFIG_DEFAULT_MISSING`(400) 신규 코드와 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` rename 이 spec 에 완료로 선언됐으나 실제 코드베이스에서 미구현 상태인 것으로 consistency 검토에서 확인됐다 — spec 과 실제 API 응답이 불일치하는 기간 동안 클라이언트 분기 오작동이 발생할 수 있다. 둘째, `POST /api/knowledge-bases` 에서 `embedding_model` 필드 제거, `embedding_dimension` NULL reset 트리거 조건 변경, `embedding-probe` 엔드포인트 legacy 파라미터 잔존 등 다수의 API 계약 변경이 구현 전환 완료 여부 확인 없이 spec 에 반영됐다. 이 변경들이 실제 코드와 동기화됐는지 확인이 선행돼야 API 계약이 유효하다.

### 위험도

HIGH
