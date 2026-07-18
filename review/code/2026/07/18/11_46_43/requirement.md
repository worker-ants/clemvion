# 요구사항(Requirement) 리뷰 — IE `endMultiTurnConversation` errorPayload 계약 문서화 + 회귀 핀 테스트

## 검토 범위

- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — 신규 `describe('endMultiTurnConversation — engine errorPayload contract …')` 블록 2건
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `endMultiTurnConversation` 시그니처에 `_errorPayload`/`_failedUserMessage`/`_failedUserMessageSource` (무시, `_` prefix) 추가 + docblock 확장
- `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ResumableNodeHandler.endMultiTurnConversation` docblock 의 `errorPayload` 서술을 "범용 계약"에서 "구현체별 분기(AI Agent verbatim relay vs IE self-fill)"로 정정
- `plan/in-progress/ie-endmultiturn-errorpayload-contract.md`, `review/consistency/2026/07/18/11_19_02/**` — 이 작업의 plan + 선행 `/consistency-check --impl-prep` 산출물 (behavior 변경 없음, 문서/추적 아티팩트)

핵심 성격: **behavior-preserving 문서화 + 회귀 핀 테스트**. 런타임 로직 변경은 0줄 — `endMultiTurnConversation`/`buildMultiTurnFinalOutput` 본문은 diff 밖.

## 코드-스펙 대조 검증 (line-level)

실제 코드를 직접 읽고 아래를 모두 확인함 (신뢰 가능한 근거로 채택, 문서 서술을 그대로 믿지 않음):

1. `information-extractor.handler.ts:1339-1363` (`buildMultiTurnFinalOutput` 의 `error` 분기) — `code: 'LLM_CALL_FAILED'`, `message: 'Conversation terminated due to LLM call failure'`, `details: { turnCount, collectionRetryCount, ...retryabilityDetails('LLM_CALL_FAILED') }`, `result: { extracted, endReason, turnCount, messages }` 를 **errorPayload 인자와 무관하게** 반환 — 테스트의 모든 `expect` 와 정확히 일치 (`err.code`/`err.message`/`details.retryable=true`/`details.retryAfterSec` undefined/`details.provider` undefined/`details.turnCount=3`/`details.collectionRetryCount=1`/`result.endReason='error'`/`extracted.orderNumber=null`).
2. `retryabilityDetails('LLM_CALL_FAILED')` (라인 1452-1463) — `rawError` 미전달 시 `retryAfterMs=null` → `{ retryable: true }` 만 반환, `retryAfterSec` 키 자체가 없음. 테스트의 `toBeUndefined()` 단언과 일치.
3. `_retryState` — `error` 분기의 반환 객체에 `_retryState` 키가 아예 없음 → `(rawResult as …)._retryState` 는 `undefined`. 테스트 단언과 일치.
4. spec `spec/4-nodes/3-ai/3-information-extractor.md` §5.3 (라인 264-330) — `output.error.details.retryable` invariant 표(라인 304)가 `LLM_CALL_FAILED`/`LLM_RATE_LIMIT` → `true`, `LLM_RESPONSE_INVALID`/`MAX_COLLECTION_RETRIES_EXCEEDED` → `false` 로 code-기반임을 명시. docblock·테스트·구현 3자가 이 invariant 와 완전 일치.
5. AI Agent 측 verbatim-relay 주장 교차검증 — `ai-turn-executor.ts:3282` `output.error = errorPayload;` (verbatim), `:3295-3318` `errorPayload.details.retryable` 기반으로 `_retryState` 조건부 emit. `spec/4-nodes/3-ai/1-ai-agent.md` §7.9(라인 921-985)·§10(라인 1122-1147, "분류는 HTTP status 기반")과 정확히 일치 — docblock 의 "AI Agent 는 verbatim relay + HTTP-status 기반" 서술이 사실과 부합.
6. 엔진 호출부 `ai-turn-orchestrator.service.ts:994-999` (`handleAiTurnError`) — `handler.endMultiTurnConversation(resumeState, 'error', errorPayload, failedUserMessage, failedUserMessageSource)` 로 5개 인자 전부 전달. IE 의 신규 시그니처(`_` prefix 3개)가 이 호출과 arity·타입 모두 호환 — 실제 호출 경로에서 인자 무시가 안전하게 성립함을 확인.
7. `AssertEndReasonDomain` type-lock (IE `:1978`, AiAgent `:234`) — 이번 시그니처 변경 후에도 유지되며 tsc 상 관련 파일 에러 0건 (아래 실행 검증 참조).

## 실행 검증

- `npx jest information-extractor.handler.spec.ts` — **38/38 pass** (신규 2건 포함, 회귀 없음).
- `npx tsc --noEmit` — `information-extractor.handler.ts`/`node-handler.interface.ts` 관련 에러 0건. (전체 305건의 사전 존재 TS2352 에러는 `ai-agent.handler.spec.ts`/`ai-turn-executor.spec.ts` 에 있으며 이번 diff 가 건드리지 않는 파일 — 동일 파일을 base commit(463aee139)으로 되돌려도 무관하게 존재하는 pre-existing 노이즈로 확인, 본 변경이 유발한 것이 아님).
- ESLint `argsIgnorePattern: '^_'` (`codebase/backend/eslint.config.mjs:59`) 확인 — `_errorPayload`/`_failedUserMessage`/`_failedUserMessageSource` 미사용 파라미터가 lint 위반을 일으키지 않음.

