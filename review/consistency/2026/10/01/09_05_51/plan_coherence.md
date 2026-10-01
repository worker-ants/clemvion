# Plan 정합성 검토 (--impl-done, scope=.claude/docs, diff-base=origin/main)

검토 기준은 HEAD 워킹트리 `/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d` 다. 프롬프트 번들의 diff(frontend 가드 5파일)만이 아니라 같은 브랜치의 하네스 변경(`guard_nerv_owned_paths.py`, `consistency_orchestrator.py`, `spec-link-checks.yml`, `PROJECT.md`, `CHANGELOG.md`)도 `git diff origin/main...HEAD` 로 직접 읽었다. scope(`.claude/docs`) 델타가 0개라는 사실은 근거로 쓰지 않았다.

전제 두 가지.
- 이 브랜치의 작업(NERV 정본 전환 단계 1)은 의도적으로 `plan/` 에 파일을 두지 않고 NERV Task(`CLE-T-VA4YA1` 외 12건)로 추적한다. `plan/in-progress/` 에 이 브랜치와 연결된 plan 이 없는 것(`worktree: nerv-cutover-*` 0건, `nerv` 언급 0건)은 결함으로 보지 않았다. 연결 plan 이 없으면 push gate 는 ad-hoc 작업으로 통과시킨다.
- 이 검토자는 NERV Task 본문을 읽지 못한다. 아래 WARNING 의 "Task 가 이미 덮고 있을 수 있다" 는 단서는 그 한계에서 나온다.

### 발견사항

- **[WARNING]** 옛 `spec/` 동결 훅이 막는 spec 편집 항목이 `plan/in-progress` 여러 곳에 열려 있는데 plan 쪽에는 동결 사실이 없다
  - target 위치: `.claude/hooks/guard_nerv_owned_paths.py` 의 `OWNED_ROOTS = {"spec": ...}` 와 `.claude/settings.json` 등록(Write|Edit|MultiEdit|NotebookEdit, main 과 워크트리 모두). `CHANGELOG.md` "옛 `spec/<영역>/` 트리는 그대로 두되 동결한다".
  - 관련 plan:
    - `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (`owner: project-planner`). 최상단 (a)/(b) 결정 후 `spec/conventions/node-cancellation.md` 외 7개 spec 을 고쳐야 하는 plan 이다. 열린 `[ ]` 중 `spec/5-system/6-websocket-protocol.md`(L524), `spec/3-workflow-editor/3-execution.md §4`(L535) 편집 항목이 있다.
    - `plan/in-progress/spec-draft-nullable-notation-followups.md`. `[ ]` 140건 중 53건이 `spec/` 을 언급한다. 예: L839 "(planner + 결정)", L1068 "(planner) `5-version-history.md` 이격 두 건".
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md`. L18 "`result.outputs` emit — 먼저 planner 턴에서 내용을 정의해야 한다".
  - 상세: 훅은 옛 `spec/<영역>/` 트리 전체의 도구 편집을 막는다. 위 plan 들의 남은 항목은 "옛 경로의 spec 을 planner 턴에서 직접 고친다" 를 전제로 쓰였다. 이제 그 경로로는 항목을 닫을 수 없고, NERV 에서 초안을 쓴 뒤 미러로 받아야 한다. 훅 안내문대로 옛 문서 하나가 여러 키로 나뉘었을 수 있어(`source_paths` 로 역추적) 항목이 가리키는 파일·절 번호가 그대로 대응하지 않는다. 단계 3(plan 제거)에서 plan 을 NERV Task 로 옮기는 작업이 있을 것으로 짐작되지만, 그 전까지 이 plan 들은 동결 사실을 모른 채 "미착수 spec 편집" 으로 남는다. 다음 세션이 이 항목을 집으면 훅 차단을 만나고 `BYPASS_NERV_OWNED_PATHS=1` 로 우회하고 싶어진다. 우회하면 옛 트리와 미러가 갈라진다.
  - 제안: (1) 단계 3 Task(`CLE-T-FN2JWK`)나 4d Task 가 "열린 spec 편집 항목이 있는 plan 의 NERV 이관" 을 이미 포함하는지 확인한다. 포함하면 각 plan 머리말에 한 줄(예: "2026-10-01 부터 옛 `spec/` 동결, 남은 spec 편집은 NERV 초안으로, 이관은 Task `CLE-T-FN2JWK`")만 달면 된다. 포함하지 않으면 그 Task 본문에 이 plan 목록을 추가한다. (2) 위 세 plan 외에도 `spec/` 편집 항목이 열린 plan 은 `grep -l '^\s*- \[ \].*spec/'` 로 전수 확인한다(이 검토는 상위 3건만 근거로 들었다).

- **[INFO]** 코퍼스에서 미러를 빼서 `spec_impact` 후보 미도달 항목의 처방 범위가 넓어진다
  - target 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `is_nerv_mirror` 와 `collect_context` 의 `all_spec_files` 필터.
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L287 "`--spec` 번들러가 `spec_impact` 대상을 후보 집합에 넣지 못한다 (하네스)" (처방 후보: 후보 선정이 `spec_impact` 를 무조건 포함). `plan/in-progress/harness-review-gate-followups.md` §O.
  - 상세: `--impl-done`/`--impl-prep` 의 target 은 scope 디렉터리에서 직접 모으므로 `spec/CLE-WF` 같은 미러 scope 를 줘도 target 은 읽힌다. 영향은 `related_specs`/`conventions` 코퍼스에만 있고, 오케스트레이터 주석이 이를 단계 4e(`CLE-T-VP5KDJ`)로 미뤘다. 다만 D3(구현할 때 클레임한 스펙만 미러로 받는다)대로 가면 앞으로 새 plan 의 `spec_impact` 는 `spec/CLE-*` 를 가리키게 되고, 그 파일은 4e 전까지 후보가 될 수 없다. 위 L287 항목의 처방("`spec_impact` 를 무조건 포함")을 구현하는 사람이 미러 제외 규칙과 부딪히는 것을 모를 수 있다.
  - 제안: L287 항목에 "미러 파일(`spec/CLE-*`)은 4e 전까지 `is_nerv_mirror` 로 코퍼스에서 제외된다. `spec_impact` 가 미러를 가리키면 처방이 이 제외와 어떻게 만나는지 4e 와 함께 정한다" 한 줄을 더하면 된다. 이 PR 에서 코드를 바꿀 일은 아니다.

