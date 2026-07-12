---
title: PR #874 defer 된 저우선 spec 문서 보강 3건 (탐색성·스코프 명시·code 미러)
worktree: spec-deferred-docs-42d3b6
started: 2026-07-10
owner: project-planner
spec_area: spec/7-channel-web-chat/1-widget-app.md, spec/conventions/conversation-thread.md
spec_impact:
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/conventions/conversation-thread.md
---

## 배경

PR #874 (웹채팅 위젯 세션 컨트롤 + 새로고침 히스토리 복원) 의 code-review / consistency
검토에서 **비차단 저우선(Info/Warning)** 으로 defer 된 문서 보강 3건. 모두
**서술 추가·정합화만** 이며 신규 결정·동작 변경이 없다 (내용 근거는 이미 본문 산문·
Rationale §8.4 에 존재). 코드 변경 없음 — spec-only.

## 변경안

### (1) `spec/7-channel-web-chat/1-widget-app.md` — Rationale `### R7` 신설

**현황**: 헤더 세션 컨트롤의 두 결정 — (a) `booting` 구간 미노출 게이팅, (b) 종료 시
`end_conversation`(graceful) vs `cancel`(범용) 분기 — 의 근거가 §2 헤더 행과 §3.1 표의
셀 산문에 흩어져 있고 Rationale 항목이 없어 탐색성이 낮다.

**변경**: `### R6` 뒤에 `### R7` 추가 (본 문서 R 번호는 문서-로컬 연속, 현재 R4~R6 → R7 이 다음).
신규 결정을 만들지 않고 산문의 근거를 Rationale 로 승격한다.

> **최종 반영 문구는 `spec/7-channel-web-chat/1-widget-app.md` §R7 참조.** 초안에 있던 "기각된 대안" 2문장(booting
> 큐잉 / 종료 명령 단일화 → 409 거부)은 consistency-check W1 로 **삭제**했다 — 실제 PR #874 리뷰·plan 이력에 검토
> 흔적이 없는 사후 구성이었고, 특히 "409 거부" 는 코드 추적상 사실이 아니다(아래 별건 참조). 최종 R7 은 세 단락
> (booting 게이팅 / graceful·cancel 분기 = EIA-IN-02 기존 계약의 매핑 / optimistic 종료) 의 **순수 산문 승격**이다.

### (2) `spec/conventions/conversation-thread.md` §9 서두 — 채널 위젯 스코프 예외 1줄

**현황**: §9 는 "Conversation Preview / history view" 의 강제 규약이고, §9.1 6-source 시각
매핑·§9.2 3중 신호(아이콘+컨테이너+chip)를 **강제**로 명시한다. 그러나 임베드형 채널 위젯
(`codebase/channel-web-chat`)은 `presentation_user`·`ai_user`→**user**, 그 외→**assistant**
의 **2-way 말풍선**으로 의도적 축약 렌더한다(1-widget-app §2 메시지 리스트 행, 구현
`conversation.ts roleOf`). 현재 §9 에 이 스코프 예외가 없어 규약-구현 불일치로 오독될 수 있다.

**변경**: §9 서두 안내 문단 다음에 스코프 예외 1줄 추가.

> **최종 반영 문구는 `spec/conventions/conversation-thread.md` §9 서두 blockquote 참조.** 초안의 "6-way" 는
> consistency-check W2 로 정정 — `ai_assistant`·`ai_tool`·`system`→assistant 로 **구체 열거**하고, "§9.1 표는 6행이지만
> `system_error` 는 frontend-합성(§1.1.1)이라 위젯 wire 에 도달하지 않는다(위젯 도메인 = backend enum 5값)" 를 명시했다.
> 링크에는 앵커(`#2-화면-구조`)를 부착했다. 추가로 §8.2 말미에 이 예외로의 cross-ref 1줄을 넣어 §8 만 읽는 독자가
> 예외를 놓치지 않게 했다(I1).

### (3) `spec/conventions/conversation-thread.md` — frontmatter `code:` + §4 표 park 행 비고

**현황 A**: §8.4 "소비처 갱신 (2026-07-09)" 이 `getStatus` REST 를 세 번째 소비처로 등재했으나,
frontmatter `code:` 에 그 구현체 `interaction.service.ts` 가 없다.

**변경 A**: frontmatter `code:` 리스트에 backend 항목 순서를 지켜 추가.

```yaml
  - codebase/backend/src/modules/external-interaction/interaction.service.ts
```

**현황 B**: §4 영속화 표 "park 진입 시" 행 비고가 **rehydration** 만 소비처로 서술해 §8.4 가
확장한 3-소비처(rehydration / SSE waiting emit / getStatus REST)와 어긋난 인상을 준다.

**변경 B**: 해당 행 비고 끝에 소비처 요약 1문장 추가 (§8.4 로 위임).

