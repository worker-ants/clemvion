# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-conversation-ui-contract.md`
검토 기준: `spec/conventions/conversation-thread.md §8`, `spec/4-nodes/3-ai/1-ai-agent.md §12`, `spec/5-system/6-websocket-protocol.md ## Rationale`, `spec/3-workflow-editor/3-execution.md §10.8`

---

## 발견사항

- **[WARNING]** `ai_message` REPLACE 정책 — "권위적 재구성" 원칙과의 긴장
  - target 위치: §9.7 — `ai_message` 이벤트의 store mutation 정책 ("REPLACE … 단, `toolStatus`/`durationMs`/`error` 는 prev 의 동일 `toolCallId` 항목에서 carry-over")
  - 과거 결정 출처: `spec/3-workflow-editor/3-execution.md §10.8` Rationale 라인 — "`messages` 스냅샷으로 타임라인을 **권위적으로 재구성** (user / assistant / tool 모두 포함, `toolCallId` 로 dedup)"
  - 상세: 기존 §10.8 은 `ai_message` 수신 시 messages 스냅샷이 "권위적(authoritative)" 소스로서 타임라인 전체를 재구성한다는 원칙을 천명하고 있다. target 의 §9.7 은 "carry-over 가 명시된 교체" 로, `toolStatus`/`durationMs`/`error` 를 prev 에서 보존한다. carry-over 는 PR #208 의 회귀 수정에서 이미 구현된 정책의 spec 화이나, 기존 "권위적 재구성" 원칙과 어긋나 보이는 표현 차이가 있다. 기존 §10.8 이 carry-over 를 명시적으로 기각하지는 않았으나, "권위적 재구성" 이라는 표현이 unconditional replace 를 암시할 수 있어 향후 구현자가 두 spec 을 보며 혼동할 위험이 있다.
  - 제안: target §9.7 의 `ai_message` 행 또는 §9.7 주석에 "기존 §10.8 의 '권위적 재구성' 을 conversation UI 레이어에 명문화하는 것이며, carry-over 항목 (`toolStatus`/`durationMs`/`error`) 은 live WS 이벤트 선행 도착 정보로 snapshot 이 빈 상태를 덮어쓰지 않기 위해 보존된다" 라는 Rationale 설명을 추가한다. 또는 §10.8 을 §9.7 을 cross-ref 하도록 갱신한다.

- **[INFO]** §9.6 parent 시각 형식 — 기존 §9.1 의 `ai_assistant` 시각 규약과의 관계 명확화
  - target 위치: §9.6 — parent 항목: "chat bubble … **아님** — inline-flex chip"
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §9.1` — `ai_assistant` 는 "🤖 assistant chat bubble (왼쪽 정렬, 일반 배경)"
  - 상세: target §9.6 은 blank-content assistant turn 이 parent 가 되면 chip 헤더로 대체됨을 명시하고, content 가 non-blank 이면 §9.1 의 표준 bubble 을 유지한다고 서술한다. 충돌이 아니라 §9.1 의 조건부 특수 케이스이지만, §9.1 표에는 이 분기가 없어 §9.1 만 보는 구현자가 혼동할 수 있다.
  - 제안: spec 본문 작성 시 §9.1 의 `ai_assistant` 행에 "단, toolCalls 가 있고 content 가 blank 인 경우는 §9.6 의 parent chip 형식 적용" 이라는 비고를 추가해 §9.1 과 §9.6 의 적용 우선 순위를 명확히 한다.

- **[INFO]** §9.9 Inv-1 — 기존 §9.1 의 `ai_tool` status badge 형식과의 관계
  - target 위치: §9.9 Inv-1 — "tool row 의 시각은 라이프사이클 phase (pending / success / error) 와 무관하게 같은 layout 을 유지"
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §9.1` — `ai_tool` = "tool name + status badge (200/4xx/5xx)"
  - 상세: 기존 §9.1 은 `ai_tool` 의 status badge 를 "200/4xx/5xx" 로 정의한다. 이는 tool 완료 이후의 HTTP-style status 다. target §9.7 은 `tool_call_started` 가 "status=pending" 을 store 에 UPSERT 한다고 정의하며, §9.9 Inv-1 이 pending/success/error 를 layout 불변량으로 명시한다. 기존 §9.1 의 "200/4xx/5xx" badge 형식이 "pending" 상태를 포함하도록 확장되어야 하는데, 이 확장이 target 에서 명시되지 않아 §9.1 과 §9.7/§9.9 사이에 표현 불일치가 생긴다.
  - 제안: target 이 spec 으로 확정될 때 §9.1 의 `ai_tool` 행의 "status badge (200/4xx/5xx)" 를 "status badge (pending / 200 / 4xx / 5xx / error)" 로 갱신하거나, §9.1 비고에 "live 단계의 badge 형식은 §9.7 참고" 를 추가한다.

