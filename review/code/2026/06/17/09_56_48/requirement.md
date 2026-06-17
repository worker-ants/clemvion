# 요구사항(Requirement) Review — C-1 step3 Form/Button InteractionService 추출

리뷰 대상 커밋: `158db86c` — `refactor(execution-engine): FormInteractionService + ButtonInteractionService 추출 (C-1 step3)`

---

## 발견사항

### [INFO] [SPEC-DRIFT] `button_continue` data 에 `selectedItem` 추가 — spec 미기재
- 위치: `codebase/backend/src/modules/execution-engine/button-interaction.service.ts` L856-862 / `button-interaction.service.spec.ts` L362-397
- 상세: `ButtonInteractionService.processButtonResumeTurn` 의 `button_continue` 분기(link 타입 버튼 클릭)에서 `structuredInteraction.data` 에 `selectedItem` 을 포함한다. `spec/conventions/node-output.md §4.5` 및 `spec/5-system/4-execution-engine.md §1.3` 의 `button_continue` data 정의는 `{ buttonId, buttonLabel, url }` 이다 — `selectedItem` 필드가 없다. 해당 코드는 carousel 같은 item-level 버튼이 link 타입인 경우(`pick__item_1` 이 `type: 'link'` 이면 가능)를 위한 합리적 확장이다. 코드 자체가 오답이 아니라 spec 이 이 조합을 다루지 않는 것.
- 제안: 코드 유지 + spec 반영. `spec/conventions/node-output.md §4.5` 의 `button_continue` data 행을 `{ buttonId, buttonLabel, url?, selectedItem? }` 로 갱신하고, `spec/5-system/4-execution-engine.md §1.3` 표도 동기화. 갱신 대상 spec 문서: `/Volumes/project/private/clemvion/spec/conventions/node-output.md` §4.5 표 `button_continue` 행, `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md` §1.3 `interaction.data payload 규격` 표.

### [INFO] `button_continue` data 의 `url` 필드 — spec 은 필수, 구현은 조건부
- 위치: `button-interaction.service.ts` L857: `...(clickedButton.url ? { url: clickedButton.url } : {})`
- 상세: `spec/conventions/node-output.md §4.5` 와 `spec/5-system/4-execution-engine.md §1.3` 의 `button_continue` data 형태는 `{ buttonId, buttonLabel, url }` — `url` 에 `?` 없이 필수로 정의돼 있다. 그러나 구현은 `url` 이 없으면 생략한다. link 타입 버튼에 `url` 이 항상 존재하는 것이 정상이나, 방어적 처리로 빈 문자열·undefined 일 때 키 자체를 제거한다. 실용적으로는 문제없으나 spec 명세와 기술적 불일치다.
- 제안: 이 정도는 코드 로직의 방어적 처리 수준으로 INFO 등급 유지. spec 갱신 시 위 SPEC-DRIFT 항목과 함께 처리하면 충분.

### [INFO] `ButtonInteractionService` 에 `applyPortSelection` 이 EngineDriver mock 에 포함됐으나 미호출
- 위치: `button-interaction.service.spec.ts` L119: `applyPortSelection: jest.fn((o: unknown) => o)`; `button-interaction.service.ts` L330 주석에만 언급
- 상세: `ButtonInteractionService` 의 실제 구현에서 `this.driver.applyPortSelection` 을 호출하지 않는다(주석만 존재). 테스트 mock 에 추가된 것은 `EngineDriver` 인터페이스 전체를 typed mock 으로 만들기 위한 것으로 보이며, 미사용 mock 은 오해를 유발할 수 있다.
- 제안: mock setup 에서 `applyPortSelection` 항목 제거 또는 명시적 주석(`// EngineDriver 인터페이스 충족용, 본 서비스 미사용`) 추가. 기능에는 영향 없음.

### [INFO] `FormInteractionService` — `allowedFieldNames.size === 0` 시 모든 필드 통과 (whitelist 우회)
- 위치: `form-interaction.service.ts` L3100: `if (allowedFieldNames.size === 0 || allowedFieldNames.has(key))`
- 상세: `node.config.fields` 가 빈 배열이거나 undefined 이면 `allowedFieldNames` 가 비어 화이트리스트 필터가 무력화되어 모든 `formData` 키가 통과한다. WARN #8 주석은 "필드 type/required 는 form handler 도메인" 이라 설명하지만, `fields` 가 비어 있을 때 임의 키 주입이 허용되는 점은 보안 정책상 재고 여지가 있다.
- 제안: 기존 엔진 코드에서 verbatim 이동된 로직이므로 동작 변경은 별도 이슈로 추적. 현 PR 범위에서는 INFO 수준 — 기능 완전성·회귀 기준으로는 문제없음.

### [WARNING] 엔진 spec(`spec/5-system/4-execution-engine.md`)이 `waitForFormSubmission`, `waitForButtonInteraction`, `processFormResumeTurn`, `processButtonResumeTurn` 의 구현 위치를 `ExecutionEngineService` 메서드로 암묵적으로 참조 중 — C-1 step3 이후 `FormInteractionService`/`ButtonInteractionService` 로 이동됐으나 spec 미갱신
- 위치: `spec/5-system/4-execution-engine.md` 83번째 줄: `직후 waitForButtonInteraction / waitForFormSubmission / waitForAiConversation 이 status 를 atomic 전이한다`; 777번째 줄: `NodeExecution.outputData`·`conversationThread` commit 맥락의 함수 포인터. plan `c1-engine-split.md §spec 갱신` 에서 PR4(체인 종료) 시 일괄 반영하기로 명시적으로 결정돼 있음.
- 판단: **SPEC-DRIFT** — plan 문서가 "PR2–4: spec 무변 예상, 체인 종료 시 planner 일괄"로 명시한 의도적 이연. 코드가 맞고 spec 갱신이 지연된 상태. 코드 fix 대상 아님.
- 제안: 코드 유지. PR4(RetryTurnService) 완료 후 `project-planner` 가 `spec/5-system/4-execution-engine.md §1.3·§7.5` 에 `FormInteractionService`/`ButtonInteractionService` 소속 메서드 포인터를 반영 (c1-engine-split.md §spec 갱신 phase DoD 조건과 동일).

---

## 요약

이번 변경은 `ExecutionEngineService` god-class 에서 Form/Button 블로킹 인터랙션 생명주기를 `FormInteractionService`와 `ButtonInteractionService` 로 추출하는 strangler-fig 리팩터링이다(C-1 step3). 기존 동작 로직은 verbatim 이동·재배선되었으며, 기능 완전성·에러 처리·엣지 케이스(nodeExec null, RUNNING 상태 가드, item-level 버튼, 비정상 payload 폴백, 화이트리스트 필터) 모두 이전 동작을 충실히 보존한다. 테스트는 두 서비스 각각에 대해 park/resume 핵심 분기와 §5.5 meta.durationMs 갱신을 포함한 10+12건의 신설 케이스로 충분히 커버하며, 엔진 spec 의 통합 테스트는 위임 경로로 올바르게 재배선됐다. spec fidelity 측면에서 `button_continue` data 의 `selectedItem` 포함이 spec 미기재 확장이고, plan 결정에 따라 spec 갱신이 PR4 이후로 이연된 상태이나 이는 의도적 SPEC-DRIFT 이며 코드 수정 대상이 아니다. TODO/FIXME 없음. 위험도 LOW.

## 위험도

LOW
