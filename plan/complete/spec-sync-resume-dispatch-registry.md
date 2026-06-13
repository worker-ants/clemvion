---
worktree: spec-sync-s-batch-b85f17
started: 2026-06-06
owner: planner
spec_impact:
  - spec/conventions/interaction-type-registry.md
  - spec/5-system/4-execution-engine.md
---

# Spec Sync — resume dispatch registry 레이어 spec 반영 (exec-park B-1 후속)

> exec-park B-1(resume dispatch registry, `exec-park-resume-dispatch-registry.md`) 구현 후
> `--impl-done`(`review/consistency/2026/06/06/19_32_46`, W1/W2) + `/ai-review`
> (`review/code/2026/06/06/19_32_46`, SPEC-DRIFT I1) 가 공통 지적한 **비차단 spec doc-sync**.
> 코드가 옳고 spec 서술이 신규 indirection 레이어를 미반영. BLOCK:NO — 차단 아님.
> **다음 blocking 노드 타입 추가 전 완료 권장**(그때 매트릭스 stale 이 실질 위험).

## 배경 (코드 현황, 이미 머지 경로)
- form/buttons/ai resume 분기가 `driveResumeAwaited`(top-level)·`driveResumeFrame`(중첩)
  두 곳 하드코딩 → ordered `resumeTurnRegistry`(first-match-wins: form→buttons→ai_conversation)
  + 단일 `dispatchResumeTurn`(`resume-turn-dispatch.ts`)로 추출. 동작·매핑 보존.

## 항목 (planner — spec write)
- [x] **W1** (2026-06-10 spec 전수 감사에서 반영 완료 — §7.5 다이어그램·최내 frame 서술에 `dispatchResumeTurn`/`resumeTurnRegistry`/`resume-turn-dispatch.ts` 반영, branch claude/spec-sync-audit-998544) `spec/5-system/4-execution-engine.md` §7.5 다이어그램(L905 영역)·§6.2 최내 frame
      서술(L922 영역)에 "form/buttons/ai 분기는 `dispatchResumeTurn`(ordered `resumeTurnRegistry`,
      `resume-turn-dispatch.ts`) 단일 진입점으로 라우팅; AI 는 `handleAiResumeTurn` 경유" 한 줄 반영.
      기존 "form→processFormResumeTurn ..." 매핑 서술은 그대로 정합(처리기 불변) — indirection 레이어만 추가 기술.
- [x] **W2** (2026-06-13, spec-sync-s-batch) `spec/conventions/interaction-type-registry.md` §1.2 매트릭스
      하단에 재개 turn 라우팅 진입점 노트(`dispatchResumeTurn`/ordered `resumeTurnRegistry`/`resume-turn-dispatch.ts`)
      추가 + frontmatter `code:` 에 `resume-turn-dispatch.ts` 등재. enum 값 신규 추가 아님 → 매트릭스 완전성 보강.
      §1.1 "단일 진실 위치"는 **enum 타입 정의 위치 전용**(WaitingInteractionType 선언처)이라 dispatch 파일은 등재 부적합
      → 의도적으로 §1.2 노트 + frontmatter 로만 처리(원안 "§1.1 Backend 행" 문구는 위치 부정확으로 비채택).
- [x] **I3** (2026-06-13) `resume-turn-dispatch.ts` JSDoc 의 `§6.2(중첩 재개)` 레이블 → `§7.5(rehydration ·
      중첩 sub-workflow 재개)` 로 교정, §6.2 는 영속화 정책임을 괄호 명시.
- [x] **I4** (이미 반영 — `spec/5-system/4-execution-engine.md §Rationale` "park 즉시 해제 + slow-path 일원화"
      항 "resume turn dispatch registry 추출 (#507)" 단락이 `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` 의
      `shared/execution-resume/process-turn-result.ts` 이관을 이미 서술). 추가 작업 불요.

## 워크플로
- planner: `/consistency-check --spec` (해당 draft) → BLOCK:NO 시 spec 반영. spec frontmatter
  `code:` 글롭(`modules/execution-engine/**`·`shared/execution-resume/**`)은 이미 신규 파일 포함.

## 진행 메모
- 2026-06-06 생성(추적용). 구현(코드)은 `exec-park-resume-dispatch-registry.md` PR 에서 완료.
