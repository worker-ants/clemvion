### 발견사항

- **[INFO]** `spec-drift-parallel-count.md` / `spec-drift-ws-button-config.md` 미해결 결정 — target 이 정식 결정을 내렸으나 source plan 이 여전히 `plan/in-progress/` 에 open 상태
  - target 위치: `plan/in-progress/spec-draft-spec-drift-resolve.md` — 변경 1 (결정 B) · 변경 2 (C2=A, C3=A)
  - 관련 plan: `plan/in-progress/spec-drift-parallel-count.md` §"해결 방향 (project-planner 결정 필요)" · `plan/in-progress/spec-drift-ws-button-config.md` §"해결 방향 (project-planner 결정 필요)"
  - 상세: 두 source plan 모두 "project-planner 결정 필요" 마킹으로 열려 있었고, target plan(owner: project-planner)이 해당 결정을 내렸다. target 의 Rationale("신규 정책이 아니라 기존 drift 해소")이 근거로 명시돼 있어 일방적 우회가 아니라 project-planner 의 정식 결정 권한 행사다. 다만 결정이 완료됐음에도 source plan 두 건이 `plan/in-progress/` 에 잔류해 추적 오염(중복 미결 신호) 우려가 있다.
  - 제안: target spec 변경이 main 에 머지되는 시점에 `spec-drift-parallel-count.md` · `spec-drift-ws-button-config.md` 두 파일을 `plan/complete/` 로 이동하거나, 각각의 "해결 방향" 섹션에 "결정 B 채택 — spec-draft-spec-drift-resolve PR 에서 해소" 를 기록하는 업데이트를 동반한다.

- **[WARNING]** `node-output-redesign/parallel.md` 의 진단이 target 변경으로 stale 됨
  - target 위치: `plan/in-progress/spec-draft-spec-drift-resolve.md` 변경 1 (결정 B)
  - 관련 plan: `plan/in-progress/node-output-redesign/parallel.md` 진단 항목 1 ("**`output.count` 제거됨** — spec §5.2 명시: 'P1.1 직교성 — `branches.length` 가 SSOT'. 적절") · 횡단 일관성 §7 항목 ("Parallel 만 `{branches}` (count 제거)")
  - 상세: `node-output-redesign/parallel.md` 가 2026-05-16 분석 기준으로 "count 제거 = 적절 (Principle 1.1 직교)" 라고 진단했다. target 의 결정 B가 main 에 적용된 이후 이 진단은 spec 현실과 역전된다 — 해당 plan을 보는 후속 개발자가 잘못된 사전 조건으로 진입할 위험이 있다. 또한 `node-output-redesign/parallel.md` §종합 개선안의 spec 보강 권고("`meta.durationMs` / `meta.branches` 추가")는 target 이 해소하지 않은 별도 잔여 항목이나, 이미 stale 된 진단과 같은 문서에 혼재돼 있어 혼선을 유발한다.
  - 제안: target 머지 후 `plan/in-progress/node-output-redesign/parallel.md` 의 "진단 항목 1" 과 "횡단 일관성 §7 Parallel count" 문단에 "(2026-06-03 spec-drift 결정 B 에 의해 count 복원됨 — stale)" 노트를 추가한다. `node-output-redesign` 의 미완료 spec 보강 권고(`meta.branches` 등)는 별도 추적 유지.

- **[INFO]** `plan-grooming-2ec306` worktree 의 `node-output-redesign/README.md` 수정과 target 의 parallel spec 변경 사이의 잠재 문서 비동기
  - target 위치: `plan/in-progress/spec-draft-spec-drift-resolve.md` 변경 1
  - 관련 plan: `plan-grooming-2ec306` 브랜치 — `plan/in-progress/node-output-redesign/README.md` 에 "5차 갱신" 노트 추가 중 (stale 항목 정정). 해당 브랜치가 `spec/4-nodes/1-logic/10-parallel.md` 를 직접 수정하지 않으므로 git 충돌은 없다. 단 README의 "5차 갱신" 노트가 count 관련 언급을 포함하지 않으므로 이 PR과 target spec PR 이 교차 머지되면 README 내용이 다시 stale 될 수 있다.
  - 제안: target 머지 이후 `node-output-redesign/README.md` 에 count 결정 반영 여부를 확인하면 충분. CRITICAL 수준 아님.

### Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검사 결과:

target plan 의 대상 spec 파일(`spec/4-nodes/1-logic/10-parallel.md`, `spec/5-system/6-websocket-protocol.md`)을 동시에 수정 중인 다른 active worktree 브랜치 후보를 조사한 결과:

- `spec-drift-parallel-count.md` — frontmatter `worktree: pending-assignment` (미배정). 충돌 후보 없음.
- `spec-drift-ws-button-config.md` — frontmatter `worktree: pending-assignment` (미배정). 충돌 후보 없음.
- `plan-grooming-2ec306` — 해당 브랜치는 `plan/in-progress/node-output-redesign/README.md` 만 수정하고 target spec 파일(`10-parallel.md`, `6-websocket-protocol.md`)을 건드리지 않는다. Step 1 ancestor 검사: ACTIVE (main 의 조상이 아님). Step 2 PR 검사: PR 미등록. git 충돌 없음 — spec 파일 비중복이므로 worktree 충돌 §5 대상에서 제외.

stale 판정 cascade 로 skip 한 worktree: **0건** (충돌 후보 자체가 없음).

### 요약

target plan(`spec-draft-spec-drift-resolve.md`)이 기술하는 두 가지 drift 해소(Parallel `count` 복원 결정 B, WS §4.4 `buttonConfig` 예시 정정 C2=A/C3=A)는 원 source plan 두 건(`spec-drift-parallel-count.md`, `spec-drift-ws-button-config.md`)이 "project-planner 결정 필요"로 열어둔 항목과 정합하는 정식 결정 행사로, 충돌이 아니다. owner 가 동일하게 project-planner 이고 Rationale 도 명시돼 있다. 다만 결정이 완료됐음에도 source plan 두 건이 `in-progress` 에 잔류하며, `node-output-redesign/parallel.md` 의 "count 제거 = 적절" 진단이 target 변경 이후 stale 된다는 WARNING 이 존재한다. active worktree 간 spec 파일 경합(§5)은 없으며 worktree 충돌 후보 7건 중 stale skip 0건, active 브랜치는 1건(`plan-grooming-2ec306`)이나 target spec 파일을 수정하지 않는다.

### 위험도

LOW
