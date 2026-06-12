# 테스트(Testing) 리뷰 결과

## 발견사항

### **[WARNING]** `findManyByIds` 메서드 자체에 대한 단위 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/model-config/model-config.service.spec.ts`
- 상세: `ModelConfigService.findManyByIds`는 이번 PR4b에서 신규 추가된 메서드로(`model-config.service.ts`), `attachEffectiveEmbeddingModel` 배치 조회의 핵심 경로다. 그러나 `model-config.service.spec.ts`에 해당 메서드를 직접 검증하는 `describe('findManyByIds')` 블록이 없다. 현재는 `knowledge-base.service.spec.ts`에서 mock으로만 사용한다. ids 빈 배열 얼리 리턴, 존재하지 않는 id 필터링, workspaceId 범위 격리 등의 계약이 단위 테스트로 보증되지 않는다.
- 제안: `model-config.service.spec.ts`에 `describe('findManyByIds')` 추가. 최소 (a) ids=[] 즉시 [] 반환, (b) 일부 존재하는 ids 조회 시 존재하는 것만 반환, (c) 다른 workspaceId 의 config 가 결과에서 제외됨을 각각 테스트.

### **[WARNING]** `attachEffectiveEmbeddingModel`의 `findAll` 경로 테스트 미흡
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts` — `describe('findAll')` 블록 (라인 130~138)
- 상세: `findAll`은 `attachEffectiveEmbeddingModel`을 호출하도록 변경됐으나 테스트에서는 `getMany`가 `[{ id: 'kb-1', name: 'KB One' }, { id: 'kb-2', name: 'KB Two' }]`만 반환하는 단순 페이지네이션 확인만 한다. (a) KB 목록 중 일부가 `embeddingModelConfigId`를 갖고 일부가 null인 혼합 케이스에서 `embeddingModel`이 올바르게 채워지는지, (b) 빈 목록(0건)일 때 `findManyByIds`·`findDefault`가 호출되지 않는지 검증이 없다. 특히 ws default kind=embedding 조회 경로(null KB 포함)가 `findAll`에서 전혀 확인되지 않는다.
- 제안: `findAll` 테스트에 배치 derive 검증 케이스 추가. embeddingModelConfigId가 있는 KB + null KB 혼합 반환 시 각 embeddingModel이 올바르게 설정되는지 assert.

### **[WARNING]** `update`에서 `embeddingModelConfigId: null` 전달(ws default 복귀) 경로 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts` — `describe('update')` 블록
- 상세: `knowledge-base.service.ts` update 로직은 `dto.embeddingModelConfigId !== kb.embeddingModelConfigId`일 때 config 검증 없이(null이면 `findEntity` 스킵) `embeddingDimension = null`을 적용한다. `dto.embeddingModelConfigId = null`을 명시 전달하면 ws default로 되돌리는 것이 DTO에 문서화된 계약이다. 그러나 이 경로(null 전달 → dimension 리셋 + ws default derive)를 직접 검증하는 테스트가 없다. `findEntity`가 호출되지 않아야 하고, 응답 `embeddingModel`은 ws default config로부터 derive돼야 한다.
- 제안: `update` describe에 "embeddingModelConfigId: null 전달 → dimension 리셋 + ws default embedding derive" 케이스 추가.

### **[INFO]** `attachEffectiveEmbeddingModel`에서 ws default kind=embedding 가 없을 때 빈 문자열 반환 경로 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `attachEffectiveEmbeddingModel` (라인 144)
- 상세: `wsDefaultEmbedding?.defaultModel ?? ''` 폴백(빈 문자열)은 KB의 embeddingModelConfigId=null이고 ws에 default kind=embedding도 없는 환경에서 반환된다. 이 edge case(응답에 embeddingModel='' 발생)가 테스트되지 않는다. 특히 신규 워크스페이스나 config 삭제 후 KB 목록 조회 시 silent fallback이 올바른지 확인이 필요하다.
- 제안: ws default embedding 없는 환경에서 `attachEffectiveEmbeddingModel` 호출 시 `embeddingModel`이 `''`가 됨을 검증하는 케이스 추가.

