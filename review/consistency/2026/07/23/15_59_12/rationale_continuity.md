# Rationale 연속성 검토 — presentation-previousoutput-spec-drift.md

## 발견사항

- **[INFO]** "6종" 정정의 근거를 execution-engine.md 의 기존 명시적 라벨로 직접 인용하면 더 강함
  - target 위치: `plan/in-progress/presentation-previousoutput-spec-drift.md` §"동반 정정 A"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §7.4 (`:893`) 및 §9.3 (`:1162`)
  - 상세: 독립 검증 결과 `spec/5-system/4-execution-engine.md:1162` 는 이미 "메시지 타입 **6종** `continue`/`cancel`/`button_click`/`ai_message`/`ai_end_conversation`/`retry_last_turn`" 이라고 **문자 그대로 "6종"** 을 명시하고 있다(§7.4 `:893` 도 6개 값을 나열). 즉 target 이 지목한 `0-common.md` 의 "5종"(3곳) 은 이 기존 SoT 라벨과 직접 모순되는 stale drift 가 맞다 — target 의 진단은 정확하다.
  - 제안: 실제 spec 수정 시 각주/본문에서 execution-engine.md §9.3 의 "6종" 문구를 그대로 인용(앵커 포함)하면, 향후 재확인하는 사람이 카운트를 다시 세지 않고 즉시 대조할 수 있다. (수정 방향에 대한 반대 아님 — 인용 강화 제안.)

- **[INFO]** 체크리스트의 "각 문서 `## Rationale` 에 개정 근거 기록" 항목 — `0-common.md` 의 기존 `## Rationale` "form submission wire format wrap" 절(`:553-578`)이 실제 타깃임을 명시
  - target 위치: `plan/in-progress/presentation-previousoutput-spec-drift.md` §체크리스트 항목 5, §동반 정정 B
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md` `## Rationale` → "form submission wire format wrap" (도입: PR #288/#301, 이후 미갱신)
  - 상세: 독립 검증 결과 이 Rationale 절 자체 안에 `waitForAiConversation`(:557, :570) 이 잔존한다. 반면 같은 문서의 **본문** §10.9(`:396-427`, PR #628 에서 갱신)는 이미 `processAiResumeTurn` / "no-op park" 로 정정되어 있다 — 즉 **한 문서 안에서 본문과 Rationale 이 서로 다른 세대의 사실을 담고 있는 실제 drift**. target 이 "B" 항목에서 지목한 위치·수정 방향은 코드(`ai-turn-orchestrator.service.ts` `processAiResumeTurn`, "re-park" 패턴 확인됨)와 execution-engine.md §7.4 Worker 동작 서술("배리어도 pendingContinuations Map 도 없고 재개 경로는 slow-path(rehydration)로 일원화")과 정확히 일치한다.
  - 제안: 현행 문구 그대로 진행. (검증만 — 수정 불필요.)

## 교차검증 요약 (판단 근거)

Rationale 연속성 관점에서 가장 중요한 질문은 "target 이 과거에 명시적으로 기각된 대안을 근거 없이 되살리는가" 인데, 독립적으로 아래를 실측했다:

1. `spec/conventions/node-output.md` §4.2(:194) 는 이미 "**Phase 3 완료 전 과도기 예외**: presentation resume 경로(`ButtonInteractionService`)는 재개 출력에 `previousOutput`… 여전히 보존한다" 를 명시하고 있다 — 이 문구는 target 의 "완전 폐기 아님" 주장과 정확히 일치하며, `git log -S` 로 도입 커밋(d3ccae700, #628, "C-1 엔진 분할 체인 종료 spec-sync")까지 추적했다. 즉 target 이 도입하려는 사실(과도기 보존)은 **이미 SoT 인 node-output.md 에 결정으로 박혀 있던 것**이고, target 은 그 결정을 presentation 4곳(`0-common.md`/`3-chart.md`×2/`4-form.md`)에 소급 반영해 **drift 를 없애는 쪽**이다. 대안 재도입이 아니라 기존 결정과의 정합화다.
2. `previousOutput` 을 완전 폐기하지 않고 예외로 남긴 이유(값 재구성 원칙, Principle 1.1)는 node-output.md 본문에 이미 있고, target 은 이 원칙("신규 소비 금지")을 그대로 보존한 채 시제만 정정한다 — Principle 위반 없음.
3. target 문서 자체의 `## Rationale` 절과 §비목표 절이 "왜 시제만 고치고 완전 삭제하지 않는가", "왜 세 문서(carousel/table/template)에는 예시를 추가하지 않는가" 에 대한 근거를 이미 서술하고 있어 요구사항 3(무근거 번복 금지)을 충족한다.
4. `spec/5-system/4-execution-engine.md:1162` 가 이미 "6종" 을 명문화하고 있어(§9.3), target 의 "동반 정정 A"(5종→6종)는 기존 SoT 와의 재정합이지 새로운 주장이 아니다.
5. `spec/4-nodes/6-presentation/0-common.md` 본문 §10.9(PR #628 갱신분)는 이미 `processAiResumeTurn`/no-op park 를 쓰고 있고, 같은 문서의 Rationale 절만 구세대 표현(`waitForAiConversation`/"loop 재진입")이 남아 있다 — target 의 "동반 정정 B"는 문서 내부 자기모순을 해소하는 것이며, 실제 코드(`processAiResumeTurn`, re-park 패턴)와도 일치함을 직접 코드 리딩으로 확인했다.

이 5가지 독립 검증 모두 target 이 과거 Rationale·SoT 와 **정합**하는 방향으로 정정하고 있음을 뒷받침하며, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 중 어느 것도 발견되지 않았다.

## 요약

target(`presentation-previousoutput-spec-drift.md`)이 제안하는 4곳 정정 및 동반 정정 A·B 모두, 실제 spec/코드를 교차검증한 결과 기존 Rationale·SoT(node-output.md §4.2 Phase 3 예외, execution-engine.md §7.4/§9.3 6종 메시지 타입, 0-common.md §10.9 본문의 processAiResumeTurn/no-op park 표현)와 **정합**하는 방향의 수정이며, 오히려 그 SoT 들에 이미 존재하던 사실을 presentation 하위 4개 파일과 0-common.md 의 구식 Rationale 절에 소급 반영해 drift 를 해소하는 성격이다. 기각된 대안의 재도입, 합의된 설계 원칙 위반, 근거 없는 결정 번복, invariant 우회 중 어느 것도 발견되지 않았다. target 문서 자체가 §비목표·`## Rationale` 절에서 판단 근거(왜 "폐기"를 지우지 않고 "신규 소비 금지"로 바꾸는지, 왜 예시에 필드를 추가하지 않는지)를 이미 명시하고 있어 연속성 요건을 충족한다.

## 위험도

NONE
