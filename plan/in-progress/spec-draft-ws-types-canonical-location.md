---
title: spec draft — WS 이벤트 값·타입의 정본 위치 서술 정정 (7곳) + §4.4 보완
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-15
owner: project-planner
status: in-progress
priority: P3
pending_plans:
  - plan/in-progress/ws-event-types-extract.md
spec_impact:
  - spec/3-workflow-editor/3-execution.md
  - spec/5-system/4-execution-engine.md
  - spec/5-system/6-websocket-protocol.md
  - spec/5-system/8-embedding-pipeline.md
  - spec/5-system/10-graph-rag.md
  - spec/data-flow/0-overview.md
  - spec/data-flow/6-knowledge-base.md
---

# WS 이벤트 값·타입의 정본 위치 서술 정정

## Overview

#1175 가 WS 이벤트 값·타입 12개를 `websocket.service.ts` 에서 **의존성-프리 모듈**
`websocket-events.types.ts` 로 옮겼다 (ES-module 순환 해소). `websocket.service.ts` 가
re-export 하므로 **동작은 불변이고 기존 문장이 거짓이 되지도 않았다.** 다만 spec 이 "권위 정의는
여기" 라고 가리키는 **정본 소재**가 낡았다.

방치하면 이 저장소가 반복해 겪은 형태가 된다 — 독자가 선언을 찾으러 엉뚱한 파일을 연다.
`22_27_21` cross_spec·plan_coherence 가 이 항목을 WARNING/INFO 로 올렸고, developer 권한 밖
(`spec/` read-only)이라 planner 턴으로 넘어온 건이다.

## 핵심 — 일괄 치환하면 틀린다

7곳이 같은 종류가 아니다. **정본(선언)이 옮겨진 것**과 **동작 주체(메서드·facade)** 를 갈라야 한다:

| 무엇 | 옮겼나 | 결론 |
|---|---|---|
| `KbEventType` · `NodeEventType` · `ExecutionChannelEvent` 등 **선언 12개** | **옮김** → `websocket-events.types.ts` | 정본 서술 갱신 대상 |
| `WebsocketService.emitKbEvent` **메서드** | 안 옮김 | 그대로 맞다 |
| 단일 sink / RxJS fan-out **facade** (`executionEvents$`) | 안 옮김 | 그대로 맞다 |

그래서 `6-websocket-protocol.md:1034` 처럼 `` `WebsocketService.emitKbEvent` 의 `KbEventType`
union `` 이라고 쓴 문장은 **앞은 맞고 뒤만 낡았다.** union 의 소재만 고친다.

## 변경안 (7곳)

### ① `spec/3-workflow-editor/3-execution.md:657` — 내가 빠뜨렸던 곳

`NodeEventType` 의 정본을 `websocket.service.ts` 로 지목.

- 현재: ``(`NodeEventType` 의 `execution.node.*` prefix — `websocket.service.ts`)``
- 변경: ``(`NodeEventType` 의 `execution.node.*` prefix — `websocket-events.types.ts`)``
- 동반: frontmatter `code:` 에 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 등재
  (`20_05_19` cross_spec INFO2 — 자매 spec `6-websocket-protocol.md` 와 비대칭이었다)

### ② `spec/5-system/10-graph-rag.md:552`

- 현재: `` `websocket.service.ts` 의 `KbEventType` union 에서 #443 에서 제거됐다 ``
- 변경: `` `websocket-events.types.ts` 의 `KbEventType` union 에서 #443 에서 제거됐다 ``

### ③ `spec/5-system/6-websocket-protocol.md:740`

- 현재: ``backend 권위 정의는 `WebsocketService` 의 `KbEventType` union (11개 = embedding 6 + graph 5)``
- 변경: ``backend 권위 정의는 `websocket-events.types.ts` 의 `KbEventType` union (11개 = embedding 6 + graph 5)``

### ④ `spec/5-system/6-websocket-protocol.md:1034` — **부분만 stale**

