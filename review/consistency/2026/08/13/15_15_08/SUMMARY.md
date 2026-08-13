# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건(중복 병합) 발견. target(`plan/in-progress/spec-draft-eia-notification-payload-contract.md`)이 EIA §6.3~§6.5 를 실제 emit 에 맞춰 정정하는 원칙은 견고하지만, 그 정정을 같은 논리로 확장해야 할 두 인접 위치(WS §4.1 completed/failed 행, `spec/conventions/chat-channel-adapter.md`)를 빠뜨려, target 이 없애려는 "문서가 실제와 다른 필드를 약속" 패턴을 그 자리에 재생산한다.

## 전체 위험도
**HIGH** — target 자체의 판단(§6.3 finalNodeId/finalPort 삭제, R16 선례 인용 등)은 실측으로 검증되고 견고하나, 수정 범위가 "문제의 절반"에서 멈춰 인접 파일 2곳이 즉시 stale 해지는 CRITICAL 결함 2건이 확인됨.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity(WARNING→강한 등급 채택) | WS §4.1 표에서 `execution.cancelled` 행만 nested 로 정정하고, 바로 옆 `execution.completed`/`execution.failed` 행은 target 이 스스로 "존재한 적 없다"고 실측한 `duration`/`nodeCount`/`failedNodeId` 를 계속 약속한 채 방치. target 이 세운 "동일 출처·동일 성격은 동일 판단" 원칙을 자신이 편집하는 같은 표 안에서 절반만 적용 | target 문서 "## 무엇을 쓸 것인가 → 3." (WS §4.1 동기화, cancelled 행 한정) | `spec/5-system/6-websocket-protocol.md` §4.1 표 L177-178 (`execution.completed`/`execution.failed` 행) | §3 을 `completed`/`failed` 행까지 확장. 실제 emit(`{executionId,status,seq,timestamp}` / `{...,error}`)에 맞춰 `duration`/`nodeCount`/`failedNodeId` 삭제 또는 "미구현(Planned)" 표기. 최소 대안: 의도적 제외라면 "## 비목표"에 명시 + 후속 항목 등재 |
| 2 | cross_spec, convention_compliance | `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` 유니온이 "EIA §6 이 SoT, drift 회피"(R3)를 명시하며 `execution.completed` 타입을 인라인 복제해 `result.finalNodeId`/`finalPort`(non-optional)·`durationMs`(non-optional) 를 필수로 선언. target 이 EIA §6.3 에서 이 필드들을 삭제/격하하면 이 컨벤션 문서만 즉시 stale — "drift 회피"가 목적인 문서 자체가 drift 상태가 됨. `execution.failed`/`execution.cancelled` variant 의 `durationMs: number` 도 동일 문제(3종 전체) | frontmatter `spec_impact`(L29-31, EIA+WS 2파일만), `## 체크리스트` | `spec/conventions/chat-channel-adapter.md` §1.2 (L138-147), Rationale R3 | `spec_impact` 에 `spec/conventions/chat-channel-adapter.md` 추가. §1.2 `execution.completed` variant 에서 `finalNodeId`/`finalPort` 삭제, `result`/`durationMs` optional 화. `execution.failed`/`execution.cancelled` variant 의 `durationMs` 도 §6.4/§6.5 결정과 맞춰 정정. 체크리스트에 항목 추가 |

## planner 인계 (권한 밖 Critical)

