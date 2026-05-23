# Plan 정합성 검토 — multiturn-error-preserve

검토 대상: `plan/in-progress/multiturn-error-preserve.md`
검토 일시: 2026-05-23
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] `spec/5-system/6-websocket-protocol.md §4.4` — spec-drift-ws-button-config 와 같은 파일 경합 가능성

- target 위치: `plan/in-progress/multiturn-error-preserve.md` § "영향 spec" 표, `spec/5-system/6-websocket-protocol.md §4.1 / §4.2 / §4.6` 행
- 관련 plan: `plan/in-progress/spec-drift-ws-button-config.md` (worktree: `pending-assignment`) — 해당 plan 은 동일 파일의 `§4.4` 를 수정한다. 처리 우선순위 MEDIUM, 아직 worktree 미할당 상태.
- 상세: target 이 수정하는 섹션(`§4.1`, `§4.2`, `§4.6`)과 `spec-drift-ws-button-config` 가 수정하는 섹션(`§4.4`)은 서로 다르나 같은 파일이다. 두 plan 이 거의 동시에 진행되면 `6-websocket-protocol.md` 에서 merge conflict 가 발생할 수 있다. target plan 의 "의존성·리스크" 절에는 `spec-drift-ws-button-config` 와의 조율이 명시되어 있으나, `spec-drift-ws-button-config` plan 자체에는 반대 방향의 cross-ref 가 없다.
- 제안: `spec-drift-ws-button-config.md` 에 "multiturn-error-preserve 머지 후 rebase" 비고를 추가하거나, 두 plan 의 실행 순서(multiturn-error-preserve 먼저)를 plan frontmatter 또는 본문에 명시.

---

### [WARNING] `spec/4-nodes/3-ai/1-ai-agent.md §7.4` — ai-agent-tool-connection-rewrite 와의 `_resumeState` 스키마 경합

- target 위치: `plan/in-progress/multiturn-error-preserve.md` § "영향 spec" 표, `spec/4-nodes/3-ai/1-ai-agent.md §7.4` 행 — `_resumeState` / `_retryState` 비교 비고 추가
- 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §"의존성·리스크" — "완료 시 `_retryState` 형식도 검토 (`_resumeState` snapshot 이라 자동 추적되어야 하지만 schema 변경의 비호환 케이스에 대비)"
- 상세: `ai-agent-tool-connection-rewrite` 는 `_resumeState` 스키마를 직접 변경할 수 있다 (도구 연결 모델 결정에 따라 새 필드 추가 가능). target plan 의 `_retryState` 는 `_resumeState` snapshot + `expiresAt` 구조이므로, `ai-agent-tool-connection-rewrite` 가 `_resumeState` 에 새 필드를 추가하면 `_retryState` 의 "포함 필드 범위" 표 (target plan Rationale §credential-free 보장 표) 도 갱신이 필요하다. target plan 은 이 리스크를 "의존성·리스크" 절에 언급하고 있으나, `ai-agent-tool-connection-rewrite` 에는 `_retryState` 에 대한 영향 명시가 없다.
- 제안: `ai-agent-tool-connection-rewrite.md` "의존성·리스크" 절에 "완료 시 `multiturn-error-preserve` 의 `_retryState` 포함 필드 표 재검토 필요" cross-ref 추가. multiturn-error-preserve 가 먼저 머지되면 이 방향의 후속 추적이 중요.

---

### [WARNING] `ai-presentation-tools.md` plan 문서 미정리 — `spec/conventions/conversation-thread.md §1.2` 중복 표기