- **[INFO]** target Rationale 의 "(기각) storybook visual regression — 본 PR 에서" — 기존 Rationale 에 storybook 도입 기각 기록 부재
  - target 위치: target Rationale 마지막 항 — "(기각) 시각 회귀 storybook 도입 — 본 PR 에서"
  - 과거 결정 출처: 해당 없음 (기존 conversation-thread.md / ai-agent.md / websocket-protocol.md Rationale 에 storybook 기각 기록 없음)
  - 상세: 기존 spec 어디에도 storybook 도입이 명시적으로 기각된 이력이 없다. target 은 "본 PR 범위 초과" 라는 이유로 v2 로드맵에 위임하고 있어, 기존 기각 결정을 번복하는 것이 아니라 새로운 결정이다. 단, v2 로드맵 (conversation-thread.md §7) 에 storybook/visual regression 이 명시되어 있지 않아 이 결정이 §7 에 반영되지 않으면 소실될 수 있다.
  - 제안: spec 확정 시 conversation-thread.md §7 v2 로드맵에 "storybook/visual regression 인프라 도입 검토" 항목을 추가해 본 기각 결정의 향후 follow-up 을 공식화한다.

- **[INFO]** §9.A 의 `mergeOrphanToolItems` 등가성 정의 — 신규 개념 (기존 Rationale 에 기각 이력 없음, 원칙 정합 확인)
  - target 위치: §9.A 전체
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §9.3` D4 · §9.5 — `messagesToConversationItems`, `threadTurnsToConversationItems` 함수명이 §9.5 에 이미 등장
  - 상세: §9.A 가 두 변환 함수의 등가성을 `subset` 관계로 정의하는 것은 기존 §9.5 에서 두 함수가 병렬 적용처로 열거된 것과 일관된다. 기존 Rationale 에서 이 관계를 명시적으로 다룬 항목은 없으나, 기각된 결정과 충돌하지도 않는다. 다만 §9.A 의 "부분 순서 (user → intermediate assistants → tools → final assistant) 는 보존된다" 는 invariant 가 기존 spec 어디에도 없는 새로운 내용이다. 이것이 기존 spec 과 모순되는지 여부는 판단 불가하나 (기존 spec 이 이 순서를 명시하지 않음), 충돌 증거도 없다.
  - 제안: 신설 이므로 Rationale 필요. target Rationale 에 이미 §9.A 채택 근거가 기술되어 있어 추가 조치 불필요. 다만 spec 확정 후 conversation-thread.md §8 에 §9.A 도입 근거를 한 줄 cross-ref 로 추가하면 이력 관리에 유리하다.

---

## 요약

target 문서 (`spec-draft-conversation-ui-contract.md`) 는 기존 spec 의 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 불변량을 직접 위반하는 항목을 포함하지 않는다. 주요 설계 결정들 (tool-call 그룹 parent-child 시각 정책, WS 이벤트 store 변환 계약, content blank 동치성 함수, UI Invariants, 회귀 차단 시나리오) 은 모두 target 자체 Rationale 에 근거가 기술되어 있으며, 기존 conversation-thread.md §8.1, websocket-protocol.md Rationale, ai-agent.md §12 의 확립된 원칙(conversationThread snapshot 우선, emit messages raw 노출 금지, source 3중 시각 신호 강제) 과 연속적이다. 다만 WARNING 1건이 있다: `ai_message` 이벤트의 carry-over REPLACE 정책이 기존 `spec/3-workflow-editor/3-execution.md §10.8` 의 "권위적 재구성" 표현과 긴장 관계에 있으며, 두 spec 을 함께 볼 구현자가 unconditional replace 로 오독할 수 있다. 이 긴장을 해소하는 cross-ref 또는 Rationale 보충이 권장된다.

---

## 위험도

LOW
