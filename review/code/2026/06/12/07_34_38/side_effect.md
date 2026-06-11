# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `resolveEmbedding` 시그니처에서 `legacyModel: string` 필수 파라미터 제거
- **위치**: `codebase/backend/src/modules/model-config/model-config.service.ts` — `resolveEmbedding` opts 타입
- **상세**: 기존 시그니처는 `legacyModel: string`을 필수(required) 파라미터로 요구했다. 이번 변경으로 해당 파라미터가 완전히 제거되었다. `embedding.service.ts`와 `rag-search.service.ts`의 호출부는 함께 수정되었으나, 이 함수를 직접 호출하는 외부 모듈 혹은 아직 인지되지 않은 내부 경로가 있다면 컴파일 에러 없이 `legacyModel`을 전달해도 TypeScript가 초과 프로퍼티 검사에서 걸러내지 않을 수 있다(객체 spread나 `as` 캐스트 경우). 이 시그니처는 공개 서비스 메서드이므로 동일 모듈 내 다른 호출자가 없는지 확인이 필요하다.
- **제안**: `grep -r 'resolveEmbedding' codebase/backend/src --include='*.ts'`로 모든 호출부를 스캔해 `legacyModel` 전달부가 남아있지 않은지 확인. 실제로는 이번 PR 내 두 호출부(`embedding.service.ts`, `rag-search.service.ts`)가 모두 수정되어 있어 즉각적 runtime 파손은 없지만, 컴파일-time warning/error가 생략된 시나리오에서 stale 호출이 남으면 빈 문자열이 model로 resolve될 수 있다.

---

### [WARNING] `resolveConfig` 에러코드 변경: `MODEL_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING` (기존 클라이언트 영향)
- **위치**: `codebase/backend/src/modules/model-config/model-config.service.ts:130`, `codebase/backend/src/modules/llm/llm.service.ts:353`
- **상세**: `resolveConfig`의 default 미설정 경로와 `llm.service.ts`의 default 미설정 경로에서 발행하는 에러코드를 `MODEL_CONFIG_DEFAULT_MISSING`으로 변경했다. 프론트엔드 `loader-error-messages.ts`에 해당 코드 매핑이 추가되었지만, 외부 API 소비자(자체 프론트 외 클라이언트, integration 파트너 등)가 `MODEL_CONFIG_NOT_FOUND` 또는 구 `LLM_CONFIG_NOT_FOUND`를 직접 분기하는 경우 해당 분기가 조용히 누락된다. 프론트엔드 내부에서는 동일 UI 메시지로 매핑되므로 사용자 노출 영향은 없으나, API 계약 관점에서는 breaking change다.
- **제안**: consistency-check SUMMARY Critical 3에서 이미 외부 소비자 점검이 api-contract-reviewer 위임 항목으로 식별되어 있다. 이 결과가 검토 완료되었는지 확인. 그렇지 않다면 본 PR merge 전 필수 선행.

---

### [WARNING] `KnowledgeBase` 엔티티의 `embeddingModel` 필드가 transient 비영속 필드로 전환 — ORM 직렬화 중 예상치 않은 DB 쓰기 가능
- **위치**: `codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts`
- **상세**: 기존 `embeddingModel`은 `@Column(...)` 데코레이터가 붙은 영속 컬럼이었다. 이번 변경으로 `@Column` 데코레이터를 제거하고 `embeddingModel?: string`을 단순 클래스 프로퍼티로 남겼다. V094 마이그레이션으로 실제 DB 컬럼은 DROP되므로 TypeORM이 이 필드를 INSERT/UPDATE 시 무시하는 것이 맞다. 그러나 TypeORM의 일부 동작에서 — 특히 `QueryBuilder`를 통한 벌크 update 혹은 ORM이 모든 엔티티 프로퍼티를 순회하는 경우 — 비-컬럼 필드가 의도치 않은 방식으로 포함될 수 있다. V094가 적용되기 전 중간 상태(V093 적용 완료, V094 미적용)에서 서버가 재시작되어 `embeddingModel`이 필드에 값이 설정된 채로 `save()`를 호출하면, TypeORM이 해당 컬럼을 DB에 쓰려고 시도하나 컬럼이 존재하므로(V093 단계에서는 아직 존재) 값이 실제 저장될 수 있다. 이 시나리오에서는 `[migrated]` 접두 model 문자열이 아닌 빈 문자열이 `embedding_model`에 쓰여질 수 있어 V093 repoint 불변성 보장에 위반된다. V094 이후에는 컬럼이 없으므로 문제없다.
- **제안**: V094 적용 전까지 `attachEffectiveEmbeddingModel`이 설정하는 `kb.embeddingModel` 값이 TypeORM `save()` 시 실수로 DB에 쓰이지 않도록, `@Column` 제거만으로 충분한지 TypeORM 버전과 동작을 재확인. 안전을 위해 `save()` 호출 이전에만 transient 필드에 쓰거나, `save()`를 `kbRepository.save(kb)` 패턴 대신 `kbRepository.update({ id: kb.id }, { ... })` 방식으로 명시적 컬럼만 지정하는 방법도 고려.

