# Plan 정합성 검토 — spec/5-system/4-execution-engine.md

검토 모드: --impl-prep (scope=spec/5-system/4-execution-engine.md)
검토일: 2026-06-19

---

## 발견사항

- **[WARNING]** `pending_plans` 에 완료된 plan 잔류
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 두 번째 항목
  - 관련 plan: `plan/in-progress/spec-sync-execution-engine-gaps.md` — 파일이 `plan/complete/spec-sync-execution-engine-gaps.md` 로 이동됨
  - 상세: spec frontmatter 가 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 pending_plan 으로 참조하고 있으나 해당 파일은 `plan/complete/` 로 이동 완료된 상태다. `spec-pending-plan-existence` frontmatter 가드가 이를 위반으로 판정할 수 있다.
  - 제안: spec frontmatter `pending_plans:` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 행을 제거. (`plan/in-progress/execution-engine-residual-gaps.md`, `plan/in-progress/exec-intake-queue-impl.md`, `plan/in-progress/exec-park-durable-resume.md` 세 항목은 실제 in-progress 이므로 유지.)

- **[INFO]** `exec-intake-queue-impl.md` PR2b 미착수 — 동시성 cap spec "Planned" 상태
  - target 위치: `spec/5-system/4-execution-engine.md §8` ("동시 실행 cap" — 워크스페이스 10/워크플로 3, Planned 배너)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` PR2b (branch `claude/impl-concurrency-cap-pr2b`, 미착수)
  - 상세: spec §8 의 동시 실행 cap(워크스페이스 10/워크플로 3·pending 큐대기·5분 cancel) 은 PR2b 에서 구현 예정으로 현재 "Planned" 표기 유지 상태다. PR2b 착수 전 `settings` 키 스키마 신설, `queued_at` 컬럼 마이그레이션 번호(V092 이후) 확인, `maxConcurrentExecutions` spec §2.2/§2.4 등재가 선행 의무로 plan 에 명시돼 있다. 본 --impl-prep 대상이 §8 구현이라면 이 미해결 사전 조건을 주의해야 한다.
  - 제안: PR2b 착수 전 plan 에 명시된 fresh `--impl-prep`(post-rebase) 재실행 의무를 이행하고, `maxConcurrentExecutions` spec §2.2/§2.4 등재를 project-planner 에 선행 위임할 것.

- **[INFO]** `execution-engine-residual-gaps.md` G1/G2 BLOCKED 상태 — 미구현 surface 잔존
  - target 위치: `spec/5-system/4-execution-engine.md §11` (WS `execution.start` graceful-shutdown gate, `errorPolicy='continue'` SIGTERM 분기)
  - 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md` G1·G2 (BLOCKED)
  - 상세: G1(WS `execution.start` graceful-shutdown gate)과 G2(`errorPolicy='continue'` SIGTERM 분기) 는 spec §11 에 명시되었으나 차단 사유로 미구현 상태다. G1 은 spec 설계(ack 계약·`fromNodeId` 의미) 미확정, G2 는 errorPolicy 스키마 노출(`parallel-p2.md §1` 미완료) 및 용어/구현 불일치가 선결 조건이다. 본 `--impl-prep` 이 §11 영역을 다룬다면 이 두 항목이 여전히 차단 상태임을 확인해야 한다.
  - 제안: G1/G2 관련 구현 착수 시 plan 에 명시된 차단 사유 해소(project-planner 선행 spec 설계, `parallel-p2.md §1` 완료) 를 확인할 것. 현재 --impl-prep 대상에 §11이 포함되지 않는다면 무시.

- **[INFO]** `exec-park-durable-resume.md` Phase B 완료 후 spec 재전환 미반영 추적
  - target 위치: `spec/5-system/4-execution-engine.md §4.x`·`§7.4`·`§7.5`·`§Rationale` (park 모델·slow-path 일원화)
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` "Spec 변경 (project-planner)" 절 — PR-B2b 이후 `§4.x` 완료형 flip·`§7.4` Worker 동작·`§7.5` case diagram 재전환 예정
  - 상세: Phase B(B1·B2a·B2b) 구현이 완료된 이후 spec §4.x banner 2개(park=세그먼트 종료, slow-path 일원화)·§7.4·§7.5 갱신이 "project-planner 일괄" 로 예정된 채로 plan 에 기록돼 있다. 해당 spec 갱신이 완료됐는지 또는 아직 대기 중인지는 exec-park 완료 현황에 따라 다르나, 현재 spec 텍스트가 전환 완료 상태인지 확인이 필요하다.
  - 제안: `exec-park-durable-resume.md` 의 "Spec 변경" 절 항목이 모두 spec 에 반영됐는지 점검 후, 반영된 항목은 체크 처리할 것.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 `pending_plans` 에 완료 이동된 `spec-sync-execution-engine-gaps.md` 를 여전히 참조하는 stale 항목이 있어 frontmatter 가드 위반 가능성이 있다(WARNING). 나머지 발견사항은 모두 INFO 수준으로, 미구현 surface(`exec-intake-queue-impl` PR2b 동시성 cap, `execution-engine-residual-gaps` G1·G2 BLOCKED) 의 사전 조건 미해소를 추적하는 것이며 --impl-prep 대상이 해당 §8/§11 영역이 아니라면 즉각적인 차단 사유가 되지 않는다. 미해결 결정을 일방적으로 우회하거나 선행 plan 을 무시하는 충돌은 없다.

## 위험도

LOW
