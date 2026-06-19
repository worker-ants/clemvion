# Rationale 연속성 검토 결과

## 발견사항

- **[WARNING]** 변경 1c/1d — 엔진 잔류 목록에서 `retryLastTurn`·`applyRetryLastTurn` thin delegator 제거 (번복 cross-reference 부재)
  - target 위치: `plan/in-progress/spec-draft-c1-spec-drift.md` 변경 1c·1d ("엔진 잔류 OLD/NEW")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "C-1 god-class strangler-fig 분할" — 엔진 잔류 bullet: `"외부 진입점(retryLastTurn·applyRetryLastTurn thin delegator)·EngineDriver 멤버(buildRetryReentryState·buildResumeCheckpoint·isCheckpointEligibleNodeType)"`
  - 상세: 기존 Rationale 은 `retryLastTurn`·`applyRetryLastTurn` 을 **엔진 잔류** thin delegator 로 명시 확정했다. target draft 의 변경 1c·1d 는 이 두 메서드를 엔진에서 제거하고 외부 진입점(`websocket.gateway`·`continuation-execution.processor`)이 `RetryTurnService` 를 직접 호출하는 구조로 번복한다. 변경 1e 에서 신규 "engine→Retry 순환 DI 제거" Rationale bullet 을 추가하지만, 그 bullet 이 기존 "엔진 잔류" 결정을 명시적으로 대체·폐기한다는 cross-reference 가 없다. 결과적으로 spec Rationale 에 상호 모순되는 두 기술(thin delegator 잔류 확정 vs 제거)이 공존할 수 있다.
  - 제안: 변경 1e 의 신규 Rationale bullet 에 "기존 C-1 Rationale '엔진 잔류' 의 `retryLastTurn`·`applyRetryLastTurn thin delegator` 항은 본 결정(후속 ④)으로 대체된다" 는 명시를 추가하거나, 변경 1d 에서 기존 spec L1464 의 "외부 진입점(`retryLastTurn`·`applyRetryLastTurn` thin delegator)" 텍스트를 삭제하는 edit 를 함께 지시할 것.

- **[INFO]** 변경 1d — ISP 5-부분인터페이스: `WorkflowExecutor` 재사용 기각 원칙 및 `WORKFLOW_EXECUTOR` 토큰 보존 계승
  - target 위치: `plan/in-progress/spec-draft-c1-spec-drift.md` 변경 1d
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale C-1 — "`WorkflowExecutor` 재사용은 기각 — 엔진 내부 통신에 재사용하면 그 계약의 의미가 과적된다"; "bootstrap 의 엔진 자기참조는 별도 `WORKFLOW_EXECUTOR` 토큰화로 해소했다"
  - 상세: draft 가 "`WorkflowExecutor` 재사용 기각·bootstrap WORKFLOW_EXECUTOR 토큰 보존" 을 명시적으로 계승하고 있어 충돌 없음.
  - 제안: 정합. 조치 불필요.

- **[INFO]** 변경 2/3 — fail-open → fail-closed 전환: 과거 합의 번복에 해당하지 않음
  - target 위치: `plan/in-progress/spec-draft-c1-spec-drift.md` 변경 2 (W-6 §6), 변경 3 (§1.4·§3.2)
  - 과거 결정 출처: `spec/4-nodes/2-flow/1-workflow.md` L75 W-6 callout, `spec/5-system/4-execution-engine.md` §Rationale — `assertSameWorkspace` 에 대해 fail-open/fail-closed 동작을 명시한 Rationale 항 없음
  - 상세: 기존 spec 은 `callerWorkspaceId` 누락 시 동작을 명시하지 않았으므로 fail-closed 전환은 이전 합의 번복에 해당하지 않는다. draft 가 "이전 fail-open[누락 시 로그 후 통과]→fail-closed 전환" 을 이미 명기하고 프로덕션 3 호출처 trace 로 입증한다고 기술하고 있어 Rationale 연속성 위반 없음.
  - 제안: 정합.

