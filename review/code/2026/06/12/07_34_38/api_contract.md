# API 계약(API Contract) 리뷰 결과

## 발견사항

---

### [CRITICAL] `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` + `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 에러코드 rename — 기존 API 클라이언트 breaking change

- **위치**: `/codebase/backend/src/modules/llm/llm.service.ts` (에러코드 변경), `/codebase/backend/src/modules/llm/llm-preview.service.ts` (에러코드 변경)
- **상세**: 이 PR 에서 두 에러코드가 rename 된다.
  1. `LLM_CONFIG_NOT_FOUND` (HTTP 400) → `MODEL_CONFIG_DEFAULT_MISSING` (HTTP 400) — `llm.service.ts`의 default config resolve 실패 경로
  2. `LLM_CONFIG_INVALID` (HTTP 400) → `MODEL_CONFIG_INVALID` (HTTP 400) — `llm-preview.service.ts`의 SSRF 가드·팩토리 오류 경로

  API 에러 코드 문자열(`code` 필드)을 직접 분기하는 외부/내부 클라이언트가 있다면 이는 breaking change다. 프론트엔드 `loader-error-messages.ts` 는 구 코드(`LLM_CONFIG_INVALID`)의 매핑을 삭제했고 테스트도 `expect(map.LLM_CONFIG_INVALID).toBeUndefined()`로 확인하고 있다. 즉 구 코드를 발행하는 경로가 사라지므로, 제3자 또는 외부 통합이 구 코드로 분기하고 있다면 조용히 실패한다.

  - `LLM_CONFIG_DEFAULT_MISSING`은 완전 신규 코드이므로, 이전 코드 `LLM_CONFIG_NOT_FOUND`를 기대하는 클라이언트에 대해 alias 없이 완전히 단절된다.
  - `MODEL_CONFIG_INVALID`는 이미 `model-config.service.ts`에서 발행되던 코드이므로 경로 통합은 일관성을 높이지만, `llm-preview.service.ts` 경로에서 구 코드를 기대하는 클라이언트에게는 breaking이다.

- **제안**: 외부 API 소비자 범위(자사 프론트엔드만인지, 공개 API/외부 통합 포함인지)를 명시적으로 확인한다. 자사 프론트엔드만 소비한다면 이미 양쪽 코드를 동일 메시지로 매핑하고 있어 실질적 영향은 없다. 외부 소비자가 있다면 `spec/conventions/error-codes.md §3 historical-artifact` 레지스트리에 구 코드명을 기록하고, 필요 시 deprecated alias를 일정 기간 병행 발행한다. 최소한 API CHANGELOG 또는 릴리즈 노트에 breaking change를 명시해야 한다.

---

### [WARNING] `MODEL_CONFIG_NOT_FOUND` HTTP status 이중 정의 — 동일 에러코드가 경로에 따라 400 / 404 반환

- **위치**: `/codebase/backend/src/modules/model-config/model-config.service.ts` (`notFound()` = `NotFoundException` 404) vs `/codebase/backend/src/modules/llm/llm.service.ts` (이 PR 에서 `MODEL_CONFIG_DEFAULT_MISSING`으로 분리되어 해소됨)
- **상세**: 이 PR 의 결과물을 보면 `MODEL_CONFIG_DEFAULT_MISSING`을 신규 코드로 분리해 `llm.service.ts`의 "default 미설정" 경로를 400으로 유지함으로써, `MODEL_CONFIG_NOT_FOUND`(model-config.service.ts 경로)는 404로 일원화된 구조가 된다. 이 분리 자체는 올바른 방향이다. 그러나 `MODEL_CONFIG_NOT_FOUND`가 `model-config.service.ts:resolveConfig`에서 `BadRequestException`(400)으로도 throw되는 경로(`MODEL_CONFIG_DEFAULT_MISSING`으로 rename 됐지만 이전 코드에서 `MODEL_CONFIG_NOT_FOUND`를 400으로 발행하던 경로)가 완전히 정리되었는지 확인이 필요하다. 프론트엔드 클라이언트 코드에서 HTTP status(400 vs 404)로 분기하는 로직이 있다면 일관성을 가져야 한다.
- **제안**: 변경 이후 `MODEL_CONFIG_NOT_FOUND`가 모든 발행 경로에서 404만 반환함을 단위 테스트로 보장한다. `MODEL_CONFIG_DEFAULT_MISSING`은 400 전용 코드임을 API 문서(Swagger/OpenAPI)에 반영한다.

---

### [WARNING] `KnowledgeBaseDto.embeddingModel` 이 이제 derived(비영속) 필드 — 응답 스키마 계약 변경

- **위치**: `/codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts`, `/codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts`
- **상세**: `embeddingModel`은 이전에는 DB 컬럼(`embedding_model`, 영속)에서 직접 직렬화되던 필드였다. 이 PR 이후 DB 컬럼이 DROP되고, `embeddingModel`은 서비스 레이어에서 참조 ModelConfig의 `defaultModel`을 읽어 런타임에 채우는 transient 필드가 된다.

  이 변경은 다음 API 계약에 영향을 준다:
  - 응답 스키마에서 `embeddingModel`은 여전히 `string`으로 노출되므로 클라이언트 입장에서는 타입 변화가 없다.
  - 그러나 **빈 문자열(`""`)**이 반환될 수 있는 경우가 생겼다: `embeddingModelConfigId`가 없고 워크스페이스 default `kind=embedding` config도 없을 때. 이전 동작에서는 항상 DB 기본값 `'text-embedding-3-small'`이 반환되던 경로다. 이는 조용한 계약 변경이다.
  - `attachEffectiveEmbeddingModel`은 throw하지 않는(soft resolve) 구현이므로 Config가 없어도 오류 없이 빈 문자열을 반환한다.