(없음) — 본 target 자체가 project-planner 의 spec draft plan이며, 위 Critical 2건 모두 이 draft 의 수정 범위를 확장하는 것으로 호출자(작성자) 권한 내에서 직접 해소 가능. `spec/` 쓰기 권한 밖 문제가 아님.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `execution.failed` 의 `durationMs` 마련 상태가 §6.3 과 비대칭 처리 — §6.3 은 "미구현(Planned)" 마커를 명시하지만 §6.4 는 `durationMs` 언급 자체가 없음 | "## 무엇을 쓸 것인가 → 2. §6.4" | target 자신의 "실측" 표(fanout 봉투에 `durationMs` 없음) + `chat-channel-adapter.md` L147 | `execution.failed` 의 `durationMs` 배선 여부 실측 후 §6.3 과 동일 기준(미구현 마커 또는 후속 등재) 적용 |
| 2 | convention_compliance | §6.3 재작성 예시의 cross-reference 링크가 placeholder(`#`) — 실 spec 반영 시 dead link. project conventions 전반은 `상대경로.md#앵커` 실링크 관행 | "무엇을 쓸 것인가 §1" 마지막 불릿 (`[EIA-IN-04 상태 조회](#)`) | conventions 전반의 cross-reference 관행 | `[EIA-IN-04 상태 조회](14-external-interaction-api.md#eia-in-04-...)` 형태의 실제 앵커로 교체 |
| 3 | plan_coherence | `execution.cancelled` "이미 정합" 전제가 `retry-turn.service.ts` 경로에서 거짓 — 실측이 `execution-engine.service.ts` 로 좁게 잡힘. `failRetryExecution`(L956-965)은 `cancelledBy` 자체를 emit 하지 않음(선재 결함, `retry-turn-terminal-guard.md` W1 로 이미 open 추적 중). `completeRetryExecution`(L723-727, 883-901)도 `durationMs`/`result.outputs` 를 DB엔 채우면서 emit 엔 안 담음 — target 의 "후속(developer)" 대상 라인 목록에서 누락 | "실측" 표 (`execution.cancelled` 행, "유일하게 부분 정합"), "### 3. §6.5" ("이미 result.cancelledBy 로 emit"), "## 후속 (developer)" 목록 | `plan/in-progress/retry-turn-terminal-guard.md` L272-278 (W1, 미체크 open), `codebase/backend/.../retry-turn.service.ts:723-727,883-901,956-965` | "실측" 표·§6.5 에 "단, retry-turn.service.ts 의 failRetryExecution 경로는 cancelledBy 미emit(선재 결함, retry-turn-terminal-guard.md W1)" 캐비엇 추가. "## 후속" 목록에 retry-turn.service.ts 세 지점 추가 또는 W1 교차 참조 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | EIA `durationMs` ↔ WS `duration` 필드명 불일치 — 같은 개념을 가리키는 두 이름이 target 이 손대는 두 파일에 남음 | EIA §6.3-6.5 vs WS §4.1 | Critical #1 처리 과정에서 함께 필드명 통일 또는 의도적 차이 명시 |
| 2 | convention_compliance | 본 bundle 이 컨텍스트 예산 초과로 `error-codes.md`, `swagger.md` 등 target 관련 conventions 다수가 절단되어 완전 검증 불가(기존 알려진 파이프라인 한계) | N/A | target 결함 아님 — `--spec` 모드 conventions 번들링 예산 재검토는 별도 백로그 |
| 3 | plan_coherence | `plan/in-progress/spec-draft-eia-r8-alignment.md` 가 체크리스트 전 항목 완료(2026-08-12)에도 `plan/complete/` 로 미이동 | 동일 worktree 인접 plan | target 범위 밖 — 별도 턴에서 이동 처리 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | WS §4.1 completed/failed 필드 미정정 + chat-channel-adapter.md spec_impact 누락 (CRITICAL 2건) |
| rationale_continuity | LOW | 대체로 견고(§6.3 삭제·R16 선례 검증됨), WS §4.1 cancelled-only 정정의 self-inconsistency만 지적(WARNING, cross_spec CRITICAL 과 병합) |
| convention_compliance | MEDIUM | chat-channel-adapter.md 누락 CRITICAL 확인 + placeholder 링크 WARNING + 컨텍스트 예산 초과로 일부 미검증 |
| plan_coherence | MEDIUM | `execution.cancelled` "이미 정합" 전제가 retry-turn.service.ts 경로에서 거짓 — 자매 plan W1 과 중복 추적 |
| naming_collision | NONE | 신규 식별자 도입 없음, 기존 이벤트명/필드 재구성만. 충돌 없음 |

