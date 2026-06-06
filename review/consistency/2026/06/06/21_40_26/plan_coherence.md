# Plan 정합성 검토 결과

## 발견사항

### [INFO] `kb-model-change-reembed-followup.md` plan 파일 미존재

- target 위치: target 문서 §Rationale 공통 — "범위 한정(경고 노출만): … 별도 follow-up(`plan/in-progress/kb-model-change-reembed-followup.md`)으로 분리"
- 관련 plan: 해당 파일이 `plan/in-progress/` 에 존재하지 않음. `plan/complete/` 에도 없음.
- 상세: target 문서는 "자동 재임베딩 트리거/저장 차단은 별도 follow-up" 으로 분리했다고 명시하나, 해당 plan 파일(`kb-model-change-reembed-followup.md`)이 실제로는 어디에도 생성되지 않았다. `spec-pending-plan-existence.test.ts` 가 이 참조를 검증하는 가드이므로, 실제 plan 파일 없이 spec 에 `pending_plans` 항목으로 등재할 경우 빌드 실패가 발생한다.
- 제안: target spec 을 실제로 작성할 때는 (a) `plan/in-progress/kb-model-change-reembed-followup.md` 를 함께 생성하거나, (b) Rationale 에서 follow-up 참조를 "향후 별도 plan 신설" 표현으로 완화해 `pending_plans:` 에는 등재하지 않는다.

---

### [INFO] `9-rag-search.md §4.2 skipReason` — target 추가가 이미 머지된 spec 내용과 단순 확장 (비충돌, 추적 권장)

