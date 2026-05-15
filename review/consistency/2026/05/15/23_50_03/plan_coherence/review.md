# Plan 정합성 검토 — spec-draft-embedding-pipeline-consistency.md

검토 대상: `plan/in-progress/spec-draft-embedding-pipeline-consistency.md`
worktree: `spec-pipeline-consistency-4c9e1f`
검토 일시: 2026-05-15

---

### 발견사항

- **[INFO]** 선행 plan 의 `scope: 'all'` 결정 항목을 target 이 자체 해소
  - target 위치: §변경 대상 spec 문서 > 1. `8-embedding-pipeline.md` §9.4 행, §3. `5-knowledge-base.md` §2.4.1 행
  - 관련 plan: `plan/in-progress/spec-update-embedding-pipeline-consistency.md` Warning 항목 "§9.4 `retry-failed` API 의 `scope` 허용값 — `'all'` 포함 여부 결정 후 `5-knowledge-base.md §2.4.1` 과 동기화"
  - 상세: 선행 plan 은 `scope: 'all'` 포함 여부를 열린 결정(open decision)으로 명시했다. target 은 백엔드 구현 확인 결과 `'all'` 이 이미 spec(`8-embedding-pipeline.md §9.4`) 에 정의되어 있고 `5-knowledge-base.md §2.4.1` 은 UI 전송값(`'embedding'|'graph'`)만 기술하므로, `'all'` 을 "운영/스크립트용"으로 유지하되 footnote 로 목적을 명시하는 방향으로 결정을 내린다. 이 결정은 코드 권위(기존 spec 본문 포함)에 근거해 도출된 것으로, 임의 우회가 아니라 기존 spec 의 표기를 존중하면서 동기화하는 방향이다. 다만 선행 plan 이 "결정 후 동기화" 라고 명시했으므로, 선행 plan 체크박스를 완료 처리하는 절차가 target plan 의 "검토 후 단계 3"에 포함되어 있는지 확인이 필요하다. 현재 단계 3은 "spec-update-embedding-pipeline-consistency.md 갱신 (모든 항목 체크 → complete/ 이동)"으로 명시되어 있어 절차상 문제는 없다.
  - 제안: 현 상태 유지. 단, "검토 후 단계 3" 수행 시 `scope` 결정 내용을 선행 plan 의 해당 체크박스 옆에 한 줄 기재 후 체크하면 추적이 완결된다.

- **[INFO]** dead path(`kb:graph_stats_updated`) 처리 plan 이 생성되지 않은 상태로 후속 위임
  - target 위치: §후속 항목 (별도 plan/dev 위임) — "dead path 처리"
  - 관련 plan: 현재 `plan/in-progress/` 에 `kb:graph_stats_updated` dead path 를 추적하는 별도 plan 파일 없음.
  - 상세: target 은 `kb-stats.helper.ts:42-46` 의 잘못된 채널 broadcast 를 "코드 측 결함은 후속 plan 분리"로 명시했다. 그러나 실제로 후속 plan 이 생성되지 않은 채 "developer 결정 사항"으로만 적혀 있다. spec 정비 후 이 dead path 가 어느 plan 에서 처리될지 추적이 불가한 상태다.
  - 제안: "검토 후 단계 4" 또는 PR description 에 dead path 처리를 위한 신규 plan 파일 생성 또는 `background-monitoring-api.md`·`0-unimplemented-overview.md` 같은 기존 plan 에 항목 추가를 명시한다. 현재는 추적 메모 수준으로 WARNING 미만이나, spec 에서 `kb:graph_stats_updated` 를 제거한 뒤 코드 결함이 방치되면 코드-spec 간 새 불일치가 발생한다.

- **[INFO]** `spec-update-embedding-pipeline-consistency.md` 의 worktree 가 이미 완료된 worktree(`cleanup-script-prod-a3f81c`)를 가리킴
  - target 위치: target plan 의 배경 — "plan/in-progress/spec-update-embedding-pipeline-consistency.md 에 정의된 항목 ... 을 본 draft 로 흡수한다"
  - 관련 plan: `plan/in-progress/spec-update-embedding-pipeline-consistency.md` frontmatter `worktree: cleanup-script-prod-a3f81c`
  - 상세: `cleanup-script-prod-a3f81c` worktree 의 PR #40 은 이미 머지됐다(`plan/complete/cleanup-script-prod.md` 존재 확인). 선행 plan 문서는 해당 worktree 가 없어진 후에도 `plan/in-progress/` 에 잔존하고 있다. target 이 이를 흡수해 처리하는 구조는 정당하나, 선행 plan 의 `worktree` 필드가 더 이상 유효하지 않으므로 혼동 가능성이 있다.
  - 제안: target plan 의 "검토 후 단계 3"에서 선행 plan 을 `complete/` 로 이동할 때, frontmatter 의 `worktree` 필드에 "(merged PR #40, 본 plan 은 spec-pipeline-consistency-4c9e1f 에서 흡수 처리)" 메모를 추가하면 이력 추적이 명확해진다.

---

### 요약

target plan(`spec-draft-embedding-pipeline-consistency.md`)은 선행 plan(`spec-update-embedding-pipeline-consistency.md`)에서 위임받은 모든 항목을 명시적으로 흡수하며, 코드 권위에 근거해 미해결 결정을 자체 해소하고 있다. 4개 spec 파일(`8-embedding-pipeline.md`, `6-websocket-protocol.md`, `5-knowledge-base.md`, `1-data-model.md`)에 대해 현재 활성 worktree 중 동일 파일을 수정 중인 다른 worktree 는 없어 직접적인 worktree 충돌은 없다(`cafe24-data-model-strengthen.md` 가 `spec/1-data-model.md` §2.10/§3 을 수정했으나 이는 이미 커밋된 사항이며 target 이 다루는 §2.12.1 과 섹션이 겹치지 않는다). `scope: 'all'` 결정은 선행 plan 의 "결정 후 동기화" 요건을 충족하는 방식으로 처리되었고, 완료 절차도 단계 3에 포함되어 있다. 후속 위임 항목(dead path)에 대한 plan 생성 누락이 잠재 추적 공백으로 남아 있으나 CRITICAL·WARNING 수준은 아니다.

### 위험도

LOW