- **제안**: `KnowledgeBaseDto`의 `embeddingModel` 필드 설명에 "미설정 시 빈 문자열(`""`)" 가능성을 Swagger `@ApiProperty`에 명시한다(이미 description에 "둘 다 없으면 빈 문자열"이 추가되어 있으므로 양호). 프론트엔드 코드에서 `embeddingModel === ""`를 방어 처리하는지 확인 권장.

---

### [WARNING] `CreateKnowledgeBaseDto`/`UpdateKnowledgeBaseDto` 에서 `embeddingModel`·`embeddingLlmConfigId` 필드 완전 제거 — API 클라이언트 breaking change

- **위치**: `/codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts`, `/codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts`
- **상세**: 요청 DTO에서 다음 필드가 완전 제거된다:
  - `embeddingModel?: string` (create/update 양쪽)
  - `embeddingLlmConfigId?: string | null` (create/update 양쪽)

  이 필드들을 송신하는 클라이언트는 400 검증 오류 없이 조용히 무시(NestJS의 `@IsOptional()` 없으면 unknown 프로퍼티 strip)되거나, class-validator의 `whitelist: true` 설정 시 자동으로 제거된다. 클라이언트가 이 필드를 보내도 오류가 발생하지 않아 겉으로는 호환되는 것처럼 보이지만, 해당 필드의 의미가 완전히 소실되는 silent breaking change다.

  프론트엔드 `knowledge-bases.ts`에서도 이미 동일하게 제거됐으므로 자사 클라이언트는 영향 없다. 그러나 외부 API 클라이언트(예: 직접 REST 호출하는 서드파티 통합)가 있다면 이 필드가 무시되어 임베딩 설정 변경이 기대대로 동작하지 않을 수 있다.

- **제안**: API 버전 문서 또는 CHANGELOG에 `embeddingModel`과 `embeddingLlmConfigId` 요청 필드 폐기를 명시한다. 기존 클라이언트가 이 필드를 사용하고 있다면 `embeddingModelConfigId`로 마이그레이션 가이드를 제공한다.

---

### [INFO] `KnowledgeBaseResponseDto`에서 `embeddingLlmConfigId` 응답 필드 제거

- **위치**: `/codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts`
- **상세**: `embeddingLlmConfigId?: string | null` 필드가 응답 DTO에서 제거된다. 이 필드를 파싱하는 클라이언트는 단순히 `undefined`를 받게 된다(JSON에서 해당 키가 사라짐). TypeScript strict null-check 또는 직렬화 검증을 사용하는 클라이언트에서 예외를 유발할 수 있으나, 프론트엔드 `KnowledgeBaseData` 인터페이스에서도 이미 동일하게 제거됐다.
- **제안**: 외부 소비자가 이 필드를 파싱하는 경우를 위해 릴리즈 노트에 명시. 자사 클라이언트만 소비하는 구조라면 INFO 수준으로 무시 가능.

---

### [INFO] `resolveEmbedding` 내부 인터페이스 변경 — `legacyModel`·`embeddingLlmConfigId` 파라미터 제거

- **위치**: `/codebase/backend/src/modules/model-config/model-config.service.ts`
- **상세**: `resolveEmbedding` 메서드의 opts 타입에서 `legacyModel: string`과 `embeddingLlmConfigId?: string | null`이 제거된다. 이는 내부 서비스 간 계약 변경이므로 외부 API 클라이언트에 직접 영향을 주지 않는다. 단, `embedding.service.ts`와 `rag-search.service.ts`에서 호출부를 일관되게 수정한 것이 확인된다.
- **제안**: 해당 없음 — 내부 인터페이스 변경으로 외부 API 계약에 영향 없음.

---

## 요약

이 PR의 핵심 API 계약 위험은 두 가지다. 첫째, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` 및 `LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 에러코드 rename은 해당 코드 문자열로 분기하는 외부 클라이언트가 있다면 breaking change이며, 자사 프론트엔드는 이미 양쪽 코드를 동일 메시지로 매핑 또는 삭제하여 내부 영향은 없으나 외부 소비자 여부 확인이 필요하다. 둘째, `CreateKnowledgeBaseDto`/`UpdateKnowledgeBaseDto`에서 `embeddingModel`·`embeddingLlmConfigId` 필드가 완전 제거되어 이를 사용하는 외부 클라이언트에서는 silent no-op이 발생한다. `KnowledgeBaseDto.embeddingModel`이 DB 컬럼에서 derived 필드로 전환되면서 미설정 시 빈 문자열을 반환하는 새로운 엣지케이스가 생겼으나 Swagger description에 이미 명시되어 있어 양호하다. 내부 서비스 간 인터페이스(`resolveEmbedding` opts) 변경은 외부 계약에 영향 없다. 전반적으로 자사 클라이언트만 소비하는 구조에서는 변경이 잘 일관성 있게 처리됐으나, 외부 소비자가 있다면 에러코드 rename과 DTO 필드 제거에 대한 deprecation 안내가 필요하다.

## 위험도

MEDIUM