- 현재: ``(`WebsocketService.emitKbEvent` 의 `KbEventType` union, `kb:${documentId}` 채널)``
- 변경: ``(`WebsocketService.emitKbEvent` 가 발행, union 정의는 `websocket-events.types.ts` 의
  `KbEventType`, `kb:${documentId}` 채널)``
- **메서드명은 건드리지 않는다** — 안 옮겼다.

### ⑤ `spec/5-system/8-embedding-pipeline.md:276`

- 현재: ``backend 권위 정의는 `WebsocketService.emitKbEvent` (KbEventType union).``
- 변경: ``backend emit 은 `WebsocketService.emitKbEvent`, union 권위 정의는
  `websocket-events.types.ts` 의 `KbEventType`.``

### ⑥ `spec/data-flow/6-knowledge-base.md:288`

- 현재: ``권위 정의는 backend `WebsocketService` 의 `KbEventType` union``
- 변경: ``권위 정의는 backend `websocket-events.types.ts` 의 `KbEventType` union``

### ⑦ `spec/data-flow/0-overview.md:110` — 인용 포인터만

단일 sink 서술 자체는 맞다 (facade 는 안 옮겼다). **인용 대상**만 낡았다.

- 현재: ``(`websocket.service.ts` 헤더 주석, EIA §R10)``
- 변경: ``(`websocket-events.types.ts` 의 `ExecutionChannelEvent` JSDoc, EIA §R10)``
- 근거: R10 문구는 이제 그 타입의 JSDoc 이다. `websocket.service.ts` 헤더에는 "값·타입을
  분리했다" 는 안내만 남았다.

## ⑧ 별건 — `spec/5-system/4-execution-engine.md` §4.4 Rationale 보완

`22_27_21` rationale_continuity INFO3 · `20_05_19` INFO4.

§4.4 "순환 의존 처리" 가 `forwardRef` / `ModuleRef.get` **두 기법만** 언급한다. #1175 가 쓴
"값·타입을 의존성-프리 모듈로 분리" 는 **직교하는 세 번째 완화 기법**인데 본문에 없다.

**착지점** (`23_28_47` cross_spec INFO3 — "말미" 는 모호하다): `### 4.4` 의 `근거:` 목록 중
**"순환 의존 처리" 항목 마지막 문단**, 즉 *"…현재는 두 기법으로 봉인한 상태를 유지한다."*
바로 뒤 (`spec/5-system/4-execution-engine.md` §4.4, 문서 하단 `## Rationale` 이 **아니다**).

추가할 문단:

