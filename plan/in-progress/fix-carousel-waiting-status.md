---
worktree: .claude/worktrees/fix-carousel-waiting-status-4d4ed3
started: 2026-06-06
owner: developer
branch: claude/fix-carousel-waiting-status-4d4ed3
spec: spec/5-system/4-execution-engine.md
status: in-progress
---

# Carousel(blocking) waiting_for_input UI stuck 회귀 fix

## 증상
워크플로우 실행 중 carousel(presentation) 노드가 buttons 입력 대기 상태인데,
UI 가 버튼을 interactive 로 못 그리고 "실행 중(Running)" 스피너로 stuck. 간헐적.
아키텍처 변경(turn-park, #494 등) 이후 재발한 회귀.

## 근본 원인
1. **백엔드 윈도우**: `executeNode` 의 blocking 노드 분기
   (`execution-engine.service.ts:7055-7059`) 가 `output.status==='waiting_for_input'`
   봉투를 **NodeExecution.status=RUNNING 인 채 outputData 만** 저장하고, 이후 메인
   루프(L1665)가 `waitForButtonInteraction` 을 호출해야 비로소 status 를
   WAITING_FOR_INPUT 으로 atomic 전이한다 (spec §66 원자성). 그 사이 스냅샷이 읽히면
   같은 행에 `status='running'` + `outputData.status='waiting_for_input'` 불일치.
   - 기존 Phase-3 fix(`executions.service.findById` REPEATABLE READ)는
     **Execution.status vs NodeExecution.status** cross-query straddle 만 막음.
     **intra-row(status 컬럼 vs outputData.status)** 불일치는 못 잡음.
2. **프론트 방어 미스**: `apply-execution-snapshot.ts` 의 inconsistent-snapshot
   reconciliation 이 오직 `ne.status === 'waiting_for_input'` 한 필드만 본다
   (L127/L153/L188). 스냅샷의 `ne.status==='running'` 이라 방어 실패 +
   먼저 도착한 WS waiting_for_input 이벤트가 set 한 waiting 상태를 L144 분기에서
   `resumeFromButtons()` 로 **wipe** → 버튼 비활성 stuck.

## 수정 (양쪽, 레이어드)
- [x] 백엔드 `executions.service.findById`: 스냅샷 정규화 — nodeExecution 이
      비terminal(running/pending) + `outputData.status==='waiting_for_input'` 이면
      스냅샷 status 를 `waiting_for_input` 으로 surface. write/원자성 불변(read-only).
      → 기존 프론트 Phase-3 방어(Execution=running/NodeExec=waiting)가 정상 작동.
      모든 스냅샷 소비자(앱·channel-web-chat·external API)에 일관 적용.
- [x] 프론트 `apply-execution-snapshot.ts`: waiting-node 판정에
      `outputData.status==='waiting_for_input'`(비terminal) 도 신호로 포함.
      L127/L153/L188 + per-node status 매핑. WS 스냅샷·replica·legacy 우회 방어 +
      event→snapshot 순서 wipe 차단 (defense-in-depth).

## 진행 체크리스트
- [x] /consistency-check --impl-prep (BLOCK: NO — Critical 0. Warning 2건은 코드-only 변경에 비적용. INFO 는 impl-done spec 동기화 후속)
- [x] 테스트 선작성 (frontend unit / backend unit)
- [x] 구현
- [x] TEST WORKFLOW (lint·unit·build·e2e 전부 PASS — unit 40, e2e 175)
      - 부수: channel-web-chat W8 eager-start flaky 테스트(race) 수정 — 기존 main 에서도 5회 중 2회 실패하던 것을 `waitFor(executionId)` 로 안정화
- [x] /ai-review + SUMMARY + critical/warning fix (W3·W4 코드 fix ecc17b15; W1·W2 SPEC-DRIFT draft d6a84827; RESOLUTION.md 작성)
- [ ] /consistency-check --impl-done (spec 연결 코드 변경)
