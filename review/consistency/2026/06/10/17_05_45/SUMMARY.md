# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다 (마이그레이션 버전 번호 V088 선점 충돌)

## 전체 위험도
**MEDIUM** — naming_collision checker 가 CRITICAL 1건(V088 race) 을 발견했고, cross_spec / plan_coherence / convention_compliance 는 WARNING 다수(BLOCK 사유 없음). rationale_continuity 는 fatal 로 검토 불가.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 마이그레이션 버전 V088 이 두 개의 독립 in-progress plan 에서 동시에 선점됨. draft 의 V088은 `llm_config→model_config` rename; exec-intake-queue-impl PR2b 의 V088은 `execution.queued_at` 컬럼 추가 | `plan/in-progress/spec-draft-unified-model-management.md` 변경 0 (V088 예시 번호) | `plan/in-progress/exec-intake-queue-impl.md` line 51 — "queued_at 신설 확정(V088)" | draft 변경 0 주석에 "exec-intake-queue-impl PR2b 의 V088 선점 충돌 — 착수 직전 `check-migration-versions.py` 로 실제 max 확인 후 재할당 필수"를 명시. exec-intake-queue-impl.md PR2b 항목에도 동일 동적 재할당 caveat 추가. |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/5-system/1-auth.md §3.2` RBAC 표 `LLM Config` 행 처리 누락 — 변경 3이 `Rerank Config` 행만 갱신하고 `LLM Config` 행 처리를 언급하지 않음 | draft 변경 3 auth §3.2 갱신 범위 | `spec/5-system/1-auth.md §3.2` (line 312-313) | 변경 3 갱신 범위를 "Rerank Config 행 제거 + LLM Config 행 → Model Config(kind=chat/embedding/rerank) 단일 행으로 통합"으로 명시 확장 |
| 2 | cross_spec | `spec/2-navigation/_layout.md §2.2` 항목 7 레이블 "LLM Config" 갱신 미명시 — 변경 6-D 가 URL 만 명시하고 레이블 변경을 누락 | draft 변경 6-D `_layout.md` URL 갱신 | `spec/2-navigation/_layout.md §2.2` (line 66) | 변경 6-D 에 `_layout.md §2.2` 항목 7 레이블 "LLM Config" → "Models" 갱신을 명시 추가 |
| 3 | cross_spec | `spec/2-navigation/5-knowledge-base.md §2.2` 의 `Part C` 링크가 통합 후 dead link 가 됨 — 변경 3이 select 소스 갱신만 명시하고 링크 교체를 누락 | draft 변경 3 5-knowledge-base §2.2 갱신 범위 | `spec/2-navigation/5-knowledge-base.md §2.2` (line 64, 68) | 변경 3 범위에 "Part C 링크 → Config > Models > Rerank 탭 참조로 교체" 명시 추가 |
| 4 | cross_spec | 구 엔드포인트 deprecation 제거 시점 이중 정의 — 변경 2는 "후속 PR에서 제거"(추상), 변경 6-D는 "PR4"(구체) | draft 변경 2 §3 vs 변경 6-D | draft 내부 충돌 | 변경 2 표현을 "PR4에서 제거(변경 6-D 참조)"로 통일하거나 변경 6-D 를 SoT 로 확정 |
| 5 | cross_spec | `spec/5-system/1-auth.md §4.1` 구 액션명(`llm_config.*`/`rerank_config.*`) 보존 정책이 spec 텍스트에 미반영 | draft 변경 6-C | `spec/5-system/1-auth.md §4.1/§4.2` | §4.1 갱신 시 "기존 `llm_config.*`/`rerank_config.*` 기록은 append-only 보존, 신규만 `model_config.*` 사용"을 spec 인라인으로 추가 |
| 6 | plan_coherence | V088 마이그레이션 번호 경합 — exec-intake-queue-impl.md 가 V088 을 "확정" 표기하고 있어 동적 재할당 caveat 불일치 | draft 변경 0 / `plan/in-progress/exec-intake-queue-impl.md` line 51 | exec-intake-queue-impl PR2b | naming_collision CRITICAL 항목과 동일 근거. CRITICAL 로 통합 처리 |
| 7 | plan_coherence | `rag-rerank-followup.md` 전 항목 완료(`[x]`)이나 `plan/complete/`로 미이동 — target landing 후 spec 서술 역전 발생 | `plan/in-progress/rag-rerank-followup.md` | target draft 변경 2 §3 / 변경 6-D | target draft landing 전후에 `rag-rerank-followup.md` 를 `plan/complete/`로 이동, §비고에 "deprecation alias는 unified-model-mgmt PR4에서 제거" 1줄 추가 |
| 8 | plan_coherence | frontmatter `related_plan` dead link — `plan/in-progress/unified-model-management.md` 가 repo 어디에도 없음 | draft frontmatter `related_plan` 필드 | (파일 미존재) | frontmatter에서 dead link 제거하거나 실제 구현 plan 경로로 교체 |
| 9 | naming_collision | `ModelConfig` / `ModelInfo` 혼동 위험 — 프론트엔드 광범위 사용 `ModelInfo` 와 신규 `ModelConfig` 가 접두어 `Model` 공유 | draft 변경 4/6-F, `codebase/frontend/src/lib/api/llm-configs.ts` line 24, `spec/5-system/7-llm-client.md` line 171 | 프론트엔드 컴포넌트 다수(`use-base-model-loader.ts`, `model-select-field.tsx` 등) | 구현 단계에서 프론트엔드 API 모듈에 JSDoc 구분 주석 추가를 구현 plan 에 기재 |
| 10 | naming_collision | 감사 액션명 이중 세트 공존 정책 미명시 — `llm_config.*`/`rerank_config.*` 와 `model_config.*` 가 동일 audit_log 에 공존하나 쿼리 대응 방침이 spec 미기술 | draft 변경 6-C | `spec/5-system/1-auth.md §4.1` | `1-auth.md §4.1`에 "전환 후 신규 이벤트는 `model_config.*`; 기존 행은 append-only 보존. 감사 쿼리는 두 세트를 OR 결합해야 함" 명시 |
| 11 | naming_collision | `/models` URL redirect 정책 spec 미명시 — 기존 사용자 `/llm-configs` 북마크 처리 방침 없음 | draft 변경 6-D `_layout.md` 항목 7 | `spec/2-navigation/_layout.md` line 66 | 변경 6-D 에 `/llm-configs` → `/models` redirect 정책(301 영구 등) 명시 또는 `/model-configs` 대안 검토 |
| 12 | naming_collision | `GET /api/llm-configs/:id/models` → `/api/model-configs/:id/models` 갱신 범위 에서 `7-llm-client.md` line 311 본문이 누락 | draft 변경 3 `7-llm-client.md` 갱신 범위 | `spec/5-system/7-llm-client.md` line 311 | 변경 3 갱신 범위에 line 311 참조 경로 갱신을 명시 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/1-data-model.md §1` ASCII ERD LLMConfig/RerankConfig 노드 갱신 — draft가 이미 명시 | draft 변경 6-A | spec 반영 시 누락 없이 적용 |
| 2 | cross_spec | `spec/5-system/7-llm-client.md §5.5` preview-models 경로 갱신 후 frontend 코드 동기화 필요 | `codebase/frontend/src/lib/api/llm-configs.ts:114` | 구현 phase에서 해소(draft에 이미 명시) |
| 3 | cross_spec | `spec/5-system/7-llm-client.md §2.1` 헤딩 "(Planned)" 갱신 — draft가 이미 명시 | draft 변경 3 | 헤딩 갱신 시 1차 구현 항목을 "(구현 완료)" 표기로 병행 갱신 |
| 4 | cross_spec | `spec/5-system/8-embedding-pipeline.md §5.3` 차원 표 이원화 방지 주석 필요 | §5.3 (line 129-137) | §5.3 표에 "ModelConfig.dimension이 SoT — 본 표는 참고 예시" 주석 추가 |
| 5 | cross_spec | `spec/data-flow/6-knowledge-base.md §2.1` `embedding_llm_config_id?` → `embedding_model_config_id? (V091)` 갱신 필요 | line 163 | 변경 3 갱신 범위(4곳)에 포함됨. spec 반영 시 확인 |
| 6 | cross_spec | 새 요구사항 ID 미부여 — 충돌 없음 | draft 전체 | 해소 불필요 |
| 7 | cross_spec | `spec/2-navigation/6-config.md Part C` 본문 처리 방향 미명시 | draft 변경 2 | "기존 Part C 섹션은 Part B 개정(Models 통합 화면)으로 흡수·대체, Part C 헤딩 삭제" 명시 추가 권장 |
| 8 | convention_compliance | frontmatter `worktree` 필드 값에 `claude/` prefix 붙어 plan_coherence checker false alarm 가능 | draft frontmatter | `worktree: unified-model-mgmt-5af7ee` 로 수정 (basename 만 기재) |
| 9 | convention_compliance | 변경 번호 5 건너뜀 — 의도적 삭제 여부 불명확 | draft 본문 섹션 순서 | 의도적이면 `<!-- 변경 5 삭제됨: <사유> -->` 주석 추가 |
| 10 | convention_compliance | `set-default` 동사형 경로 선택 근거가 `spec/conventions/swagger.md` 에 미반영 | 변경 2 §3 / 변경 6-E | `swagger.md`에 동사형 서브경로 선례 패턴 1절 추가 검토 (blocking 아님) |
| 11 | convention_compliance | `related_plan` frontmatter 비표준 키 — build guard 거부 없음, 관행화 시 문서화 권장 | draft frontmatter | 관행 정착 시 `plan-lifecycle.md §4`에 추가 필드 예시로 문서화 |
| 12 | plan_coherence | `kb-model-change-reembed-followup.md` §배경이 target landing 후 구식이 됨 — embedding_model_config_id FK 기반으로 갱신 필요 | `plan/in-progress/kb-model-change-reembed-followup.md` §배경 | 정책 결정 → spec 갱신 → 배경 갱신 순서로 진행 |
| 13 | plan_coherence | stale worktree 3건 (MERGED) — `.claude/worktrees/` 잔존 | spec-sync-audit-998544, kb-unsearchable-warning-b47e20, kb-lifecycle-groom-57cc46 | `cleanup-worktree-all.sh --yes --force` 로 정리 권장 |
| 14 | naming_collision | `model_config.dimension` vs `knowledge_base.embedding_dimension` SoT/캐시 관계 명시 위치 추가 필요 | draft 변경 6-G / `spec/1-data-model.md §2.16` | `§2.16 ModelConfig` 표의 `dimension` 설명에 "SoT. KB.embedding_dimension은 이 값의 파생 캐시" 1줄 추가 |
| 15 | naming_collision | `model_config.kind` DB 컬럼이 여러 JSONB discriminator `kind` 와 네임스페이스 공유 — 실질 DB 충돌 없으나 코드 레이어 혼용 위험 | `spec/1-data-model.md` line 716, 747, 766 | 구현 시 `ModelConfigKind = 'chat' | 'embedding' | 'rerank'` 타입 명시적 export |
| 16 | rationale_continuity | **재시도 필요** — checker 가 fatal 상태로 종료되어 결과 파일 없음 | — | rationale_continuity checker 재실행 필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Critical 0, Warning 5, Info 6. spec 텍스트 갱신 범위 누락·레이블 불일치 수준. 작동 불가 모순 없음 |
| rationale_continuity | N/A (재시도 필요) | fatal 종료로 산출물 없음 |
| convention_compliance | LOW | Critical 0, Warning 0, Info 5. worktree prefix 불일치·변경 번호 건너뜀 등 경미한 규약 위반 |
| plan_coherence | LOW | Critical 0, Warning 3 (V088 race — naming_collision CRITICAL 과 동일 근거, rag-rerank-followup 미이동, related_plan dead link), Info 2 |
| naming_collision | MEDIUM | Critical 1 (V088 race). Warning 4 (ModelConfig/ModelInfo 혼동, 감사 액션명 이중 세트, /models URL redirect, spec 텍스트 갱신 범위 보완). Info 2 |

