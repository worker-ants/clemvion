# RESOLUTION — `17_04_25` (`--spec` 3회차, BLOCK: NO)

CRITICAL 0 — **게이트 통과**. WARNING 4건은 전부 실재했고 전부 내 것이라 모두 고쳤다.

## WARNING 2 (cross_spec) — 정정하면서 **새 충돌을 만들었다**

B3 각주를 다시 쓰며 마지막 줄에 *"노드 종류를 읽어야 하면 `waitingNodeType` 을 쓴다"* 를
**무자격으로** 적었다. EIA §R17 은 정반대를 못박고 있다:

> *"`node.type` 은 외부 소비 매핑이 없다. … `waitingNodeType` 은 **WS 내부 부가 식별자**이고,
> 외부 클라이언트는 `interactionType` 으로 분기한다."*

**소비자별로 갈라 적었다** — 내부(에디터 WS)는 `waitingNodeType`, 외부(SSE·chat-channel·SDK)는
`interactionType`. 초판이 스코프를 빼먹었다는 사실도 함께 남겼다.

**같은 라운드에서 고친 것이 바로 옆에서 새 결함을 만든 형태다.** 2회차 Critical(*"없는 근거를
지어냄"*)을 고치면서, 그 문단 끝에 **다른 문서의 정책을 확인하지 않은 권고**를 붙였다.
정정문을 쓸 때도 **인접 주장 하나하나가 새 주장**이라는 것을 놓쳤다.

## WARNING 1 (rationale) — 내 plan 이 스스로와 모순됐다

B3 체크리스트 줄이 **폐기된 근거**(*"동일 이름·다른 계층"*)를 `[x]` 완료로, 취소선 없이
그대로 들고 있었다. 같은 문서 위쪽에는 정정 반영분이 있으니 **한 문서 안에서 두 말**을 한다.

체크리스트에 취소선 + *"`16_41_05` CRITICAL 로 반증, 실제 각주는 재작성분 참조"* 를 달았다.
**"체크박스 = 실제 상태"** 는 이 저장소가 반복 기록한 규칙인데, 이번엔 *상태*가 아니라
*근거*가 낡은 형태였다.

## WARNING 3 (convention) — 파일명이 planner 규약 이탈

`project-planner/SKILL.md` 3번이 draft 를 **`plan/in-progress/spec-draft-<name>.md`** 로
못박는다(선례: `spec-draft-cross-audit-doc-batch.md`). 내 파일은 `planner-doc-batch.md` 였다.

`git mv` 로 **`spec-draft-planner-doc-batch.md`** 로 정정하고, 참조 잔재 0건을 확인했다.
build guard 가 강제하지 않아 조용히 지나갈 수 있었던 자리다.

## WARNING 4 (plan_coherence) — harness 항목을 고립 등재했다

새 harness 갭을 EIA 트래커에만 넣어, 기존 harness 트래커
(`harness-consistency-summary-downgrade-rule.md` — **2026-08-09 에 같은 처방이 이미 실측·등재**,
`harness-review-gate-followups.md`)와 끊겨 있었다. 중복 진단을 낳는다.

**상호 참조를 넣되 이관하지는 않았다** — 발견 맥락이 EIA 시리즈이고 재현 근거(`13_30_49`·
`16_41_05` 두 라운드)가 여기 쌓여 있다. 대신 *"처방은 한 곳에서 집행돼야 하므로, harness
작업을 착수하는 쪽이 이 항목을 흡수한다"* 를 명시했다.

## INFO

- **#1** (`{id}` 정정 확인) · **#2** (`wire 전용` 라벨 EIA 일치 확인) — 직전 라운드
  WARNING 해소 확인 기록.
- **#3** (`{id}`/`<id>` cross-document 분기) — pre-existing, target 책임 밖. 이번 배치에서
  재작업하지 않는다.
- **#4** (`### 4.4` 헤딩 중복) — `13_30_49` 에서 이미 처분·등재.