---

### [WARNING] `attachEffectiveEmbeddingModel`이 `list`/`findOne`/`create`/`update` 모든 경로에서 추가 DB 호출 유발 — 기존 호출자에게 없던 네트워크 I/O
- **위치**: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `attachEffectiveEmbeddingModel` private 메서드
- **상세**: 이전에는 `list`/`findOne`/`create`/`update`가 DB 조회 + save 후 즉시 반환했다. 이번 변경으로 모든 경로에 `attachEffectiveEmbeddingModel` 호출이 추가되어, 매번 `modelConfigService.findManyByIds` + (필요 시) `modelConfigService.findDefault` 쿼리가 추가로 발행된다. 이는 의도된 변경(embeddingModel derive 용)이나 부작용 관점에서 다음을 점검해야 한다:
  1. `list()` 경로에서 `kbs` 배열에 포함된 모든 `embeddingModelConfigId`가 unique set으로 배치 조회되므로 N+1은 방지됨. 그러나 `needsWsDefault`가 true인 경우(즉, 한 건이라도 `embeddingModelConfigId`가 null인 KB가 있으면) 항상 추가 `findDefault` 쿼리가 발행된다. 이 추가 쿼리는 기존에 없던 것으로, 해당 메서드를 호출하는 상위 레이어(HTTP 핸들러, agent-memory 등)에서 트랜잭션 컨텍스트나 타임아웃 설정에 영향을 줄 수 있다.
  2. `create`/`update`는 `save()` 후 `attachEffectiveEmbeddingModel([saved], workspaceId)`를 호출하는데, 이때 `saved` 객체의 `embeddingModelConfigId`가 null이면 wsDefault 쿼리가 추가로 발행된다. 에러 상황이 아닌 정상 흐름에서의 추가 쿼리이므로 throw 없이 진행되지만, save 이후 DB 상태와 일치하지 않는 transient 값이 반환될 가능성이 있다(wsDefault가 직전에 삭제된 경우).
- **제안**: 현재 구현은 전체적으로 안전하며, 배치화가 적용되어 N+1은 방지됨. 단, `list()` 내 `findDefault` 추가 쿼리에 대한 성능 영향을 모니터링. `wsDefaultEmbedding`이 null이더라도 throw하지 않는 soft resolve 설계는 명세에 부합함.

---

### [INFO] SQL 마이그레이션 V093에서 `model_config` 테이블에 새 row INSERT — 운영 환경 데이터 증가
- **위치**: `codebase/backend/migrations/V093__kb_embedding_repoint.sql`
- **상세**: V093 마이그레이션은 `embedding_model_config_id IS NULL`인 KB들에 대해 `INSERT INTO model_config`를 수행한다. 이 INSERT는 dedup CTE(`distinct_src`)를 통해 동일 `(workspace_id, provider, api_key, base_url, default_model, dimension)` 조합당 하나의 row만 생성한다. 생성된 config의 `is_default = FALSE`이므로 기존 default config에 영향을 미치지 않는다. 단, 이 row들의 `name` 필드에 `[migrated] ` 접두어가 붙어 생성되어, 관리 UI에서 임시 config로 표시된다.
- **제안**: 마이그레이션 완료 후 `[migrated]` 접두어 config들이 KB 목록에서 정상적으로 표시되는지 확인. 관리 UI에서 해당 config들을 더 적절한 이름으로 변경할 것을 운영 팀에 안내.