### **[INFO]** V093 마이그레이션 SQL 자체에 대한 자동화된 회귀 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/migrations/V093__kb_embedding_repoint.sql`
- 상세: plan의 체크(라인 2077)에서 "e2e는 빈 DB라 repoint 로직은 미실행"으로 명시됐다. V093의 4가지 repoint 분기(ws default embedding pin, legacy embedding_llm_config_id→새 config 생성, ws default chat→새 config 생성, fail-loud RAISE)는 e2e 또는 통합 테스트 수준에서 실행되지 않는다. SQL 검증 쿼리 주석과 fail-loud RAISE 존재로 보완하고 있으나, 향후 DB 스키마 변경이나 플랫폼 이식 시 회귀 위험이 잠재한다.
- 제안: 중기적으로는 docker-compose 기반 통합 테스트에서 V093 repoint 로직을 시나리오별로 실행하는 마이그레이션 검증 테스트 스크립트 작성 고려. 단기적으로는 plan의 현재 주석 처리된 SQL 검증 쿼리를 migration-smoke 스크립트로 형식화하는 것을 권장.

### **[INFO]** `rag-search.service.spec.ts`에서 `embeddingModelConfigId=null` KB 그룹핑 테스트의 mock 일관성 재확인 필요
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts`
- 상세: `makeKbRow` helper의 default `embeddingModelConfigId: null` + `dim=1536` 케이스에서 같은 null config를 가진 KB들이 단일 그룹으로 묶이는 것을 명시적으로 검증하는 테스트가 있는지 확인 필요. 현 `resolveEmbedding` mock은 null id를 `DEFAULT_EMBEDDING_MODEL`로 resolve하는데, null KB들이 동일 ws default로 resolve되어 올바르게 단일 embed 호출로 합쳐지는지(not just by dim) 별도 assert가 없다. 현 구현의 그룹키는 `${NULL_KEY}::${dim}`이므로 동일 dim이면 묶이는 것은 맞으나, 다른 null KB끼리 ws default 모델이 동일하다는 가정이 테스트에서 명시적으로 표현되지 않는다.
- 제안: `describe('1급 embeddingModelConfigId 그룹 키 분리/병합')` 내에 null+null 동일 dim = 단일 embed 호출 케이스를 명시적으로 추가하면 의도가 더 명확해진다.

### **[INFO]** `LLM_CONFIG_INVALID` 코드 undefined 검증이 프론트 테스트에만 존재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/pr4b-kb-embedding-retire/codebase/frontend/src/components/llm-config/__tests__/sanitize-loader-error.test.ts`
- 상세: `LLM_CONFIG_INVALID`가 이제 `loader-error-messages.ts`에서 제거됐고 테스트도 `expect(map.LLM_CONFIG_INVALID).toBeUndefined()`로 확인한다. 그러나 백엔드 `llm-preview.service.spec.ts`에서는 `LLM_CONFIG_INVALID → MODEL_CONFIG_INVALID` rename 후 에러 코드가 정확히 `MODEL_CONFIG_INVALID`임을 검증한다. 양쪽 테스트가 정합적으로 업데이트돼 있으므로 큰 문제는 없으나, 프론트 `use-embedding-model-loader.test.tsx`에서도 에러 코드 매핑이 `MODEL_CONFIG_INVALID`로 올바르게 수정됐음을 확인 완료.

## 요약

PR4b의 핵심 변경(legacy `embeddingModel`/`embeddingLlmConfigId` 컬럼 은퇴, `resolveEmbedding` step-3 제거, 에러코드 통일)에 대한 단위 테스트 업데이트는 전반적으로 충실하다. `embedding.service.spec.ts`, `rag-search.service.spec.ts`, `knowledge-base.service.spec.ts`, `model-config.service.spec.ts`, `llm.service.spec.ts`, `llm-preview.service.spec.ts`, 프론트 `sanitize-loader-error.test.ts` 모두 변경 내용에 맞게 정비됐다. 그러나 신규 도입된 `findManyByIds` 메서드 자체의 단위 테스트 부재, `findAll` 경로에서의 `attachEffectiveEmbeddingModel` 배치 derive 미검증, `update`에서 `embeddingModelConfigId: null` 전달(ws default 복귀) 경로 미테스트가 WARNING 수준 갭으로 남는다. V093 SQL 마이그레이션 자체는 e2e 범위 외로 자동화된 회귀 보증이 없는 점이 INFO로 기록된다.

## 위험도

MEDIUM