## 권장 조치사항

1. **[BLOCK 해소 필수]** `plan/in-progress/spec-draft-unified-model-management.md` 변경 0 주석에 "exec-intake-queue-impl PR2b 의 V088 선점 충돌 — 착수 직전 max 확인 후 재할당 필수"를 명시. `exec-intake-queue-impl.md` PR2b 항목에도 동일 동적 재할당 caveat 추가.
2. **[spec 반영 전 해소 권장]** `spec/5-system/1-auth.md §3.2` RBAC 표 갱신 범위를 "Rerank Config 행 제거 + LLM Config 행 → Model Config 단일 행 통합"으로 변경 3에 명시 확장.
3. **[spec 반영 전 해소 권장]** 변경 6-D 에 `_layout.md §2.2` 항목 7 레이블 "LLM Config" → "Models" 갱신과 `/llm-configs` → `/models` redirect 정책을 명시.
4. **[spec 반영 전 해소 권장]** 변경 3 `5-knowledge-base §2.2` 갱신 범위에 `Part C` 링크 → `Config > Models > Rerank 탭` 교체 명시 추가.
5. **[착수 전 처리]** `rag-rerank-followup.md` 를 `plan/complete/`로 이동 (전 항목 완료 상태).
6. **[착수 전 처리]** frontmatter `related_plan` dead link 제거 또는 실제 구현 plan 경로로 교체.
7. **[착수 전 처리]** frontmatter `worktree` 값을 `unified-model-mgmt-5af7ee` (basename 만) 으로 수정.
8. **[rationale_continuity 재시도]** checker 가 fatal 로 종료됨. 재실행 후 결과 통합 필요.
9. **[구현 phase 기재]** 프론트엔드 API 모듈에 `ModelConfig`/`ModelInfo` 구분 JSDoc 주석 추가 및 `ModelConfigKind` 타입 명시적 export 를 구현 plan 에 포함.
10. **[정리]** stale worktree 3건 (`spec-sync-audit-998544`, `kb-unsearchable-warning-b47e20`, `kb-lifecycle-groom-57cc46`) 을 `cleanup-worktree-all.sh --yes --force` 로 제거.