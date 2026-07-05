# Plan 정합성 검토 — spec-draft-g1-withdraw-ws-start-gate.md

## 검토 범위

- Target: `plan/in-progress/spec-draft-g1-withdraw-ws-start-gate.md` (spec draft, `--spec` 모드)
- 대조: `plan/in-progress/**` 전체(특히 `execution-engine-residual-gaps.md`, `spec-sync-websocket-protocol-gaps.md`, `exec-park-durable-resume.md`, `spec-draft-crash-running-redrive.md`, `spec-update-execution-engine-pr4.md`, `spec-update-gap-callout-plan-links.md`)
- 실 spec 파일 대조: `spec/5-system/4-execution-engine.md §11`(line 1222-1247), `spec/5-system/6-websocket-protocol.md §1.2/§4.2/§4.4/§4.5/§7/§8`, `spec/3-workflow-editor/3-execution.md §8.2/§9`, `spec/5-system/2-api-convention.md §10.3`

## 발견사항

- **[INFO] G1 철회 근거와 사실관계는 실제 spec/plan 상태와 정확히 일치**
  - target 위치: 배경 절 "사실관계 (검증됨)"
  - 관련 plan: `execution-engine-residual-gaps.md` G1(line 31-43), `spec-sync-websocket-protocol-gaps.md`(line 19: `execution.start`/`stop` 이미 미구현 항목으로 등재)
  - 상세: `6-websocket-protocol.md` line 197·201·213(§4.2), `3-execution.md` line 40·311·330(§8.2/§9), `4-execution-engine.md` line 1226·1228(§11)을 모두 직접 대조한 결과 target draft 의 인용 line 번호·문구가 실제 파일과 정확히 일치한다. `spec-sync-websocket-protocol-gaps.md` 역시 이미 `execution.start`/`execution.stop`을 미구현(Planned) 항목으로 독립 추적 중이라 target draft 의 "WS 시작 경로는 Planned 미래 표면" 결론과 상충하지 않고 오히려 뒷받침한다.
  - 제안: 조치 불필요. 근거가 견고함을 기록.

- **[INFO] G2 는 target 범위 밖으로 남아 있으며 이 처리는 적절**
  - target 위치: 변경 4 — "G1 헤딩 WITHDRAWN 처리" (G2 는 언급 안 함)
  - 관련 plan: `execution-engine-residual-gaps.md` G2(line 45-67, BLOCKED 유지), `exec-park-durable-resume.md` line 187·206·209(G2 부분 해소 표기), `spec-draft-crash-running-redrive.md` line 78·86(G2 defer 재확인, 사용자 결정 2026-07-03)
  - 상세: `4-execution-engine.md §11` 항목 4 의 "Phase 2" stale 문구(line 1237)는 G2 소관이며 G2 가 여전히 BLOCKED(defer 확정)이므로 target draft 가 이를 건드리지 않는 것이 맞다. G1 철회로 engine spec frontmatter 의 `status: partial` 유지 이유가 "G2 잔존"으로 좁혀진다는 draft 서술(변경 4)도 실제 frontmatter(`pending_plans` 유지, G2 미해소)와 정합한다.
  - 제안: 조치 불필요.

- **[WARNING] engine spec frontmatter `pending_plans` 의 선재 stale 엔트리 — target 과 무관하지만 인접 영역**
  - target 위치: 해당 없음 (target draft 가 손대지 않는 영역)
  - 관련 plan: `4-execution-engine.md` frontmatter(line 9-13) `pending_plans: [execution-engine-residual-gaps.md, spec-sync-execution-engine-gaps.md, exec-intake-followups.md, exec-park-durable-resume.md]` — 이 중 `spec-sync-execution-engine-gaps.md` 는 이미 `plan/complete/`로 이동되어 in-progress 에 존재하지 않는다(dangling pointer).
  - 상세: target draft 는 G1 철회로 `execution-engine-residual-gaps.md` 만 갱신 대상으로 삼는다. 이 자체는 정합적이나, 같은 frontmatter 블록에 이미 존재하는 stale pointer 는 draft 범위 밖이라 그대로 남는다. G1 철회 작업과 직접 충돌하지는 않지만, "engine spec frontmatter 정합화" 작업을 하는 김에 이 dangling 항목도 함께 정리하지 않으면 추후 별도 발견으로 재부상할 소지가 있다.
  - 제안: target draft 자체를 막을 사유는 아님(범위 밖 이슈). 원한다면 변경 4 실행 시 frontmatter `pending_plans` 에서 `spec-sync-execution-engine-gaps.md` 항목도 함께 제거하는 것을 고려. 강제 아님 — 별도 후속으로 남겨도 무방.

- **[INFO] api-convention.md §10.3 변경 범위 제한은 이웃 plan 과 충돌 없음**
  - target 위치: 변경 3
  - 관련 plan: `spec-sync-websocket-protocol-gaps.md` (WS 프로토콜 갭 전반 추적, api-convention.md 는 대상 파일로 명시돼 있지 않음)
  - 상세: target draft 는 "api-convention §10 전반의 WS 정합은 spec-sync-websocket-protocol-gaps.md 소관"이라 명시하고 execution.start 관련 최소 마커만 추가한다고 범위를 제한했다. 실제로 그 plan 의 미구현 항목 리스트(line 17-26)에는 api-convention.md 파일이 전혀 언급되지 않아 겹치는 후속 항목이 없다.
  - 제안: 조치 불필요.

## 요약

Target spec draft(G1 철회)는 `execution-engine-residual-gaps.md` G1 항목이 정확히 인용하는 사실관계를 실제 spec 파일(`6-websocket-protocol.md`, `3-execution.md`, `4-execution-engine.md`, `2-api-convention.md`)과 line 단위로 대조한 결과 모두 정확했다. G1 철회는 "필요성부터 평가"라는 기존 사용자 결정(2026-07-05)의 결과물이므로 미해결 결정을 일방적으로 우회하는 것이 아니라 그 결정을 이행하는 문서이며, G2(BLOCKED 유지)·engine spec frontmatter `status: partial`(G2 잔존으로 유지)와도 충돌 없이 정합하다. `spec-sync-websocket-protocol-gaps.md`가 이미 `execution.start`/`stop`을 별도로 미구현 추적 중인 점도 draft 의 결론을 뒷받침한다. 유일하게 눈에 띄는 사항은 engine spec frontmatter `pending_plans`에 이미 존재하는 `spec-sync-execution-engine-gaps.md`(complete 로 이동된 dangling pointer)인데, 이는 target draft 범위 밖의 선재 이슈이며 이번 변경을 막을 사유는 아니다.

## 위험도
LOW
