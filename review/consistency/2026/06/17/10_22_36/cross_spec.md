## 발견사항

- **[WARNING]** `processFormResumeTurn` / `processButtonResumeTurn` / `waitForButtonInteraction` 메서드 소유자 — spec vs 구현 불일치
  - target 위치: `button-interaction.service.ts` (신규 파일), `execution-engine.service.ts` (diff 패치)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §7.5 lines 941-942, 959
  - 상세: spec §7.5 rehydration 흐름 설명("form → `processFormResumeTurn`, button → `processButtonResumeTurn`")과 §1 Pre-park read-window 주석("직후 `waitForButtonInteraction` / `waitForFormSubmission` / `waitForAiConversation`")이 해당 메서드들을 `ExecutionEngineService` 의 **자체 메서드**인 것처럼 표현한다. 구현에서는 `ButtonInteractionService` / `FormInteractionService` 로 추출되어 `ENGINE_DRIVER` 토큰을 통해 위임받는다. spec 은 `AiTurnOrchestrator` 와 동일한 추출 패턴이 form/button 에도 적용됐음을 전혀 언급하지 않는다 — AiTurnOrchestrator 도 spec 에 미등장 하므로 일관된 누락이지만, 새 소비자(테스트 작성자·리뷰어)가 spec 을 보고 메서드 소유자를 오인할 수 있다.
  - 제안: spec §7.5 rehydration의 `dispatchResumeTurn` 설명과 §1 Pre-park read-window 주석에 "form/button 처리는 각각 `FormInteractionService.processFormResumeTurn` / `ButtonInteractionService.processButtonResumeTurn` 으로 위임 (C-1 step3 — `AiTurnOrchestrator` 선례와 동일 패턴)" 구문 추가. `spec/5-system/4-execution-engine.md` 갱신 필요.

- **[WARNING]** `button_continue.data` shape — `selectedItem` 필드 미정의
  - target 위치: `button-interaction.service.ts` lines 800-809 (`processButtonResumeTurn` — link 버튼 분기)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §1.3 interaction.data 표; `spec/conventions/node-output.md` §4.5; `spec/4-nodes/6-presentation/0-common.md` §interaction 표
  - 상세: spec 세 군데(`4-execution-engine.md §1.3`, `conventions/node-output.md §4.5`, `4-nodes/6-presentation/0-common.md`) 모두 `button_continue.data` shape 을 `{ buttonId, buttonLabel, url }` 로만 정의하며 `selectedItem` 필드를 언급하지 않는다. 구현은 link 타입 버튼에서도 `selectedItem !== undefined` 조건부로 `selectedItem` 을 `data` 에 포함한다. 반면 `button_click.data` 의 경우 spec 은 이미 `{ buttonId, buttonLabel, selectedItem? }` 로 `selectedItem?` 을 명시해 두었다. `button_continue` 의 경우만 누락된 것이다. 다운스트림 AI Agent 의 ConversationThread 주입 · 외부 채널 어댑터가 `button_continue.data` shape 을 파싱할 때 미정의 필드로 인한 혼동 가능성이 있다.
  - 제안: `spec/5-system/4-execution-engine.md` §1.3, `spec/conventions/node-output.md` §4.5, `spec/4-nodes/6-presentation/0-common.md` 의 `button_continue` 행을 `{ buttonId, buttonLabel, url, selectedItem? }` 로 갱신. 또는 `button_continue` 의 item-level 버튼 해당 여부 자체를 설계 결정으로 명확히 기록.

- **[INFO]** spec §1 Pre-park read-window 주석의 메서드명 정확도
  - target 위치: `execution-engine.service.ts` 패치 (diff) — `waitForButtonInteraction` 호출이 `this.buttonInteraction.waitForButtonInteraction` 으로 재배선
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §1 line 83
  - 상세: 해당 주석은 "직후 `waitForButtonInteraction` / `waitForFormSubmission` / `waitForAiConversation` 이 status 를 atomic 전이한다" 고 기술하며 메서드 소유자를 암묵적으로 `ExecutionEngineService` 로 가정한다. `waitForFormSubmission` 과 `waitForButtonInteraction` 은 각각 `FormInteractionService` / `ButtonInteractionService` 로 이전됐으나 `waitForAiConversation` 은 엔진에 잔류. 기능 동작 자체는 정확히 동일하므로 CRITICAL 은 아니지만 명명 혼란의 원인이 될 수 있다.
  - 제안: spec §1 주석을 "직후 `FormInteractionService.waitForFormSubmission` / `ButtonInteractionService.waitForButtonInteraction` / `waitForAiConversation`(엔진 잔류) 이 ..." 로 갱신.

- **[INFO]** `processFormResumeTurn` 단위 테스트 `describe` 블록 제거 — spec §10.9 cross-reference 소실
  - target 위치: `execution-engine.service.spec.ts` diff (lines 1416-1835 제거 — `processFormResumeTurn — 4 branches (SUMMARY W1)` 블록)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` (테스트 코드 내 주석의 `spec §10.9` 참조가 사라짐)
  - 상세: 제거된 테스트 블록 안의 주석("exec-park D6 full B3, spec §10.9, spec §7.5")에 `spec §10.9` cross-reference 가 있었다. 이 테스트는 `FormInteractionService.spec.ts` (별도 파일, diff 의 `form-interaction.service.spec.ts`)로 이전된 것으로 추정되나 해당 파일은 본 diff 에 포함되지 않았다. spec §10.9 자체가 실제로 form sentinel 검증을 가리키는 섹션인지 검증 필요. `processFormResumeTurn` 에 대응하는 동등 테스트가 다른 파일에 보존됐다면 실질 손실 없음.
  - 제안: `FormInteractionService.spec.ts` 파일에 동등한 sentinel/non-sentinel/RUNNING/null 4-branch 테스트가 존재하는지 확인. 미존재 시 추가.

---

## 요약

이번 diff 는 `ButtonInteractionService` (신규) + `FormInteractionService` (기존 추출 완료 가정)의 등록 및 `ExecutionEngineService` 의 dispatch loop / resume registry 위임을 구현하며, 동작 계약(`PARK_RELEASED` 반환, `WAITING_FOR_INPUT` 전이, `execution.resumed` emit) 자체는 spec §7.5 rehydration 경로와 일관된다. 주요 cross-spec 충돌은 두 가지다: (1) spec 이 `processFormResumeTurn` / `processButtonResumeTurn` / `waitForButtonInteraction` 메서드를 `ExecutionEngineService` 직속 메서드로 기술하고 있어 추출 서비스 아키텍처가 spec 에 반영되지 않았고, (2) `button_continue.data` shape 에 구현이 추가한 `selectedItem?` 필드가 spec 세 군데(execution-engine §1.3, node-output §4.5, presentation/0-common)에 정의되지 않아 데이터 계약 불일치가 있다. 두 항목 모두 기능 오동작보다는 spec drift 성격이나, `button_continue.data` shape 변경은 외부 소비자(채널 어댑터·ConversationThread renderer)에 영향을 줄 수 있어 명시적 spec 갱신이 권장된다.

---

## 위험도

LOW
