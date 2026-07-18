# 부작용(Side Effect) 리뷰 — IE `endMultiTurnConversation` errorPayload 계약 문서화

## 리뷰 대상

1. `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — 회귀 핀 테스트 2건 추가
2. `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `endMultiTurnConversation` 시그니처에 `_`-prefixed optional 인자 3개 추가 + docblock
3. `codebase/backend/src/nodes/core/node-handler.interface.ts` — docblock 정정만 (타입 시그니처 무변경)
4. `plan/in-progress/ie-endmultiturn-errorpayload-contract.md`, `review/consistency/2026/07/18/11_19_02/*` — 신규 워크플로 산출물 (plan tracking + consistency-check 리포트)

## 발견사항

- **[INFO]** IE `endMultiTurnConversation` 시그니처 확장(2 → 5 인자)은 순수 additive/optional
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:771-779`
  - 상세: `_errorPayload?`, `_failedUserMessage?`, `_failedUserMessageSource?` 3개가 전부 optional 이며 본문에서 사용되지 않는다(구현은 여전히 `hydrateState(stateRaw)` + `buildMultiTurnFinalOutput(state, endReason)`만 호출). 실제 호출자인 `ai-turn-orchestrator.service.ts:927`(2-args, 정상 종결)와 `:994`(5-args, error 종결)를 확인했다 — orchestrator 는 핸들러 타입을 모른 채 `ResumableNodeHandler` 제네릭 인터페이스로만 호출하므로 IE 개편 이전에도 이미 5개 인자로 호출하고 있었고(JS 는 초과 인자를 조용히 무시), 이번 변경은 그 기존 런타임 동작을 TS 타입 레벨에서 명시적으로 잠근 것뿐이다. 런타임 동작 변화 없음(behavior-preserving, plan 문서에 "behavior 무변경"으로 명시 및 실측으로 확인됨).
  - 제안: 없음 — 의도된 문서화. arity 에 의존하는 호출부(`Function.length` 등)가 있는지 grep 했으나 코드베이스에 없음을 확인했다.

- **[INFO]** `node-handler.interface.ts` 는 docblock 만 변경, 타입 시그니처 무변경
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:452-467`(구), `:1281-1300`(신)
  - 상세: `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 파라미터 타입·optional 여부·순서 전부 그대로이며, 주석만 "핸들러는 반드시 output.error 에 verbatim set" → "구현체마다 소비 방식이 다르다(AiAgentHandler=relay, InformationExtractorHandler=self-fill)" 로 정정됐다. 컴파일 계약·다른 구현체(`AiAgentHandler`, `assert-end-reason-domain.type-fixture.ts`)에 영향 없음.
  - 제안: 없음.

- **[INFO]** 신규 파일 생성은 예상된 워크플로 산출물이며 애플리케이션 코드의 부작용이 아님
  - 위치: `plan/in-progress/ie-endmultiturn-errorpayload-contract.md`, `review/consistency/2026/07/18/11_19_02/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: CLAUDE.md 의 plan lifecycle(`plan/in-progress/<name>.md`)과 consistency-check 산출 규약(`review/consistency/**`)에 정확히 부합하는 신규 파일 생성이며, developer 워크플로의 정상 절차(임계 impl-prep bypass 승인 기록 포함)다. 런타임 애플리케이션 코드가 만드는 파일시스템 부작용이 아니라 개발 프로세스 아티팩트.
  - 제안: 없음.

- **[INFO]** 테스트 파일(`information-extractor.handler.spec.ts`)의 신규 `describe` 블록은 순수 회귀 핀
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts:1294-1435`
  - 상세: 새 테스트는 `handler.endMultiTurnConversation`을 직접 호출해 반환값만 단언한다. 전역 mock(`mockLlmService`)·`beforeEach` 재설정 범위 밖 상태를 건드리지 않으며, 네트워크·파일시스템 호출 없음. 두 번째 테스트("produces the same self-filled envelope when errorPayload is omitted")는 `errorPayload` 인자를 아예 생략해 하위 호환(구 2-args 호출자) 경로도 함께 핀한다.
  - 제안: 없음.

## 확인했으나 이슈 아님

- 전역 변수/환경 변수 읽기·쓰기 없음.
- 외부 네트워크 호출 없음(모두 mock).
- 공개 API(엔진→핸들러 호출 계약) 실질 변경 없음 — 타입 명시화만.
- 이벤트/콜백 발생 패턴 변경 없음.

## 요약

이번 변경 셋은 선재 런타임 동작(엔진 orchestrator 가 IE 를 포함한 모든 `ResumableNodeHandler` 구현체에 5개 인자로 `endMultiTurnConversation` 을 호출해 왔고, IE 는 JS 의 초과 인자 무시로 이미 뒤 3개를 버려 왔던 상태)을 TS 타입 시그니처와 docblock 으로 정확히 문서화하는 behavior-preserving 변경이다. 실제 프로덕션 코드 diff 는 optional/`_`-prefixed 파라미터 3개 추가와 주석뿐이며 함수 본문·호출자·인터페이스 계약 모두 무변경임을 실제 호출부(`ai-turn-orchestrator.service.ts:927,994`)까지 추적해 확인했다. 나머지 diff(plan/review 산출물)는 표준 개발 워크플로 문서로 애플리케이션 부작용과 무관하다. 부작용 관점에서 위험 요소를 발견하지 못했다.

## 위험도

NONE
