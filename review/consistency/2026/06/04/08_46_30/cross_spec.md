# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
Target: `spec/conventions/spec-impl-evidence.md`
Diff base: `origin/main`

---

## 발견사항

### [WARNING] PROJECT.md 자동 가드 목록에 신규 가드 4건 미등재

- **target 위치**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts`, `spec-plan-completion.test.ts` 를 build 차단 가드로 규정
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/PROJECT.md §자동 가드 (build-time 차단)` (line 233~254)
- **상세**: `PROJECT.md §자동 가드` 목록은 `spec-frontmatter.test.ts`, `spec-code-paths.test.ts`, `spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts` 4건만 등재되어 있다. 이번 변경으로 `spec-impl-evidence.md §4.2` 에 추가된 4건(`spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts`, `spec-plan-completion.test.ts`)은 PROJECT.md 목록에 없다. `test_doc_sync_matrix.py` 의 `test_referenced_guard_tests_exist` 검증은 "PROJECT.md 에 이름이 나오는 guard 파일이 codebase/ 에 실존하는가"를 확인하지만, 역방향(새로 구현된 guard 가 PROJECT.md 에 등재됐는가)은 검증하지 않는다. 결과적으로 목록이 실제 가드 현황과 불일치하여 신규 개발자가 가드 전체를 파악하지 못할 수 있다.
- **제안**: `PROJECT.md §자동 가드 (build-time 차단)` 목록에 4건을 추가. `spec/conventions/spec-impl-evidence.md §6 Rollout 정책` step 4("PROJECT.md §자동 가드 표에 해당 row 추가")가 이미 이 의무를 선언하고 있으므로 누락된 단계 이행만 필요.

---

### [WARNING] `doc-sync-matrix.json` 에 신규 가드 미반영 (PROJECT.md matrix와 동기화 필요)

- **target 위치**: `spec/conventions/spec-impl-evidence.md §4.2` (신규 가드 4건 선언)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/.claude/config/doc-sync-matrix.json`, `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/.claude/tests/test_doc_sync_matrix.py`
- **상세**: `test_doc_sync_matrix.py` 의 `test_row_count_matches_project_md_table` 검증은 JSON rows 수와 PROJECT.md matrix 표의 행 수가 1:1 이어야 한다고 강제한다. PROJECT.md matrix 표에 신규 가드 4건을 추가하면 JSON 도 같이 늘려야 하고, JSON 의 `guard_tests` 필드에 실존 검증도 걸린다. 신규 guard 파일들(`spec-link-integrity.test.ts` 등)이 `codebase/` 에 생성되었으므로 `test_json_guard_tests_exist` 는 통과하나, 행 수 불일치(matrix 표 추가 없으면 JSON 행수 미증가)가 빌드 실패를 유발할 수 있다. 단, PROJECT.md 에 해당 가드가 추가되지 않은 현 상태에서는 이미 불일치가 잠재해 있음.
- **제안**: PROJECT.md §자동 가드 목록 추가와 동시에 `doc-sync-matrix.json` 에 해당 rows 를 추가. `spec-impl-evidence.md §6 Rollout 정책 step 4` 가 이 작업을 의무화하고 있으므로 이행 대상.

---

### [INFO] `spec/conventions/spec-impl-evidence.md` 자체의 frontmatter `code:` 에 신규 파일 4건 이미 등재 — 일관성 확인됨

- **target 위치**: `spec/conventions/spec-impl-evidence.md` frontmatter `code:` 목록 (line 5~15)
- **충돌 대상**: 없음
- **상세**: `spec-plan-completion.test.ts`, `spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts`, `spec-links.ts` 가 모두 frontmatter `code:` 에 등재되어 있어 `spec-code-paths.test.ts` 가드가 통과할 수 있는 상태다. spec 자기 자신의 frontmatter와 구현 파일 목록 사이에 충돌 없음.

---

### [INFO] Gate C cutoff `2026-06-04` — spec-impl-evidence, plan-lifecycle, 테스트 코드 3곳 동기화 확인 필요

- **target 위치**: `spec/conventions/spec-impl-evidence.md §R-8` — "cutoff 값은 spec-impl-evidence·plan-lifecycle·test 3곳에 동기 유지"
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/kb-quality-fba2f2/.claude/docs/plan-lifecycle.md §5 Gate C`, `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` (line: `const GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z")`)
- **상세**: spec-impl-evidence.md R-8 이 cutoff `2026-06-04`를 선언하고, plan-lifecycle.md §5 Gate C 가 동일값을 서술하며, 테스트 코드도 `2026-06-04T00:00:00Z` 로 정확히 일치. 현 상태에서는 3곳 동기화가 맞음. 향후 cutoff 를 변경할 때 3곳을 동시 갱신해야 함을 명시한 R-8 서술이 올바름. (경고 아님 — 현재 상태는 일치.)

---

### [INFO] `spec/conventions/` flat reference 영역 — spec-area-index 가드 면제 선언 일관성 확인됨

- **target 위치**: `spec/conventions/spec-impl-evidence.md §4.2` `spec-area-index.test.ts` 비고란 "카탈로그"
- **충돌 대상**: 구현 파일 `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` (line 196: `if (rel === "spec/conventions") continue;`)
- **상세**: `spec-impl-evidence.md §4.2` 표에서 `spec-area-index.test.ts` 의 예외로 "`spec/conventions/`(flat reference, 무-index), 카탈로그"를 명시했고, 구현 코드에서도 `if (rel === "spec/conventions") continue;` 로 정확히 면제 처리되어 spec 선언과 구현이 일치함.

---

## 요약

이번 구현(diff)은 `spec/conventions/spec-impl-evidence.md §4.2` 에 선언된 지식저장소·plan 무결성 가드 4건(`spec-link-integrity.test.ts`, `spec-area-index.test.ts`, `plan-frontmatter.test.ts`, `spec-plan-completion.test.ts`)과 공유 헬퍼 `spec-links.ts`를 신규 추가한 것으로, 데이터 모델·API 계약·RBAC 등 다른 영역 spec 과의 직접 모순은 없다. 단, spec-impl-evidence.md §6 Rollout 정책 step 4 에서 명시한 "PROJECT.md §자동 가드 표에 해당 row 추가" 의무가 아직 이행되지 않아, PROJECT.md 의 자동 가드 목록과 `doc-sync-matrix.json`이 신규 4건을 반영하지 않은 상태다. 이 두 곳이 동기화되지 않으면 `test_doc_sync_matrix.py` 의 행 수 검증이 향후 PROJECT.md 갱신 시 실패할 수 있고, 가드 현황을 보는 개발자가 4건을 놓칠 수 있다.

---

## 위험도

LOW