- target 위치: target 문서 §변경 1 — §4.2 ragDiagnostics skipReason 확장(`kb_unsearchable` 추가)
- 관련 plan: `plan/in-progress/rag-dynamic-cut.md` (PR #500, 머지 완료 `adfb10de`)
- 상세: 현재 `9-rag-search.md §4.2` 의 `skipReason` 은 `empty_kb_list` / `no_results` 두 값을 열거한다(PR #500 에 의해 spec 에 반영됨). target 은 세 번째 값 `kb_unsearchable` 을 추가하는 것이므로 충돌이 아니라 단순 enum 확장이다. 그러나 rag-dynamic-cut plan 과 rag-rerank-followup plan 모두 `9-rag-search.md` 를 pending_plans 참조 대상으로 유지 중이어서, target 이 같은 spec 파일을 수정하면 해당 파일 frontmatter 의 `pending_plans:` 에 target 의 plan 파일도 추가해야 한다.
- 제안: target spec 작성 시 `9-rag-search.md` frontmatter `pending_plans:` 에 target plan 경로를 병기한다.

---

### [INFO] `9-rag-search.md §6 에러 처리 표` — rag-followup-efsearch PR #503 이미 §6 수정 완료 (비충돌)

- target 위치: target 문서 §변경 1 — §6 에러 처리 표 신규 행 추가
- 관련 plan: `plan/in-progress/rag-followup-efsearch.md` (PR #503, 머지 완료 `18edfea0`)
- 상세: `rag-followup-efsearch` plan 이 "9-rag-search §6" 을 수정 범위로 명시했으며 PR #503 으로 이미 머지됐다. 현재 `9-rag-search.md §6` 에는 리랭커·동적 컷 관련 행들이 추가된 상태다. target 이 추가하려는 "KB 검색 불가(embedding_dimension NULL)" 행은 기존 행들과 구분되는 새로운 케이스이므로 내용 충돌은 없다. 단, 해당 worktree 의 branch(`rag-followup-efsearch-b6c8e8`)가 plan frontmatter 에 남아 있으나 PR #503 으로 squash-merge 됐다 — stale worktree 항목(아래 §stale 목록 참조).
- 제안: 충돌 없음. target 이 §6 에 새 행을 삽입할 때 기존 행들(리랭커 오류 케이스, 동적 컷 케이스)과 순서 정합을 유지하면 된다.

---

### [WARNING] `5-knowledge-base.md` — status 가 `implemented` 인데 target 이 카드 UI 신규 기능 추가

- target 위치: target 문서 §변경 2 — §2.2.1 컬렉션 카드에 검색불가 경고 추가, §2.1 임베딩 상태 행 보강
- 관련 plan: `spec/2-navigation/5-knowledge-base.md` frontmatter `status: implemented`
- 상세: `5-knowledge-base.md` 는 현재 `status: implemented` 이다. target 이 §2.2.1 카드에 "재임베딩 중" / "재임베딩 필요·검색 불가" 경고 UI 를 추가하면 해당 spec 에 미구현 surface 가 생기므로 status 를 `partial` 로 낮추고 `pending_plans:` 에 target plan 경로를 등재해야 한다. 이 조치 없이 `implemented` 를 유지하면 `spec-status-lifecycle.test.ts` 가 미구현 코드 없이 implemented 를 선언한 것으로 볼 수 있어 정합성 위험이 있다. (코드는 변경 2 에서 "codebase 변경 없음, spec 한정" 이라고 명시했으나, 실제로 구현 PR 이 이어져야 UI 에서 경고가 표시됨 — 구현 plan 이 별도 생성될 것으로 보임.)
- 제안: target spec draft 적용 시 `5-knowledge-base.md` frontmatter 를 `status: partial` + `pending_plans: [plan/in-progress/spec-draft-kb-unsearchable-warning.md]` (또는 후속 구현 plan 경로) 로 갱신한다.

---

### [INFO] `8-embedding-pipeline.md` — status `implemented` 이나 cross-ref 추가만이므로 status 변경 불필요

- target 위치: target 문서 §변경 3 — §line 249 보강 (cross-ref 추가, idle+NULL 케이스 명시)
- 관련 plan: `spec/5-system/8-embedding-pipeline.md` frontmatter `status: implemented`
- 상세: 변경 3 은 기존 "자연스럽게 제외" 문구에 (a) idle+NULL 케이스 명시, (b) `not_searchable` 신호 cross-ref, (c) UI 카드 cross-ref 3줄을 추가하는 것으로, 신규 미구현 surface 를 만들지 않는다(기존 동작을 더 정확히 기술하는 것). status 변경이 불필요하다.
- 제안: 변경 3 은 현행 status 유지로 적용 가능.

---

### [INFO] `9-rag-search.md §2.2` — 기존 `grounding:"none"` 봉투와 동형 추가 (비충돌, 확장)

- target 위치: target 문서 §변경 1 — §2.2 KB tool 결과 포맷에 `status:"not_searchable"` 봉투 추가
- 관련 plan: `plan/in-progress/rag-dynamic-cut.md` / `plan/in-progress/rag-rerank-followup.md`
- 상세: PR #500(rag-dynamic-cut) 이 이미 `grounding:"none"` 봉투를 §2.2 에 추가했고 현재 main 에 반영돼 있다. target 이 추가하려는 `status:"not_searchable"` 봉투는 다른 케이스(embedding_dimension NULL)를 다루므로 충돌이 없다. `reason` 필드(`reembedding_in_progress` / `reembedding_required`)와 `note` 필드는 신규 키이므로 기존 소비자에게 additive 변경이다.
- 제안: 충돌 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `rag-dynamic-cut-12fac1` (branch `claude/rag-dynamic-cut-12fac1`) — Step 2 PR #500 MERGED. target 과 동일 spec 파일(`9-rag-search.md`) 접촉 후보였으나 stale 로 skip.
- `rag-followup-efsearch-b6c8e8` (branch `claude/rag-followup-efsearch-b6c8e8`) — Step 2 PR #503 MERGED. target 과 동일 spec 파일(`9-rag-search.md`) 접촉 후보였으나 stale 로 skip.
- `rag-rerank-impl` (branch `claude/rag-rerank-impl`) — Step 2 PR #465 MERGED. target 과 동일 spec 파일(`9-rag-search.md`, `5-knowledge-base.md`) 접촉 후보였으나 stale 로 skip.

worktree 물리 디렉터리는 모두 이미 정리된 상태 (`.claude/worktrees/` 에 `kb-unsearchable-warning-b47e20` 만 존재). plan frontmatter 에 남아있는 이 branch 명들은 plan 파일 자체를 `complete/` 로 이동하거나 frontmatter 를 sentinel 로 갱신하면 정리된다.

---

## 요약

target(`spec-draft-kb-unsearchable-warning.md`) 이 수정하는 세 spec 파일(`9-rag-search.md`, `5-knowledge-base.md`, `8-embedding-pipeline.md`) 중 worktree 충돌 후보는 3건이었으나 전부 PR #500·#503·#465 squash-merge 완료로 stale 판정되어 active 충돌은 0건이다. 미해결 결정과의 충돌도 없다. 주요 유의사항은 두 가지다: (1) Rationale 에서 언급한 `kb-model-change-reembed-followup.md` plan 파일이 아직 존재하지 않아 spec 에 `pending_plans:` 로 등재하면 빌드 가드 실패가 발생하므로 파일 생성 또는 참조 방식 조정이 필요하다, (2) `5-knowledge-base.md` 는 `status: implemented` 이므로 신규 미구현 UI surface(경고 카드)가 추가될 경우 `status: partial` + `pending_plans:` 갱신이 선행돼야 spec-lifecycle 가드를 통과한다. worktree 충돌 후보 3건 중 stale 3건 skip, active 0건 분석.

## 위험도

LOW

STATUS: SUCCESS
