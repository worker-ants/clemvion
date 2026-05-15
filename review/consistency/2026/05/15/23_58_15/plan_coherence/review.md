# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
worktree: `spec-pipeline-consistency-4c9e1f`
검토 일시: 2026-05-15

---

### 발견사항

- **[INFO]** `spec-update-embedding-pipeline-consistency.md` 의 모든 항목이 미체크 상태로 잔존
  - target 위치: target plan 배경 절 — "`plan/in-progress/spec-update-embedding-pipeline-consistency.md` 에 정의된 항목을 본 draft 로 흡수한다"
  - 관련 plan: `plan/in-progress/spec-update-embedding-pipeline-consistency.md` — Critical 1건 + Warning 7건 + Info 3건 모두 `[ ]` 미완료
  - 상세: target plan 이 parent plan 의 항목을 "흡수"해 처리하겠다고 선언하고 있으나, parent plan 의 체크박스는 아직 하나도 완료 처리되지 않았다. 의미상 충돌은 아니지만, target plan 의 검토 후 단계에 "parent plan 항목 `[x]` 처리 후 `git mv plan/complete/`" 가 포함되어 있으므로 현 단계에서는 추적 메모 수준. parent plan 의 `worktree` 필드가 `cleanup-script-prod-a3f81c` 를 가리키는데 해당 worktree 는 이미 PR #40 머지 후 삭제된 상태로, frontmatter 갱신이 필요하다.
  - 제안: target plan 의 검토 후 단계 완료 시 `spec-update-embedding-pipeline-consistency.md` 체크박스를 일괄 완료 처리하고 `git mv plan/complete/` 로 이동. 현 시점에서는 parent plan 의 `worktree` 필드를 `spec-pipeline-consistency-4c9e1f` 또는 `(completed)` 로 갱신하는 것을 권장.

- **[INFO]** `kb-graph-stats-dead-path.md` 후속 plan 이 아직 미생성
  - target 위치: "후속 plan (별도 분리 필요)" 절 — "`plan/in-progress/kb-graph-stats-dead-path.md` 로 분리해 dev 위임"
  - 관련 plan: 없음 (아직 미생성)
  - 상세: target plan 이 dead path (`kb-stats.helper.ts:42-46` 의 `kb:graph_stats_updated` emit) 를 spec 에서 제거하지만, 코드 측 결함 처리를 위한 후속 plan 은 아직 생성되지 않았다. target plan 의 검토 후 단계 체크박스(`[ ] plan/in-progress/kb-graph-stats-dead-path.md 신규 plan 생성`)가 미완인 것과 일치하며 충돌은 아니다. 단, spec 에서 `kb:graph_stats_updated` 를 삭제하면 해당 이벤트를 복원하는 방향으로 결정이 바뀔 경우 spec 변경을 reverse 해야 한다는 종속 관계가 plan 에만 명시되고 후속 plan 파일에 기록되지 않아 추적이 어렵다.
  - 제안: target plan 의 "후속 plan" 절에 "후속 plan 의 결정에 따라 본 PR 의 spec 변경(10-graph-rag.md, 2-navigation/5-knowledge-base.md 의 `kb:graph_stats_updated` 제거)을 reverse 할 수 있음"을 명시. 후속 plan 생성 시 이 의존 관계를 frontmatter 또는 배경 절에 기재할 것.

- **[INFO]** `spec/1-data-model.md §2.12.1` 변경과 `cafe24-data-model-strengthen.md` 의 완료된 변경 간 섹션 구분 명확
  - target 위치: 변경 대상 spec 문서 §4 — `spec/1-data-model.md §2.12.1 DocumentChunk 인덱스` 변경
  - 관련 plan: `plan/in-progress/cafe24-data-model-strengthen.md` — `spec/1-data-model.md §2.10` 과 `§3` 을 완료 처리(`[x]`)
  - 상세: `cafe24-data-model-strengthen.md` 는 `spec/1-data-model.md §2.10` (Integration 테이블 필드) 과 `§3` (인덱스 표 V045)을 이미 변경 완료했다. target plan 은 동일 파일의 `§2.12.1` (DocumentChunk 인덱스) 만 건드리므로 섹션이 겹치지 않는다. 두 plan 이 동시에 `spec/1-data-model.md` 에 쓰기를 시도하는 worktree 경합 가능성이 있으나, `cafe24-data-model-strengthen.md` 의 spec 변경은 이미 완료(`[x]`) 상태이고 해당 변경이 main 에 merge 되었는지 확인이 필요하다.
  - 제안: `cafe24-data-model-strengthen.md` 의 spec 변경이 PR merge 완료 상태라면 경합 없음. merge 전이라면 target plan 의 PR 생성 전에 `cafe24-data-model-strengthen.md` 의 spec 변경 PR 이 먼저 merge 되어야 한다는 직렬화 조건을 target plan 에 명시할 것.

### 요약

target plan (`spec-draft-embedding-pipeline-consistency.md`) 은 `spec-update-embedding-pipeline-consistency.md` 가 미해결로 남긴 Critical/Warning 항목을 체계적으로 흡수하는 구조로 작성되어 있으며, 미해결 결정을 무단으로 우회하거나 다른 plan 의 영역을 침범하는 CRITICAL·WARNING 수준의 충돌은 발견되지 않았다. 6개 대상 spec 파일은 현재 활성 worktree 중 어느 것도 동시에 수정하고 있지 않다. 다만 세 가지 INFO 사항 — (1) parent plan 의 worktree frontmatter 갱신 필요, (2) dead path 후속 plan 의 spec-reverse 종속 관계 명시 부재, (3) `spec/1-data-model.md` 를 변경하는 cafe24-data-model-strengthen 의 merge 선행 여부 확인 — 은 추적 기록으로 남겨두는 것이 안전하다.

### 위험도

LOW
