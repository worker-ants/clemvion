# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 에러코드 rename의 외부 API breaking change 가능성, V094 DDL 락, transient 엔티티 필드 중간 배포 위험, 테스트 갭(findManyByIds/findAll/update null 경로) 이 복합적으로 MEDIUM을 구성함. 데이터 손실 위험은 없으며 자사 클라이언트만 소비하는 구조라면 실질 영향은 낮음.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / 문서화 | 에러코드 rename(`LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING`) — 외부 API 소비자 breaking change 가능. plan §범위 2 체크리스트의 "외부 소비자 Sunset/deprecation 정책 검토(api-contract-reviewer)"와 `spec/conventions/error-codes.md §3 historical-artifact` 등재가 미완료 상태. CHANGELOG/릴리즈 노트 미기록. | `llm.service.ts`, `llm-preview.service.ts`, `loader-error-messages.ts` | 외부 소비자 범위 확인 후: 자사 클라이언트만이면 INFO 수준으로 강등 가능. 외부 소비자가 있으면 `spec/conventions/error-codes.md §3`에 구 코드 등재, 릴리즈 노트에 breaking change 명시. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 사이드이펙트 / DB | V094 `DROP COLUMN` DDL — AccessExclusiveLock 획득으로 운영 테이블 읽기/쓰기 블로킹 가능. FK(`fk_kb_embedding_llm_config`) 제거 단계가 추가 락 유발. | `V094__kb_drop_legacy_embedding_columns.sql` | `knowledge_base` row 수·트래픽 패턴 확인 후 low-traffic 배포 윈도우 적용. 필요 시 `lock_timeout`/`statement_timeout` 설정. |
| 2 | 사이드이펙트 / 엔티티 | `embeddingModel` 필드가 `@Column` 제거 후 transient 필드로 전환 — V093 적용 완료 후 V094 미적용 중간 상태에서 TypeORM `save()` 가 빈 문자열을 `embedding_model` 컬럼에 쓸 수 있어 V093 repoint 불변성 위반 가능. | `knowledge-base.entity.ts`, `knowledge-base.service.ts` | TypeORM 버전 동작 재확인. `save()` 대신 `kbRepository.update({ id }, { ...명시적 컬럼 })` 방식으로 전환하거나, `attachEffectiveEmbeddingModel`이 `save()` 이후에만 호출됨을 보증. |
| 3 | 아키텍처 / 결합도 | `KnowledgeBaseService.create`/`update`에서 `findEntity`(검증) + `findManyByIds`(derive) + 조건부 `findDefault`(wsDefault) 로 `ModelConfigService`를 최대 3회 호출 — 이미 로드한 config를 재조회하는 불필요한 DB 왕복. | `knowledge-base.service.ts` create/update | `findEntity` 결과를 재사용해 `findManyByIds` 호출 제거. `attachEffectiveEmbeddingModel`은 `list` 경로(bulk) 전용으로 범위 한정 고려. |
| 4 | 아키텍처 / 모듈 경계 | `attachEffectiveEmbeddingModel`이 ORM 엔티티 인스턴스를 직접 뮤테이션(`kb.embeddingModel = ...`) — save→reload 경로에서 transient 필드가 소실되어 미묘한 버그 잠재. 서비스 레이어와 프레젠테이션 레이어 책임 혼재. | `knowledge-base.service.ts` `attachEffectiveEmbeddingModel` | 응답 DTO(`KnowledgeBaseDto`)를 명시적으로 생성하고 엔티티→DTO 변환 단계에서 derive 수행. 서비스 반환 타입을 엔티티에서 DTO로 변경. |
| 5 | 테스트 | `ModelConfigService.findManyByIds` 신규 메서드 단위 테스트 부재 — ids=[] 얼리 리턴, 존재하지 않는 id 필터링, workspaceId 범위 격리 계약이 검증되지 않음. | `model-config.service.spec.ts` | `describe('findManyByIds')` 추가: (a) ids=[] → [] 반환, (b) 일부 존재하는 ids 조회, (c) 다른 workspaceId config 제외 검증. |
| 6 | 테스트 | `findAll` 경로에서 `attachEffectiveEmbeddingModel` 배치 derive 미검증 — embeddingModelConfigId 혼합(있음+null) 케이스 및 빈 목록 시 `findManyByIds`/`findDefault` 미호출 검증 없음. | `knowledge-base.service.spec.ts` describe('findAll') | embeddingModelConfigId 있는 KB + null KB 혼합 반환 시 각 `embeddingModel` 올바르게 설정되는지 assert 추가. |
| 7 | 테스트 | `update`에서 `embeddingModelConfigId: null` 전달(ws default 복귀) 경로 테스트 없음 — `findEntity` 미호출, dimension 리셋, ws default derive 계약 미검증. | `knowledge-base.service.spec.ts` describe('update') | "embeddingModelConfigId: null 전달 → dimension 리셋 + ws default embedding derive" 케이스 추가. |
| 8 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/8-embedding-pipeline.md §5.5` — legacy step-3 서술 및 "V092 에서 제거 예정" 문구 잔존. V093/V094(PR4b)에서 실제 제거 완료됨. | `spec/5-system/8-embedding-pipeline.md` §5.5 | 코드 유지. `project-planner` 위임: §5.5를 2-step 기술로 교체, "V092 에서 제거 예정" → "V093/V094(PR4b) 에서 제거됨" 갱신. `spec/1-data-model.md §2.11` legacy 컬럼 행도 갱신. |
| 9 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/3-error-handling.md §1.3` — `MODEL_CONFIG_DEFAULT_MISSING` 미등재, `MODEL_CONFIG_NOT_FOUND` 설명의 "default 해석 실패" 문구 잔존. | `spec/5-system/3-error-handling.md §1.3` | 코드 유지. `project-planner` 위임: 표에 `MODEL_CONFIG_DEFAULT_MISSING | 400` 행 추가, `MODEL_CONFIG_NOT_FOUND` 설명에서 "default 해석 실패" 문구 제거. |
| 10 | API 계약 | `CreateKnowledgeBaseDto`/`UpdateKnowledgeBaseDto`에서 `embeddingModel`·`embeddingLlmConfigId` 필드 완전 제거 — 외부 클라이언트가 이 필드를 전송해도 오류 없이 무시되는 silent breaking change. | `create-knowledge-base.dto.ts`, `update-knowledge-base.dto.ts` | API 버전 문서/CHANGELOG에 폐기 필드 명시. 외부 클라이언트가 있다면 `embeddingModelConfigId`로의 마이그레이션 가이드 제공. |
| 11 | API 계약 | `MODEL_CONFIG_NOT_FOUND` HTTP status 이중화 해소 검증 미흡 — 변경 이후 모든 발행 경로에서 404만 반환함을 단위 테스트로 보장 필요. | `model-config.service.ts` `resolveConfig` | 변경 이후 `MODEL_CONFIG_NOT_FOUND`가 모든 경로에서 404만 반환함을 단위 테스트로 보장. `MODEL_CONFIG_DEFAULT_MISSING`은 400 전용임을 OpenAPI에 반영. |
| 12 | 요구사항 / plan | plan 체크박스 §범위 1 "작업"의 repoint 우선순위 서술이 SQL 구현 및 plan "Repoint creds/model 출처" 섹션과 정반대로 기재됨. | `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §범위 1 line 76-80 | plan 체크박스를 `(1) ws default kind=embedding → (2) embedding_llm_config_id → (3) ws default chat`으로 수정 (코드는 올바름). |
| 13 | 문서화 | `KnowledgeBase` 엔티티 `embeddingModel` transient 필드 — TypeORM 엔티티 내 `@Column` 없는 필드 존재 이유·미초기화 위험 경고 문서화 불충분. | `knowledge-base.entity.ts` | "@Transient — DB 컬럼 없음. `attachEffectiveEmbeddingModel` 통과 후에만 값 보장. 직접 `kbRepository.findOne` 결과 외부 노출 시 undefined 가능" 주석 추가. |
| 14 | 문서화 | `attachEffectiveEmbeddingModel` JSDoc `@param` 태그 없음, "throw 하지 않음" 계약 `@throws` 미명시. | `knowledge-base.service.ts` | `@param kbs`, `@param workspaceId`, `@throws — 절대 throw 하지 않음. config 미존재 시 빈 문자열 대체` JSDoc 보강. |
| 15 | 문서화 | `resolveEmbedding` JSDoc `@param opts.embeddingModelConfigId` 설명 부재 — null vs undefined 의미 차이 미문서화. | `model-config.service.ts` `resolveEmbedding` | `@param opts.embeddingModelConfigId — null/undefined 시 ws default kind=embedding으로 resolve` 설명 추가. |
| 16 | 문서화 | `KnowledgeBaseDto.embeddingModel` 빈 문자열 케이스 — Swagger description에 추가됐으나 "빈 문자열 = config 미설정 상태, 임베딩 기능 사용 전 설정 필요" 안내 추가 권장. | `knowledge-base-response.dto.ts` | Swagger `description`에 "빈 문자열인 경우 워크스페이스에 embedding ModelConfig가 없는 상태" 명시. |
| 17 | 문서화 | `knowledge-bases.ts` (프론트엔드 API 인터페이스) 제거 필드 변경 경위 주석 없음. | `codebase/frontend/src/lib/api/knowledge-bases.ts` | `KnowledgeBaseData` 인터페이스 상단에 `// PR4b: embeddingLlmConfigId removed (V094 DROP). embeddingModel is now read-only, derived server-side.` 주석 추가. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | V093 fail-loud RAISE EXCEPTION에 KB UUID 목록 노출 — DBA 레벨 마이그레이션 로그에만 노출, 클라이언트 전파 없음. | `V093__kb_embedding_repoint.sql` 라인 104-106 | 수용 가능. 로그 접근 정책 엄격 시 카운트만 출력하는 옵션 있으나 현행 유지 타당. |
| 2 | 보안 | `findManyByIds` workspaceId 범위 필터 올바르게 적용 — 멀티테넌트 격리 유지. | `model-config.service.ts` `findManyByIds` | 이상 없음. |
| 3 | 보안 | `embeddingModelConfigId` 생성·변경 시 `findEntity(id, workspaceId, 'embedding')` 검증 유지 — 무효 ID·타 워크스페이스 ID 주입 차단. | `knowledge-base.service.ts` create/update | 이상 없음. |
| 4 | 성능 | `attachEffectiveEmbeddingModel` N+1 완전 회피 — `Set`+`findManyByIds(In(...))` 배치 패턴, 최대 2회 쿼리 고정. | `knowledge-base.service.ts` | 현행 유지. |
| 5 | 성능 | V093 `embedding_model_config_id IS NULL` 필터 — 인덱스 없으면 풀스캔. 마이그레이션 락 시간 증가 가능. | `V093__kb_embedding_repoint.sql` | 인덱스 존재 확인. 수만 건 이상 환경 시 `CREATE INDEX CONCURRENTLY` 별도 마이그레이션 고려. |
| 6 | 성능 | RAG 검색 그룹 키 `(embeddingModelConfigId, dim)` 2필드 단순화 — 불필요한 embed 호출 감소. 성능 개선. | `rag-search.service.ts` | 이상 없음. |
| 7 | 성능 | `resolveEmbedding` legacy step-3 제거 → 최대 DB 쿼리 1회 감소. | `model-config.service.ts` | 이상 없음. |
| 8 | 아키텍처 | `KnowledgeBase` 엔티티에 `@Column` 없는 transient 필드 직접 선언 — 향후 개발자 영속 컬럼 오해 위험. | `knowledge-base.entity.ts` | TypeORM `@AfterLoad` 또는 응답 DTO에만 파생 필드를 두는 구조로 중장기 개선 권장. |
| 9 | 아키텍처 | `RagSearchService` raw SQL `dataSource.query` 잔존 — 레이어 경계 결합 지속. 이번 PR 신규 도입 아님. | `rag-search.service.ts` | 중장기적으로 Repository 추상화로 분리 고려. |
| 10 | 아키텍처 | 에러코드 접두어 `MODEL_CONFIG_*` 통일 방향 긍정적. `LLM_CREDENTIALS_REQUIRED` 는 잔존 이종 접두어. | `llm.service.ts` | 단일 `error-codes.ts` `as const` 파일로 집중 관리 권장. |
| 11 | SPEC-DRIFT | [SPEC-DRIFT] `spec/1-data-model.md §2.11` `embedding_llm_config_id`·`embedding_model` 행 "[LEGACY — PR4b 제거 예정]" 표기 잔존. PR4b(V093/V094) 에서 제거 완료됨. | `spec/1-data-model.md §2.11` | `project-planner` 위임: 해당 행 삭제 또는 "PR4b(V093/V094) 에서 제거됨" 갱신. |
| 12 | 요구사항 | V093 `embedding_model IS NULL` KB 처리 — `COALESCE` 방어 코드 없음. 스키마 DEFAULT로 보호되나 명시적 주석 권장. | `V093__kb_embedding_repoint.sql` 라인 41, 73-74 | `COALESCE(kb.embedding_model, 'text-embedding-3-small')` 또는 스키마 DEFAULT 보증 주석 추가. |
| 13 | 요구사항 | `KnowledgeBase.embeddingModelConfigId` 삭제된 config일 때 `embeddingModel = ''` soft resolve — JSDoc에 명시된 의도적 동작. | `knowledge-base.service.ts` | 이상 없음. |
| 14 | 테스트 | `attachEffectiveEmbeddingModel` ws default kind=embedding 없을 때 빈 문자열 반환 경로 테스트 없음. | `knowledge-base.service.spec.ts` | ws default embedding 없는 환경에서 `embeddingModel = ''` 검증 케이스 추가. |
| 15 | 테스트 | V093 SQL 마이그레이션 자동화 회귀 테스트 없음 — e2e는 빈 DB라 미실행. | `V093__kb_embedding_repoint.sql` | 중기적으로 docker-compose 기반 마이그레이션 시나리오 검증 스크립트 작성 고려. |
| 16 | 데이터베이스 | V093 step-1 UPDATE — workspace 당 `is_default=TRUE kind=embedding` config 복수 시 non-deterministic UPDATE 가능. 실제 unique 제약으로 1개 보장되나 마이그레이션 내 검증 없음. | `V093__kb_embedding_repoint.sql` 라인 63-69 | `model_config`의 `(workspace_id, kind, is_default) WHERE is_default=TRUE` partial unique index 존재 확인. 없으면 서브쿼리에 `LIMIT 1` 추가. |
| 17 | 사이드이펙트 | V093 INSERT로 `[migrated]` 접두 model_config row 생성 — 관리 UI에 임시 config 노출. | `V093__kb_embedding_repoint.sql` | 마이그레이션 완료 후 `[migrated]` config 적절한 이름으로 변경 운영 팀 안내. |
| 18 | 사이드이펙트 | `LLM_CONFIG_INVALID` 매핑 삭제 후 기존 캐시된 에러 응답 수신 시 에러 메시지 미표시 가능. | `loader-error-messages.ts` | 배포 후 `LLM_CONFIG_INVALID` 발행 경로 완전 소멸 모니터링. |
| 19 | 유지보수성 | `DEFAULT_EMBEDDING_MODEL` 상수가 테스트 파일 2곳에 독립 선언 — 프로덕션 값 변경 시 2곳 수정 필요. | `embedding.service.spec.ts`, `rag-search.service.spec.ts` | 테스트 공용 헬퍼 파일 추출 또는 프로덕션 상수 import. 단기적으로 동기화 주석 추가. |
| 20 | 유지보수성 | `NULL_KEY` 상수명이 현재 역할("embeddingModelConfigId=null KB 그룹 키 placeholder")을 충분히 표현하지 못함. | `rag-search.service.ts` | `NO_CONFIG_KEY`로 rename 또는 역할 주석 보강. |
| 21 | 유지보수성 | `resolveConfig` 에러 payload에 `workspaceId` 미포함 — `llm.service.ts` 동일 에러코드 payload와 구조 불일치. | `model-config.service.ts:134` | `BadRequestException` payload에 `workspaceId` 추가. |
| 22 | 유지보수성 | V093 SQL 헤더 주석이 CTE 인라인 주석·V094 내용과 중복 — 첫 독해 비용 높음. | `V093__kb_embedding_repoint.sql` 라인 33-57 | 헤더를 "목적·spec 링크·우선순위 요약"으로 축소, "비가역성·DOWN:" 절은 V094에만 유지. |
| 23 | 유저 가이드 | `MODEL_CONFIG_DEFAULT_MISSING` 신규 코드 — 노드 실행 경로에서 간접 호출 시 `ERROR_KO` 한국어 매핑 없어 영문 fallback 가능성. | `backend-labels.ts` `ERROR_KO` | `MODEL_CONFIG_DEFAULT_MISSING: "워크스페이스 기본 모델 설정이 지정되어 있지 않아요."` 추가 권장 (강제 아님). |
| 24 | 문서화 | plan `related_plan` frontmatter 경로 오기 — `plan/in-progress/kb-model-change-reembed-followup.md`가 실제 `plan/complete/`에 있음. | `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` | frontmatter 경로를 `plan/complete/kb-model-change-reembed-followup.md`로 수정. |
| 25 | 문서화 | `embedding.service.ts`/`rag-search.service.ts` 내 "PR2 폴백 체인" 참조 잔존 여부 확인 필요. | `embedding.service.ts`, `rag-search.service.ts` | `grep -r 'PR2 폴백 체인\|PR2:' codebase/backend/src --include='*.ts'` 스캔 후 정리. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. `findManyByIds` workspaceId 격리 올바름. 입력 공격 면적 축소. |
| performance | LOW | `create`/`update` 단건 경로 config 중복 조회(WARNING 1건). 전반적으로 쿼리 감소 방향. |
| architecture | LOW | 서비스↔프레젠테이션 책임 혼재, 엔티티 transient 필드 뮤테이션(WARNING 2건). |
| requirement | LOW | 코드 구현 완전. spec 갱신 누락 3건(SPEC-DRIFT), plan 체크박스 오기 1건(WARNING). |
| scope | LOW | 변경 범위 plan §범위 1/2에 충실. `agent-memory.service.ts` 주석, 프론트 타입 변경이 plan 미명시(WARNING 2건, 허용 수준). |
| side_effect | MEDIUM | V094 DDL 락, 엔티티 transient 필드 중간 배포 위험, 에러코드 외부 breaking change(WARNING 3건). |
| maintainability | LOW | INFO 수준 이슈만(주석 중복, 상수 중복, 에러 payload 비일관). CRITICAL/WARNING 없음. |
| testing | MEDIUM | `findManyByIds` 단위 테스트 부재, `findAll` derive 미검증, `update` null 경로 미검증(WARNING 3건). |
| documentation | MEDIUM | 에러코드 historical-artifact 미등재(CRITICAL 1건), 엔티티 transient 필드 경고 부족, JSDoc 갭(WARNING 4건). |
| database | MEDIUM | V094 DDL 락(WARNING 1건). V093 fail-loud 트랜잭션 보장 올바름. N+1 회피 올바름. |
| api_contract | MEDIUM | 에러코드 rename breaking change(CRITICAL 1건 공유), DTO 필드 제거 silent breaking(WARNING 2건). |
| user_guide_sync | NONE | 매트릭스 트리거 미매칭. `MODEL_CONFIG_DEFAULT_MISSING` ERROR_KO 미등록 INFO 1건. |

