# Plan 정합성 검토 — spec-draft-unified-model-management.md

## 발견사항

### [CRITICAL] PR #517 (OPEN) 이 동일 spec 파일 5개를 동시에 수정 중 — active worktree 충돌

- **target 위치**: 변경 1(`spec/1-data-model.md §2.16`), 변경 2(`spec/2-navigation/6-config.md`), 변경 3(`spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/2-navigation/5-knowledge-base.md`)
- **관련 plan**: branch `refactor-backlog-options` / PR #517 (`docs(plan): refactor 백로그 — 옵션별 장단점·트레이드오프·권장안 보강 (91건)`, OPEN)
- **상세**:
  PR #517(`refactor-backlog-options`)이 아직 머지되지 않은 OPEN 상태로 다음 5개 spec 파일을 직접 수정한다:
  - `spec/1-data-model.md`: `embedding_llm_config_id` 행 삭제, `provider` 컬럼 서술 "Planned" 복원, `pending_plans` 추가
  - `spec/2-navigation/6-config.md`: frontmatter `code:` 경로 정리, §C.2 baseUrl 설명 단순화, R-4 rationale 절 삭제
  - `spec/5-system/7-llm-client.md`: rerank 프로바이더 표 `Dropped→Planned` 복원, `cohere baseUrl` 인자 제거, frontmatter `code:` 정리
  - `spec/5-system/8-embedding-pipeline.md`: `status: partial→implemented` 승격, `pending_plans` 삭제
  - `spec/2-navigation/5-knowledge-base.md`: `embedding_llm_config_id` 관련 행, `embedding-probe` 엔드포인트, `embedding-stats`/`retry-failed`/`search` 엔드포인트 행 삭제

  target plan 은 같은 5개 파일을 `consistency-check` 통과 후 동일 worktree(`unified-model-mgmt-5af7ee`)에서 개정할 예정이다. PR #517 이 머지되기 전에 target spec 개정을 진행하면 병렬 수정 경합(merge conflict 또는 의미 단절)이 발생한다.

  추가로 **의미 충돌**이 있다: PR #517 은 `spec/5-system/7-llm-client.md §2.1` 에서 `jina/voyage/local/builtin` 을 "Dropped" → "Planned" 로 복원했고, `spec/1-data-model.md §2.16.1` 의 `provider` 설명도 "Planned(후속)" 으로 갱신했다. 반면 target plan 변경 2(`spec/2-navigation/6-config.md`)의 Rerank 탭 설명은 provider 목록을 `tei/cohere` 로만 서술하며 이 복원을 반영하지 않는다. 두 변경이 그대로 적용되면 `6-config.md` 와 `7-llm-client.md` 가 서로 다른 provider 범위를 기술하게 된다.

- **제안**: PR #517 머지 완료 후 — 또는 PR #517 충돌 범위를 확인·정리한 뒤 — target spec 개정을 착수한다. 특히 `jina/voyage/local/builtin` provider "Planned" 복원 여부는 PR #517 과 통일된 결정을 먼저 합의해야 한다.

---

### [WARNING] kb-model-change-reembed-followup 의 "비용·UX 정책 미결" 이 target plan 의 Embedding 탭 차단 규칙과 잠재 간섭

