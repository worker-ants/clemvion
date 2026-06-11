# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — Cross-Spec 3건 + Plan Coherence 1건 + Naming Collision 1건 CRITICAL 발견. Plan Coherence 의 PR #517 활성 worktree 충돌이 가장 긴급한 선결 조건이다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | KnowledgeBase 임베딩 FK 컬럼명 충돌 — draft `embedding_model_config_id` vs 기존 `embedding_llm_config_id` | 변경 1 §2.16 ModelConfig "참조 관계(kind 의미)" | `spec/data-flow/6-knowledge-base.md` §1.1/§1.2/§2 (4곳) | 컬럼명을 `embedding_llm_config_id`(data-flow 기존 명칭)로 통일하거나, `spec/data-flow/6-knowledge-base.md` 전체를 `embedding_model_config_id`로 일괄 갱신. 갱신 목록에 `spec/data-flow/6-knowledge-base.md` 추가 필수 |
| 2 | Cross-Spec | `spec/1-data-model.md §2.11 rerank_config_id` FK 타깃 모순 — draft `FK → model_config` 선언 vs spec `FK → RerankConfig` 유지 | 변경 1 §2.16 ModelConfig "rerank: rerank_config_id 전환 선언" | `spec/1-data-model.md §2.11` (`FK → RerankConfig`), `§2.16.1 RerankConfig` 엔티티 현존 | draft 채택 전 `spec/1-data-model.md §2.11 rerank_config_id` 행 FK 타깃 갱신 및 §2.16.1 RerankConfig 삭제를 동일 PR에 포함 |
| 3 | Cross-Spec | `LLMClientFactory`/`RerankClientFactory` 팩토리 분리 정책과 단일 테이블 통합 후 계층 책임 불명확 | 변경 2 §3 API 단일 엔드포인트; 변경 1 §2.16 단일 테이블 | `spec/5-system/7-llm-client.md §4` `LLMClientCreateOptions`, `§4.1 RerankClientFactory` 별도 팩토리 | `spec/5-system/7-llm-client.md §4`에 "ModelConfig.kind로 팩토리 선택 로직" (또는 팩토리 통합 결정) 명시 |
| 4 | Plan Coherence | PR #517 (`refactor-backlog-options`, OPEN)이 동일 5개 spec 파일을 동시 수정 중 — active worktree 충돌 및 의미 충돌 | 변경 1~3 전체 (5개 spec 파일) | PR #517: `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/2-navigation/5-knowledge-base.md` 동시 수정 중 | PR #517 머지 완료 후 target spec 개정 착수. `jina/voyage/local/builtin` "Planned" 복원 여부를 PR #517과 통일 합의 선행 |
| 5 | Naming Collision | `POST /api/model-configs/preview-models` 경로 갱신이 `spec/5-system/7-llm-client.md §5.5`에 명시되지 않음 — spec 드리프트·런타임 404 위험 | 변경 3 `spec/5-system/7-llm-client.md` "동작 불변, 엔티티명만 ModelConfig로" | `spec/5-system/7-llm-client.md:307` `POST /api/llm-configs/preview-models`, `codebase/frontend/src/lib/api/llm-configs.ts:114` fetch URL | 변경 3에 "§5.5 경로 `/api/llm-configs/preview-models` → `/api/model-configs/preview-models` 명시 갱신" 추가. frontend API 클라이언트 URL 갱신도 구현 대상 명시 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/2-navigation/6-config.md §3` API 엔드포인트 이중 정의 — `/api/llm-configs`/`/api/rerank-configs` canonical vs draft 신규 API | 변경 2 §3 API 표 | `spec/2-navigation/6-config.md §3` | `spec/2-navigation/6-config.md §3` LLM Config API / Rerank Config API 표를 `/api/model-configs` 표로 교체, 구 엔드포인트에 deprecation 주석 추가 |
| 2 | Cross-Spec / Rationale | R-3 번복이 `spec/2-navigation/6-config.md §R-3` 본문에 미반영 — 동일 라벨이 두 spec에서 반대 결론 | 변경 2 §Rationale 개정 (R-3 번복) | `spec/2-navigation/6-config.md §R-3` ("RerankConfig sibling 분리") | draft 채택 시 `spec/2-navigation/6-config.md §R-3`을 번복 내용으로 교체. 또한 `spec/1-data-model.md §2.16.1`, `spec/5-system/9-rag-search.md Rationale`, `spec/5-system/7-llm-client.md Rationale` 3곳의 구형 "분리 근거" 설명도 변경 3 갱신 목록에 추가 |
| 3 | Cross-Spec | `spec/5-system/8-embedding-pipeline.md §5.2` 임베딩 모델 소스 불일치 — `KB.embedding_model` 문자열 vs `kind=embedding` ModelConfig FK | 변경 3 `spec/5-system/8-embedding-pipeline.md` 갱신 지시 | `spec/5-system/8-embedding-pipeline.md §5.2/§5.3` | `§5.2`/`§5.3`을 ModelConfig.dimension 기반으로 갱신, `spec/data-flow/6-knowledge-base.md §1.2` `embedding_llm_config_id` 참조도 함께 갱신 |
| 4 | Cross-Spec | V089 마이그레이션 `is_default=true` 중복 행 처리 미명시 — partial unique 추가 시 중복 데이터로 마이그레이션 실패 위험 | 변경 1 §2.16 ModelConfig `is_default`, 마이그레이션 V089 | `spec/1-data-model.md §2.16 LLMConfig` (partial unique 제약 미명시) | V089에 "기존 `is_default=true` 중복 행 정리(예: `created_at` 최신 1개 보존, 나머지 `false`)" 단계 명시 |
| 5 | Cross-Spec | `KB.embedding_model` 문자열 컬럼 존속 여부 미명시 — `embedding_model_config_id` FK와 공존 시 SoT 불명확 | 변경 1 §2.16 embedding_model_config_id 신규; 마이그레이션 V091 | `spec/1-data-model.md §2.11 KnowledgeBase` `embedding_model` 컬럼 현존 | V091 또는 V092에 "`KB.embedding_model` 컬럼 DROP" 또는 ModelConfig.default_model로 resolve하는 방식 명시 |
| 6 | Rationale | R-3 번복 — 4개 spec Rationale 갱신 대상 중 일부 누락 (`spec/1-data-model.md §2.16.1`, `spec/5-system/9-rag-search.md Rationale`, `spec/5-system/7-llm-client.md Rationale`) | 변경 3 연관 spec 참조 갱신 목록 | 상기 3개 spec Rationale | 변경 3 절에 3곳 Rationale 갱신 지시 명시 추가 |
| 7 | Rationale | 임베딩 1급화 — `KnowledgeBase.embedding_model` → `embedding_model_config_id` FK 전환 근거 및 `LlmService.listModels type='embedding'` 필터 전환 Rationale 미명시 | 변경 1 §2.16 ModelConfig R: 임베딩 1급화; 변경 3 `spec/5-system/8-embedding-pipeline.md` | `spec/5-system/8-embedding-pipeline.md Rationale` | 변경 3에 (a) 문자열→FK 전환 근거, (b) `listModels type='embedding'` → `kind='embedding'` 조회 전환 Rationale 명시 포함 |
| 8 | Plan Coherence | `kb-model-change-reembed-followup` 의 "비용·UX 정책 미결"과 target plan의 "차원 변경 차단" 범위 미분리 | 변경 2 §Part B Embedding 탭 "차원 변경 차단(재임베딩 가드)" | `plan/in-progress/kb-model-change-reembed-followup.md` (정책 미결 상태) | target plan의 "차원 변경 차단"이 `kb-model-change-reembed-followup`의 선택지 중 어느 쪽인지 명시. `kb-model-change-reembed-followup`의 미결 범위를 target 적용 후 좁혀 재작성 |
| 9 | Plan Coherence | `rag-rerank-followup` 완료 항목 3건 무효화 — `spec/5-system/1-auth.md §3.2` RBAC 갱신이 변경 3 체크리스트 누락 | 변경 1 §2.16.1 삭제, 변경 2 §3 `/api/rerank-configs` deprecation | `plan/in-progress/rag-rerank-followup.md`; `spec/5-system/1-auth.md §3.2` `rerank_config` RBAC 행 | 변경 3 체크리스트에 `spec/5-system/1-auth.md §3.2` RerankConfig → ModelConfig(kind=rerank) 갱신 추가. `rag-rerank-followup` 완료 기준 갱신 |
| 10 | Naming Collision | KB 신규 FK `embedding_model_config_id` — `spec/data-flow/6-knowledge-base.md`가 갱신 목록 누락 (기존 `embedding_llm_config_id` 4곳 참조) | 변경 3 대상 파일 목록 | `spec/data-flow/6-knowledge-base.md:37,73,117,163` | 변경 3 대상 파일 목록에 `spec/data-flow/6-knowledge-base.md` 추가 |
| 11 | Naming Collision | `is_default` per-(workspace,kind) 부분 유니크 의미 변경 — 기존 `set-default` 서비스 로직이 kind 범위 없이 전체 초기화 시 버그 위험 | 변경 2 §3 API `PATCH /api/model-configs/:id/set-default` | `codebase/backend/src/modules/llm-config/entities/llm-config.entity.ts:17` (workspace-level 단일 unique) | `PATCH /api/model-configs/:id/set-default` 항목에 "동일 `(workspace_id, kind)` 내의 기존 기본값 초기화 후 지정" 동작 명시 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/0-overview.md §6.1` 구현 완료 목록 용어 갱신 필요 (RerankConfig, LLMConfig 엔티티명 잔류) | `spec/0-overview.md §6.1` | draft 채택 시 "ModelConfig(chat/embedding/rerank 통합)"으로 동기화 |
| 2 | Cross-Spec | `spec/5-system/9-rag-search.md §3.3` "RerankConfig endpoint" 명칭 갱신 필요 | `spec/5-system/9-rag-search.md §3.3/§3.3.2` | "RerankConfig" → "ModelConfig(kind=rerank)" 일괄 갱신 |
| 3 | Cross-Spec | `spec/2-navigation/5-knowledge-base.md §2.2` 리랭커 select 소스 설명 갱신 필요 | `spec/2-navigation/5-knowledge-base.md §2.2` | draft 채택 시 동시 갱신 |
| 4 | Cross-Spec | `spec/5-system/7-llm-client.md §2.1` 헤딩 "리랭크 프로바이더 (Planned)" 구현 완료 상태와 불일치 | `spec/5-system/7-llm-client.md §2.1` | "리랭크 프로바이더 (1차: tei/cohere 구현 완료)"로 갱신 권장 |
| 5 | Rationale | `spec/5-system/7-llm-client.md Rationale` "왜 LLMClientFactory에 통합하지 않았나" — "별개 DB 테이블" 전제가 통합 후 사실과 달라짐 | `spec/5-system/7-llm-client.md Rationale` | "ModelConfig 통합 이후에도 RerankClient 분리 유지 — DB 테이블은 통합됐으나 API shape 차이 불변" 문장 추가 |
| 6 | Rationale | `spec/5-system/9-rag-search.md Rationale` "왜 RerankConfig를 LLMConfig와 분리했나" 항 — 변경 3 갱신 목록 누락 | `spec/5-system/9-rag-search.md Rationale` | 변경 3에 Rationale 항 "ModelConfig 통합 근거로 갱신 또는 폐기" 추가 |
| 7 | Naming Collision | `ModelConfig`와 기존 `ModelInfo` 근접 혼동 위험 — "provider 설정"과 "모델 목록 항목" 의미 상이 | `spec/5-system/7-llm-client.md §3.5`, `codebase/frontend/src/lib/api/llm-configs.ts:24` | 코드 내 JSDoc에 "provider-level configuration" vs "model list item" 구분 명시 |
| 8 | Naming Collision | `ModelConfig.kind` 값 집합(`chat`/`embedding`/`rerank`)이 기존 `ModelInfo.type` 값(`chat`/`embedding`)과 중복 | `model_config.kind` Enum, `ModelInfo.type` | TypeScript 레이어에서 `ModelKind` enum 전용 정의, `ModelInfo.type` 타입과 분리 선언 |
| 9 | Naming Collision | `knowledge_base.rerank_config_id`와 `rerank_llm_config_id` 두 컬럼 — 이름만 보면 동일 역할처럼 보이나 타깃이 다름 | `spec/1-data-model.md §2.11` | `§2.11` 갱신 시 두 컬럼의 역할 차이 주석 명시 |
| 10 | Plan Coherence | `spec-sync-config-gaps` plan — target 적용 후 Part B+C 항목 잔류 시 혼란 가능 | `plan/in-progress/spec-sync-config-gaps.md` | target spec 반영 완료 후 재검토, Part A 항목(5건)만 남기고 Part B+C 소멸 확인 |
| 11 | Plan Coherence | `migration-tooling-evaluation` — V088 착수 전 `sqitch-poc.md` PoC 결과 참조 권장 (차단 이슈 없음) | 변경 1 마이그레이션 V088~V092 | 추가 조치 불요. V088 착수 전 `sqitch-poc.md` 결과 최종 확인 권장 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | HIGH | FK 컬럼명 충돌, rerank_config_id FK 타깃 모순, 팩토리 계층 책임 불명확 3건 CRITICAL + 5건 WARNING |
| Rationale Continuity | LOW | R-3 번복 의도·근거 있으나 4개 spec Rationale 갱신 대상 누락 (2건 WARNING, 2건 INFO) |
| Convention Compliance | N/A | 결과 파일 없음 — 재시도 필요 |
| Plan Coherence | HIGH | PR #517 active worktree 충돌 1건 CRITICAL + 3건 WARNING |
| Naming Collision | MEDIUM | preview-models 경로 갱신 누락 1건 CRITICAL + 3건 WARNING |

