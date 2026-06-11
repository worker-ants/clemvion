# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] SOLID — 단일 책임: `attachEffectiveEmbeddingModel` 의 책임 위치
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `attachEffectiveEmbeddingModel` 메서드 (lines 916-946 diff)
- 상세: `KnowledgeBaseService` 가 "응답 직렬화용 transient 파생값 채우기"라는 프레젠테이션 레이어 관심사를 직접 수행한다. 서비스 레이어(비즈니스)가 응답 형태를 변형하는 역할까지 맡으면 단일 책임이 경계를 넘는다. 현재는 entity 에 비영속 필드(`embeddingModel?: string`)를 선언하고 서비스가 채우는 방식이며, 이 패턴은 ORM 엔티티 설계 관점에서도 transient 필드 남용 신호다.
- 제안: 응답 derive 는 별도 `KnowledgeBaseMapper` 또는 NestJS interceptor(직렬화 계층)에서 수행하거나, 응답 DTO 클래스에 static factory 메서드로 분리할 것. 서비스는 도메인 규칙(저장, 검증)에 집중하도록 유지한다.

### [INFO] 엔티티 설계 — 비영속 파생 필드의 도메인 경계 혼재
- 위치: `codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts` — `embeddingModel?: string` (영속 컬럼 제거 후 transient 재선언)
- 상세: V094 에서 `embedding_model` 컬럼이 DROP 되었음에도 엔티티 클래스에 `@Column` 없이 동명 필드를 재선언했다. TypeORM 엔티티에 `@Column` 없는 순수 in-memory 필드가 존재하면, 향후 개발자가 이를 영속 컬럼으로 오해하거나 TypeORM 자동 스키마 동기화(synchronize: true 환경)에서 예상치 못한 동작을 유발할 수 있다.
- 제안: TypeORM `@AfterLoad` / `@AfterInsert` 데코레이터를 사용하거나, 엔티티가 아닌 응답 DTO 에만 파생 필드를 두고 Mapper 에서 채우도록 구조를 분리한다. 엔티티 내에 transient 필드가 불가피하다면 `@VirtualColumn` 또는 명시적 JSDoc 으로 비영속임을 선언하고 unit test 에서 ORM save/load 사이클에서 손실됨을 검증해야 한다.

### [INFO] 레이어 책임 — SQL 직접 조회 잔존 (rag-search.service)
- 위치: `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts` — `dataSource.query(...)` raw SQL
- 상세: `RagSearchService` 가 `DataSource.query` 로 raw SQL 을 직접 실행하며 `KbRow` 인터페이스를 자체 정의한다. 이 PR 에서 `embedding_model`, `embedding_llm_config_id` 컬럼을 SQL 에서 제거하는 변경은 올바르나, 레이어 경계 관점에서 검색 서비스가 데이터 조회 세부(컬럼 목록)를 알아야 하는 구조 자체는 지속되고 있다. 이번 PR 에서 도입/악화된 문제는 아니나, 검색 레이어와 데이터 레이어가 결합된 상태로 남아 향후 스키마 변경 시 누락 위험이 계속된다.
- 제안: 중장기적으로 KB 데이터 조회를 Repository 추상화로 분리해 SQL 변경이 레이어 경계 안에서 일어나도록 한다. 단기적으로는 `KbRow` 와 raw SQL SELECT 목록이 정확히 동기화되는지 컴파일-타임 보증이 없으므로, 통합 테스트로 보완한다.

