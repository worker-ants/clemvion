# Plan 정합성 검토 결과

검토 모드: `--impl-prep`  
Target: `spec/5-system/4-execution-engine.md`  
기준 worktree: `claude/llm-error-passthrough-79d0fe` (origin/main 기반, clean)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `pending_plans` 에 이미 `plan/complete/` 로 이동한 plan 파일이 등재됨
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` line 11
  - 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md` (파일이 `plan/complete/spec-sync-execution-engine-gaps.md` 로 이동됨)
  - 상세: frontmatter 의 `pending_plans:` 항목 `plan/in-progress/spec-sync-execution-engine-gaps.md` 가 실제로는 `plan/complete/` 에 존재하고 `plan/in-progress/` 에는 없다. spec-lifecycle 규약상 complete 이동 후 frontmatter `pending_plans:` 에서 해당 항목을 제거해야 spec `status: partial` 의 근거 목록이 정확해진다. `spec-impl-evidence.md §3 (c)` 가드는 `pending_plans` 가 모두 해소될 때 `status: implemented` 승격을 허용하는데, dead 링크가 남아 있으면 승격 조건 판정이 부정확해진다.
  - 제안: `spec/5-system/4-execution-engine.md` frontmatter 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 행을 제거한다 (project-planner 영역).

### 발견사항 2

- **[INFO]** `exec-park-durable-resume.md` 의 "umbrella 잔여" 항목이 미해소이며 target spec §7.1/§7.3/§8.x 와 연계된 구현 갭이 존재함
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 (stalled-job 재배달 — "구현 상태: 미구현"), §8 (동시성 cap — "Planned PR2b")
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` 마지막 항목 "umbrella 잔여 (분리)": PR3 rehydration 일반화(ai_agent → 일반 노드) 미구현, `node-cancellation-infrastructure.md §2` 미착수
  - 상세: target spec 의 §4 배너 / §7.1 / §8 / §9.3 은 여전히 "Planned" 미구현 표면을 포함하고, 이를 추적하는 `exec-park-durable-resume.md` 와 `exec-intake-queue-impl.md` 가 `in-progress` 에 유효하게 등재돼 있다. 이는 올바른 상태이며 충돌이 아니다. 단, `llm-error-passthrough` 구현이 §7.5.2 (`typed ExecutionError` / continuation ack 에러 표면)에 작업할 경우, `exec-park-durable-resume.md` 의 잔여 PR3(rehydration 일반화)와 코드 표면이 겹칠 수 있다. 현재로서는 §7.5.2 는 continuation 핸들러의 ack 에러 변환 레이어이고 PR3 는 rehydration 경로 확장이라 직접 충돌은 없으나, 두 작업 모두 `execution-engine.service.ts` / `continuation-bus.service.ts` 를 수정할 경우 merge-coordinate 가 필요하다.
  - 제안: `llm-error-passthrough` plan 착수 시 `exec-park-durable-resume.md` 의 잔여 PR3(rehydration)와 코드 파일 겹침이 없는지 확인하는 주석을 plan 에 포함한다. 현 단계에서 spec 또는 plan 수정 필요 없음.

### 발견사항 3

- **[INFO]** `execution-engine-residual-gaps.md` G1 / G2 BLOCKED 상태와 target spec §11 ("WS `execution.start` graceful-shutdown gate" / "errorPolicy `continue` 분기") 미구현 표면은 `llm-error-passthrough` 범위(`§7.5.2`)와 직교함
  - target 위치: `spec/5-system/4-execution-engine.md` §11 items 1 (WS gate), 4 (errorPolicy continue)
  - 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md` G1 / G2
  - 상세: G1/G2 는 graceful shutdown 관련 미구현이며 `llm-error-passthrough` 의 §7.5.2 ack 에러 표면 구현과 구현 레이어가 다르다. 구현 착수 전 확인 차원에서 추적한다.
  - 제안: 추적 메모 수준. plan 또는 spec 수정 불필요.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 현재 `plan/in-progress/` 에 있는 3개 plan(`execution-engine-residual-gaps.md`, `exec-intake-queue-impl.md`, `exec-park-durable-resume.md`)을 `pending_plans`로 정상 참조하고 있으며, 이들 plan 이 아직 미해소 항목을 보유하고 있어 spec `status: partial` 이 정당하다. `llm-error-passthrough` 구현이 착수하려는 §7.5.2 (`typed ExecutionError` / continuation ack 에러 표면 / 내부 메시지 누출 차단) 는 현재 어떤 in-progress plan 의 "결정 필요" 항목과도 충돌하지 않는다 — §7.5.2 는 이미 spec 본문에 정의된 내용이며, plan 들이 추적하는 미구현 표면(§7.1 stalled-job / §8 concurrency cap / G1 WS gate / G2 errorPolicy continue / PR3 rehydration 일반화)과 구현 레이어가 다르다. 다만 frontmatter `pending_plans` 에 이미 `plan/complete/` 로 이동한 `spec-sync-execution-engine-gaps.md` 가 dead 링크로 남아 있어 spec-lifecycle 가드의 정확도를 저해하므로 제거가 권장된다.

---

## 위험도

LOW

STATUS: SUCCESS
