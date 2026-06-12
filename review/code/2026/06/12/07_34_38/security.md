# Security Review — PR4b KB Embedding Legacy Column Retirement

## 발견사항

### **[INFO]** V093 마이그레이션: RAISE EXCEPTION 에러 메시지에 KB UUID 목록 노출
- 위치: `/codebase/backend/migrations/V093__kb_embedding_repoint.sql` 라인 104~106
- 상세: fail-loud 블록이 `RAISE EXCEPTION` 으로 orphan KB 의 `id` 값을 에러 메시지에 포함한다. 이 UUID 목록은 DBA 레벨 마이그레이션 로그에만 노출되며(Flyway 실행 로그), 클라이언트나 HTTP 응답으로 전파되지 않는다. DB 레벨 식별자가 운영 로그에 남는 것 자체는 통상 수용 가능하다.
- 제안: 수용 가능. 만약 로그 접근 정책이 엄격하다면 UUID 대신 카운트만 출력하는 옵션도 있으나, 운영 수동 처리용 진단 정보이므로 현행 유지가 타당하다.

### **[INFO]** `findManyByIds` — 워크스페이스 범위 필터 적용 확인 (양호)
- 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` 신규 `findManyByIds` 메서드
- 상세: `this.repo.find({ where: { id: In(ids), workspaceId } })` 로 조회 시 `workspaceId` 조건이 명시적으로 포함되어 있다. 타 워크스페이스의 ModelConfig id 를 입력해도 결과에서 걸러지므로 Tenant 간 데이터 유출 경로가 없다.
- 제안: 이상 없음.

### **[INFO]** `attachEffectiveEmbeddingModel` — 쓰기 없는 비영속 derive (양호)
- 위치: `/codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `attachEffectiveEmbeddingModel`
- 상세: 반환 DTO 의 `embeddingModel` 필드를 인메모리에서만 채우며 DB 에 저장하지 않는다. `KnowledgeBase` entity 의 `embeddingModel` 프로퍼티에는 `@Column` 데코레이터가 없어 TypeORM 이 이 필드를 영속화하지 않는다. 표시용 derive 로서 보안상 문제 없음.
- 제안: 이상 없음.

### **[INFO]** `embeddingModelConfigId` 검증 — 생성·변경 시 서버 측 kind 검증 유지 (양호)
- 위치: `/codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `create` 및 `update`
- 상세: `embeddingModelConfigId` 가 제공되면 `modelConfigService.findEntity(id, workspaceId, 'embedding')` 로 존재 여부 + 워크스페이스 소유 + `kind='embedding'` 를 한 번에 검증한다. 무효 ID 나 타 워크스페이스 ID 주입 시 `MODEL_CONFIG_NOT_FOUND` 예외가 발생한다.
- 제안: 이상 없음.

### **[INFO]** 에러 코드 변경 (`LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING`) — 정보 노출 수준 변동 없음
- 위치: `/codebase/backend/src/modules/llm/llm-preview.service.ts`, `/codebase/backend/src/modules/llm/llm.service.ts`, `/codebase/backend/src/modules/model-config/model-config.service.ts`
- 상세: `llm-preview.service.ts` 의 `MODEL_CONFIG_INVALID` 에러는 `raw = error instanceof Error ? error.message : String(error)` 를 그대로 `message` 에 담아 던진다(라인 66~81). 이 메시지는 외부 LLM provider SDK 가 반환한 에러 문자열이므로, SDK 에러가 내부 정보(연결 URL, 토큰 형식 등)를 포함할 경우 HTTP 400 응답으로 클라이언트에 노출될 수 있다. 이는 이번 PR 의 신규 취약점이 아니라 기존 동작 그대로이며, 에러 코드명 변경만 이루어진 것이다.
- 제안: 중기적으로 SDK 에러 메시지를 sanitize(공개 안전한 메시지로 래핑)하는 것을 권장하나, 이번 PR 범위 밖이다.

### **[INFO]** `embeddingModel` 패턴 검증 제거 (`@Matches(EMBEDDING_MODEL_PATTERN)`) — 의도적 삭제
- 위치: `/codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts`, `update-knowledge-base.dto.ts`
- 상세: `embeddingModel` 필드 자체가 DTO 에서 제거됐으므로 해당 `@Matches` 검증도 함께 사라진 것이다. `embeddingModel` 은 이제 서버가 참조 config 로부터 derive 하는 read-only 값이므로 클라이언트 입력 경로가 없다. 인젝션 공격 면적이 오히려 줄었다.
- 제안: 이상 없음.

### **[INFO]** V093 SQL: api_key 암호화 컬럼 그대로 복사 (양호)
- 위치: `/codebase/backend/migrations/V093__kb_embedding_repoint.sql` `distinct_src`, `created` CTE
- 상세: 주석에 명시된 대로 `api_key` 는 암호화된 ciphertext 컬럼이 그대로 복사된다. 평문 노출이나 재암호화 필요 없이 동일 ciphertext 가 신규 config row 에 보존된다. SQL 레벨에서 값 변환이나 평문 전환이 일어나지 않는다.
- 제안: 이상 없음.

### **[INFO]** RAG Search SQL 쿼리 — 파라미터 바인딩 확인 필요
- 위치: `/codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` 라인 151~162 (diff 기준)
- 상세: `this.dataSource.query<KbRow[]>(SQL, ...)` 형태의 raw SQL 에서 `embedding_model` 및 `embedding_llm_config_id` 컬럼이 제거되었다. 이 쿼리에 사용자 입력이 직접 포함되는지 확인이 필요하다. 변경 diff 에서는 SELECT 컬럼 목록 축소만 이루어졌으며, WHERE 조건에 사용되는 파라미터(`kbIds`, `workspaceId`)는 기존과 동일하게 바인딩 파라미터로 처리될 것으로 보인다. 단, diff 에서 파라미터 바인딩 방식을 확인할 수 없어 INFO 등급으로 기록한다.
- 제안: `dataSource.query` 호출 시 두 번째 인자로 파라미터 배열을 사용하는 기존 패턴이 유지되고 있는지 확인한다. 이는 기존 코드 패턴의 연속이며 신규 취약점 도입은 없다.

---

## 요약

이번 PR 은 KB 임베딩 legacy 컬럼(`embedding_model`, `embedding_llm_config_id`)을 은퇴시키고 단일 1급 `embedding_model_config_id` 경로로 통일하는 리팩토링이다. 보안 관점에서 주목할 신규 취약점은 발견되지 않았다. 오히려 클라이언트가 임의의 `embeddingModel` 문자열을 주입할 수 있던 경로가 제거되고 서버 측 derive 로 대체됨으로써 입력 공격 면적이 축소됐다. `findManyByIds` 신규 메서드는 `workspaceId` 범위 필터를 올바르게 적용하여 멀티테넌트 격리를 유지한다. `embeddingModelConfigId` 지정 시 `findEntity(id, workspaceId, 'embedding')` 를 통한 소유권·kind 검증이 유지되어 권한 없는 config 참조를 차단한다. V093 마이그레이션의 fail-loud RAISE 설계는 부분 마이그레이션 후 DROP 되는 위험을 트랜잭션 롤백으로 방지하며, `api_key` ciphertext 복사 방식도 적절하다. 에러 코드 rename 은 노출 정보 수준에 변화를 주지 않는다. 기존부터 존재하던 SDK 에러 메시지의 클라이언트 직접 노출 패턴이 이번 PR 에서도 유지되고 있으나, 이는 이번 변경의 신규 도입이 아니다.

## 위험도

NONE
