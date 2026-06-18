# Plan 정합성 검토 — spec/5-system/4-execution-engine.md

검토 모드: --impl-prep  
Target 문서: `spec/5-system/4-execution-engine.md`  
검토 일시: 2026-06-19

---

## 발견사항

### [WARNING] spec frontmatter `pending_plans`에 완료된 plan 이 등재됨
- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter (line 11)
  ```
  - plan/in-progress/spec-sync-execution-engine-gaps.md
  ```
- **관련 plan**: `plan/complete/spec-sync-execution-engine-gaps.md` (이미 `plan/complete/` 로 이동됨)
- **상세**: spec frontmatter 의 `pending_plans:` 가 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 참조하고 있으나, 해당 파일은 `plan/complete/spec-sync-execution-engine-gaps.md` 에 존재한다. `plan/in-progress/` 에는 해당 파일이 없다. 또한 spec 본문 §8 (line 1039)에도 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 참조하는 인라인 링크가 있다. spec-sync-execution-engine-gaps.md 자체는 §4/§7.1/§8 의 내용이 `exec-intake-queue-impl.md` 로 forwarding 됐고 모든 항목이 완료 표기된 상태다.
- **제안**: spec frontmatter `pending_plans:` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 제거하고, §8 본문의 인라인 참조도 `plan/in-progress/exec-intake-queue-impl.md` (PR2b) 단독으로 정정한다. `project-planner` 영역.

### [INFO] exec-intake-queue-impl.md PR2b — 미착수 상태이며 결정된 전제 조건이 충족됐는지 재확인 필요
- **target 위치**: `spec/5-system/4-execution-engine.md` §8 (Planned: PR2b)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` PR2b
- **상세**: spec §8 은 워크스페이스/워크플로우 동시 실행 cap, 큐 대기 5분 cancel 을 "Planned(PR2b)" 로 명시한다. `exec-intake-queue-impl.md` 는 PR2b 착수 전 `settings` 키 스키마 신설(`maxConcurrentExecutions` — §2.2/§2.4 미정의)과 마이그레이션 번호 확인(`queued_at` 컬럼, 구 V088 → V092 이후로 재부여 필요)을 명시하고 있으며, "착수 전 fresh `--impl-prep`(post-rebase) 재실행 의무"가 명기돼 있다. 본 검토는 그 재실행이므로 충돌 없음. PR2b 착수 자체는 exec-park-durable-resume 의 전제 조건(B3 완료 여부)과 마이그레이션 최대 번호 재확인이 필요하다는 점을 추적 메모로 남긴다.
- **제안**: PR2b 착수 시 `exec-intake-queue-impl.md` 의 기술 설계(V092+ 마이그레이션 번호, advisory lock, settings 키 스키마) 를 fresh 재확인한다. 별도 plan 갱신 불요.

### [INFO] execution-engine-residual-gaps.md G1/G2 — 여전히 BLOCKED 상태이나 spec 은 이를 "Planned" 로 기술
- **target 위치**: `spec/5-system/4-execution-engine.md` §11 (WS `execution.start` gate, graceful shutdown `errorPolicy='continue'` 분기)
- **관련 plan**: `plan/in-progress/execution-engine-residual-gaps.md` G1/G2
- **상세**: spec §11 은 두 항목(WS `execution.start` graceful-shutdown gate, `errorPolicy='continue'` SIGTERM 분기)을 정상 목표로 서술한다. G1/G2 는 사유가 있는 BLOCKED 상태로 `execution-engine-residual-gaps.md` 에서 추적되고 있으며, spec §11 구현 상태 배너도 이를 "미구현" 로 명시한다. 충돌은 없으나 BLOCKED 결정이 spec 본문에 명시적으로 반영되지 않아 독자가 착각할 수 있다.
- **제안**: 추적 메모 수준. spec §11 에 "G1/G2 BLOCKED — spec 확정 선행 필요" 배너 추가는 project-planner 선택 사항.

### [INFO] node-cancellation-infrastructure.md §2 — exec-park-durable-resume B3 직렬화 의존 추적
- **target 위치**: `spec/5-system/4-execution-engine.md` §1.2 (NodeExecution.status 'cancelled' enum), §7.4 dispatch 경로
- **관련 plan**: `plan/in-progress/node-cancellation-infrastructure.md` §2, `plan/in-progress/exec-park-durable-resume.md` Phase 0
- **상세**: node-cancellation §2 (dispatch 직전 abort 체크 + cancelled enum)는 exec-park PR-B2 (B3 dispatch-path 정리) 선행 후 rebase 하기로 직렬화 순서가 확정돼 있다(`exec-park-durable-resume.md` Phase 0 §2.1). PR-B2b 는 이미 구현 완료(commit 확인)로 보인다. target spec 을 읽는 구현자가 이 직렬화 순서를 인지하지 못하면 node-cancellation §2 를 exec-park 완료 전에 착수할 위험이 있다.
- **제안**: 추적 메모. node-cancellation §2 착수 전 exec-park B3 랜딩 여부를 확인하도록 plan 에 체크포인트가 이미 있으므로 별도 조치 불요.

---

## 요약

Target 문서 `spec/5-system/4-execution-engine.md` 는 `--impl-prep` 범위에서 in-progress plan 들과 전반적으로 정합하다. 미구현 surface(PR2b 동시성 cap, G1/G2 graceful shutdown 확장, PR4 stalled-job 일원화)가 plan 과 spec 양측에 "Planned/BLOCKED" 로 일치하게 표기돼 있다. 유일한 실질 경고는 spec frontmatter `pending_plans:` 가 이미 `plan/complete/` 로 이동한 `spec-sync-execution-engine-gaps.md` 를 `in-progress` 경로로 참조하는 stale 링크이며, 이는 spec-guard(`spec-pending-plan-existence.test.ts`)가 불일치를 검출할 수 있는 항목이다. 미해결 설계 결정(PR2b 마이그레이션 번호, settings 키 스키마)은 plan 내에 명시돼 있고 target 이 이를 우회하거나 일방적으로 결정하지 않는다.

---

## 위험도

LOW