---

## 발견 없는 에이전트

없음 — 모든 에이전트가 1건 이상 발견사항 기록.

---

## 권장 조치사항

1. **[Critical 선행]** 외부 API 소비자 범위 확인 후 에러코드 rename(`LLM_CONFIG_INVALID` → `MODEL_CONFIG_INVALID`, `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_DEFAULT_MISSING`) breaking change 처리 — 자사 클라이언트 전용이면 `spec/conventions/error-codes.md §3`에 historical-artifact 등재 + 릴리즈 노트 명시로 해소.
2. **[Critical 선행]** SPEC-DRIFT 항목 3건 `project-planner` 위임: `spec/5-system/8-embedding-pipeline.md §5.5` 2-step 기술 갱신, `spec/5-system/3-error-handling.md §1.3` `MODEL_CONFIG_DEFAULT_MISSING` 등재, `spec/1-data-model.md §2.11` legacy 컬럼 서술 갱신.
3. **[배포 전]** V094 DDL 락 대책 — `knowledge_base` row 수 확인, low-traffic 배포 윈도우 예약, 필요 시 `lock_timeout` 설정.
4. **[배포 전]** 엔티티 transient 필드 중간 배포 위험 검토 — TypeORM `save()` 시 `embeddingModel` 빈 문자열이 DB에 쓰이지 않는지 V093-V094 중간 상태에서 검증.
5. **[테스트]** `findManyByIds` 단위 테스트 추가 (WARNING 5).
6. **[테스트]** `findAll` 배치 derive + `update` null 경로(ws default 복귀) 테스트 추가 (WARNING 6, 7).
7. **[plan 수정]** plan §범위 1 체크박스 repoint 우선순위 서술 오기 수정 (WARNING 12).
8. **[문서화]** `KnowledgeBase` 엔티티 transient 필드 경고 주석, `attachEffectiveEmbeddingModel` JSDoc, `resolveEmbedding` JSDoc 보강 (WARNING 13-15).
9. **[문서화]** `knowledge-bases.ts` 프론트엔드 인터페이스 변경 경위 주석 추가 (WARNING 17).
10. **[유지보수]** `resolveConfig` 에러 payload에 `workspaceId` 추가, `NULL_KEY` → `NO_CONFIG_KEY` rename, `DEFAULT_EMBEDDING_MODEL` 테스트 상수 통합 (INFO).

---

## 라우터 결정

라우터가 선별 (`routing_status=done`):

- **실행** (12명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `api_contract`, `user_guide_sync`
- **제외** (2명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 제외 (변경 범위상 dependency 위험 낮음으로 판단) |
  | concurrency | 라우터 제외 (이번 PR 변경 범위에 동시성 관련 신규 코드 없음) |

- **강제 포함 (router_safety)**: `database`, `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (8명)