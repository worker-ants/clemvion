# Plan 정합성 검토 결과

검토 대상: PR4b — KB 임베딩 legacy 컬럼 은퇴 + 에러코드 통일
plan: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md`
기준 plan 디렉터리: `plan/in-progress/**`

---

## 발견사항

### [WARNING] MODEL_CONFIG_NOT_FOUND HTTP 상태 — spec(404) vs PR4b 계획(400 유지) 불일치

- **target 위치**: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` §범위 2 에러코드 표 — `LLM_CONFIG_NOT_FOUND` → `MODEL_CONFIG_NOT_FOUND`, HTTP 400 유지
- **관련 spec**: `spec/5-system/3-error-handling.md §1.3` line 50 — `MODEL_CONFIG_NOT_FOUND` 는 HTTP **404** 로 정의됨 (`RESOURCE_NOT_FOUND` 의 ModelConfig 특화 코드)
- **상세**: PR4b 는 `llm.service.ts:356` 의 `LLM_CONFIG_NOT_FOUND` (현재 `BadRequestException`, HTTP 400) 를 `MODEL_CONFIG_NOT_FOUND` 로 리네임하되 HTTP 400 을 유지하겠다고 명시했다. 그러나 spec `3-error-handling.md §1.3` 은 `MODEL_CONFIG_NOT_FOUND` 를 이미 HTTP 404 로 등재하고 있고, `model-config.service.ts:94` 의 `notFound()` 메서드도 `NotFoundException`(404)을 사용한다. PR4b 가 그대로 진행하면 동일 에러 코드 `MODEL_CONFIG_NOT_FOUND` 가 한 path 에서는 400, 다른 path 에서는 404 를 반환하게 되어 spec 과 코드 내부 계약 모두 정합성이 파괴된다. (현재 model-config.service.ts line 121 도 `BadRequestException`으로 `MODEL_CONFIG_NOT_FOUND` 를 throw 하는 기존 불일치가 있으나, PR4b 에서 추가 emit 을 늘리면 문제가 심화된다.)
- **제안**: 구현 착수 전 아래 두 선택지 중 하나를 결정하고 spec 또는 plan 을 갱신해야 한다.
  - (a) `llm.service.ts` 경로를 `MODEL_CONFIG_NOT_FOUND` 로 리네임하고 `NotFoundException`(404) 로 승격 — spec 정의와 일치. `llm.service.ts` resolve 경로가 400 을 반환해야 하는 계약이 별도로 존재하는지 확인 필요.
  - (b) `llm.service.ts` 경로 전용 별도 코드명(예: `LLM_RESOLVE_FAILED`) 을 신설하고 spec 에 등재 — HTTP 400 유지 가능.
  - 어느 쪽이든 `spec/5-system/3-error-handling.md §1.3` 과 plan 의 에러코드 표를 일치시킨 뒤 구현한다.

---

### [WARNING] spec-update-pr2-embedding.md 미이동 — step-3 폴백 서술 충돌 위험

- **target 위치**: `plan/in-progress/spec-update-pr2-embedding.md` (worktree: `unified-model-mgmt-5af7ee`, PR #541 MERGED)
- **관련 plan**: 동 plan §제안 변경 2 — `spec/5-system/8-embedding-pipeline.md §5.5` 에 3단계 폴백 체인(legacy step-3 포함) 문서화 제안
- **상세**: `spec-update-pr2-embedding.md` 가 제안하는 `§5.5 임베딩 설정 해석 폴백 체인` 의 step-3 서술("legacy 폴백") 은 `spec/5-system/8-embedding-pipeline.md §5.5` 에 이미 반영되어 있다. 이 plan 은 사실상 완료 상태이므로 `plan/complete/` 로 이동해야 한다. 이동하지 않으면 PR4b 가 step-3 를 코드와 spec 양쪽에서 제거한 후 plan 의 해당 draft 가 "미적용" 상태처럼 남아 후속 작업자가 혼동할 수 있다.
- **제안**: `plan/in-progress/spec-update-pr2-embedding.md` 를 `plan/complete/` 로 이동 (project-planner 또는 resolution-applier 영역). PR4b 착수 전 정리 권장.

---

### [WARNING] spec-update-embedding-testconnection.md 미이동 — 동일 유형 orphaned plan

- **target 위치**: `plan/in-progress/spec-update-embedding-testconnection.md` (worktree: `fix-embedding-test-dimension-a3d42a`)
- **상세**: PR #548 ("fix(model-config): 임베딩 연결 테스트·모델 로드 회귀 + 차원 자동 감지") 가 2026-06-11 머지됐다. 이 plan 이 추적하는 worktree `fix-embedding-test-dimension-a3d42a` 는 물리적으로 존재하지 않으며(`.claude/worktrees/` 에 없음), 구현 완료로 보인다. plan 을 `plan/complete/` 로 이동해야 한다.
- **제안**: `plan/complete/` 로 이동. PR4b 의 spec 변경 위임(5-knowledge-base, 8-embedding-pipeline) 과 교차하지 않으므로 blocking 은 아님.

---

### [INFO] 마이그레이션 번호 append-only 확인 — V093/V094 안전

- **target 위치**: PR4b plan §범위 1 — V093(repoint), V094(DROP)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` — 구 V088 선점 표기를 V092 이후로 재부여한다는 주석 포함
- **상세**: PR #505 (`claude/impl-concurrency-cap-pr2b`) 가 MERGED 되어 현재 main 의 max 마이그레이션 버전은 V092 (`drop_rerank_config`) 임이 확인됐다. PR4b 의 V093/V094 는 append-only 원칙과 충돌 없다. `scripts/check-migration-versions.py --base origin/main` 통과 예상.

---

### [INFO] related_plan dead link — kb-model-change-reembed-followup

- **target 위치**: `plan/in-progress/unified-model-management-pr4b-kb-embedding-retire.md` frontmatter `related_plan:` — `plan/in-progress/kb-model-change-reembed-followup.md`
- **상세**: 해당 plan 은 2026-06-11 완료되어 `plan/complete/kb-model-change-reembed-followup.md` 로 이동된 상태다. frontmatter 경로가 stale 이지만 plan-frontmatter 테스트가 없으면 무해함. 다만 plan-coherence 도구가 dead link 를 false-positive CRITICAL 로 보고할 수 있으므로 수정 권장.
- **제안**: PR4b plan frontmatter `related_plan:` 의 해당 항목을 `plan/complete/kb-model-change-reembed-followup.md` 로 업데이트.

---

### [INFO] spec-update-pr2-embedding 의 §5.5 step-3 서술과 PR4b spec 위임 항목의 순서 주의

- **target 위치**: PR4b plan §범위 1 — "spec 갱신 (→ project-planner 위임): 5-system/8-embedding-pipeline.md 의 legacy step-3 서술 제거"
- **상세**: 현재 `spec/5-system/8-embedding-pipeline.md §5.5` 는 step-3 legacy 폴백을 명시하고 있고 마지막 줄에 "legacy 컬럼(embedding_llm_config_id·embedding_model)은 V092 에서 제거 예정" 이라고 서술한다(실제로는 PR4b 에서 제거). PR4b 구현 완료 후 project-planner 에게 spec 위임 시 이 §5.5 를 step-2 체인으로 축소하고 "V094 에서 제거 완료"로 갱신해야 한다. 별도 충돌은 아니나 spec 위임 범위 목록에 8-embedding-pipeline §5.5 가 명시되어 있는지 확인 필요 (plan 본문의 위임 항목 목록에는 포함되어 있음 — 정합).

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`) — Step 2 PR #541 MERGED. `spec-update-pr2-embedding.md` · `spec-draft-unified-model-management.md` 의 worktree. spec/1-data-model.md, spec/5-system/8-embedding-pipeline.md 등 PR4b 와 겹치는 spec 파일이 있으나 해당 worktree 는 stale 이므로 활성 경합 없음.
- `kb-quality-fba2f2` (branch `claude/kb-quality-fba2f2`) — Step 2 PR #457 MERGED. `knowledge-base-quality-improvements.md` worktree. stale.
- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — Step 1 ancestor 검사에서 STALE 확인 (origin/main 조상). 해당 worktree 는 마이그레이션 V090~V092 만 포함(공유 base). V093/V094 추가 없음.
- `impl-exec-concurrency-cap` (branch `claude/impl-concurrency-cap-pr2b`) — Step 2 PR #505 MERGED. `exec-intake-queue-impl.md` 가 "V092 이후로 재부여" 라고 주석한 migration 은 이미 merge 완료. V093/V094 충돌 없음.
- `fix-embedding-test-dimension-a3d42a` (orphaned) — 물리 worktree 미존재, PR #548 MERGED. `spec-update-embedding-testconnection.md` 의 worktree. stale.

worktree 충돌 후보 7건 중 stale 5건 skip, active 2건(`pr4b-kb-embedding-retire`, `errcode-wiring-92dc2c`) 분석.

`errcode-wiring-92dc2c` (branch `claude/errcode-wiring-92dc2c`) — Step 1 ACTIVE, Step 2 PR 없음 (Step 3 fallback: active 처리). 해당 worktree 는 `error-codes.ts`, `execution-failure-classifier.ts` 를 수정하나 `LLM_CONFIG_NOT_FOUND` / `MODEL_CONFIG_NOT_FOUND` 는 건드리지 않음. PR4b 와 동일 파일 수정 없음 — 경합 없음.

stale 5건: `./cleanup-worktree-all.sh --yes --force` 실행으로 `audit-sot-hygiene-8fc5f1` 의 물리 worktree 가 정리 대상일 수 있음. (`unified-model-mgmt-5af7ee`, `kb-quality-fba2f2`, `impl-exec-concurrency-cap`, `fix-embedding-test-dimension-a3d42a` 는 이미 `.claude/worktrees/` 에 없음.)

---

## 요약

PR4b plan 은 parent plan(`unified-model-management.md`) 과 전체적으로 정합하며, 마이그레이션 번호(V093/V094) · 비가역 DROP 단계화 · legacy 폴백 제거 범위 모두 상위 설계와 일치한다. V093 의 자연키 dedup 및 fail-loud RAISE 논리는 parent plan 의 "설계 검토 후 진행" 요구사항을 충족하는 방향이다. 다만 에러코드 리네임 영역에서 **WARNING 1건** 이 존재한다: `llm.service.ts` 의 `LLM_CONFIG_NOT_FOUND`(현 HTTP 400)를 `MODEL_CONFIG_NOT_FOUND` 로 리네임하되 400 을 유지하는 안이 spec(`3-error-handling.md §1.3`, HTTP 404 정의)과 직접 충돌한다. 이 결정은 구현 착수 전 HTTP status 를 확정하고 spec 또는 plan 에 반영해야 한다. 추가로 `spec-update-pr2-embedding.md` 등 stale worktree 의 orphaned plan 2건 이동이 권장된다. worktree 충돌 후보 7건 중 stale 5건 skip, active 2건 분석 — active 2건 간 실제 파일 경합 없음.

---

## 위험도

**MEDIUM**

(에러코드 HTTP status 결정 미확정 상태에서 구현 진행 시 spec 위반 발생. 확정 후 구현 시 LOW.)
