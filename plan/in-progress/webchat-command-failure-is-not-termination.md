---
worktree: (unstarted)
started: 2026-07-17
owner: project-planner
---

# 웹채팅 위젯: 비-410 명령 실패는 종료인가 — 제품 결정 필요

**상태**: 미착수. **결정이 먼저 필요하고, 그 결정은 spec 변경을 수반하므로 `project-planner` 트랙이다.**
(`developer` 는 `spec/` read-only — CLAUDE.md.)

이 항목은 `webchat-boot-single-flight.md`(developer 트랙)에서 분리됐다. 그쪽 plan 하단의 산문으로만
두면 그 plan 이 `complete/` 로 이동할 때 함께 묻힌다 —
`/consistency-check --impl-done` 19_46_54 `plan_coherence` WARNING 이 정확히 이 위험을 지적했다.

## 배경

`sendCommand` 가 비-410 실패(5xx·409 STATE_MISMATCH·form 검증 4xx·순수 네트워크 순단)를 받으면
`ERROR` 를 디스패치하고, 리듀서가 이를 `phase: "ended"` 로 보낸다. 즉 **일시적 실패 한 번이 대화를
끝낸다.** `eia-client.ts` 의 `interact()` 가 410 만 특수 처리하고 나머지 `!res.ok` 전부와 fetch reject 를
같은 예외로 던지므로, 위젯은 "서버가 죽었다" 와 "패킷 하나 놓쳤다" 를 구분하지 못한다.

## 무엇이 어긋나는가

| spec | 약속 | 현 구현 |
| --- | --- | --- |
| [`1-widget-app.md` §2 "Form" 행](../../spec/7-channel-web-chat/1-widget-app.md) | 실패 시 `error.details` 표시 후 **재제출** | `ended` — 재제출 표면이 사라진다 |
| [`3-auth-session.md` §3.1-2](../../spec/7-channel-web-chat/3-auth-session.md) | `200` + `running`/`waiting_for_input` → SSE 재연결 → **복원** | 복원은 되지만(§ 아래) UI 는 `ended` 로 남는다 |

`3-auth-session.md` §3.1-3 의 storage 정리 조건 열거(SSE terminal / 복원 시 200+terminal·404·복구불가
401 / 명령 410)에 **"그 외 명령 실패" 는 없다.** 그래서 storage 는 보존되고 새로고침하면 복원된다 —
하지만 같은 마운트에서는 `ended` 인 채 SSE 만 살아있는 **불일치 상태**가 남는다.

## 이 항목이 분리된 경위 (중요)

`webchat-boot-single-flight` PR 이 한때 이 gap 을 **반대 방향으로** 해석해 "에러도 종료다" 를 전제로
`teardownSession()`(storage 소거)을 추가했다. 결과는 **살아있는 대화의 영구 유실**이었다 —
`getStatus` 가 내내 `200 {status:"running"}` 인데도 새로고침 시 `phase=collapsed`. spec §3.1-3 의 명시
열거를 코드가 조용히 넘은 것이라 되돌렸다(ai-review 18_39_11 `requirement` CRITICAL, 실측 단일라인 귀속).

**그 사건이 이 plan 의 존재 이유다**: gap 을 코드에서 즉흥적으로 메우면 방향을 반대로 잡아도
아무도 못 막는다. spec 이 먼저 답해야 한다.

## 결정해야 할 것

1. **비-410 명령 실패는 종료인가?**
   - (A) **아니다 — 일시적 실패로 취급**. `ERROR` 가 `ended` 로 보내지 않고, 에러 표시 + 현재 표면
     유지(재제출 가능). `1-widget-app.md` §2 Form 약속과 정합. → `widget-state.ts` 의 `ERROR` 전이
     재설계 필요.
   - (B) **그렇다 — 종료로 취급**. 그러면 `3-auth-session.md` §3.1-3 정리 조건에 그 항목을 **명문화**
     해야 하고, "일시적 500 에도 대화 영구 소실" 을 제품이 수용한다는 뜻이다(권장하지 않음 — 위
     사건이 그 대가를 보여줬다).
   - (C) **오류 종류로 분기**. 예: 4xx 검증 실패 → 재제출, 5xx/네트워크 → 재시도 후 종료.
     `interact()` 가 상태코드를 이미 실어 보내므로 구현 가능하나 분기 기준을 spec 이 정해야 한다.
2. (1)의 답에 따라 `ended` 인 채 SSE 가 살아있는 상태를 어떻게 정리할지 — 현재는 `ERROR` 가
   `teardownSession` 을 거치지 않아 스트림이 남는다(이 PR 이전부터의 동작).

## 선행/참조

- 되돌림 경위·실측: `plan/complete/` 로 이동할 [`webchat-boot-single-flight.md`](./webchat-boot-single-flight.md) §후속 (18_39_11 처리)
- 리뷰 근거: `review/code/2026/07/17/18_39_11/requirement.md` (CRITICAL), `SUMMARY.md`
- 분리 요구: `review/consistency/2026/07/17/19_46_54/plan_coherence.md` (WARNING)

## 체크리스트

- [ ] 결정 (A/B/C) — 사용자 또는 `project-planner`
- [ ] `spec/7-channel-web-chat/3-auth-session.md` §3.1-3 · `1-widget-app.md` §2 반영
- [ ] `/consistency-check --spec` 통과
- [ ] 구현 (`developer` 트랙 인계) + 회귀 테스트
</content>
