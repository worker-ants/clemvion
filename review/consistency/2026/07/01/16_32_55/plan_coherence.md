# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
Target: `spec/5-system/4-execution-engine.md`
구현 범위: M-7 타입 단언 리팩터 (`plan/in-progress/refactor/03-maintainability.md §M-7`)

---

## 발견사항

### 발견사항 1

- **[WARNING]** `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` 에 완료·이동된 plan 경로가 잔류
  - target 위치: `spec/5-system/4-execution-engine.md` lines 1–13 (frontmatter `pending_plans:`)
  - 관련 plan: `plan/complete/spec-sync-execution-engine-gaps.md` (완료본), frontmatter 에는 `plan/in-progress/spec-sync-execution-engine-gaps.md` 로 기재
  - 상세: spec frontmatter 의 `pending_plans` 항목 `plan/in-progress/spec-sync-execution-engine-gaps.md` 는 실제로 `plan/complete/spec-sync-execution-engine-gaps.md` 로 이동 완료됐다. 완료 plan 의 내용을 보면 §4/§7.1/§8 세 항목이 모두 `[x]` 로 닫혀있고 "각 항목 → exec-intake-queue-impl 로 forwarding" 상태다. `plan/in-progress/` 경로에는 해당 파일이 없다. spec-impl-evidence §3 이 `pending_plans` 파일의 유효성을 요구하므로 stale 경로는 `status: partial` 근거 구조를 약화시킨다.
  - 제안: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 항목을 제거한다. 나머지 세 항목(execution-engine-residual-gaps, exec-intake-queue-impl, exec-park-durable-resume)은 실제로 `plan/in-progress/` 에 존재하며 미해결 surface 를 보유하므로 유지가 옳다.

### 발견사항 2

- **[INFO]** M-7 계획 서술의 "C-1 분할과 동시 진행" 전제가 이미 충족됐으나 plan 이 미갱신
  - target 위치: 해당 없음 (spec 본문은 M-7 타입 전략을 미규정 — 상태 B)
  - 관련 plan: `plan/in-progress/refactor/03-maintainability.md §M-7` ("옵션 C — C-1 분할과 동시, 분리되는 서비스 단위로 boundary 파싱 도입")
  - 상세: M-7 권장안 C 의 "C-1(02 소유) 일정에 종속" 단점 항목은, C-1 이 2026-06-28 에 완료됐으므로(`03-maintainability.md §C-1` "닫힘 — 02 C-1 완료") 더 이상 유효한 제약이 아니다. 분리된 서비스 단위(`AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`)가 이미 존재하므로 M-7 은 선행 조건 없이 착수 가능한 상태다. 후속 plan 항목(exec-intake-queue-impl PR2b, exec-park-durable-resume umbrella 잔여)과의 타입 경계 충돌도 없다 — M-7 은 behavior-preserving rename 이고 PR2b 는 신규 컬럼·새 서비스 진입이라 작업 표면이 직교한다.
  - 제안: `03-maintainability.md §M-7` 에 "C-1 완료(2026-06-28)로 착수 제약 해소됨" 메모를 추가하면 후속 진입자의 착수 판단에 도움이 된다. 필수 사항은 아니며 정합 차단 이슈 아님.

### 발견사항 3

- **[INFO]** `exec-park-durable-resume.md` 의 "PR3 rehydration 일반화(ai_agent → 일반 노드)" 미구현 surface 가 잔여하며, 이 surface 는 `spec/5-system/4-execution-engine.md §7.5` 재개 경로 서술과 연결됨
  - target 위치: `spec/5-system/4-execution-engine.md §7.5` (rehydration, `RESUME_INCOMPATIBLE_STATE` 케이스)
  - 관련 plan: `plan/in-progress/exec-park-durable-resume.md` 말미 "umbrella 잔여 (분리): PR3 rehydration 일반화"
  - 상세: spec §7.5 는 rehydration 허용 노드를 "ai_agent · information_extractor" 로 기술하나, exec-park-durable-resume 의 미구현 항목 PR3 는 이를 일반 노드로 확장하는 작업을 예약하고 있다. M-7 이 §7.5 재개 경로의 타입 경계(예: `driveResumeAwaited` / `driveResumeFrame`)를 narrowing 할 때, 이 미래 확장을 미리 고려하지 않으면 PR3 구현 시 타입 가드를 재수정해야 할 수 있다. 단, PR3 는 별도 plan 하에 별도 착수되므로 M-7 현재 구현을 차단하지 않는다.
  - 제안: M-7 구현 시 rehydration 노드 타입 체크(`isCheckpointEligibleNodeType` 등)를 narrowing 할 경우, allow-list 를 hard-code 하지 않고 설정 가능하게 두거나 별도 상수로 추출하면 PR3 확장 시 수정 범위가 최소화된다. 구현 시 선택적 고려 사항.

---

## 요약

`spec/5-system/4-execution-engine.md` 의 Plan 정합성 관점에서 구현 차단에 해당하는 Critical 발견은 없다. M-7(타입 단언 리팩터)이 가정하는 선행 조건(C-1 분할 완료)은 충족됐고, 미해결 결정(G1 WS gate / G2 errorPolicy / PR2b 동시성 cap / PR3 rehydration 일반화)은 모두 M-7 과 직교하는 표면에 있어 일방적 결정 충돌이 없다. 단, spec frontmatter `pending_plans` 에 `plan/complete/` 로 이동된 `spec-sync-execution-engine-gaps.md` 가 `plan/in-progress/` 경로로 잘못 기재돼 있어 spec-impl-evidence §3 의 파일 유효성 요건을 위반한다 — 이 항목을 삭제하는 spec frontmatter 갱신이 권장된다.

## 위험도

LOW