## 발견사항

- **[INFO]** plan 문서(`ie-endmultiturn-errorpayload-contract.md`)의 워크플로 체크리스트가 "5-7/8" 단계를 완료로 갱신 중이나(uncommitted), `9. /ai-review + fix`·`9. /consistency-check --impl-done` 은 아직 미체크 — 이는 본 리뷰 자체가 그 "9" 단계 실행이므로 프로세스상 정상 진행 상태이며 코드 결함 아님.
  - 위치: `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` 워크플로 체크리스트
  - 상세: 리뷰 시점 기준 최신 정보 공유 목적으로만 기록.

- **[INFO]** 이번 diff 는 순수 문서화 + pinning 테스트이며 런타임 분기·엔진 호출 경로에 대한 실질 변경이 전무함 — "기능 완전성"·"에러 시나리오"·"반환값" 관점에서 검토할 신규 로직 자체가 없음(이미 §5.3/§5.6 을 완전 충족하는 기존 코드를 재확인·잠그는 성격). `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` 의 "판정(측정 결과)" 절이 서술한 Q1/Q2 결론(엔진 errorPayload 는 IE 에 구조적으로 무관, 현행 self-fill 이 §5.6 을 완전 충족)도 코드로 직접 재현·확인됨.
  - 위치: 전체 diff
  - 상세: 회귀 핀 테스트의 목적(§5.3 invariant 를 깨는 미래의 "잘못된 fix" 차단)이 실제로 성립 — `enginePayload`(code=LLM_RATE_LIMIT, retryable=false, retryAfterSec=30, provider=anthropic)를 명시적으로 넘겨도 IE 출력에 전혀 반영되지 않음을 실측 확인했으므로, 향후 누군가 verbatim relay 로 "고치면" 이 테스트가 즉시 실패해 §5.3 위반을 잡아낸다.

- **[INFO]** 관련 spec 문서 식별 및 본문 일치 — `spec/4-nodes/3-ai/3-information-extractor.md` §5.3(에러 envelope shape·retryable invariant), `spec/4-nodes/3-ai/1-ai-agent.md` §7.9/§10(AI Agent 의 verbatim relay·HTTP-status 기반 분류), `spec/conventions/node-output.md` Principle 3.2.1(details 표준 필드)이 모두 이 diff 의 docblock·테스트 주석과 line-level 로 정합. spec 본문 자체의 결함(§5 "Principle 11" 오귀속, AI Agent multi-turn `out` 포트 자기모순 등)은 이미 병행 산출물(`review/consistency/2026/07/18/11_19_02/SUMMARY.md`)에서 별도 out-of-scope 항목으로 project-planner 에 위임 처리돼 있어 본 diff 의 책임 범위 밖으로 명확히 경계됨.

- **[SPEC-DRIFT 아님, 확인 사항]** `node-handler.interface.ts` docblock 정정 자체가 SoT 재서술(구현체마다 소비 방식이 다름을 명시)이며, 이는 코드가 이미 옳았고(§5.3 invariant 를 준수하는 self-fill) spec 해석을 범용 계약처럼 오독할 여지가 있던 **인터페이스 주석**을 교정한 것 — spec 문서(`3-information-extractor.md`/`1-ai-agent.md`) 자체는 변경되지 않았고 이미 정합 상태였으므로 SPEC-DRIFT 카테고리에 해당하지 않음 (spec 은 애초 옳았고, 인터페이스의 docblock 이라는 코드 주석이 오해를 유발할 뿐이었음 — 이번에 그 주석을 정정).

CRITICAL/WARNING 급 발견사항 없음.

## 요약

이번 변경은 IE(`InformationExtractorHandler`) 의 `endMultiTurnConversation` 이 엔진의 `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 3개 인자를 의도적으로 무시하고 자체 §5.3 invariant(code-기반 `retryable`)로 self-fill 한다는 **기존에 이미 준수 중이던 동작**을 (a) `node-handler.interface.ts`·핸들러 docblock 으로 명문화하고 (b) 미래의 잘못된 "verbatim relay 로 고치는" 회귀를 막는 pinning 테스트 2건으로 고정하는 순수 문서화 커밋이다. 테스트 기댓값을 실제 handler 코드(`buildMultiTurnFinalOutput`/`retryabilityDetails`)와 line-level 로 직접 대조한 결과 완전히 일치했고, 관련 spec 본문(§5.3 invariant 표, §7.9/§10 AI Agent 분기)과도 정합했으며, jest 38/38 pass·관련 파일 tsc 에러 0건·eslint `_` prefix 정책 준수까지 실측 확인했다. 병행 커밋된 `plan/`·`review/consistency/` 산출물은 이 작업의 impl-prep 단계에서 발견된 (본 task 범위 밖) 3건의 Critical spec 불일치를 project-planner 후속 위임으로 명확히 경계 짓고 있어, 이번 diff 의 책임 범위를 흐리지 않는다. CRITICAL/WARNING 없음.

## 위험도

NONE
