# RESOLUTION — 10_11_22

## 조치 항목

| SUMMARY # | 분류 | 조치 | commit | 비고 |
|-----------|------|------|--------|------|
| C-1 | verified-non-issue | — | — | `resolveEmbedding` 이미 2-step(154-177행). step-3 분기·`embeddingLlmConfigId`/`legacyModel` 파라미터 없음. 146-147행 주석 명시. spec §5.5 일치. |
| C-2 | verified-non-issue | — | — | `llm-preview.service.ts:39/48/69` 이미 `MODEL_CONFIG_INVALID`(구 `LLM_CONFIG_INVALID` 0건). |
| C-3 | verified-non-issue | — | — | `MODEL_CONFIG_DEFAULT_MISSING` 은 `llm.service.ts:356` 에서 발행 중. `error-codes.ts` 는 노드 핸들러 런타임용 canonical enum 으로, NestJS API 레이어 도메인 코드와 다른 레이어. 미등재 정상. |
| C-4 | verified-non-issue | — | — | `MODEL_CONFIG_DEFAULT_MISSING`(400) 이미 `llm.service.ts:356` 발행 중. "spec 만 등재, 미구현" 주장 틀림. |
| W-1 | spec | draft 위임 | — | `plan/in-progress/spec-fix-error-code-routing.md` — resolveEmbedding(404) vs resolveConfig(400) 의도적 차이 Rationale 명시 필요. `ESCALATE=spec`. |
| W-2 | verified-non-issue | — | — | `MODEL_CONFIG_NOT_FOUND`(404) 전환 이미 구현 완료. spec 기술 정확. |
| W-3 | verified-non-issue | — | — | step-3 이미 제거됨(146-147행 주석 + Rationale). V094 SQL 에 배포 순서 의존 및 lock_timeout 주의 이미 명시. |
| W-4 | verified-non-issue | — | — | `create-knowledge-base.dto.ts` 에 `embedding_model` 필드 없음. `embeddingModelConfigId` 만 존재. |
| W-5 | verified-non-issue | — | — | 사용자 결정 #4: `EmbeddingProbeDto.llmConfigId`·`embeddingModel` 은 probe 요청 파라미터 — 제거 금지. spec §1.6 probe 서술 보존. |
| W-6 | verified-non-issue | — | — | `update-knowledge-base.dto.ts` 에 `embedding_model` 필드 없음. dimension reset 조건 = `embeddingModelConfigId` 변경. |
| W-7 | verified-non-issue | — | — | V094 SQL 에 AccessExclusiveLock 경고 + `SET lock_timeout = '3s'` 이미 포함. |
| W-8 | verified-non-issue | — | — | V093 SQL 헤더 주석에 "Flyway 는 Postgres 단일 트랜잭션이라 fail-loud RAISE 시 전체 롤백 + V094 미실행" 명시. |
| W-9 | verified-non-issue | — | — | `error-codes.md §3` 하단 `> §3 은 active 코드…§4 에 둔다` callout 이미 추가됨. Overview 중복 없음. |
| W-10 | 코드 | fixed | 2ba5d0d2 | `error-codes.spec.ts` 에 LLM_CONFIG_INVALID·LLM_CONFIG_NOT_FOUND 잔존 검출 회귀 가드 추가. |
| W-11 | 코드 | fixed | 2ba5d0d2 | plan 적용 위치 표에 `spec/data-flow/7-llm-usage.md | embeddingLlmConfigId 참조 제거` 행 소급 추가. |
| W-12 | 코드 | fixed | 2ba5d0d2 | CHANGELOG breaking change #3 에 `GET /api/knowledge-bases`, `GET /api/knowledge-bases/:id` 엔드포인트 명시 보완. |
| W-13 | verified-non-issue | — | — | `resolveEmbedding` step-3 이미 제거됨 (C-1 동일). kind 파라미터 생략 경로 자체가 없음. |
| I-4 | spec | draft 위임 | — | `plan/in-progress/spec-fix-error-code-routing.md` 에 포함 — KB nav spec 에 resolveEmbedding(404) vs resolveConfig(400) 구분 주석 추가 제안. `ESCALATE=spec`. |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- build : 해당 없음 (테스트·plan·CHANGELOG 변경만)
- e2e   : 통과 (188/188)

## 보류·후속 항목

### spec 위임 (ESCALATE=spec)

- **W-1 / I-4**: `plan/in-progress/spec-fix-error-code-routing.md`
  - `spec/5-system/3-error-handling.md §1.3` — `MODEL_CONFIG_DEFAULT_MISSING` 설명에 `resolveEmbedding` 이 404 를 사용하는 이유 명시
  - `spec/5-system/3-error-handling.md Rationale` — 404/400 분리 섹션 말미에 `resolveEmbedding`(404 유지) 근거 추가
  - `spec/2-navigation/5-knowledge-base.md` — ws default 부재 에러코드 `MODEL_CONFIG_NOT_FOUND`(404) 유지하되 맥락 주석 추가

### INFO 항목 (자동 수정 미대상)

- **I-1**: V093 api_key ciphertext 복사 전제 통합 테스트 검증 권장
- **I-2**: `workspaceId` 오류 메시지 포함 — 인증된 사용자 컨텍스트, 실질 위험 제한적
- **I-3**: 마이그레이션 이력 표에 V093/V094 컬럼 삭제 append-only 기록 추가 권장
- **I-5**: `spec/2-navigation/6-config.md` legacy 임베딩 서술 제거 여부 확인 (기존 spec-update-pr4b 범위 포함)
- **I-6**: PR merge 후 `error-codes.md §4` PR 컬럼에 실제 PR 번호 기입
- **I-7**: `knowledge_base(embedding_model_config_id)` 인덱스 존재 여부 확인 후 spec 명시
- **I-8**: V093 step-3b 통합 테스트 / staging DB 수동 검증 권장
- **I-9**: spec 변경 완료 시 `plan/in-progress/spec-update-pr4b-embedding-retire.md` → `plan/complete/` 이동
- **I-10**: `review/consistency/2026/06/12/09_01_10/_retry_state.json` — 완료 상태 아닌 초기 상태 파일 잔존
- **I-11**: 확인 완료 — 동반 갱신 누락 없음
