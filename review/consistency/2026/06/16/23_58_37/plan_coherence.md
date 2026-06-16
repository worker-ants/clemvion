# Plan 정합성 검토 — spec/5-system/4-execution-engine.md

검토 모드: 구현 착수 전 검토 (--impl-prep)
Target: `spec/5-system/4-execution-engine.md`

---

## 발견사항

### [WARNING] pending_plans 에 이미 complete 로 이동된 plan 링크 잔존
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 2번째 항목
- 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md` (링크 대상)
- 상세: spec frontmatter 의 `pending_plans` 에 `plan/in-progress/spec-sync-execution-engine-gaps.md` 가 나열되어 있으나, 실제 해당 파일은 `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/plan/complete/spec-sync-execution-engine-gaps.md` 에 존재하고 `in-progress/` 에는 없다. 해당 plan 의 모든 추적 항목은 `exec-intake-queue-impl.md` 로 forwarding 됐으며 plan 자체는 complete 로 마킹된 상태다. spec-impl-evidence §3 에 따르면 `pending_plans:` 는 `in-progress/` 에 실존하는 파일만 가리켜야 한다. 이 dead-link 로 인해 spec-frontmatter 검증 테스트(`spec-frontmatter.test.ts` 의 `spec-pending-plan-existence` guard) 가 실패할 수 있다.
- 제안: target spec frontmatter 의 `pending_plans:` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 항목을 제거한다 (project-planner 영역 — spec 편집). 관련 미구현 surface 추적은 `plan/in-progress/exec-intake-queue-impl.md` 에 이미 이전됐으므로 정보 손실 없음.

### [INFO] exec-intake-queue-impl.md — PR2b(동시성 cap) 미해결 결정의 spec 미반영 영역
- target 위치: `spec/5-system/4-execution-engine.md §8` — 워크스페이스/워크플로 동시 실행 cap 표의 "Planned(PR2b)" 항목들
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR2b 항목 — `maxConcurrentExecutions` 키를 `Workspace.settings`/`Workflow.settings` JSONB 에 추가하는 결정이 "spec 추가 필요"(plan 내 항목 5)로 미해결 상태
- 상세: spec §8 표의 "워크스페이스당 동시 Execution 수 / 워크플로우당 동시 Execution 수" cap 행이 `Workspace.settings`/`Workflow.settings` 에서 읽는 것으로 기술되어 있으나, plan 은 이 설정 키(`maxConcurrentExecutions`)가 spec §2.2/§2.4 의 알려진 키 목록에 **미정의** 상태임을 명시하고 있다. target spec 이 이 키를 현재 정의하지 않은 상태에서 "Workspace.settings" 를 참조하면 spec 내부 불일치가 된다. PR2b 착수 전에는 이 미결 항목이 충돌을 일으키지 않으나, 착수 시 선행 spec 갱신이 필요하다.
- 제안: PR2b 착수 전 project-planner 가 `spec/2-navigation/` 또는 관련 data-model spec 에 `maxConcurrentExecutions` 설정 키를 등재한 후 `exec-intake-queue-impl.md` 의 항목 5를 체크한다. 현 시점은 관찰 메모로 충분하다.

### [INFO] exec-intake-queue-impl.md — PR3/PR4 미구현 표면과 target spec §7.1/§9.3 간 정합 (참고)
- target 위치: `spec/5-system/4-execution-engine.md §7.1` (stalled-job 재배달 "Planned"), §8 (동시성 cap "Planned")
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR3(크래시 재개) / PR4(stalled-job 일원화)
- 상세: spec 본문에 `§4` 배너 및 §7.1/§8 에 "Planned(PR2-4)" 표식이 남아있고 plan 에 PR3/PR4 가 미착수로 남아있다. 이는 spec 이 의도적으로 "미구현 aspirational" 임을 명시한 정상 상태이며 충돌이 아니다. 다만 이번 `--impl-prep` 검토 시점에 target spec 을 구현 대상으로 삼는 작업 범위가 이 미구현 영역을 건드린다면 선행 plan 의 결정을 따라야 한다.
- 제안: 현재 착수 전 검토이므로 참고 메모만 등록. 실제 §7.1/PR3/PR4 구현 착수 시 `exec-intake-queue-impl.md` 의 설계 결정(stalled-job dedup·waiting_for_input 제외·WORKER_HEARTBEAT_TIMEOUT 의미 재정의)을 준수한다.

---

## 요약

`spec/5-system/4-execution-engine.md` 와 `plan/in-progress/` 의 진행 중 4개 plan 간 정합성을 점검했다. 미해결 결정과의 일방적 충돌 또는 선행 plan 미해소 사항은 발견되지 않았다. 단, frontmatter `pending_plans:` 에 `plan/in-progress/spec-sync-execution-engine-gaps.md` 가 기재되어 있으나 해당 파일은 `plan/complete/` 로 이미 이동된 dead-link(WARNING)가 존재한다. 이는 spec-frontmatter 검증 가드를 위배할 수 있으므로 project-planner 가 해당 항목을 frontmatter 에서 제거해야 한다. 나머지 3개 plan(`execution-engine-residual-gaps.md`, `exec-intake-queue-impl.md`, `exec-park-durable-resume.md`)은 모두 target spec 의 약속·배너·Rationale 과 일관된다 — G1/G2 는 여전히 BLOCKED 로 spec §11 Phase 1 표식과 일치하며, PR2b 미착수·PR3/PR4 Planned 도 spec 내 "Planned" 표식과 정합한다. exec-park-durable-resume 의 모든 Phase A/B 항목은 완료로 체크됐고 target spec 의 §4.x/§7.4/§7.5 최종 모델과 일치한다.

## 위험도

LOW

---

STATUS: OK