- **[INFO]** 변경 4 — §10 미등록 vendor 코드 passthrough·`retryable=false`: §10 단일 taxonomy 원칙과의 tension
  - target 위치: `plan/in-progress/spec-draft-c1-spec-drift.md` 변경 4 (L1099 분류 산문 갱신)
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md` L1099 — "별도 `AI_*` fallback 코드를 쓰지 않는다(§10 단일 LLM taxonomy 유지)"
  - 상세: 기존 Rationale 은 `AI_*` 별도 네임스페이스 신설을 기각했다. draft 는 **미등록** vendor 코드도 그대로 passthrough·`retryable=false` 로 처리한다고 추가한다. 기존에 "미등록 코드를 passthrough 한다/차단한다" 는 결정이 없으므로 공백 채움이지 합의 번복이 아니다. 다만 enum 밖 코드가 외부에 노출됨으로써 "§10 단일 taxonomy" 경계가 약화될 수 있다는 tension 을 새 Rationale 없이 본문만 갱신하는 점이 다소 아쉽다.
  - 제안: ai-agent.md §Rationale 에 "미등록 vendor 코드 passthrough 는 `AI_*` 별도 네임스페이스 신설을 피하면서 코드 손실 없이 보존하는 방식으로, §10 단일 taxonomy 원칙의 연장이다" 는 한 줄 근거를 추가할 것을 권장.

- **[INFO]** 변경 5b — `meta.turnDebug` 열에 `mcpDiagnostics?` 추가
  - target 위치: `plan/in-progress/spec-draft-c1-spec-drift.md` 변경 5b (`0-common.md §6` L106)
  - 과거 결정 출처: `spec/4-nodes/3-ai/0-common.md` L106 (표 열) vs L112 (본문 산문)
  - 상세: L112 는 이미 `meta.turnDebug[i].{ragSources, ragDiagnostics, mcpDiagnostics}` 를 언급하는데 L106 표에는 `mcpDiagnostics?` 가 누락돼 spec 내부 불일치다. 추가는 기각 대안 재도입이 아닌 내부 drift 보정이다. 충돌 없음.
  - 제안: 정합.

- **[INFO]** 변경 6 — `button_continue` data shape `url` optional + `selectedItem?` 추가
  - target 위치: `plan/in-progress/spec-draft-c1-spec-drift.md` 변경 6 (`spec/4-nodes/6-presentation/0-common.md §4.5` L131)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` L186 — `button_continue`: `{ buttonId, buttonLabel, url?, selectedItem? }` (이미 optional). `spec/4-nodes/6-presentation/0-common.md` L131 — `{ buttonId, buttonLabel, url }` (non-optional)
  - 상세: 엔진 spec(L186)이 이미 `url?` 로 기술하고 있어 `0-common.md` 의 non-optional `url` 은 합의가 아닌 spec 내 drift 다. draft 의 수정은 더 권위 있는 소스와 일치시키는 것이다. 기각된 결정 재도입에 해당하지 않는다.
  - 제안: 정합.

---

## 요약

target draft 는 전반적으로 기존 Rationale 합의 원칙을 준수한다. 유일한 WARNING 은 변경 1c/1d — 기존 C-1 Rationale 이 명시적으로 "엔진 잔류" 로 확정한 `retryLastTurn`·`applyRetryLastTurn` thin delegator 를 제거하는 번복에서, 변경 1e 의 신규 Rationale bullet 이 기존 결정을 대체한다는 cross-reference 를 제공하지 않는다는 점이다. 이를 명시하지 않으면 spec C-1 Rationale 섹션에 서로 모순되는 두 기술이 공존하는 문서 일관성 문제가 발생한다. 나머지 변경(fail-closed 전환·미등록 vendor code passthrough·mcpDiagnostics drift 보정·button_continue shape 정합)은 기존 Rationale 기각 항과 충돌이 없으며, 대부분 spec 내 drift 를 코드 현실에 맞게 보완하는 수준이다.

---

## 위험도

LOW
