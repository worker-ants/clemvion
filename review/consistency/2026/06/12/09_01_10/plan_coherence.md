# Plan 정합성 검토 결과

## 발견사항

### [WARNING] db-host-blocked-7df9f7 (PR #553 OPEN) 과 동일 파일 병렬 편집
- **target 위치**: `spec/5-system/3-error-handling.md §1.3` — `MODEL_CONFIG_DEFAULT_MISSING` 행 추가, `MODEL_CONFIG_NOT_FOUND` 설명 정정
- **관련 plan**: `plan/in-progress/http-ssrf-all-auth-followups.md` 계열의 `db-host-blocked-7df9f7` worktree (PR #553 OPEN)가 동일 파일 `spec/5-system/3-error-handling.md` 의 §3.1 Database 카테고리 행(`DB_HOST_BLOCKED` 추가)과 §3.2 요약 표를 수정 중
- **상세**: 양쪽이 수정하는 행(라인)은 다르다 — db-host-blocked 는 80번대 §3.1 Database 행, target 은 42~57번대 §1.3 MODEL_CONFIG 행. 의미 충돌은 없으나, 두 브랜치가 같은 파일을 동시에 편집 중이므로 merge 시 컨텍스트 충돌 가능성이 있다.
- **제안**: target PR 병합 순서를 db-host-blocked PR #553 완료 후로 조정하거나, 사전에 rebase 후 진행. 또는 merge 시 3-way merge 확인으로 충분.

### [WARNING] spec-update-pr2-embedding.md 플랜 라이프사이클 미정리 — target 과 기능 중복
- **target 위치**: target 플랜 전체 (§5.5 2-step 업데이트, 데이터모델 legacy 컬럼 갱신)
- **관련 plan**: `plan/in-progress/spec-update-pr2-embedding.md` (worktree: `unified-model-mgmt-5af7ee`, PR #541 MERGED — stale)
  - 해당 플랜은 `spec/5-system/8-embedding-pipeline.md §5.5` 의 3-step 서술을 draft 로 담고 있으며, "INFO-1 의 legacy 태그는 V092 PR4 에서 해당 컬럼 실제 제거 시 spec 에서도 삭제" 라고 명시해 target 플랜과 직접 연결됨
  - 그러나 플랜의 worktree PR #541 이 이미 머지됐고, §5.5 3-step 내용은 이미 main spec 에 반영된 상태이므로 이 플랜은 complete/ 로 이동돼야 하나 in-progress 에 잔류 중
- **상세**: target 이 §5.5 를 2-step 으로 갱신하는 작업은 정당하고 spec-update-pr2-embedding 의 draft 를 "supersede" 하는 관계다. 충돌이 아니라 후속 완성 작업이다. 그러나 spec-update-pr2-embedding.md 가 in-progress 에 남아있으면 다음 검토자에게 혼선을 줄 수 있다.
- **제안**: target 플랜 적용 완료 후 `spec-update-pr2-embedding.md` 를 `plan/complete/` 로 이동할 것 (target 이 pr2 spec-update 의 최종 단계를 완성하는 관계).

### [INFO] unified-model-management.md 의 PR4b 플랜명 불일치 (경미)
- **target 위치**: target 플랜 frontmatter `worktree: pr4b-kb-embedding-retire`
- **관련 plan**: `plan/in-progress/unified-model-management.md` 157번 행 — "별 plan `unified-model-management-pr4b-kb-embedding-retire.md` 신설 예정"
- **상세**: unified-model-management 가 예고한 플랜명(`unified-model-management-pr4b-kb-embedding-retire.md`) 과 실제 생성된 플랜명(`spec-update-pr4b-embedding-retire.md`) 이 다르다. 기능 범위는 동일하나 참조 링크가 깨질 수 있다.
- **제안**: `unified-model-management.md` 157번 행의 플랜명 예고를 실제 파일명으로 갱신하거나, target 플랜 도입부에 "unified-model-management §PR4b 후속" cross-ref 를 추가.

### [INFO] spec-draft-unified-model-management.md 플랜 라이프사이클 미정리
- **target 위치**: target 플랜과 직접 충돌 없음
- **관련 plan**: `plan/in-progress/spec-draft-unified-model-management.md` (worktree: `unified-model-mgmt-5af7ee`, PR #541 MERGED — stale)
  - PR #541 이 머지됐으나 플랜 파일이 in-progress 에 잔류 중
- **제안**: `plan/complete/` 로 이동 권장 (별도 작업, target PR 와 무관).

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`) — Step 1 ACTIVE (squash merge 로 commit hash 변경), Step 2 PR #541 MERGED. stale skip.
  - 대상 플랜: `plan/in-progress/spec-draft-unified-model-management.md`, `plan/in-progress/spec-update-pr2-embedding.md`
- `spec-errcode-catalog-a09758` (branch `claude/spec-errcode-catalog-a09758`) — Step 1 ACTIVE (squash), Step 2 PR #551 MERGED. stale skip.
  - 이 worktree 가 `spec/5-system/3-error-handling.md` 와 `spec/conventions/error-codes.md` 를 수정했으나 이미 main 에 반영됨.
- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — Step 1 ACTIVE (squash), Step 2 PR #552 MERGED. stale skip.
  - codebase 파일만 수정, target 플랜 spec 파일과 중복 없음.

worktree 충돌 후보 4건(unified-model-mgmt, spec-errcode-catalog, audit-sot-hygiene, db-host-blocked) 중 stale 3건 skip, active 1건(db-host-blocked, PR #553 OPEN) 분석.

활성 상태로 남은 stale worktree 들은 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target 플랜(`spec-update-pr4b-embedding-retire.md`)은 `plan/in-progress/unified-model-management.md` 가 명시적으로 예고한 PR4b 후속 spec 갱신이며, 미해결 결정을 일방적으로 우회하지 않는다. §7 "사용자 결정 (2026-06-12): 자사 전용 — 문서화로 충분" 은 unified-model-management 가 PR4 시점으로 이월한 Sunset 헤더/deprecation 정책을 사용자 명시 결정으로 정리한 것이라 적법하다. 주요 주의 사항은 db-host-blocked-7df9f7 worktree (PR #553 OPEN) 가 `spec/5-system/3-error-handling.md` 의 다른 섹션을 동시 편집 중이라는 점 — 라인 충돌은 없으나 merge 시 컨텍스트 충돌 가능성이 있어 WARNING 으로 분류한다. stale worktree 후보 3건 중 모두 squash merge 로 main 에 반영됐고 spec 변경도 이미 흡수된 상태다.

---

## 위험도

LOW
