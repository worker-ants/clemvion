---
title: 웹채팅 spec Rationale 문서화 갭 — 하드윈 불변식 2건 + §NNN 표기 규약 (planner 트랙)
worktree: (unstarted)
started: 2026-07-24
owner: project-planner
status: in-progress
priority: P3
---

## Overview

[`webchat-boot-single-flight.md`](../complete/webchat-boot-single-flight.md) 의 **planner 이월**
에서 분리했다. 그쪽에 산문으로만 두면 plan 완료 이동 시 함께 묻힌다 — 형제 이월 2건
(`webchat-usewidget-extraction` · `webchat-command-failure-is-not-termination`)과 같은 처분이다.

> 출처: `--impl-done` 03_24_41 `rationale_continuity` + `convention_compliance` INFO.
> **비차단**(문서화 durability). 코드·동작 영향 없음.

## 문제 — 하드윈 불변식이 spec 에 흔적이 없다

두 불변식은 **8~12차례 재발·재설계를 거쳐 확정된 하드윈**인데, 근거가 코드 JSDoc·테스트 주석·
plan 진행기록에만 있고 `spec/` 의 `## Rationale` 에는 없다. spec 만 읽는 사람은 왜 그렇게
설계됐는지 알 수 없고, 다음 라운드에서 같은 대안이 다시 제안된다(이 저장소가 반복 관측한 패턴).

1. **`sessionEstablished()` 가 표면/스트림 단일-진실인 이유** — 지연 seed 되감기·이중 스트림
   방어를 왜 `sessionEstablished` 에 걸었는가.
2. **비-410 명령 실패는 종료가 아니다 (A-6 되돌림 근거)** — `RESTORED`/`BOOTED` 로의 `ended`
   가드 확대를 왜 되돌렸는가.

## 왜 developer 가 못 쓰나

CLAUDE.md 상 `spec/` 는 **planner 트랙**이다. developer 는 read-only 이므로 원 plan 에서
쓸 수 없었다. 단, 이 저장소는 [`eia-context-schema-followups`](eia-context-schema-followups.md)
에서 경계를 이미 확정했다 — **코드 변경에 동반되는 SoT 표 sync(신규 요구·결정 없음)** 는
developer 가능, **신규 요구/결정을 담는 spec 본문 편집**은 planner. 본 건은 Rationale 서술
(설계 근거의 서사)이라 planner 트랙이 맞다.

## 체크리스트

- [ ] `spec/7-channel-web-chat/2-sdk.md`(또는 `3-auth-session.md`) `## Rationale` 에 위 불변식 2건의
      근거 추가 — **어느 문서가 맞는 자리인지 판정 포함**
- [ ] `§NNN` 표기 규약 명문화 (`convention_compliance` INFO) — spec 내 절 참조 표기를 규약으로 고정
- [ ] `/consistency-check --spec` 통과 (Rationale 은 `rationale_continuity` 대상이라 필수)

## 관련

- 부모: [`webchat-boot-single-flight.md`](../complete/webchat-boot-single-flight.md) §planner 이월
- 근거 위치(현재): `codebase/channel-web-chat/src/widget/use-widget.ts` JSDoc ·
  `use-widget-eager-start.test.ts` 주석
- 형제 이월: [`webchat-usewidget-extraction.md`](webchat-usewidget-extraction.md) ·
  [`webchat-command-failure-is-not-termination.md`](webchat-command-failure-is-not-termination.md)

## Rationale

**왜 별 티켓인가.** 산문 이월은 부모 plan 이 `complete/` 로 가면 증발한다 — 이 저장소가
harness-guard-followups 에서 반복 확인한 실패다(그래서 §L·§I·§H 도 개별 티켓으로 분리했다).
형제 2건이 이미 같은 이유로 분리돼 있어, 이 1건만 산문으로 남기면 비대칭이다.

**왜 P3 인가.** 비차단·문서화 durability 항목이다. 코드는 이미 옳게 동작하고 회귀 테스트로
고정돼 있으며, 갭은 "왜" 가 spec 에 없다는 것뿐이다. 다만 방치하면 같은 대안이 재제안되는
비용이 실제로 발생해 왔으므로 won't-do 는 아니다.