> **축이 다른 세 번째 완화책** — 위 두 기법은 **DI 그래프**를 다루지만, 순환은 **ES-module
> 그래프** 층위에서도 문제를 낸다: 순환 위 모듈이 *모듈 평가 시점*에 다른 모듈의 값(enum 등)을
> 읽으면 아직 `undefined` 다. 이 층위는 값·타입 선언을 **의존성-프리 모듈**로 분리해 해소한다
> (`websocket-events.types.ts`, #1175 — 그 전엔 지연 평가로 우회했다). **DI 그래프·`forwardRef`
> 배치·단일 sink 정책은 이 조치로 바뀌지 않으며**, 위 문단이 유예한 *"이벤트 기반 디커플링으로
> 순환을 근본 축소"* 도 **여전히 유예 상태**다 — 줄어든 것은 모듈 그래프이지 DI 그래프가 아니다.

**유예 결정을 뒤집지 않는다.** `23_28_47` cross_spec W3 이 "근본 축소가 일부 진행됐다" 는 오독
여지를 지적해서, 문단 첫 줄에 **축 구분**을 두고 마지막 줄에 **무엇이 안 줄었는지**를 못 박았다.

## 범위 밖

- `NotificationEventType` 개명 (동명 충돌) — 별도 백로그
- `6-websocket-protocol.md` 의 `### 4.3`/`4.4` 절 번호 중복 — 이번 diff 무관 기존 상태
- `codebase/**` 일체 — planner 턴이다

## Rationale

**왜 re-export 가 있는데도 고치나.** 문장이 거짓은 아니다. 하지만 spec 의 "권위 정의" 는
독자에게 *선언을 찾을 위치*를 알려주는 계약이고, 지금은 그 계약이 한 단계 우회한다. 이 저장소는
같은 형태(미러 문서 drift)를 반복해 겪었고, re-export 는 언젠가 걷힐 수 있다.

**왜 일괄 치환이 아닌가.** `emitKbEvent` 와 fan-out facade 는 `WebsocketService` 에 그대로
있다. `WebsocketService` 를 전부 새 파일명으로 바꾸면 **맞던 문장을 틀리게 만든다.** 그래서
7곳을 개별 판정했고 ④⑤는 "발행 주체 / union 정의" 를 나눠 썼다.

**왜 체크리스트에 "선행 plan 닫기" 를 넣었나.** `23_28_47` plan_coherence W2 — 이 항목들은
`ws-event-types-extract.md` §"후속" 에 등재된 것이고, 적용 후 그쪽을 안 닫으면 **이미 해소된
항목이 미해결로 남아** 다음 세션이 중복 조사한다. 이 저장소가 기록한 실패 형태다.

**기각한 대안 — 새 spec 문서 신설.** "WS 이벤트 타입 정본" 문서를 따로 만들어 6곳이 그것을
참조하게 하는 방안을 검토했으나 기각한다. 지금 문제는 구조가 아니라 **한 파일명이 낡은 것**이고,
문서를 늘리면 동기화 지점이 하나 더 생긴다. `spec/conventions/spec-impl-evidence.md` 의
frontmatter `code:` 가 이미 "어느 코드가 이 spec 을 구현하나" 를 담당한다.

## 체크리스트

- [x] `--spec` — `23_28_47` **BLOCK: YES**(이 draft 자신의 frontmatter 결함, 가드 실측 2 FAIL)
      → 정정 후 `23_38_46` **BLOCK: NO** (Critical 0 · Warning 0)
- [x] spec 7곳 정정 (①~⑦) — 각 치환 **1회 정확 일치**를 단언하고 적용
- [x] `3-execution.md` frontmatter `code:` 등재 (①)
- [x] §4.4 "축이 다른 세 번째 완화책" 문단 추가 (⑧) — `23_38_46` rationale INFO1 반영해
      **기존 표의 "ES-module 순환 봉인"(DI 인스턴스화 순서) vs 본 문단(모듈 평가 시점
      `undefined`)이 다른 실패 모드**임을 문단 안에 명시
- [x] **선행 plan 닫기** — `ws-event-types-extract.md` §"후속" 의 **체크박스 9개**
      (`planner 턴` 7건 + `그 밖` 의 `3-execution.md` frontmatter `code:` · §4.4 Rationale 2건).
      뭉뚱그리지 말고 명시하라는 `23_38_46` plan_coherence INFO4 반영
- [ ] push 게이트 통과 → PR

### `4-execution-engine.md` frontmatter `code:` 는 **일부러 안 건드린다**

§4.4 본문이 이제 `websocket-events.types.ts` 를 인용하니 `code:` 에도 넣을 법하다. 넣지 않는다 —
실측하면 이 문서의 `code:` 는 `execution-engine/**` · `shared/execution-resume/**` · frontend
ws client 뿐이고, **§4.4 가 통째로 `WebsocketService` 얘기인데도 backend websocket 모듈을 싣지
않는다.** 그게 이 문서의 확립된 스코핑(= 실행 엔진 자신의 코드만)이므로, 지금 타입 모듈만 넣으면
오히려 어긋난다. ①의 `3-execution.md` 는 반대다 — 거기 `code:` 는 이미 `websocket.service.ts`
를 싣고 있어서 자매 항목을 더하는 게 정합이다.

## 후속

- [ ] `.claude/docs/plan-lifecycle.md §4` 에 **plan-레벨 `pending_plans:`**(선행/의존)를
      spec-레벨 `pending_plans:`(책임 plan, `spec-impl-evidence.md §2.1`)와 구분해 문서화.
      `23_38_46` convention INFO3 — 금지 위반은 아니고 이미 자매 draft 도 같은 용법이지만,
      같은 키가 두 의미로 쓰이는 게 반복 관행이 됐다. harness 문서라 이 PR 범위 밖