```markdown
**소비처는 (a) rehydration(내부 무손실 재개), (b) SSE `waiting_for_input` emit, (c) `GET /api/external/executions/:id`(`getStatus`) REST 읽기 전용 — 세 곳이며, (b)·(c) 공개 표면은 `redactThreadForPublic` 로 egress 마스킹된다(§8.4).**
```

## 체크리스트

- [x] `/consistency-check --spec` 통과 (BLOCK: NO — Critical 0, Warning 3) → `review/consistency/2026/07/10/22_27_01/SUMMARY.md`
- [x] (1) 1-widget-app.md R7 반영 (**W1 반영: "기각된 대안" 2문장 삭제**)
- [x] (2) conversation-thread.md §9 스코프 예외 반영 (**W2 반영: 5값 구체 열거 + `system_error` 도달 불가 명시 + 앵커**)
- [x] (3) conversation-thread.md frontmatter + §4 표 반영
- [x] (I1) §8.2 말미 위젯 스코프 cross-ref 추가
- [x] (W3) `spec-sync-external-interaction-api-gaps.md` 에 미등재 backlog 2항목 등재
- [x] doc-guard (spec-link-integrity) 통과 (PR #899 CI + 2026-07-12 재확인: `spec-link-integrity.test.ts` 13/13 pass)
- [x] commit + PR → PR #899 (commit `52f46f95f`)

## consistency-check 반영 결과 (2026-07-10)

| # | 발견 | 초안 | 최종 |
|---|---|---|---|
| W1 | R7 의 "기각된 대안" 2문장이 실제 PR #874 이력에 없는 **사후 구성** | "booting 큐잉 기각" / "명령 단일화 기각(409 거부)" | **삭제**. graceful/cancel 은 위젯의 기각 이력이 아니라 **EIA-IN-02 기존 계약의 매핑**임을 명시 |
| W2 | "6-way" 가 위젯 wire 도메인(backend 5값)과 어긋남 | "§9.1 의 6-way … 그 외→assistant" | `ai_assistant`·`ai_tool`·`system`→assistant **구체 열거** + "`system_error` 는 frontend-합성(§1.1.1)이라 위젯 wire 에 도달 불가" 명시 |
| W3 | spec 이 약속한 backlog 2항목이 plan 미등재 | — | `spec-sync-external-interaction-api-gaps.md` 등재 |

**별건(본 PR 범위 밖)**: `end_conversation` 이 노드 타입을 강제하지 않아(`assertNodeId`+`assertWaiting` 만) Form 대기 중
호출 시 409 가 아니라 **빈 formData 로 Form 이 조용히 재개**될 수 있다. developer 후속으로 분리 — R7 은 이 미검증
동작을 인용하지 않는다.

## Rationale

- **R7 을 신규 결정이 아니라 산문 승격으로 둔 이유**: PR #874 에서 이미 구현·리뷰·머지된 동작이며,
  Rationale 부재는 탐색성 문제일 뿐이다. 결정을 재개봉하지 않는다.
- **§9 예외를 위젯 문서가 아니라 convention 문서에 쓰는 이유**: convention 이 "강제" 를 선언하는
  쪽이므로 예외 스코프도 같은 문서가 SoT 여야 한다(위젯 문서에만 쓰면 convention 독자가 못 본다).
- **예외를 §9.1·§9.2 로 한정**: 위젯은 §9.3~§9.5 를 실제로 준수한다(`conversation.ts` 1차 소스 =
  `conversationThread.turns`, raw emit 미노출, `[user-input]` strip). 예외를 §9 전체로 넓히면
  실제보다 느슨한 계약이 되어 회귀 가드가 사라진다.

## 완료 (2026-07-12 라이프사이클 마감)

변경안 3건(+I1·W3)은 전부 PR #899 (commit `52f46f95f`) 로 반영·머지됐다. 잔여 체크박스 2개
(doc-guard·commit+PR)가 미체크로 `in-progress/` 에 잔류하던 것을 consistency-check
(`review/consistency/2026/07/12/01_41_42/`) 가 하우스키핑으로 지목 → 실제 반영을 재확인하고 마감한다.

- **target 재확인**: `1-widget-app.md` §R7 (L159), `conversation-thread.md` §9 서두 blockquote (L397)·
  §8.2 말미 cross-ref (L332)·frontmatter `code:` interaction.service.ts (L7)·§4 park 행 소비처 1문장 (L217)
  모두 현행 main 에 존재.
- **doc-guard**: `spec-link-integrity.test.ts` 13/13 pass (2026-07-12 재확인).
- 미해결 follow-up 0건 → `plan/complete/` 이동. `spec_impact` frontmatter 는 이미 리스트로 선언됨 (Gate C).