- target 위치: `plan/in-progress/multiturn-error-preserve.md` § "영향 spec" 표, `spec/conventions/conversation-thread.md §1.2` 행 — `data?` 행 비고에 `system_error` payload shape 인라인 정의
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` §4.1 작업 단위 — `spec/conventions/conversation-thread.md §1.2` 갱신이 `[ ]` (미완) 으로 표기되어 있음
- 상세: `ai-presentation-tools` PR #269 는 이미 main 에 머지되어 `spec/conventions/conversation-thread.md §1.2` 에 `presentations?` 행이 추가된 상태다. 그러나 `ai-presentation-tools.md` plan 의 해당 항목은 `[ ]` 로 남아 있어 "진행 중인 작업이 같은 파일의 같은 섹션을 손대고 있다" 는 오해를 줄 수 있다. 실제 충돌은 없으나 plan 문서 stale 상태가 검토자 혼란을 유발한다.
- 제안: `ai-presentation-tools.md` 의 §4.1 해당 `[ ]` 항목들을 `[x]` 로 처리하거나, plan 을 `plan/complete/` 로 이동. (PR #269 가 이미 codebase + spec 전체를 반영하여 머지 완료된 상태이므로 plan closure 조건이 충족됨.)

---

### [INFO] OQ2 (retry 횟수 한도) — 열린 상태로 명시됨 (escalate 후보)

- target 위치: `plan/in-progress/multiturn-error-preserve.md` § "Open Questions" — OQ2: "본 PR 은 명시적 한도 없음 — provider 가 자체적으로 429 를 다시 던지면 그게 한도. 한도가 필요하면 별 PR."
- 관련 plan: 없음 (연관 plan 없음)
- 상세: OQ2 는 의도적으로 "본 PR 에서 결정 안 함" 으로 처리되었으며, `_retryState.expiresAt` TTL 이 사실상 상한 역할을 한다는 설명도 있다. 이 결정이 추후 replay-rerun 이나 외부 표면 노출 plan 과 충돌할 가능성이 있다 (예: `spec/5-system/14-external-interaction-api.md` 에서 `retry_last_turn` 외부 노출 시 retry 횟수 제한 정책이 필요함 — target plan 이 EIA-IN-02 "외부 미노출" 로 scope 제한하여 현재는 충돌 없음).
- 제안: OQ2 를 후속 plan 아이템으로 명시적 추적 (예: `0-unimplemented-overview.md` 의 후속 인덱스 항목 추가).

---

### [INFO] `spec/conventions/conversation-thread.md §9.6` — ai-presentation-tools 머지된 내용과 additive 관계 확인 권장

- target 위치: `plan/in-progress/multiturn-error-preserve.md` § "영향 spec" 표, `§9.6` 행 — `system_error` source 는 `groupToolCallItems` parent/child 분류 대상 외
- 관련 plan: `plan/in-progress/ai-presentation-tools.md` — §9.6 `render_*` tool 관련 groupToolCallItems 정책이 PR #269 에서 구현됨
- 상세: target plan 의 "의존성·리스크" 절에 "ai-presentation-tools 이미 main 머지 완료 — 기존 §9.6 `groupToolCallItems` 동작과 정합 확인" 이 명시되어 있다. 실제 §9.6 에 `system_error` 를 "unclaim 상태 그대로" 두는 정책은 `render_*` tool 의 grouping 로직과 orthogonal — 동일 함수에 대한 별개 분류 케이스 추가이므로 논리 충돌 없음. 단, 구현 단계에서 `groupToolCallItems` 의 switch/if-else 분기에 `system_error` 누락 방지를 단위 테스트로 명시적 검증 필요 (target plan 의 B1 TDD 에서 이미 다루고 있음).
- 제안: plan 에 이미 반영되어 있으므로 별도 조치 불필요. 구현 단계 검토자 참고용 메모.

---

### [INFO] `plan/in-progress/replay-rerun.md` — cross-ref 는 target plan 이 이미 처리

- target 위치: `plan/in-progress/multiturn-error-preserve.md` § "영향 spec" 표, `spec/5-system/6-websocket-protocol.md §4.2` 행 비고 — "Re-run (§13 replay-rerun) 과 다름" cross-ref 추가
- 관련 plan: `plan/in-progress/replay-rerun.md` — PR2 (구현) 미완, worktree 미할당
- 상세: target plan 이 `§4.2` 에 "Re-run 과 다름" cross-ref 를 명시하여 의미 분리를 문서화한다. `replay-rerun.md` 는 PR2 구현 대기 중이나 spec(`§13-replay-rerun.md`)은 이미 확정됨. 두 경로가 직교적이며 target plan 의 처리가 충분하다.
- 제안: 별도 조치 불필요. 직교 관계 정합 확인 완료.

---

## 요약

`multiturn-error-preserve` plan 은 전체적으로 기존 in-progress plan 들과의 정합성을 상당 부분 이미 자체 "의존성·리스크" 절에서 다루고 있다. 실질적인 위험 요소는 두 가지다. 첫째, `spec/5-system/6-websocket-protocol.md` 파일을 `spec-drift-ws-button-config` 와 동시 수정할 경우 서로 다른 섹션임에도 같은 파일 충돌이 발생할 수 있고, 반대 방향의 cross-ref 가 없다. 둘째, `ai-agent-tool-connection-rewrite` 가 `_resumeState` 스키마를 변경하면 `_retryState` 포함 필드 표 갱신이 필요한데, `ai-agent-tool-connection-rewrite` plan 에 이 후속 추적이 명시되지 않았다. `ai-presentation-tools` plan 문서의 `[ ]` stale 항목은 실제 spec 충돌이 아니라 plan closure 누락이며, 해당 spec 변경은 이미 PR #269 로 main 에 반영되어 있다. OQ2 (retry 횟수 한도) 는 의도적 미결 사항으로 현재 다른 plan 과 충돌하지 않는다.

## 위험도

LOW
