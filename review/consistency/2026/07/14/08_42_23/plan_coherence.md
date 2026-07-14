# Plan 정합성 검토 — spec/5-system/4-execution-engine.md (--impl-done)

## 검토 방법 메모

payload 의 "진행 중 plan 문서 모음" 에는 5개 plan(`ai-agent-tool-connection-rewrite.md`,
`cafe24-backlog-residual.md`, `chat-channel-discord-gateway.md`,
`chat-channel-slack-socket-mode.md`, `chat-channel-visual-ssr-png.md`)만 포함돼 있었고,
diff 가 실제로 구현하는 `plan/in-progress/eia-command-waiting-surface-guard.md`(diff 주석에
"F-1 (plan eia-command-waiting-surface-guard)" / "F-2 (plan eia-command-waiting-surface-guard)"
로 명시 참조됨)는 **payload 코퍼스에서 누락**돼 있었다. payload 만으로는 정합성 판단이
불가능해, `plan/in-progress/` 를 직접 조회해 이 plan 및 인접 후보(`execution-engine-residual-gaps.md`,
`eia-context-schema-followups.md`, `spec-sync-external-interaction-api-gaps.md`,
`merge-p2-async-fanin.md`, `self-hosting-deployment.md`)를 보완 확인했다.

## 발견사항

### [INFO] payload plan 코퍼스에 target 의 직접 소유 plan 누락
- target 위치: (payload 구성 — target 문서 자체 결함 아님)
- 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md`
- 상세: diff 의 F-1(`expectedNodeId` 스레딩)·F-2(`surfaceMismatch` 안내)는 이 plan 의 "후속
  항목" 섹션을 그대로 구현한 것이고, 코드 주석·테스트 설명에 plan 파일명이 직접 인용된다.
  그런데도 orchestrator 가 만든 payload 의 plan 코퍼스에는 포함되지 않아, 이 checker 가
  payload 만 신뢰했다면 "미해결 결정과의 충돌" 판단 근거 없이 통과시켰을 것이다.
- 제안: target 문서 경로(`spec/5-system/4-execution-engine.md`)와 diff 파일 경로
  (`execution-engine.service.ts`, `interaction.service.ts` 등) 기준으로 plan 코퍼스를 고를 때,
  diff 본문/주석에 명시 인용된 `plan/in-progress/<name>.md` 파일명을 grep 해 코퍼스에 강제
  포함시키는 규칙을 orchestrator 선택 로직에 추가할 것을 제안(체커 자체 수정 대상은 아님).

### 결론: 미해결 결정과의 충돌 — 없음
`eia-command-waiting-surface-guard.md` 를 직접 읽은 결과, F-1 은 "결정(사용자, 2026-07-14):
Approach B — 외부 caller 만 검사 + `in_process_trusted` 면제" 로 이미 확정돼 있고, diff 는 정확히
이 Approach B 를 구현한다(`interaction.service.ts` 의 `isInternalCtx(ctx) ? undefined :
dto.nodeId`, `resolveWaitingNodeExecutionId` 의 `expectedNodeId` optional 검사). F-2 도 "CCH-ERR-04
관례에 맞춰 best-effort 안내" 로 결정 완료 상태이고 diff 의 `sendSurfaceMismatchNotice` /
`SURFACE_MISMATCH_DEFAULTS` 구현과 정확히 일치한다. target 문서(`spec/5-system/4-execution-engine.md`
§7.5.1)도 이미 plan 의 F-1 체크리스트("spec §7.5.1 — nodeId 불일치 행 + 진입점별 커버리지 표")에
따라 갱신되어 있고, in_process_trusted 면제·WS/`/continue` 미적용·"확장은 별도 후속(plan F-6)"
문구까지 코드·plan·spec 3자가 정확히 대응한다. **일방적 결정 우회 없음.**

### [INFO] F-6 (WS/`/continue` nodeId 검사 확장)이 target frontmatter `pending_plans:` 에 미등재
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:`
  (현재 `execution-engine-residual-gaps.md`, `exec-intake-followups.md` 만 등재) / 본문 §7.5.1
  코드 진입점별 커버리지 표 "WS continuation … 확장은 별도 후속(plan F-6)" 문구
- 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` §F-6 (미완료, "본 PR 범위 밖")
- 상세: `spec/conventions/spec-impl-evidence.md` 는 `pending_plans:` 를 "미구현 surface 를
  책임지는 plan 경로" 로 정의한다. §7.5.1 코드 진입점별 커버리지 표는 WS continuation·REST
  `/continue` 의 nodeId 검사를 "미적용" 으로 명시하며 본문에서 그 확장 작업을 "plan F-6" 로
  직접 지칭한다 — `execution-engine-residual-gaps.md` 의 G2(§11 errorPolicy 분기, defer 확정)와
  본질적으로 같은 패턴(spec 본문이 미구현 surface 의 owner plan 을 명시)인데, G2 owner 는
  `pending_plans:` 에 등재된 반면 F-6 owner 는 등재돼 있지 않다.
  다만 동일 패턴이 `spec/5-system/14-external-interaction-api.md`(F-1/F-2/F-3 이 직접 손댄 spec)
  의 `pending_plans:` 에도 이 plan 이 없어, 이번 diff 로 새로 생긴 누락이 아니라 이 plan 라인
  전체(F-1~F-6)에 걸친 기존 패턴으로 보인다. 이 plan 은 이미 여러 차례
  `/consistency-check --impl-done`(BLOCK: NO)을 통과했으므로 build-time 가드
  (`spec-status-lifecycle.test.ts` 등)에 걸리는 하드 오류는 아니다(target 은 이미 다른 사유로
  `status: partial` 이라 `pending_plans:` 비어있음 가드는 무관).
- 제안: F-6 이 실제로 "언젠가 구현될 promise" 라면 `plan/in-progress/eia-command-waiting-surface-guard.md`
  를 target frontmatter `pending_plans:` 에 추가해 추적성을 맞추는 편이 좋다. 반대로 F-6 이
  결정된 확장이 아니라 "제안만 해둔 backlog" 라면(§F-6 문구 자체가 "별도 결정·작업이라 이관" 이라
  아직 착수 결정도 안 된 상태), 현재처럼 `pending_plans:` 미등재를 유지하는 것도 방어 가능 —
  다만 이 경우 spec 본문 문구를 "(plan F-6, 착수 미결정)" 등으로 좀 더 명확히 하면 좋다. 어느
  쪽이든 target 자체를 막을 사안은 아니며, 다음 spec 동기화 시 함께 정리 권장.

## 요약

target(`spec/5-system/4-execution-engine.md`)이 반영하는 diff 는 `plan/in-progress/
eia-command-waiting-surface-guard.md` 의 F-1(Approach B, 2026-07-14 결정 완료)·F-2(best-effort
안내, 결정 완료)를 정확히 구현하며, 그 plan 은 이미 수차례의 `/ai-review`·`/consistency-check
--impl-done`·spec 동기(S-1) 단계를 BLOCK:NO 로 통과한 상태다. 코드·spec·plan 3자가 Approach B
결정과 정확히 일치하고, "결정 필요" 로 남겨둔 항목을 우회하는 정황도 없다. 유일한 관찰 사항은
payload 자체가 이 핵심 plan 을 코퍼스에서 누락시켰다는 점(INFO, orchestrator 개선 여지)과,
target frontmatter `pending_plans:` 가 F-6(아직 미결정 후속) 을 명시 등재하지 않은 기존 패턴
(INFO, 이번 diff 로 신규 발생한 문제 아님)이다. 두 항목 모두 target 병합을 막을 수준은 아니다.

## 위험도

LOW
