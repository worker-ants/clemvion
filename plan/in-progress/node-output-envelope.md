---
title: "`execution.node.*` 의 `envelope.output` 도 fail-closed allowlist — 유예 근거가 실측에 반증됐다"
status: in-progress
worktree: node-output-envelope-458f05
started: 2026-08-24
owner: developer
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/6-websocket-protocol.md
  # 자기-반증형 소정정 (CLAUDE.md 「자기-반증형 소정정」 절) — `#1208` 에서 내가 쓴
  # "잔여로 남은 것은 envelope.output 하나다 … 이종 payload 라 같은 목록을 걸 수 없다" 를
  # 이 작업의 실 DB 조회가 반증했다. 취소선 보존 + 정정. 게이트는 `--impl-done spec/conventions/`.
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

- [ ] `/consistency-check --impl-prep`
- [ ] `allowlistFanoutNodeOutput` 에 `envelope.output` 배선 (세 위치 공통 헬퍼로 정리)
- [ ] 캐너리 — `_retryState` 제거 · 렌더 키 보존 · **내부 WS 불변** · flat 폴백 동작 고정
- [ ] **#1208 의 잔여 캐너리를 뒤집는다** (`[잔여] … 아직 allowlist 를 지나지 않는다`)
      — 그 테스트의 JSDoc 이 *"닫히면 RED 가 되고 그 단언을 뒤집는 것이 그 작업의 일부"*
      라고 적어 뒀다. 그 계약을 이행한다.
- [ ] (planner 턴) §R17 표의 잔여 행 flip + **틀린 유예 근거를 취소선으로 정정**,
      WS §4.4 단서 갱신
- [ ] 뮤테이션 검증
- [ ] TEST WORKFLOW 4단계 + ratchet
- [ ] `/ai-review`

## 검증 기준

- **내부 WS 는 안 바뀐다** — #1208 과 같은 안전 조건.
- **뮤테이션**: `envelope.output` 배선만 제거 → 새 캐너리만 RED(기존 둘은 GREEN 이어야
  세 위치가 실제로 갈린다).
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.
