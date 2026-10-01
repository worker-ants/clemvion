# Plan 정합성 검토 (impl-done, scope=.claude/docs, diff-base=origin/main)

## 발견사항

- **[WARNING]** spec/ 동결 훅이 plan 완료 이동의 인입 참조 갱신 규칙과 부딪힌다
  - target 위치: `.claude/docs/plan-lifecycle.md` §3 "인입 참조" · §4 `pending_plans` 표 · §5 Gate C (이 브랜치에서 델타 0). 관련 코드는 `.claude/hooks/guard_nerv_owned_paths.py` (`OWNED_ROOTS = {"spec": ...}`)
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` · `execution-engine-residual-gaps.md` · `retry-turn-terminal-guard.md` · `update-returning-tuple-shape.md` · `spec-sync-external-interaction-api-gaps.md` 등. 옛 트리 spec 22개가 `pending_plans` 로 in-progress plan 을 가리키고 본문에도 `plan/in-progress/...` 링크가 있다(예: `spec/5-system/1-auth.md:119`, `spec/5-system/4-execution-engine.md:63,438,1154`)
  - 상세: 훅은 `spec/` 아래 모든 경로를 막는다. 새 미러(`CLE-*`)만이 아니라 "동결"한 옛 `spec/<영역>/` 트리도 막는다. 그런데 plan-lifecycle §3 은 plan 을 `complete/` 로 옮길 때 `spec/` 등 살아있는 문서의 plan 링크를 같은 커밋에서 갱신하라고 한다. 옛 트리 spec 본문의 `../../plan/in-progress/x.md` 링크는 plan 이 옮겨지면 죽고 `spec-link-integrity` scope 1 이 RED 가 된다. 이 링크를 고치려면 훅을 막는 `spec/` 편집이 필요하다. (`pending_plans` 경로는 `spec-pending-plan-existence` 가 complete/ 쌍둥이로 해소하므로 그쪽은 RED 가 아니다.) 훅 docstring 은 "거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때 더한다 — 먼저 막으면 문서가 시키는 일을 훅이 막는다" 고 적었다. 이 브랜치는 `spec/` 을 단계 1 에서 먼저 막았고 `CLAUDE.md`·`.claude/docs/plan-lifecycle.md`·`project-planner/SKILL.md` 는 그대로 `spec/` 쓰기를 안내한다(`NERV` 언급은 `.claude/docs/worktree-policy.md` 뿐이다). 스스로 세운 순서 원칙과 어긋난다.
  - 제안: 다음 중 하나를 정한다. (a) plan-lifecycle §3 에 "옛 `spec/` 트리 동결 이후 plan 이동 시 인입 링크는 어떻게 갱신하는가(예: `BYPASS_NERV_OWNED_PATHS=1` 로 링크만 정정, 또는 NERV 경로)" 를 한 줄 명시한다. (b) 단계 1 에서는 신규 미러(`spec/CLE-*`·`spec/README.md`)만 막고 옛 트리는 거버넌스 문서 개정(NERV 단계 4) 때 막는다. 어느 쪽이든 거버넌스 문서 개정은 project-planner 턴이다.

- **[WARNING]** 옛 트리 spec 편집이 남은 in-progress plan 항목에 새 경로 안내가 없다
  - target 위치: 이 브랜치 전체 (`spec/` 동결). `plan/**` 델타 0
  - 관련 plan: `spec-update-node-cancellation-shutdown-classification.md` (51·54·57·524·535·604·607행, `spec/5-system/6-websocket-protocol.md`·`spec/3-workflow-editor/3-execution.md` 등 반영), `spec-draft-eia-notification-payload-contract.md:191` ("planner 턴 선행 필요"), `webchat-command-failure-is-not-termination.md:73-75` (결정 후 `spec/7-channel-web-chat/*` 반영 + `--spec` 통과), `webchat-spec-rationale-followup.md:49·103`, `ai-agent-tool-connection-rewrite.md:56-72` (spec 10곳 갱신), `spec-draft-nullable-notation-followups.md` (2147·4970·5727·5823·6185·6426·6541행 등 planner 트랙 spec 정정)
  - 상세: 위 항목은 모두 옛 `spec/<영역>/` 파일을 planner 가 고치는 것을 전제로 한다. 지금은 Write/Edit 이 훅에서 막히고 `/consistency-check --spec` 도 미러가 코퍼스에서 빠진 옛 트리만 본다. plan 어디에도 "이 항목은 NERV 스펙 편집(`/nerv:spec edit`)으로 옮겨 가는가, 옛 트리를 우회 편집하는가" 가 적혀 있지 않다. 미해결 결정은 아니지만 후속 항목이 실행 불가가 된 사실이 plan 에 반영되지 않았다.
  - 제안: 해당 plan 마다(또는 한 곳에 모아) "옛 spec 트리 동결 — 이 항목은 NERV Task `CLE-T-…` 로 이관 / 미러 반영 대기" 를 표시한다. 이관 방침은 NERV 단계 3(plan 제거) Task 의 범위로 명시해 두면 된다.

- **[INFO]** 전환 작업이 NERV Task 로만 추적되고 저장소에 되돌아오는 포인터가 없다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`NERV_MIRROR` 주석 "옛 트리는 NERV 전환 단계 5 에서 지운다"), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` (`is_nerv_mirror`, "코퍼스를 미러로 옮기는 일은 단계 4e 다")
  - 관련 plan: `plan/in-progress/**` 에 NERV 전환 항목 없음 (`grep -ril nerv plan` 0건). 이는 "plan/ 에 새 파일을 만들지 않고 NERV Task 12건으로 추적" 한다는 기존 결정과 일치한다
  - 상세: 두 코드 자리는 임시 골격이다. 단계 5 에서 옛 트리가 사라지면 `spec-link-integrity` scope 1 과 `spec-area-index` 는 대상이 0개가 되고 새 테스트 `excludes the NERV spec mirror from scope` 의 `spec/5-system/1-auth.md` 단언은 의도적으로 RED 가 된다. 이 회수 조건이 NERV 쪽에만 있다. 저장소를 읽는 사람은 주석의 "단계 5"·"단계 4e" 가 어느 Task 인지 알 수 없다.
  - 제안: 주석에 Task ID(`CLE-T-7M4C4X` 단계 5, `CLE-T-…` 4e)를 적고 단계 5 done 조건에 "`inNervMirror`·`is_nerv_mirror` 제거 또는 재조정, 위 테스트의 옛 트리 단언 교체" 를 넣는다.

- **[INFO]** 번들 절단 백로그 항목의 측정 기준선을 명시해 둘 만하다
  - target 위치: `consistency_orchestrator.py` `collect_context` 의 `all_spec_files` 필터
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:4301`(387개 `@bundle-file` 중 380개 생략), `:4640`(`spec_impact` 의 `spec/conventions/*` 누락), `harness-review-gate-followups.md` "승격은 됐는데 굶는다" 절
  - 상세: 미러(169편 + README)를 코퍼스에서 뺐으므로 위 항목의 수치 기준선은 그대로다. 문제는 없다. 다만 단계 4e 에서 코퍼스를 미러로 옮기면 파일 수·크기 분포가 바뀌어 이 항목들의 측정이 다시 유효한지 다뤄야 한다. 지금 plan 에 그 연결이 없다.
  - 제안: 4e Task 본문이나 위 두 plan 항목에 "코퍼스 이전 시 재측정" 한 줄을 남긴다.

## 요약

구현 diff(`spec-links.ts`·`spec-link-integrity.test.ts`)는 미러를 옛 트리 링크 가드에서 빼는 국소 변경이고 plan 의 미해결 결정과 직접 충돌하지 않는다. 링크 가드 통합층 보강 등 열린 harness plan 항목(`spec-links.test.ts` 대상)도 건드리지 않는다. `.claude/docs` 델타는 0이다. 문제는 브랜치 전체가 `spec/` 을 훅으로 먼저 막았는데 plan 쪽 후속이 반영되지 않은 점이다. plan 완료 이동 시 인입 링크 갱신 규칙과 옛 트리 spec 편집을 전제한 열린 항목 다수가 새 제약 아래서 실행 경로가 불명확하다. 이 브랜치에 연결된 in-progress plan(`worktree` 매칭)은 없어 plan push gate 는 걸리지 않는다. 결정 합의가 선행돼야 하는 CRITICAL 은 없고 plan·거버넌스 문서 갱신이 필요한 WARNING 2건과 추적 메모 INFO 2건이다.

## 위험도

MEDIUM