### [INFO] 추상화 수준 — `resolveEmbedding` 의 시그니처 단순화는 적절
- 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` — `resolveEmbedding` opts 인터페이스
- 상세: legacy `embeddingLlmConfigId`, `legacyModel` 파라미터를 제거해 인터페이스가 `{ embeddingModelConfigId?, workspaceId }` 로 단순화됐다. 이는 OCP(개방-폐쇄) 관점에서 legacy 폴백 체인 확장 없이 1급 경로만 남기는 올바른 수렴이다. 단, 옵션 객체 패턴을 사용하므로 향후 파라미터 추가 시 하위호환성이 유지된다.
- 제안: 없음. 설계 방향이 적절하다.

### [INFO] 확장성 — 에러 코드 네이밍 정규화
- 위치: `codebase/backend/src/modules/llm/llm.service.ts`, `llm-preview.service.ts` — `MODEL_CONFIG_DEFAULT_MISSING`, `MODEL_CONFIG_INVALID` 코드 전환
- 상세: 에러 코드를 `LLM_CONFIG_*` → `MODEL_CONFIG_*` 로 통일한 것은 도메인 용어와 모듈 경계를 맞추는 긍정적 변화다. 다만 `LLM_CREDENTIALS_REQUIRED` 는 `llm.service.ts` 에 남아 있어 일부 이종 접두어가 혼재한다. 이는 의도된 범위 제한이므로 INFO 수준이나, 장기적으로 에러 코드 체계를 단일 enum/const 파일에 집중 관리하면 분산 문자열 리터럴로 인한 오타/누락을 방지할 수 있다.
- 제안: `codebase/backend/src/modules/model-config/constants/error-codes.ts` 같은 단일 파일로 모든 `MODEL_CONFIG_*` 코드를 `as const` 로 집중 관리한다.

### [WARNING] 결합도 — `KnowledgeBaseService` 의 `ModelConfigService` 의존 심화
- 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — `attachEffectiveEmbeddingModel` 에서 `modelConfigService.findManyByIds` + `modelConfigService.findDefault` 동시 의존
- 상세: `KnowledgeBaseService.create` 와 `update` 는 이미 `findEntity` 로 검증을 위해 `ModelConfigService` 를 호출했다. 이번 PR 에서 응답 derive 를 위해 `findManyByIds`, `findDefault` 호출이 추가됐다. 단일 create/update 요청에서 `ModelConfigService` 를 최대 3번(검증 1 + batch 조회 1 + wsDefault 1) 호출하는 구조가 됐다. 검증 단계에서 이미 로드한 config 를 derive 단계에서 재조회하는 것은 불필요한 DB 왕복이자 결합 심화다.
- 제안: `findEntity` 로 검증 시 가져온 config 객체를 재사용해 `findManyByIds` 호출을 제거한다. create 경우: `embeddingModelConfigId` 검증 시 얻은 config 를 바로 `embeddingModel` derive 에 사용. update 경우도 동일. `attachEffectiveEmbeddingModel` 은 `list` 경로(bulk) 전용으로 범위를 한정하면 단일 요청 경로의 불필요한 DB 호출을 없앨 수 있다.

### [WARNING] 모듈 경계 — `KnowledgeBase` 엔티티에 transient 필드 직접 뮤테이션
- 위치: `knowledge-base.service.ts` `attachEffectiveEmbeddingModel` — `kb.embeddingModel = ...`
- 상세: 서비스가 ORM 엔티티 인스턴스를 직접 뮤테이션해 응답 형태를 변형하는 패턴은 엔티티의 단일 책임(데이터 구조·ORM 매핑)과 서비스의 책임(비즈니스 로직)을 혼재시킨다. TypeORM 이 엔티티를 다시 저장(save)하거나 리로드할 경우, transient 필드는 사라지므로 save → reload 경로가 존재하는 곳에서 미묘한 버그가 발생할 수 있다.
- 제안: 응답 DTO(`KnowledgeBaseDto` 또는 별도 response class)를 명시적으로 생성하고, 엔티티 → DTO 변환 단계에서 derive 를 수행한다. 서비스 반환 타입도 엔티티가 아닌 DTO 로 변경하면 모듈 경계가 명확해진다.

### [INFO] 순환 의존성 — 없음
- 상세: `model-config` 모듈이 `knowledge-base` 모듈을 참조하지 않으며, `knowledge-base` → `model-config` 단방향 의존이다. `llm` 모듈도 `knowledge-base` 를 참조하지 않는다. 이번 PR 에서 순환 의존성이 추가되지 않았다.

### [INFO] 디자인 패턴 — 마이그레이션 게이트 패턴(V093 fail-loud)
- 위치: `codebase/backend/migrations/V093__kb_embedding_repoint.sql` — `DO $$` fail-loud 블록
- 상세: V093 은 데이터 무결성 게이트로 작동한다(repoint 불완전 시 전체 롤백). Flyway 단일 트랜잭션을 이용해 V094 DROP 의 사전 보증을 SQL 레이어에서 강제하는 설계는 forward-only 마이그레이션 패턴에서 적절한 안전 장치다.
- 제안: 없음. 패턴 적용이 올바르다.

---

## 요약

PR4b 는 KB 임베딩 legacy 컬럼을 단계적(V093 repoint → V094 DROP)으로 제거하며 `resolveEmbedding` 의 폴백 체인을 2단계로 단순화하는 목적에 충실하다. 아키텍처 관점에서 핵심 우려는 두 가지다. 첫째, `KnowledgeBaseService` 가 응답 파생값 채우기(`attachEffectiveEmbeddingModel`)를 직접 수행하면서 서비스 레이어와 프레젠테이션 레이어 책임이 혼재하고, ORM 엔티티에 비영속 transient 필드를 직접 뮤테이션하는 패턴이 모듈 경계를 모호하게 만든다. 둘째, create/update 경로에서 이미 검증 단계에서 로드한 config 를 응답 derive 단계에서 재조회해 `ModelConfigService` 호출이 중복된다. 두 이슈 모두 현재 기능 동작에는 무해하나, 코드베이스가 커질수록 결합도 증가와 불필요한 DB 왕복을 누적시킨다. V093 SQL 의 fail-loud 게이트, `resolveEmbedding` 시그니처 단순화, 에러 코드 통일은 아키텍처적으로 올바른 방향이다.

## 위험도

LOW

---

STATUS: SUCCESS
