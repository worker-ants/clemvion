---
title: "`execution.node.*` 의 `envelope.output` 도 fail-closed allowlist — 유예 근거가 실측에 반증됐다"
status: complete
worktree: node-output-envelope-458f05
started: 2026-08-24
completed: 2026-08-24
owner: developer
spec_impact:
  # ── (1) planner 턴으로 고친다 — 자기-반증형 소정정 예외가 **적용되지 않는** 파일들 ──
  # 이 둘은 **API 계약 문서**라 CLAUDE.md 예외 조건 2 에 해당하지 않는다. 그래서 예외를
  # 원용하지 않고, 이 PR 안에서 **planner 턴**으로 처리한다(아래 `## 작업` 의 "(planner 턴)"
  # 항목). spec 을 별도 PR 로 떼면 머지 시차 동안 spec-impl drift 가 생기므로 같은 PR 에
  # 둔다 — `#1204`·`#1208` 에서 내린 것과 같은 판단이다.
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/6-websocket-protocol.md
  # `12_02_30` cross_spec W1 — §4.1 의 래퍼/도메인값 구분을 담은 형제 문서 둘. 같은 planner
  # 턴 범위다(내가 쓴 문장이 아니므로 자기-반증형 예외 대상 아님).
  - spec/conventions/chat-channel-adapter.md
  - spec/5-system/15-chat-channel.md
  # `12_55_09` convention W2 — 래퍼/도메인 구분의 **정본**을 Principle 0 에 1회 세운다.
  # 이 구분이 산문으로 5곳에 흩어져 이번 작업에서 4라운드 연쇄 정정을 낳았다.
  - spec/conventions/node-output.md
  # `12_42_20` cross_spec CRITICAL — `conversation-thread.md` §9.7 두 행(`node.failed`/
  # `node.completed` 의 error shape). **아래 (2) 와 같은 파일이지만 성격이 다르다**:
  # §8.4 는 자기-반증형 소정정, §9.7 은 **planner 턴**(내가 쓴 문장이 아니고 wire 계약이라
  # 예외 조건 1·2 둘 다 불충족).
  # ── (2) 자기-반증형 소정정 (CLAUDE.md 「자기-반증형 소정정」 절) — **이 한 파일에만** ──
  # 대상 문장: `#1208` 에서 내가 쓴 "잔여로 남은 것은 envelope.output 하나다 … 이종 payload 라
  # 같은 목록을 걸 수 없다". **상태 예고**이지 API 계약 조항이 아니다(조건 2 충족). 이 작업의
  # 실 DB 조회가 반증했고(조건 3), 취소선 보존 + 그 문장에 국한(조건 4).
  # 게이트는 `--impl-done spec/conventions/` (조건 5).
  - spec/conventions/conversation-thread.md
---

# `envelope.output` allowlist (EIA §R17 표의 잔여 행)

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
의 항목 *"`execution.node.completed`/`.failed` 의 `envelope.output` 은 아직 deny-list 다"*
(2026-08-23 등재, `23_29_27` cross_spec CRITICAL).

`#1208` 이 SSE/fanout 의 `waiting_for_input` 표면만 닫고 이 표면을 **의도적으로 남겼다**.
그 유예의 근거를 이 작업이 **먼저 재검증했고, 틀렸다.**

## ⚠️ 내가 #1208 에 쓴 유예 근거는 틀렸다

`#1208` 은 이렇게 적었다 — spec §R17 정정 블록·트래커·커밋 본문 세 곳에:

> `envelope.output` 은 `NodeHandlerOutput` 하나가 아니라 **이종 payload** 다. 버튼 재개
> record `{type, buttonId, buttonLabel, clickedAt, selectedItem, nodeOutput, _selectedPort}`
> 를 정본 `allowlistNodeOutputKeys` 에 넣으면 **`{}`** 가 된다(실측).

**그 `{}` 실측 자체는 맞다. 틀린 것은 "그 객체가 `outputData` 가 된다" 는 전제다.**

`resolveButtonInteraction` 이 만드는 그 flat record 는
`contextService.setNodeOutput` 으로 **in-memory `nodeOutputCache`** 에만 들어간다
(`button-interaction.service.ts:503`). `nodeExec.outputData` 에 실제로 대입되는 것은
그 다음 줄의 `buildResumedStructuredOutput(...)` 결과이고, 그 함수의 반환 타입은
**`NodeHandlerOutput`** 이다 — `{config, output, port, status, meta?}`, **전부 allowlist 안**.

