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
  - spec/data-flow/0-overview.md
---

> **상태 (2026-08-08 위생 정리)** — **§1~§3 은 전부 머지됐다** (`#1042`, `0d20a9cc9`).
> `in-progress/` 에 남는 이유는 아래 **§4(서술형 "LLM Config" 표기, 별도 범위)** 하나뿐이며,
> 그 항목이 체크박스 없이 산문으로만 있어 이 plan 이 "0 open" 으로 보이던 상태였다.
> Stop 훅의 완료 nudge 가 오발화하므로 §4 를 체크리스트에 명시로 올렸다.
>
> `worktree:` 를 `spec-structural` → `(unstarted)` 로 정정 (그 worktree 는 머지 후 회수됨).

## Overview

`#1040` 의 `/consistency-check --impl-done` 라운드가 `spec/data-flow/` 전수를 점검하며 낸 WARNING
중, **그 PR 범위 밖이라 닫지 못한 3건**을 분리해 추적한다. 셋 다 `spec/` 쓰기라 **planner 턴**이 필요하다.

원 plan(`review-info-followups.md` §4)에서 이관. 그 plan 의 해당 3개 항목은 `#1041` 에서 `[x]` 로
갱신하며 본 plan 으로의 상호참조를 달았고, plan 자체도 `plan/complete/` 로 이동했다.

> **`plan/complete/spec-sync-structural-followups.md` 와 혼동 금지** — 파일명 접미(`…structural-followups`)
> 가 겹치지만 그쪽은 2026-06 spec-sync 감사 파생으로 **스코프가 무관**하다.

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

- [x] §1 RBAC 표 배치 — **(a) 승격 채택**. 인바운드 앵커 전수 확인 결과 `12-workspace.md#32`/`#4`
      를 가리키는 링크 **0건**이라 번호 재배치가 안전했다(`1-auth.md §3.2` 를 가리키는 것들과 혼동
      금지). `### 3.2` → `## 4. 권한 (RBAC 요약)` 승격, 기존 `## 4 외부 의존` → `## 5`,
      문서 내 자기참조 `§4`(Audit 도메인 행 지시) 1건도 `§5` 로 정정.
      **(b) 도 함께** — `0-overview.md` 에 `### 3.6 권한 요약 (선택)` 을 신설해 규약과 실물을
      둘 다 맞췄다(§3.4 아래에 두지 말 것 + SoT 는 `1-auth.md` §3.2 명시).
- [x] §2 SIGTERM 상호참조 각주 — 표 셀에 "분류 정책 결정 대기 중" + 표 아래 blockquote 로
      (a)/(b) 미결과 종속 실측 갭(`assertExecutionNotCancelled` 가 FAILED/SERVER_INTERRUPTED
      미관측)을 링크. **결정을 선점하지 않는 중립 서술**로 작성.
- [x] §3 명칭 통일 — **`data-flow/` 범위만**. 전수 조사 20건 중 상당수가 서술이 아니라 **코드
      식별자**였다(`ASSISTANT_NO_LLM_CONFIG` 에러 코드, `llm-config-selector` widget,
      `ED-AI-06`~`08` 요구사항 ID 문맥) — 문자열 치환하면 코드와 어긋난다. `12-workspace.md`
      §4 헤더·System role, `0-overview.md` 도메인 인덱스 4곳만 통일하고 범위를
      `12-workspace.md` Rationale "명칭 통일 범위" 에 명문화.
- [x] `/consistency-check --spec` — **BLOCK: NO**, Critical 0 · Warning 4 · INFO 6.
      W1 plan 절 오인용(§3→§4) · W2 `spec_impact` 에 `0-overview.md` 누락 · W4 동명 접미 혼동
      각주 — 셋 다 반영. W3(원 plan 미갱신)은 **`#1041` 이 이미 처리**한 것이 이 브랜치
      (origin/main 기준)에 없어 그렇게 보인 것 — 확인 후 Overview 에 명시.
      INFO#1(§3.6 근거가 본문에 있음 — §1 에서 지적한 것과 같은 종류)도 함께 닫아
      `0-overview.md` `## Rationale` 로 이동. (`review/consistency/2026/08/01/00_17_36/SUMMARY.md`)
- [x] push + PR — **머지 완료 `#1042` (`0d20a9cc9`)**. 착지 실측:
      `spec/data-flow/12-workspace.md:241` `## 4. 권한 (RBAC 요약)` ·
      `spec/data-flow/0-overview.md:180` `### 3.6 권한 요약 (선택)` ·
      `spec/data-flow/3-execution.md:300` "분류 정책 결정 대기 중".
      (머지 후에도 `[ ]` 로 남아 있던 것을 2026-08-08 위생 정리에서 정정.)
- [ ] **§4 서술형 "LLM Config" 표기** — 아래 §4 참조. **이 plan 의 유일한 잔여**이며,
      종전엔 산문으로만 있어 완료 판정을 오염시켰다. 2026-08-08 실측 잔존 **17건 / 4파일**:
      `3-workflow-editor/4-ai-assistant.md` · `3-workflow-editor/_product-overview.md` ·
      `4-nodes/3-ai/_product-overview.md` · `5-system/_product-overview.md`.
      (`data-flow/12-workspace.md` 의 2건은 §3 이 남긴 **범위 서술 자체**라 대상 아님.)

## 4. 잔여 — 서술형 "LLM Config" 표기 (별도)

`3-workflow-editor/`·`4-nodes/`·`5-system/` 에 남은 구 표기는 **식별자와 서술을 한 건씩 구분**해야
한다. 기계적 치환 금지 — 아래는 건드리면 안 되는 것들이다:

- `ASSISTANT_NO_LLM_CONFIG` (`4-ai-assistant.md:620`) — 에러 코드, 코드와 연결
- `llm-config-selector` (`4-ai-assistant.md:651`) — widget 이름
- `ED-AI-06`/`07`/`08` (`_product-overview.md`) — 요구사항 ID 의 설명문이라 ID 자체는 불변

바꿔도 되는 것: 순수 서술("LLM Config에 등록된 모델을 활용해", "LLM Config 선택 + 새 세션" 등).

## Rationale

**왜 `#1040` 에서 닫지 않았나**: 셋 다 그 PR 이 만든 결함이 아니고(전부 사전 존재), 고치면 scope 가
크게 번진다 — §1 은 섹션 번호 재배치로 하위 참조 연쇄 갱신, §3 은 문서군 전반 표기 변경이다.
`#1040` 은 그 자리에서 오독을 막는 최소 조치(bridging 문장)만 하고 나머지를 여기로 넘겼다.

**우선순위 P3 인 이유**: 셋 다 **내용이 틀린 것이 아니라 배치·표기** 문제다. 실제로 틀렸던
Critical(viewer 실행 권한)과 WARNING(LLM Config/Integration 권한 병합)은 `#1040` 이 이미 닫았다.
