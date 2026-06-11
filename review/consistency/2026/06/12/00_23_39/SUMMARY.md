# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — `MODEL_CONFIG_NOT_FOUND` HTTP status 이중 정의 및 에러코드 rename 규약 위반 가능성이 구현 착수 전 해소 필요. spec 버전 번호 오기(V092→V094)도 개발자 오해를 유발할 수 있음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity / naming_collision / plan_coherence (통합) | `MODEL_CONFIG_NOT_FOUND` HTTP status 이중 정의 — plan 은 `llm.service.ts` rename 경로에서 HTTP **400** 유지를 결정했으나, spec `3-error-handling.md §1.3` 및 `model-config.service.ts:92-121` 은 이미 **404** 로 정의·발행 중. 동일 코드 문자열이 두 발행 경로에서 서로 다른 HTTP status를 가져 클라이언트 분기 로직과 spec 모두 불일치 | `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §범위 2 에러코드 표 | `spec/5-system/3-error-handling.md §1.3` (MODEL_CONFIG_NOT_FOUND = 404), `model-config.service.ts:92` (`notFound()` = NotFoundException 404) | (A) `llm.service.ts` 경로도 NotFoundException(404)로 승격해 spec 정의 일치, 또는 (B) spec `3-error-handling.md §1.3` HTTP status를 400으로 수정하고 backward-compat Rationale을 spec에 기록. 착수 전 project-planner와 확정 후 spec 갱신 선행. |
| 2 | convention_compliance / cross_spec (통합) | `spec/5-system/8-embedding-pipeline.md §5.5` 가 legacy 컬럼 제거를 "V092 에서 제거 예정"으로 기술 — V092는 이미 PR4a `drop_rerank_config`로 점유됨. 개발자가 V092 재사용을 시도하거나 마이그레이션 번호 충돌 유발 가능 | `spec/5-system/8-embedding-pipeline.md §5.5` 마지막 주석, `spec/1-data-model.md §2.11` | `codebase/backend/migrations/V092__drop_rerank_config.sql` (이미 main에 머지), `spec/conventions/migrations.md §2-3` (V번호 단조 증가·Append-only) | PR4b 착수 전 `spec/5-system/8-embedding-pipeline.md §5.5` 의 "V092 에서 제거 예정" → "V093/V094(PR4b)에서 제거"로 갱신. `spec/1-data-model.md §2.11` 의 두 legacy 필드 설명도 동일 갱신. project-planner 위임 실행. |
| 3 | convention_compliance | `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` rename 이 `spec/conventions/error-codes.md §2` 의 "rename 은 breaking change" 규약 위반 가능성 — 프론트엔드(`loader-error-messages.ts`)가 두 코드 모두 분기하므로 breaking 여부 착수 전 검증 필요 | PR4b 구현 계획 에러코드 범위 2 | `spec/conventions/error-codes.md §2` (rename 안정성), `codebase/frontend/` 내 `LLM_CONFIG` 리터럴 분기 경로 | 착수 전 `codebase/frontend/`에서 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 리터럴 직접 분기 경로 검색. 존재하면 deprecated alias 이중 발행 또는 `error-codes.md §3 historical-artifact` 레지스트리 등재 전략. 내부 전용이면 rename 허용 근거를 spec에 명시. |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | V093 repoint 경로가 `ws default chat` config를 2순위 폴백으로 사용 — 기각된 "chat piggyback" 패턴 재도입 위험. dimension 결정 방식(probe? embedding_dimension 캐시?) 미명시 | `plan` §범위 1 V093 우선순위 `(1) embedding_llm_config_id → (2) ws default chat → (3) ws default embedding` | `spec/5-system/8-embedding-pipeline.md §5.2` ("chat LLMConfig piggyback 기각"), `spec/1-data-model.md §2.16 Rationale` (임베딩 1급화) | V093 설명에 "ws default chat 폴백 시 `KB.embedding_dimension` 존재 시 SoT로 사용, 없으면 probe embed 필수" 조건 명시. 또는 2단계 `(1) embedding_llm_config_id → (2) ws default embedding` 로 단순화해 chat 경로 완전 제외. |
| 2 | cross_spec / naming_collision (통합) | `spec/5-system/7-llm-client.md §5.5·§6` 이 구 코드명 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 를 4-5개소에서 계속 사용 — PR4b 이후 `3-error-handling.md`만 갱신되고 `7-llm-client.md`가 누락되면 spec 내 코드명 불일치 잔존 | `spec/5-system/7-llm-client.md §5.5`, `§6 에러 처리 표` (라인 235, 257, 327, 341) | `spec/5-system/3-error-handling.md §1.3` (`MODEL_CONFIG_INVALID`·`MODEL_CONFIG_NOT_FOUND` 정식 등재) | project-planner 위임 spec 갱신 범위에 `7-llm-client.md §5.5·§6` 의 구 코드명 4개소 일괄 갱신 명시. |
| 3 | cross_spec | `spec/data-flow/6-knowledge-base.md §2` 가 V094 DROP 후에도 `embedding_model`·`embedding_llm_config_id` 를 정상 컬럼으로 열거 — 구현자 혼동 및 테스트 데이터 오류 유발 가능 | `spec/data-flow/6-knowledge-base.md §2` 생성 스키마 (line 250) | V094 DROP 이후 해당 컬럼 부재 | spec 갱신 위임 시 `spec/data-flow/6-knowledge-base.md §2` 표에서 `embedding_model`·`embedding_llm_config_id` 제거. |
| 4 | plan_coherence | `plan/in-progress/spec-update-pr2-embedding.md` (worktree `unified-model-mgmt-5af7ee`, PR #541 MERGED)가 `plan/complete/`로 미이동 — PR4b 가 step-3 제거 후 해당 draft가 "미적용"처럼 남아 후속 작업자 혼동 | `plan/in-progress/spec-update-pr2-embedding.md` | PR #541 완료 상태 | PR4b 착수 전 `plan/complete/`로 이동. |
| 5 | plan_coherence | `plan/in-progress/spec-update-embedding-testconnection.md` (worktree `fix-embedding-test-dimension-a3d42a`, PR #548 MERGED 2026-06-11) 물리 worktree 미존재 — orphaned plan | `plan/in-progress/spec-update-embedding-testconnection.md` | PR #548 완료 상태 | `plan/complete/`로 이동. |
| 6 | convention_compliance | V093 fail-loud RAISE 정책이 spec 어느 문서에도 정의되지 않음 — 비가역 데이터 마이그레이션 실패 전략을 spec 수준 근거 없이 진행 | PR4b 구현 계획 §범위 1 V093 fail-loud RAISE | `spec/conventions/migrations.md §3` (Append-only), CLAUDE.md Rationale 3섹션 권장 | PR4b plan 또는 `spec/5-system/8-embedding-pipeline.md Rationale` 에 V093 fail-loud 전략과 근거(repoint 실패 시 일부만 마이그레이션된 채 DROP 불가 → 전체 RAISE가 안전함) 명시. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/5-system/8-embedding-pipeline.md §5.5` resolveEmbedding step-3 서술이 PR4b 제거 대상이나 spec 본문에 정식 서술로 잔존 — 구현자가 spec을 그대로 따르면 step-3를 지우지 않을 위험 | `spec/5-system/8-embedding-pipeline.md §5.5` | plan 체크리스트의 "spec 갱신 → project-planner 위임" 항목이 V094 DROP 이후 즉시 수행되도록 순서 명시. 구현 PR에 `// TODO: spec §5.5 step-3 제거 예정` 주석 추가. |
| 2 | rationale_continuity | V094 비가역 DROP 전 V093 검증 통과 조건 Rationale 부재 — Flyway forward-only 정책 자체와는 충돌 없음 | `plan` §범위 1 "V093 commit(검증 통과) 후에만 V094 진행" | spec 갱신 시 `spec/5-system/8-embedding-pipeline.md Rationale` 에 "V093 repoint + fail-loud RAISE로 NULL KB 0건 확인 후 V094 DROP" 패턴 한 항 추가. |
| 3 | convention_compliance | `spec/5-system/8-embedding-pipeline.md §5.5` 섹션 제목 "(PR2)" 수식어가 PR4b 완료 후에도 남을 수 있음 | `spec/5-system/8-embedding-pipeline.md §5.5` 섹션 제목 | PR4b 완료 후 §5.5 전체 삭제 또는 §5.2 에 통합. 현재는 착수 전 확인 불필요 — PR 완료 체크리스트에 포함. |
| 4 | convention_compliance | V093/V094 동일 PR 포함 시 V093 단계적 배포 불가 — trade-off를 plan에 명시해야 함 | PR4b 구현 계획 | `spec/conventions/migrations.md §2` (V번호 단조 증가) | plan에 trade-off 명시. 착수 전 `ls codebase/backend/migrations \| tail -2` 로 max V 재확인 필수. |
| 5 | plan_coherence | PR4b plan frontmatter `related_plan:` 에 `plan/in-progress/kb-model-change-reembed-followup.md` 가 stale 경로로 남아있음 (실제: `plan/complete/`) | PR4b plan frontmatter | 2026-06-11 이동 완료 | frontmatter 경로를 `plan/complete/kb-model-change-reembed-followup.md` 로 업데이트. |
| 6 | naming_collision | `RERANK_CONFIG_INVALID` — plan §범위2에서 "검토" 상태로 결론 미확정. 독립 레이어 코드로 충돌 없음 | PR4b 에러코드 표 | `spec/5-system/9-rag-search.md`, `spec/2-navigation/6-config.md` | "변경 없음(현행 유지)"으로 확정해 plan에 명시. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `8-embedding-pipeline.md §5.5` V092 stale 서술(Critical 통합), `7-llm-client.md` 구 에러코드 잔존, data-flow 컬럼 미동기화 |
| rationale_continuity | HIGH | `MODEL_CONFIG_NOT_FOUND` HTTP status plan(400) vs spec(404) 직접 충돌(Critical 통합), V093 chat piggyback 재도입 위험 |
| convention_compliance | HIGH | `8-embedding-pipeline.md §5.5` V092 오기로 인한 migration 번호 충돌(Critical 통합), 에러코드 rename breaking 가능성(Critical), spec drift 관련 WARNING 4건 |
| plan_coherence | MEDIUM | `MODEL_CONFIG_NOT_FOUND` HTTP status 불일치(Critical 통합), orphaned plan 2건, frontmatter dead link |
| naming_collision | HIGH | `MODEL_CONFIG_NOT_FOUND` HTTP status 이중 정의(Critical 통합), `LLM_CONFIG_INVALID` spec 잔존, V092→V094 오기 |

## 권장 조치사항

1. **(BLOCK 해소 — 최우선)** `MODEL_CONFIG_NOT_FOUND` HTTP status 확정: project-planner와 협의해 (A) spec 404 준수 → `llm.service.ts` NotFoundException(404) 승격, 또는 (B) 400 유지 확정 → `spec/5-system/3-error-handling.md §1.3` HTTP status 수정 + backward-compat Rationale 기록. 착수 전 `codebase/backend/`에서 `MODEL_CONFIG_NOT_FOUND` 발행처 전수 확인 후 결정.
2. **(BLOCK 해소 — 최우선)** `spec/5-system/8-embedding-pipeline.md §5.5` 와 `spec/1-data-model.md §2.11` 의 "V092 에서 제거 예정" 표기를 "V093/V094(PR4b)에서 제거"로 project-planner 위임 갱신. 착수 전 완료.
3. **(BLOCK 해소 — 착수 전)** `codebase/frontend/`에서 `LLM_CONFIG_INVALID`·`LLM_CONFIG_NOT_FOUND` 리터럴 직접 분기 경로 유무 검색. 분기 경로 존재 시 deprecated alias·이중 발행 전략; 내부 전용이면 rename 허용 근거를 `spec/conventions/error-codes.md §3`에 기록.
4. V093 repoint 우선순위 `(2) ws default chat` 폴백 — dimension 결정 방식 명시 또는 2단계로 단순화해 chat piggyback 경로 제거. V093 SQL 작성 전 결정.
5. orphaned plan 이동: `plan/in-progress/spec-update-pr2-embedding.md`, `plan/in-progress/spec-update-embedding-testconnection.md` → `plan/complete/`. PR4b 착수 전 정리 권장.
6. V093 fail-loud RAISE 근거를 PR4b plan 또는 `spec/5-system/8-embedding-pipeline.md Rationale`에 명시.
7. PR4b plan `related_plan:` frontmatter의 `kb-model-change-reembed-followup.md` 경로를 `plan/complete/`로 업데이트.
8. `spec/data-flow/6-knowledge-base.md §2` 의 `embedding_model`·`embedding_llm_config_id` 컬럼 제거 — V094 DROP 후 spec 갱신 위임 범위에 포함.
9. `spec/5-system/7-llm-client.md §5.5·§6` 구 코드명 4개소 갱신 — project-planner 위임 spec 갱신 범위에 명시적으로 추가.