---
title: data-flow spec 구조·표기 후속 3건 — RBAC 표 배치 · SIGTERM 상호참조 · Model Config 명칭 통일
worktree: (unstarted)
started: 2026-07-31
owner: planner
status: in-progress
priority: P3
spec_impact:
  - spec/data-flow/12-workspace.md
  - spec/data-flow/3-execution.md
---

## Overview

`#1040` 의 `/consistency-check --impl-done` 라운드가 `spec/data-flow/` 전수를 점검하며 낸 WARNING
중, **그 PR 범위 밖이라 닫지 못한 3건**을 분리해 추적한다. 셋 다 `spec/` 쓰기라 **planner 턴**이 필요하다.

원 plan(`review-info-followups.md` §4)에서 이관. 그 plan 은 본 항목들이 분기됐으므로 완료 처리한다.

## 1. `12-workspace.md` §3.2 RBAC 매트릭스 배치

RBAC 권한 매트릭스가 `## 3. 상태 전이` 섹션 **아래**에 있다. `spec/data-flow/0-overview.md §3.4` 가
정의한 "상태 전이" 섹션 템플릿은 **엔티티 status enum 전이**만 다루는 자리이고, 15개 형제 data-flow
문서 전원이 이를 지키는데 `12-workspace.md` 만 이탈해 있다(사전 존재, `#1040` 은 표 내용만 정정하고
위치는 건드리지 않았다).

선택지 (택1):

- (a) §3.2 를 `## 3` 밖으로 빼서 별도 `## 권한 (RBAC)` 섹션으로 승격
- (b) `0-overview.md §3` 공통 규약에 "도메인 문서는 선택적 RBAC 요약을 덧붙일 수 있다" 예외 조항 명문화

(a) 가 템플릿을 지키는 방향이지만 섹션 번호가 밀려 하위 참조(`§4`, `§5` …)를 함께 갱신해야 한다.
**착수 전 인바운드 앵커 링크를 전수 확인할 것** — `#32-rbac-…` 형태로 이 절을 가리키는 문서가 있으면
같이 고쳐야 한다.

## 2. `3-execution.md` §3.3 SIGTERM 행 상호참조

SIGTERM/graceful-shutdown 취소 분류가 **미결 결정**에 걸려 있는데 §3.3 이 이를 언급하지 않아 완결된
것처럼 읽힌다.

- 미결 결정: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의
  "결정이 필요하다 (택일)" (a)/(b)
- 종속 실측 갭: `plan/in-progress/node-cancellation-residual-signal-propagation.md` — 취소 가드
  `assertExecutionNotCancelled` 가 `FAILED`/`SERVER_INTERRUPTED` 를 관측하지 못한다

조치: §3.3 "비정상 종료 회수" 표의 `ShutdownStateService.onApplicationShutdown` 행(또는 각주)에
**"분류 정책 결정 대기 중"** 상호참조를 단다. **결정 자체를 선점하지 않는 것**이 요점이다 — (a)/(b)
중 어느 쪽으로도 읽히지 않게 중립적으로 쓴다.

## 3. "LLM Config" → "Model Config" 표기 통일

`unified-model-management`(V088~V092) 이후 API·내비게이션은 `Model Config` 로 일원화됐고
`spec/5-system/1-auth.md` 가 그 정본 명칭을 쓴다. 그런데 product-facing 문서 다수가 아직 `LLM Config`
를 쓴다.

`#1040` 은 오독만 막는 bridging 문장("LLM Config 는 Model Config 와 같은 리소스")을 각주에 넣었고,
**표기 자체는 통일하지 않았다**. 알려진 잔존 위치:

- `spec/data-flow/12-workspace.md` §3.2 표 헤더, `:11`
- `spec/data-flow/0-overview.md:131`
- (전수는 착수 시 `rg -n "LLM Config" spec/` 로 재확인)

조치 시 `spec/2-navigation/6-config.md:286`("LLM Config alias 제거 완료" 문서화)와 `7-llm-usage.md`
(이미 `Model Config`)를 기준으로 삼는다.

## 체크리스트

- [ ] §1 RBAC 표 배치 — (a)/(b) 택일 + 인바운드 앵커 전수 확인
- [ ] §2 SIGTERM 상호참조 각주 (결정 선점 금지)
- [ ] §3 명칭 통일 — `rg -n "LLM Config" spec/` 전수 후 일괄
- [ ] `/consistency-check --spec` (planner 의무)
- [ ] push + PR

## Rationale

**왜 `#1040` 에서 닫지 않았나**: 셋 다 그 PR 이 만든 결함이 아니고(전부 사전 존재), 고치면 scope 가
크게 번진다 — §1 은 섹션 번호 재배치로 하위 참조 연쇄 갱신, §3 은 문서군 전반 표기 변경이다.
`#1040` 은 그 자리에서 오독을 막는 최소 조치(bridging 문장)만 하고 나머지를 여기로 넘겼다.

**우선순위 P3 인 이유**: 셋 다 **내용이 틀린 것이 아니라 배치·표기** 문제다. 실제로 틀렸던
Critical(viewer 실행 권한)과 WARNING(LLM Config/Integration 권한 병합)은 `#1040` 이 이미 닫았다.
