# RESOLUTION — 22_30_15

> 대상: KB 임베딩 1급화 PR2 (unified-model-mgmt-5af7ee)
> 일시: 2026-06-10

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W3 | 코드 | 73423472 | resolveEmbedding 레거시 경로 `!legacy` → `throw this.notFound()` (NotFoundException 404 통일) |
| W4 | 코드 | 73423472 | groupVectorKbs: 1급 경로 키 = `${embeddingModelConfigId}::${dim}` 만; 레거시 = `null::${model}::${dim}::${cfgKey}` |
| W5 | 코드(plan) | 73423472 | plan/in-progress/unified-model-management.md V091 행 — 실제 구현(컬럼+FK 추가만, 점진적 폴백)으로 기술 갱신 |
| W6 | 코드 | 73423472 | W3 와 동일 fix — 경로 (3) `findEntity` 선행 throw 시 HTTP 경로 불일치 해소 |
| W7 | FALSE POSITIVE | (없음) | 검증: `grep -c "describe('resolveEmbedding')" spec.ts` = 1. 리뷰어 가상 줄 번호에 의한 오탐. 조치 없음 |
| W9 | 코드 | 73423472 | `VectorGroup.model` → `legacyModel` 로 이름 변경; 인터페이스 주석에 "1급 경로에서는 config.defaultModel 사용" 명시 |
| W10 | 코드 | 73423472 | `NULL_KEY = 'null'` 상수 추출; 그룹 키에서 `'none'`/`'default'` 대신 `NULL_KEY` 통일 |
| W11 | 테스트 | 73423472 | model-config.service.spec.ts: (3) 레거시 실패 → NotFoundException 단언 강화; (1) model == config.defaultModel; embeddingModelConfigId: null 명시 전달 → (2) 폴백 동작 |
| W12 | 테스트 | 73423472 | embedding.service.spec.ts: KB에 embeddingModelConfigId 설정 + resolveEmbedding 다른 model 반환 시 llm.embed가 config.defaultModel로 호출됨 assertion |
| W13 | 테스트 | 73423472 | rag-search.service.spec.ts: 동일 embeddingModelConfigId + 다른 embeddingModel → 1그룹(embed 1회); 다른 embeddingModelConfigId → 별도 그룹 |
| W14 | 테스트 | 73423472 | knowledge-base.service.spec.ts: embeddingModelConfigId 변경 → embeddingDimension null 리셋; 동일 값 전송 → 리셋 없음 |
| W15 | 테스트 | 73423472 | rag-search.service.spec.ts: embeddingModelConfigId 있는 KB → resolveEmbedding 올바른 인자(embeddingModelConfigId + workspaceId) assertion |
| W16 | 코드(doc) | 73423472 | resolveEmbedding JSDoc `@throws {NotFoundException} MODEL_CONFIG_NOT_FOUND` 추가 |
| INFO-1/2/3 | spec (SPEC-DRIFT) | (draft 위임) | `plan/in-progress/spec-update-pr2-embedding.md` — project-planner 위임 |

### 처리 제외 항목 (지시에 따라)

| SUMMARY # | 사유 |
|-----------|------|
| W1 | 선행 코드(PR2 diff 미포함). 별도 hardening 백로그로 추적 |
| W2 | legacy `embeddingLlmConfigId` 는 역방향 호환 의도적 kind 무관 조회. 코드 주석으로 명시됨. PR4 제거 추적 |
| W8 | mock 팩토리 추출 — 기능 버그 아닌 리팩토링. 중기 백로그 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (179/179)

## 보류·후속 항목

- **W1** (Pre-existing 보안): `embedding.service.ts` 벡터 string concat 시 NaN/Infinity 미검증 — PR2 diff 미포함 선행 코드. 별도 보안 하드닝 backlog 아이템으로 등록 필요.
- **W2** (Legacy kind 무검증): `model-config.service.ts` legacy 경로 `findEntity` 에 `expectedKind` 없음 — 역방향 호환 의도. 코드 주석에 "intentionally kind-agnostic for backward-compat" 명시됨. PR4 legacy 제거 시 자연 해소. 추적: `plan/in-progress/unified-model-management.md §3 V092`.
- **W8** (유지보수): `mockModelConfig.resolveEmbedding` mock 팩토리 추출 — 기능 버그 아닌 리팩토링. 중기 백로그.
- **W9-doProcess** (Architecture): `embedding.service.doProcess` ~188줄 메서드 분리 — 중기 백로그.
- **INFO-4** (성능): legacy-only 워크스페이스 불필요 DB 쿼리 1회 추가. PR4 legacy 제거 시 자연 해소.
- **INFO-5 / INFO-20** (API): legacy DTO 필드 `@ApiProperty({ deprecated: true })` 미설정 → PR4.
- **INFO-6 / INFO-14** (테스트): null 복원 시 dimension 리셋 케이스(W14에서 일부 커버); FK ON DELETE SET NULL e2e 후속 테스트 — 별도 follow-up.
- **INFO-7** (DTO): CreateKnowledgeBaseDto cross-field 검증 없음. Swagger description 개선 후속.
- **INFO-8, INFO-13** (defaultModel null guard): ModelConfig.defaultModel null 케이스 미검증 — 별도 follow-up.
- **INFO-9~12, INFO-15, INFO-17~19** (문서화/유지보수): 주석 개선류. 중기 백로그.
- **INFO-21** (API Contract): KB 조회 응답 DTO embeddingModelConfigId 포함 여부 확인 — 별도 follow-up.
- **INFO-22** (보안): 에러 메시지 내부 state 경미 노출 — 글로벌 exception filter 확인 후속.
- **SPEC-DRIFT draft**: `plan/in-progress/spec-update-pr2-embedding.md` — project-planner 가 `/consistency-check --spec` 후 반영.