## 권장 조치사항

1. **(BLOCK 해소)** target "## 무엇을 쓸 것인가 → 3." 을 확장해 WS §4.1 의 `execution.completed`/`execution.failed` 행도 `execution.cancelled` 와 동일 기준으로 정정(`duration`/`nodeCount`/`failedNodeId` 삭제 또는 미구현 표기).
2. **(BLOCK 해소)** `spec_impact` 에 `spec/conventions/chat-channel-adapter.md` 추가하고 §1.2 `EiaEvent` 3개 variant(`completed`/`failed`/`cancelled`)의 `finalNodeId`/`finalPort`/`result`/`durationMs` 를 target 의 EIA §6.3-6.5 최종 결정과 맞춰 optional화/삭제. 체크리스트에 항목 추가.
3. §6.4 의 `durationMs` 배선 여부를 §6.3 과 동일 기준으로 실측해 비대칭 해소(WARNING #1).
4. §1 예시 링크의 `(#)` placeholder 를 실제 앵커로 교체(WARNING #2).
5. `execution.cancelled` "이미 정합" 서술에 `retry-turn.service.ts`(`failRetryExecution`) 미emit 캐비엇 추가, `retry-turn-terminal-guard.md` W1 교차 참조 또는 "## 후속" 목록에 해당 3개 지점 추가(WARNING #3).
6. (선택) EIA `durationMs` / WS `duration` 필드명 통일(INFO #1).
---

## 이 라운드 처분 (main Claude)

**CRITICAL 2건 + WARNING 3건 전부 반영해 draft 를 전면 개정했다.** 둘 다 정확했고 둘 다 내 것이다.

두 CRITICAL 은 같은 결함이다 — **범위를 절반만 잡았다.**

- WS §4.1 에서 `execution.cancelled` 행만 고치고, 바로 옆 `completed`/`failed` 행이 약속하는
  `duration`·`nodeCount`·`failedNodeId` 는 두었다. **내가 직접 "엔진에 없다" 고 실측한 필드**를
  같은 표 안에서 절반만 처리한 것이다.
- `spec/conventions/chat-channel-adapter.md` 는 `spec_impact` 에 **아예 없었다**. 그 문서 §1.2 는
  `finalNodeId`/`finalPort` 를 **non-optional** 로 선언하면서 R3 로 "EIA §6 이 SoT, drift 회피" 를
  표방한다 — SoT 를 고치면 **drift 회피용 문서가 drift** 가 된다.

**이 세션에서 같은 형태가 다섯 번째다.** 그리고 결정적으로, 나는 **바로 앞 PR(#1164)에서
"SoT 이관 시 앵커 전수 grep 을 절차로" 를 plan 에 적어 놓고 내 draft 에는 적용하지 않았다.**
절차를 적는 것과 따르는 것은 다른 일이다.

이번 개정은 **필드 이름 전역 grep 으로 시작**했다:

```
grep -rn "finalNodeId\|finalPort\|nodeCount\|failedNodeId" --include="*.ts" --include="*.md" codebase/ spec/
```

그 결과 영향 파일이 2 → **3 + 코드 미러 1** 로 늘었다.

**WARNING 3 도 같은 뿌리였다.** draft 가 *"`cancelled` 는 이미 nested 로 emit 된다"* 고 적었는데
`retry-turn.service.ts` `failRetryExecution` 은 `cancelledBy` 를 **아예 안 담는다**. 내 실측이
`execution-engine.service.ts` 한 파일에 갇혀 있었다 — 한 파일을 재고 전체로 일반화했다.

WARNING 1(§6.4 `durationMs` 비대칭)·2(placeholder 링크 `(#)`)도 반영했다. INFO 1(EIA `durationMs`
vs WS `duration` 이름 불일치)은 **통일하기로** 했다 — 단위가 이름에 있는 쪽이 낫고 EIA 가 외부
계약이다.