---

### [INFO] `LLM_CONFIG_INVALID` 에러코드 제거 — `loader-error-messages.ts`에서 매핑 삭제
- **위치**: `codebase/frontend/src/components/llm-config/loader-error-messages.ts`
- **상세**: `LLM_CONFIG_INVALID` 키 매핑이 삭제됐다. `llm-preview.service.ts`의 발행 코드가 `MODEL_CONFIG_INVALID`로 변경되어 프론트엔드 내 자체 매핑 변경은 일치한다. 그러나 기존 캐시된 에러 응답이나 외부에서 직접 API를 호출하는 소비자가 `LLM_CONFIG_INVALID`를 받을 경우 `undefined`를 반환하게 되어 에러 메시지가 표시되지 않는다. 테스트(`sanitize-loader-error.test.ts`)에서 `LLM_CONFIG_INVALID`가 `undefined`임을 명시적으로 검증하고 있어 의도된 변경임은 확인되나, 이 변경이 외부 클라이언트에게 조용히 regression이 될 수 있다.
- **제안**: 배포 후 `LLM_CONFIG_INVALID`가 발행되는 경로가 완전히 없어졌음을 모니터링.

---

### [INFO] `KbUpdatePayload` 타입에서 `embeddingModel`·`embeddingLlmConfigId` 제거 — 프론트엔드 타입 축소
- **위치**: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx`
- **상세**: 내부 타입 `KbUpdatePayload`에서 두 필드가 제거됐다. 해당 페이지 내에서만 사용되는 타입이므로 공개 API 계약에는 영향 없음.
- **제안**: 이 타입을 참조하는 다른 컴포넌트가 없음을 확인(이 페이지 단독 타입임).

---

### [INFO] `rag-search.service.ts` SQL SELECT에서 `embedding_model`, `embedding_llm_config_id` 컬럼 제거
- **위치**: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts:151-158`
- **상세**: Raw SQL에서 두 컬럼을 제거했다. V094 마이그레이션 전에 이 코드가 배포되면 SELECT 시 해당 컬럼들이 존재하지만 코드는 읽지 않으므로 데이터 무결성에 영향 없음. V094 이후에는 컬럼이 DROP되므로 코드-DB 일치. Flyway 순차 적용으로 V093 → V094가 보장되나, 배포 타이밍(마이그레이션 실행 vs 애플리케이션 재시작)에 따라 코드가 먼저 배포되고 컬럼이 나중에 DROP될 수 있는 blue-green 배포 시나리오는 문제없음. 반대(컬럼 먼저 DROP, 구 코드 접근)는 발생하지 않도록 배포 순서 관리 필요.
- **제안**: 배포 순서를 DB 마이그레이션 먼저, 애플리케이션 재시작 후로 표준 유지.

---

## 요약

이번 PR은 KB 임베딩 legacy 컬럼(`embedding_model`, `embedding_llm_config_id`)을 1급 `embedding_model_config_id` 기반으로 완전 전환하는 비가역 데이터 마이그레이션을 포함한다. 부작용 관점에서 가장 주의할 점은 세 가지다: (1) `resolveEmbedding` 시그니처 변경이 모든 호출부에 반영됐는지 확인(PR 내에서는 처리됨), (2) `KnowledgeBase` 엔티티의 `embeddingModel`이 `@Column` 없는 transient 필드로 전환되어 V093-V094 중간 배포 상태에서 TypeORM이 해당 값을 의도치 않게 DB에 쓰는 시나리오에 대한 주의, (3) `MODEL_CONFIG_DEFAULT_MISSING` 신규 에러코드 도입으로 인한 외부 API 소비자에 대한 breaking change 가능성(자체 프론트엔드는 이미 매핑 추가됨). 전체적으로 변경의 범위와 의도가 일관되게 구현되었으며, fail-loud RAISE로 데이터 무결성을 보장하는 구조는 적절하다.

## 위험도

MEDIUM