- **[INFO]** 옛 SoT 와 NERV SoT 가 갈린 상태가 PROJECT.md 인용으로 굳는다
  - target 위치: `PROJECT.md` 의 `spec-link-integrity.test.ts`·`spec-area-index.test.ts` 행(미러 제외 서술을 더하고 "SoT: `spec/conventions/spec-impl-evidence.md §4.2`" 를 그대로 둠), 이 브랜치가 바꾼 frontend 파일 5개.
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` "SoT 표와 가드 서술 동기화" 계열(`spec-impl-evidence §4.2` 정정 항목 · L324 부근). `plan/in-progress/eia-context-schema-followups.md` L32(가드 확장 때 "§4.2 SoT 표 + test 주석 동기화").
  - 상세: 바뀐 가드 5개는 모두 `spec/conventions/spec-impl-evidence.md` 의 `code:` frontmatter 에 들어 있다. 그런데 그 옛 파일의 §4.2 표(L133-134)는 미러 제외를 서술하지 않는다(`grep -i 'mirror|미러|NERV'` 0건). 미러 제외는 NERV 쪽 `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md`(R-12 포함)에만 있다. 옛 파일은 훅 때문에 planner 도 고칠 수 없다. 결과적으로 PROJECT.md 는 옛 SoT 를 가리키는데 그 SoT 는 코드보다 한 걸음 뒤처진다. 이 저장소가 이 계열의 drift 를 여러 번 겪었다는 plan 기록(위 두 곳)이 있어 한 줄 추적을 권한다.
  - 제안: PROJECT.md 의 두 행에서 SoT 를 `CLE-ENG-SPECEVIDENCE`(미러 경로)로 병기하거나, 단계 4f(`CLE-T-RXMB2X`, 개별 가드) 본문에 "PROJECT.md 의 SoT 인용을 NERV 키로 바꾼다" 를 적는다. 단계 5(옛 트리 삭제) 전에 해소되지 않으면 그 인용은 죽은 링크가 된다.

- **[INFO]** 이 라운드의 scope(`.claude/docs`)가 바뀐 코드의 spec-linked 영역과 무관하다: `harness-review-gate-followups.md` §O 의 사례가 하나 더 생겼다
  - target 위치: 이 consistency 세션의 scope 지정(`--impl-done .claude/docs`, 델타 0).
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` §O "`--impl-prep`·`--impl-done` 이 `spec/` 최상위 파일을 scope 로 받지 못한다 — 무관한 폴더 + 보정 블록이 관례가 됐다", 그리고 그 안의 "게이트도 scope 를 보지 않는다" 절.
  - 상세: 바뀐 codebase 파일의 spec 은 `spec/conventions/spec-impl-evidence.md` 인데 scope 는 `.claude/docs` 로 줬다. 이 PR 에서는 옛 트리가 동결돼 `spec/conventions/` 를 scope 로 줘도 고칠 수 있는 것이 없고, 무관한 Critical 을 끌어올 위험(§O 가 실측한 두 건)만 남는다. 그래서 무관하지만 안전한 폴더를 고른 것으로 보인다. §O 가 말하는 "scope 를 보지 않는 Gate 2" 때문에 이 선택은 게이트에 걸리지 않는다. 동결 이후에는 이 형태가 일반화될 수 있다.
  - 제안: §O 의 "실측 비용" 아래에 "2026-10-01 NERV 전환 1: spec 이 동결돼 올바른 scope 가 없는 형태" 한 줄을 추가한다. 이 PR 안에서 처분할 일은 없다.

### 요약

이 브랜치는 미해결 결정을 일방적으로 내리거나 선행 plan 을 우회하지 않는다. 전환 계획의 결정 12개는 NERV Task 에 확정돼 있고, 이 브랜치의 변경(미러 도입, 편집 가드, 가드 제외 규칙, CI 잡)은 그 범위 안에 있다. `plan/in-progress/` 중 이 변경과 직접 겹치는 항목은 없다(frontend 문서 가드의 보강 항목이나 `harness-review-gate-followups.md` 의 미해결 항목을 이 PR 이 선점하거나 무효로 만든 것은 확인되지 않았다). 문제는 후속 항목 쪽이다. 옛 `spec/` 동결로 `spec-update-node-cancellation-shutdown-classification.md`, `spec-draft-nullable-notation-followups.md`, `spec-sync-external-interaction-api-gaps.md` 등의 열린 spec 편집 항목이 정상 경로로는 실행할 수 없게 됐는데 plan 쪽에는 그 사실이 없다(WARNING 1건). NERV Task(단계 3·4d)가 이관을 이미 다루고 있는지 확인하고 한 줄 표지를 다는 것으로 충분하다. 나머지 세 건은 4e·4f 와 §O 에 한 줄씩 남길 추적 메모다.

### 위험도

MEDIUM

STATUS=success ISSUES=4 PATH=/Volumes/project/private/clemvion/.claude/worktrees/nerv-cutover-1-69b98d/review/consistency/2026/10/01/09_05_51/plan_coherence.md
