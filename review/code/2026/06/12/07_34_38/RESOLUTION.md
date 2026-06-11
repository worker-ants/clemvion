# RESOLUTION — 07_34_38

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| Critical #1 | spec | draft 위임 | `plan/in-progress/spec-update-pr4b-embedding-retire.md` — 에러코드 rename historical-artifact 등재, 외부 소비자 여부 사용자 결정 필요 |
| W1 | 코드 | fixed (7e1efac5) | V094 헤더에 AccessExclusiveLock 운영 주의 + `SET lock_timeout = '3s'` 추가 (프로젝트 관례 V036 준수) |
| W2 | 검증 | verified-non-issue | TypeORM 은 `@Column` 없는 필드를 영속화하지 않으므로 `save()` 가 `embeddingModel`(transient)을 `embedding_model` 컬럼에 쓰지 않음. V093→V094 는 Flyway 순차 적용이라 "V093 적용+V094 미적용 상태로 신코드가 도는" 윈도우가 없음. 불필요한 방어코드 추가 안 함. |
| W3 | 코드 | fixed (7e1efac5) | create/update 단건 경로: `findEntity` 결과를 `embeddingConfig` / `updatedEmbeddingConfig` 에 보존해 `findManyByIds` 재조회 제거. findAll(bulk) 경로는 기존 배치 유지. |
| W4 | 검증 | verified — 기존 패턴 수용 | 프로젝트 현행 패턴이 엔티티 직접 직렬화. 전면 DTO 매핑 전환은 PR4b 범위 초과. W13(transient 주석) 으로 위험 문서화. 중장기 개선 항목으로 추적. |
| W5 | 코드 | fixed (7e1efac5) | `model-config.service.spec.ts` 에 `describe('findManyByIds')` 추가: (a) ids=[]→[] DB 미호출, (b) 일부 존재 id 조회, (c) 타 workspaceId 격리 |
| W6 | 코드 | fixed (7e1efac5) | `knowledge-base.service.spec.ts` findAll 에 embeddingModelConfigId 있음+null 혼합 KB 반환 시 각 embeddingModel 올바름 + 빈 목록 시 findManyByIds/findDefault 미호출 assert 추가 |
| W7 | 코드 | fixed (7e1efac5) | `knowledge-base.service.spec.ts` update 에 `embeddingModelConfigId: null` → dimension 리셋 + ws default embedding derive + findEntity 미호출 케이스 추가 |
| W8 | spec | draft 위임 | `plan/in-progress/spec-update-pr4b-embedding-retire.md §1` — `spec/5-system/8-embedding-pipeline.md §5.5` 2-step 기술 갱신, "V092 제거 예정" → "V093/V094(PR4b) 제거됨", `spec/1-data-model.md §2.11` legacy 컬럼 행 갱신 |
| W9 | spec | draft 위임 | `plan/in-progress/spec-update-pr4b-embedding-retire.md §2` — `spec/5-system/3-error-handling.md §1.3` 에 `MODEL_CONFIG_DEFAULT_MISSING\|400` 행 추가, `MODEL_CONFIG_NOT_FOUND` 설명에서 "default 해석 실패" 제거 |
| W10 | spec | draft 위임 | `plan/in-progress/spec-update-pr4b-embedding-retire.md §7` — DTO 필드 제거 silent breaking + 외부 소비자 여부 사용자 결정 포함 |
| W11 | 코드 | fixed (7e1efac5) | `model-config.service.spec.ts` 에 `MODEL_CONFIG_NOT_FOUND 404 전용` describe 추가: findEntity 미존재, cross-kind, resolveEmbedding id 명시 + ws default 없음 경로 전부 status:404 assert |
| W12 | 코드 | fixed (7e1efac5) | plan §범위 1 체크박스 우선순위 서술 수정: `(1) ws default kind=embedding → (2) embedding_llm_config_id → (3) ws default chat → (4) fail-loud` |
| W13 | 코드 | fixed (7e1efac5) | `knowledge-base.entity.ts` embeddingModel 필드에 @Transient 경고 주석 보강 |
| W14 | 코드 | fixed (7e1efac5) | `attachEffectiveEmbeddingModel` JSDoc에 @param kbs, @param workspaceId, @throws 절대 throw 하지 않음(soft resolve) 명시 |
| W15 | 코드 | fixed (7e1efac5) | `resolveEmbedding` JSDoc에 @param opts.embeddingModelConfigId null/undefined → ws default kind=embedding 폴백 설명 추가 |
| W16 | 코드 | fixed (7e1efac5) | `KnowledgeBaseDto.embeddingModel` Swagger description에 "빈 문자열인 경우 워크스페이스에 embedding ModelConfig 가 없는 상태" 보강 |
| W17 | 코드 | fixed (7e1efac5) | `KnowledgeBaseData` 인터페이스 상단에 `PR4b: embeddingLlmConfigId removed (V094 DROP)` 주석 추가 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (6621 passed, 1 skipped — 사전 존재 skip)
- build : 해당 없음 (코드·테스트·주석·plan 변경만)
- e2e   : 통과 (188/188)

## 보류·후속 항목

### spec 위임 (ESCALATE=spec)
전체 spec 변경 목록은 `plan/in-progress/spec-update-pr4b-embedding-retire.md` 참조.

- **Critical #1**: `spec/conventions/error-codes.md §3` LLM_CONFIG_*/LLM_CONFIG_INVALID historical-artifact 등재
- **W8**: `spec/5-system/8-embedding-pipeline.md §5.5` 2-step 기술 갱신 + `spec/1-data-model.md §2.11` legacy 컬럼 행
- **W9**: `spec/5-system/3-error-handling.md §1.3` MODEL_CONFIG_DEFAULT_MISSING 등재
- **W10**: `spec/2-navigation/5-knowledge-base.md`, `6-config.md` legacy 서술 제거
- **공통**: `spec/5-system/7-llm-client.md §5.5·§6` 구 코드명 → 신 코드명
- **공통**: `spec/data-flow/6-knowledge-base.md §2` embedding_model·embedding_llm_config_id 컬럼 제거
- **외부 소비자 결정**: 자사 클라이언트만 소비하면 CHANGELOG 기록으로 충분 — 외부 소비자 존재 여부 사용자 확인 필요

### 중장기 개선 항목 (INFO — 자동 수정 미대상)
- **W4 근거 기록**: 엔티티 직접 직렬화 → 응답 DTO 매핑 분리 (중장기 리팩토링)
- INFO #14: `attachEffectiveEmbeddingModel` ws default 없을 때 빈 문자열 반환 경로 테스트 (추가 가능)
- INFO #19: `DEFAULT_EMBEDDING_MODEL` 테스트 상수 중복 — 공용 헬퍼로 통합 권장
- INFO #20: `NULL_KEY` → `NO_CONFIG_KEY` rename 또는 주석 보강
- INFO #21: `resolveConfig` 에러 payload에 workspaceId 추가
- INFO #23: `MODEL_CONFIG_DEFAULT_MISSING` ERROR_KO 한국어 매핑 추가 권장
- INFO #24: plan frontmatter `related_plan` 경로 오기 — `plan/complete/kb-model-change-reembed-followup.md`로 수정
- INFO #25: `embedding.service.ts`/`rag-search.service.ts` "PR2 폴백 체인" 참조 잔존 여부 스캔
