---
worktree: (unstarted)
started: 2026-06-06
owner: planner
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
- [ ] **W2** `spec/conventions/interaction-type-registry.md` §1.1 Backend 행 + §1.2 매트릭스에
      `resume-turn-dispatch.ts`(또는 glob `execution-engine/**`) dispatch 위치 등재. enum 값 신규
      추가 아님 → 매트릭스 완전성 보강.
- [ ] **I3(선택)** `resume-turn-dispatch.ts` JSDoc 의 `§6.2(중첩 재개)` 레이블 → `§7.5 중첩
      sub-workflow 재개` 로 교정(§6.2 는 영속화 정책). *코드 주석이라 developer 도메인 — spec PR
      과 별도로 처리 가능하나, 본 plan 에 함께 추적.*
- [ ] **I4(선택)** `spec/5-system/4-execution-engine.md §Rationale` "park 즉시 해제" 항에
      "B-1 후속 — park return-signal sentinel(`PARK_RELEASED`/`ProcessTurnResult`)을
      `shared/execution-resume/process-turn-result.ts` 로 이관" 한 문장 추가.

## 워크플로
- planner: `/consistency-check --spec` (해당 draft) → BLOCK:NO 시 spec 반영. spec frontmatter
  `code:` 글롭(`modules/execution-engine/**`·`shared/execution-resume/**`)은 이미 신규 파일 포함.

## 진행 메모
- 2026-06-06 생성(추적용). 구현(코드)은 `exec-park-resume-dispatch-registry.md` PR 에서 완료.