> Convention Compliance checker: `convention_compliance.md` 파일이 존재하지 않아 결과를 읽을 수 없었습니다. 재시도 필요.

---

## 권장 조치사항

1. **(BLOCK 해소 최우선) PR #517 머지 완료 대기** — target plan 착수 전에 `refactor-backlog-options` PR #517을 머지하거나 충돌 범위를 정리해야 한다. 특히 rerank provider 목록(`tei/cohere` vs `jina/voyage/local/builtin Planned`) 결정을 PR #517과 통일 합의.
2. **(BLOCK 해소) FK 컬럼명 단일화** — `embedding_model_config_id` vs `embedding_llm_config_id` 중 하나를 확정하고, `spec/data-flow/6-knowledge-base.md` (4곳)을 변경 3 갱신 목록에 추가. Cross-Spec Critical #1 + Naming Collision Warning #10 동시 해소.
3. **(BLOCK 해소) `spec/1-data-model.md §2.11/§2.16.1` 동일 PR 갱신 선언** — `rerank_config_id` FK 타깃 `RerankConfig → model_config`로 교체, `§2.16.1 RerankConfig` 삭제를 draft와 동일 커밋에 포함.
4. **(BLOCK 해소) `spec/5-system/7-llm-client.md §4` 팩토리 선택 로직 명시** — `ModelConfig.kind`로 어느 팩토리를 호출할지(또는 통합 결정) 명시.
5. **(BLOCK 해소) `spec/5-system/7-llm-client.md §5.5` 경로 명시 갱신** — 변경 3에 `/api/llm-configs/preview-models` → `/api/model-configs/preview-models` 갱신 포함. frontend `codebase/frontend/src/lib/api/llm-configs.ts:114` URL 갱신도 구현 체크리스트에 추가.
6. **(WARNING 해소) 변경 3 갱신 목록 보완** — `spec/2-navigation/6-config.md §3` deprecation 처리, `spec/2-navigation/6-config.md §R-3` 교체, `spec/5-system/8-embedding-pipeline.md §5.2/§5.3` 갱신, `spec/5-system/1-auth.md §3.2` RBAC 행 갱신, 4개 spec Rationale 갱신 지시 추가.
7. **(WARNING 해소) V089 마이그레이션 중복 `is_default` 정리 단계 추가** — `created_at` 최신 1개 보존, 나머지 `false` 처리 명시.
8. **(WARNING 해소) `KB.embedding_model` 컬럼 DROP 또는 대체 방식 V091/V092에 명시**.
9. **(WARNING 해소) `PATCH /api/model-configs/:id/set-default` 동작에 `(workspace_id, kind)` 범위 제한 명시**.
10. **(WARNING 해소) `kb-model-change-reembed-followup` 미결 범위를 target 적용 후 재작성**, "차원 변경 차단" 동작이 어느 선택지인지 명시.
11. **Convention Compliance checker 재실행** — `convention_compliance.md` 파일 미생성으로 결과 누락. 재시도 후 추가 위배 없으면 전체 위험도 재평가.