> **교훈**: 나는 "그 객체에 allowlist 를 걸면 어떻게 되나" 를 쟀고, 물었어야 할 것은
> **"그 객체가 이 표면에 도달하나"** 였다. 프록시를 재고 결론을 냈다.

## 실측 — 진짜 `outputData` shape (정본 구현 재현 아님, 실 DB 조회)

e2e 285건을 돌린 뒤 **teardown 전에** 실 postgres 를 조회했다
(`docker compose … up` → `run --rm runner` → 조회 → `down`).

```sql
SELECT k, count(*) FROM node_execution ne,
  LATERAL jsonb_object_keys(ne.output_data) AS k
WHERE ne.output_data IS NOT NULL AND jsonb_typeof(ne.output_data)='object'
GROUP BY k ORDER BY 2 DESC;
```

| top-level 키 | 행 수 | allowlist |
| --- | --- | --- |
| `meta` | 83 | ✅ |
| `config` | 82 | ✅ |
| `output` | 81 | ✅ |
| `port` | 20 | ✅ |
| `status` | 7 | ✅ |
| `conversationConfig` | 1 | ✅ |

전체 93행 중 84행이 object, 9행이 NULL, **배열·스칼라 0행**. flat record 는 **한 행도 없다**.

**즉 같은 목록을 그대로 걸 수 있다.**

## 남은 위험 — `finalAdapted ?? nodeOutputCache` 폴백

`ai-turn-orchestrator.service.ts:1451` 이 `finalAdapted` 가 nullish 면
`context.nodeOutputCache[node.id]` 를 `outputData` 로 쓴다. 그 캐시는
`execution-context.service.ts:214` 주석이 *"already-flattened engine output … 의도적으로
bare (예: `{parameters: {}}`)"* 라 부르는 **flat view** 다.

- **285건에서 한 번도 안 나타났다** — 위 표에 `parameters` 등이 없다.
- 그래도 코드 경로로는 살아 있으므로 **캐너리로 현 동작을 고정**하고, "flat view 가
  `outputData` 로 영속되는 것이 옳은가" 는 **별건**으로 트래커에 등재한다(이 PR 이
  고칠 문제가 아니다 — 고치면 영속 계약을 건드린다).

## 배선

`#1208` 이 만든 `allowlistFanoutNodeOutput` 에 **세 번째 위치**를 더한다:

| 이벤트 | 위치 |
| --- | --- |
| waiting (form) | `envelope.nodeOutput` — #1208 |
| waiting (buttons) | `envelope.buttonConfig.nodeOutput` — #1208 |
| **`node.completed`/`.failed`** | **`envelope.output`** — 이번 |