- **target 위치**: 변경 2 §Part B Embedding 탭 — "KB가 이미 벡터를 가진 embedding config는 차원 변경 차단(재임베딩 가드)"
- **관련 plan**: `plan/in-progress/kb-model-change-reembed-followup.md` — "착수 전 project-planner spec 선갱신 필수(비용·UX 정책 결정 필요)" 미해소 상태
- **상세**:
  `kb-model-change-reembed-followup.md` 는 임베딩 모델 변경 시 정책을 세 선택지(자동 재임베딩 / 강제 확인 모달 / 경고 강화)로 열어 두고, "착수 전 project-planner spec 선갱신 필수" 를 명시하며 정책 결정을 대기 중이다.

  target plan 은 Embedding 탭에서 "차원 변경 차단(재임베딩 가드)" 을 이미 결정된 동작으로 기술한다. 이는 위 선택지 중 하나(선택지 1·2 어느 쪽도 아닌 "변경 자체를 차단") 에 해당하며, `kb-model-change-reembed-followup` 가 열어 둔 정책 결정의 일부를 사전에 내리는 격이다.

  현재 `spec/2-navigation/5-knowledge-base.md §2.2` 의 "모델 변경 경고" 는 `kb-unsearchable-warning` PR(#511) 에서 이미 구현·반영됐고 `kb-model-change-reembed-followup` 는 후속 미해소 정책만 남겨 있다. 따라서 "차원 변경 차단" 이 target plan 의 임베딩 config 화면(새 ModelConfig CRUD 화면) 수준의 UX 결정이라면 `kb-model-change-reembed-followup` 와 별개 범위라 봐도 무방할 수 있다 — 단, 두 plan 이 `spec/2-navigation/5-knowledge-base.md §2.2` 를 동시에 다루기 때문에 target spec 반영 시 `kb-model-change-reembed-followup` 의 정책 항목을 업데이트·해소하거나 범위를 명시적으로 분리해야 한다.

- **제안**: target plan 의 "차원 변경 차단" 동작이 `kb-model-change-reembed-followup` 에서 정의하는 정책 선택지 중 어느 쪽인지 명시하고, `kb-model-change-reembed-followup` 의 미결 범위를 target 적용 후 좁혀 재작성한다.

---

### [WARNING] rag-rerank-followup — RerankConfig 완결성 항목이 target plan 에서 무효화

- **target 위치**: 변경 1 `§2.16.1 (삭제) RerankConfig`, 변경 2 `§3 API` — `/api/rerank-configs` 를 deprecation alias 로 격하
- **관련 plan**: `plan/in-progress/rag-rerank-followup.md` — `spec/2-navigation/6-config.md` 에 `/api/rerank-configs` CRUD 절 추가(완료 `[x]`), `spec/5-system/1-auth.md §3.2` RerankConfig RBAC 행 추가(완료), `spec/1-data-model.md §2.16.1` title 정리(완료)
- **상세**:
  `rag-rerank-followup` 은 RerankConfig 를 독립 리소스로 spec 에 등재하는 작업을 완료 표시했다. target plan 은 RerankConfig 를 `ModelConfig(kind=rerank)` 로 흡수·삭제하고 `/api/rerank-configs` 를 deprecation alias 로 격하한다. 이로 인해:
  1. `spec/5-system/1-auth.md §3.2` 의 `rerank_config` RBAC 행은 `model_config(kind=rerank)` 로 갱신이 필요하다 (target 변경 범위에서 누락).
  2. `spec/1-data-model.md §2.16.1` 이 삭제되므로 해당 anchor 를 참조하는 링크가 끊긴다.
  3. `rag-rerank-followup` 의 "모든 surface 구현 시 `plan/complete/` 이동" 기준이 target 적용 후 변경되므로 plan 본문 갱신 필요.

- **제안**: target plan 변경 3 체크리스트에 `spec/5-system/1-auth.md §3.2` 의 RerankConfig → ModelConfig(kind=rerank) 갱신을 추가하고, `rag-rerank-followup` 비고 절의 완료 기준을 갱신한다.

---

### [WARNING] spec-sync-config-gaps — Plan 에 Part B+C 미구현 항목 교차 명시 필요

- **target 위치**: 변경 2 §Part B 전반, "영향 없음 확인" — "spec-sync-config-gaps.md 의 Auth gap 은 Part A 영역이라 비충돌"
- **관련 plan**: `plan/in-progress/spec-sync-config-gaps.md` (worktree `spec-sync-audit`, stale) — `spec/2-navigation/6-config.md` 전반 미구현 surface 추적
- **상세**:
  `spec-sync-config-gaps` 는 `spec/2-navigation/6-config.md` Part A(AuthConfig) 5건의 미구현 항목을 추적한다. target plan 의 "영향 없음" 확인은 올바르다 — 현재 미구현 항목 5건이 모두 Part A 이므로 실질 충돌은 없다. 그러나 `spec-sync-config-gaps` plan 이 과거 Part B+C 항목도 포함했을 수 있어 target 적용 후 Part B+C 관련 추적 항목이 잔류하면 혼란이 생길 수 있다.

- **제안**: target spec 반영 완료 후 `spec-sync-config-gaps.md` 를 재검토해 Part A 항목(5건)만 남기고 Part B+C 항목이 있으면 소멸 확인 후 정리한다.

---

### [INFO] migration-tooling-evaluation — Flyway V088+ 착수 전 Sqitch PoC 결과 확인 권장

- **target 위치**: 변경 1 마이그레이션 — V088~V092 Flyway 번호 계획
- **관련 plan**: `plan/in-progress/migration-tooling-evaluation.md` (worktree `migration-tooling-eval-1de449`, stale — PR MERGED), `plan/in-progress/sqitch-poc.md`
- **상세**: target plan 은 V088~V092 Flyway 마이그레이션을 계획한다. 현재 main 최신 마이그레이션은 V087 이므로 번호 자체는 올바르다. `migration-tooling-evaluation.md` 는 "평가/의사결정 단계, 규약 변경 없음" 명시로 현행 Flyway 사용에 영향 없음이 확인되며 해당 worktree 는 stale 이다. `sqitch-poc.md` 의 PoC 결과가 아직 미확정이라도 현재 Flyway 규약이 유효하므로 차단 이슈 없음.
- **제안**: 추가 조치 불요. V088 착수 전 `sqitch-poc.md` 결과를 참조해 도구 교체 여부를 최종 확인하면 충분.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

| worktree | branch | stale 판정 근거 |
|---|---|---|
| `rag-rerank-impl` | `claude/rag-rerank-impl` | Step 1 ACTIVE → Step 2 PR MERGED |
| `spec-sync-audit-998544` | `claude/spec-sync-audit-998544` | Step 1 ACTIVE → Step 2 PR MERGED |
| `rag-dynamic-cut-12fac1` | `claude/rag-dynamic-cut-12fac1` | Step 1 ACTIVE → Step 2 PR MERGED |
| `migration-tooling-eval-1de449` | `claude/migration-tooling-eval-1de449` | Step 1 ACTIVE → Step 2 PR MERGED |
| `trigger-schedule-sync-f88604` | `claude/trigger-schedule-sync-f88604` | Step 1 STALE (ancestor of main) |
| `plan-complete-ai-review-backlog-85f80a` | `claude/plan-complete-ai-review-backlog-85f80a` | Step 1 ACTIVE → Step 2 PR MERGED |
| `kb-lifecycle-groom-57cc46` | `claude/kb-lifecycle-groom-57cc46` | Step 1 ACTIVE → Step 2 PR MERGED |
| `kb-unsearchable-warning-b47e20` | `claude/kb-unsearchable-warning-b47e20` | Step 1 ACTIVE → Step 2 PR MERGED |

이 worktree 들은 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**active 로 처리된 worktree:**
- `refactor-backlog-options`: Step 1 ACTIVE → Step 2 PR **#517 OPEN** → active. CRITICAL 발견사항으로 처리.

---

## 요약

target plan `spec-draft-unified-model-management.md` 는 `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/2-navigation/5-knowledge-base.md` 5개 spec 파일을 동시에 개정하려 한다. 이 중 PR #517(`refactor-backlog-options`, OPEN)이 동일 5개 파일 모두를 이미 수정 중이어서 active worktree 충돌이 발생한다(CRITICAL). 특히 PR #517 은 target plan 이 `tei/cohere` 로만 기술하는 rerank provider 를 `jina/voyage/local/builtin` "Planned" 로 복원했고, `cohere baseUrl` 인자·`embedding_llm_config_id`·`embedding-probe` 엔드포인트 등도 삭제·단순화해 의미 충돌이 크다 — PR #517 머지 완료 후 target 작업이 그 결과를 베이스라인으로 삼아야 한다. 추가로 `rag-rerank-followup` 의 완료 항목 3건이 target 으로 인해 무효화되므로(WARNING) `spec/5-system/1-auth.md §3.2` RBAC 갱신이 변경 3 체크리스트에 누락됐다. `kb-model-change-reembed-followup` 의 정책 미결(WARNING)도 target 의 "차원 변경 차단" 기술과 범위 분리가 필요하다. worktree 충돌 후보 9건 중 stale 8건 skip, active 1건(`refactor-backlog-options`)이 CRITICAL 로 처리됐다.

## 위험도

HIGH