chat-channel `node.completed` 소비 경로도 같은 13키로 덮인다 — dispatcher 가 `p.output` 을
그대로 넘기고, 렌더러가 `nodeOutput.rendered`·`.payload`·`.title`·`.config`·`.output` 을
읽는다(#1208 이 넓힌 그 키들).

## 작업

- [x] `/consistency-check --impl-prep` — `10_44_28` **BLOCK: YES** (절차 Critical) → 아래
      `RESOLUTION.md`. 실질 spec-code 충돌은 checker 재확인에서 **이미 해소** 판정.
- [x] `--impl-done` **두 스코프** (`12_13_36` plan_coherence W1 이 요구한 증거 인용)
      - `12_02_30` (`spec/5-system/`) **BLOCK: NO** · W2 → 형제 문서 2곳 정정 + 게이트 실행
      - `12_13_36` (`spec/conventions/`) **BLOCK: YES** — 자기-반증형 소정정 **조건 5** 게이트.
        같은 파일 §3 매핑표에 미러가 하나 더 남아 있었다(§1.3 은 고치고 §3 은 안 고쳤다).
        planner 턴으로 정정 → `12_24_55` 재실행으로 해소.
- [x] `allowlistFanoutNodeOutput` 에 `envelope.output` 배선 (최상위 두 키를 공통 헬퍼로)
- [x] 캐너리 — `_retryState` 제거 · 렌더 키 보존 · **내부 WS 불변** · flat 폴백 동작 고정
- [x] **#1208 의 잔여 캐너리를 뒤집었다** (`[잔여] … 아직 allowlist 를 지나지 않는다`)
      — 그 테스트의 JSDoc 이 *"닫히면 RED 가 되고 그 단언을 뒤집는 것이 그 작업의 일부"*
      라고 적어 뒀다. 그 계약을 이행했다.
- [x] **(planner 턴)** §R17 표의 잔여 행 flip + 틀린 유예 근거 취소선 정정, WS §4.4 단서,
      WS §4.1 표에 `output` 열 + 래퍼/도메인값 이름 분리(`10_44_28` naming W2 · INFO 1)
- [x] 뮤테이션 검증 — 3건, **예측 2/3 적중 + 1건은 내 예측이 틀렸다**
- [x] TEST WORKFLOW 4단계 + ratchet — lint 48s · unit 85s(backend **8,997 passed** /
      433 suites, 전 러너 실패 0) · build 145s · e2e 239s(285 passed) · ratchet 199/38 일치
- [x] `/ai-review` — 3라운드로 수렴
      - `11_05_39`: LOW · C0 · **W3** → 3건 전부 처리. 핵심은 **"emit 5곳" 이 6곳**이었던
        내 정량 오류(다섯 자리 전수 정정) · 리팩터가 떼어 놓은 JSDoc · `#1208` 과 비대칭이던
        breaking-change 고지.
      - `11_34_04` (타겟 4명): LOW · C0 · **W0 → 수렴.** INFO 2건만 처리 —
        그중 `.failed` 직접 증거는 **내가 spec 에 그 보장을 써 넣었기 때문에** 넘기지 않았다.
      - `11_53_06` (타겟 2명): LOW · C0 · **W1** — 이 체크박스 미동기화 하나.

## 검증 기준

- **내부 WS 는 안 바뀐다** — #1208 과 같은 안전 조건.
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.

## 뮤테이션 (예측을 실행 전에 쓰고 실측과 두 칸으로 대조)

| # | 뮤턴트 | 예측 | 실측 |
|---|---|---|---|
| M1 | `narrowTopLevelNodeOutput(next, 'output')` 제거 | 신규 `output` 캐너리 + flat 폴백 캐너리 **2건** RED, 기존 `nodeOutput`/`buttonConfig` 는 GREEN | ✅ 2 failed / 56 passed (58 기준) — 정확히 그 둘, 나머지 GREEN |
| M5 | 〃 (**PR 종결 시점 재측정**) | 리뷰가 캐너리를 늘렸으니 RED 도 늘어야 한다 | ✅ **3 failed / 60 passed (63 기준)** — `.failed` 캐너리가 셋째로 독립 발화 |
| M2 | `…(envelope, 'nodeOutput')` 제거 | `nodeOutput` 캐너리 **2건** RED | ⚠️ **1 failed** / 57 passed — 예측이 틀렸다 |
| M3 | 헬퍼 copy-on-change 제거 | 기존 `동일 객체` 1건 RED | ✅ 1 failed / 57 passed — 그 테스트 |

**M1 의 카운트는 두 번 적는다** (`11_53_06` testing INFO 1). 뮤테이션을 돌린 시점(58건)과
  PR 이 닫히는 시점(63건)의 baseline 이 다르다 — 리뷰가 캐너리를 늘렸기 때문이다. 이 저장소가
  기록한 *"PR 안의 정량 기록은 PR 이 닫히는 시점의 값"* 에 맞춰 **M5 로 재측정**해 함께 실었다.
  결론(그 뮤턴트가 잡힌다)은 두 시점 모두 같고, 늘어난 1건이 `.failed` 캐너리다.

**M2 예측이 왜 틀렸나 (중요)**: chat-channel 4키 캐너리를 함께 셌는데, 그 넷은
`expect(nodeOutput[key]).toEqual(value)` 로 **보존**을 단언한다. 필터가 통째로 사라지면
보존은 여전히 참이라 **GREEN 이다** — 그 캐너리는 *과잉 좁힘*만 잡는 **단방향 가드**다.

설계 자체는 의도대로다(그 넷의 존재 이유가 chat-channel 렌더 파손 방지). 다만 **"이 캐너리가
무엇을 잡는가" 를 내가 한 방향으로만 세지 않았다** — 보존 단언과 제거 단언은 서로 다른
뮤턴트를 잡는다. M1 이 두 방향을 다 잡은 것은 신규 캐너리에 제거 단언(`_retryState`)과
보존 단언(`output`)이 **둘 다** 들어 있기 때문이다.

- **세 위치가 실제로 갈린다** — M1 과 M2 가 서로 다른 테스트를 RED 로 만든다(교집합 0).
- **내부 WS 는 안 바뀐다** — #1208 과 같은 안전 조건, 신규 캐너리가 대조군으로 고정.
