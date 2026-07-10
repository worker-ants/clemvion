# Rationale 연속성 검토 — #501 attribution 하드닝 (impl-done)

- target(diff): `git diff origin/main...HEAD -- codebase/` — 대상 커밋 `5e6f70b76`
  - `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (resume `llmContext` 타입 주석 + import)
  - `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` (collection-retry 2nd-chat 단언 테스트 추가)
- 대상 spec Rationale: `spec/5-system/4-execution-engine.md:1378-1385` ("resume/retry 턴 usage-log attribution — 식별 필드 재유도 불변식 (#501, 2026-07)")
- 관련 RESOLUTION: `review/code/2026/07/10/23_20_30/RESOLUTION.md` §2 (INFO#3 defer)
- 관련 선행 검토: `review/consistency/2026/07/10/22_52_18/rationale-continuity.md` (impl-prep, draft 기준 — 이번은 실제 commit 기준 재검증)

## 발견사항

### [Info] 인라인 주석의 TS 일반 규칙 서술이 불완전 (결론 자체는 실증됨)

- target 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2602-2605` (신규 주석), 커밋 메시지 `5e6f70b76` 동일 문구
- 과거 결정 출처: 해당 없음 (신규 서술 — Rationale 충돌은 아님)
- 상세: 주석은 "TS 의 excess-property check 는 fresh object literal 을 인자로 직접 넘길 때만 걸린다" 고 일반화한다. 이 문장만 보면 `const llmContext: LlmCallContext = {...}` (변수 선언에 명시 타입을 붙이는 이번 수정)가 "인자로 직접 넘기는" 경우가 아니므로 왜 보호되는지 설명이 안 된다. 실제 TS 규칙은 "함수 인자 위치" 뿐 아니라 "명시 타입이 붙은 변수 선언에 대입되는 fresh 리터럴" 에도 동일하게 적용된다 — 이번 수정이 기대는 것은 바로 후자의 메커니즘이다.
  - 직접 `tsc --strict` 로 3-케이스 실증: (a) `const a: T = {...typo...}` → `TS2561` 발생, (b) `const b = {...typo...}; f(b)` (주석이 지적하는 old 패턴) → 에러 없음(조용히 통과), (c) `f({...typo...})` (리터럴 직접 인자) → `TS2561` 발생. 즉 주석이 말하는 "이미 보호되는 단발 경로"(c)·"보호 안 되던 구 패턴"(b)·"이번에 추가한 보호"(a) 판정 자체는 전부 사실과 일치한다. 다만 (a)가 보호되는 이유를 (a)와 무관한 규칙("인자로 직접 넘길 때만")으로만 설명해 논리적 연결이 빠져 있다.
  - 커밋 메시지의 "실증(mutation): 주석 있음 → TS2561 / 주석 없음 → tsc 무오류" 서술은 정확히 이 사실(오탈자가 annotated const 선언에서 잡힘)을 가리키므로, 결론과 실증은 정확하다 — 다만 일반 규칙 문장 자체가 그 이유를 다 담지 못한다.
- 제안: (선택적) 주석을 "…인자로 직접 넘기거나, 명시 타입이 붙은 변수 선언에 대입될 때 걸린다" 로 한 구절만 보강하면 완전해진다. 런타임/Rationale 영향 없는 문서 정밀도 문제이므로 비차단.

## 검토 관점별 판정

1. **기각된 대안의 재도입** — 없음. 본 변경은 `plan/in-progress/resume-llm-usage-attribution.md:74,78` (직전 #877/#879 PR 최종 /ai-review INFO#1·INFO#4)에 이미 계획돼 있던 후속을 그대로 실행한 것이며, 새로운 설계 대안이 아니다.
2. **합의된 원칙 위반** — 없음. `spec/5-system/4-execution-engine.md:1382` 는 "이 불변식은 현재 회귀 테스트로만 강제된다"고 명시한다. 본 변경은 그 강제 수단을 (a) 타입 레벨 오탈자 차단(`ai-turn-executor.ts` 명시 타입 주석) + (b) 회귀 테스트 범위 확장(IE collection-retry 루프 2번째 chat 단언)으로 **보강**하며, 원칙을 우회하거나 축소하지 않는다.
3. **결정의 무근거 번복** — 없음. `buildRetryReentryState` 재구성 계층(§1.3 두 재유도 채널)은 이번 diff 에서 손대지 않았다. `ai-turn-executor.ts` 변경은 타입 주석 추가뿐으로 런타임 동작 변경이 0건이며(diff 확인), 따라서 "결정을 뒤집는다" 자체가 성립하지 않는다.
4. **암묵적 가정 충돌** — 없음. RESOLUTION.md §2 (INFO#3 defer) 의 근거 — "`runTurnWithCollectionRetries` 가 루프 전체에서 동일한 `params.llmContext` 참조 하나만 넘기는 구조상 [역방향 누출] 발생 경로가 없다" — 를 `information-extractor.handler.ts:981-1145` 를 직접 읽어 검증함:
   - `runTurnWithCollectionRetries` 의 `for (;;)` 루프(1019-1145행) 는 매 반복 `params.llmContext` 를 그대로 `traceChat` 3번째 인자로 전달한다(1037행). 루프 안에서 재계산·병합·override 되는 지역 변수는 `messages`/`partialResult`/`collectionRetryCount`/token 합계뿐이며 `params.llmContext` 는 어디서도 재대입되지 않는다.
   - `traceChat`(1881-1899행) 은 받은 `llmContext` 를 그대로 `this.llmService.chat(llmConfig, params, llmContext, {signal})` 에 전달할 뿐 가공하지 않는다.
   - 즉 RESOLUTION 의 "값을 만들어낼 코드가 없다" 주장은 사실이며, 역방향 회귀(원래 `undefined` 인데 재시도 시 값이 새어 들어오는 것) 는 현재 코드 구조상 발생 불가능하다. defer 판정은 타당.

## 요약

이번 변경은 `spec/5-system/4-execution-engine.md` Rationale 의 "#501 식별 필드 재유도 불변식" 이 명시한 "현재 회귀 테스트로만 강제된다" 는 서술을 그대로 계승하면서 그 강제 수단(타입 레벨 오탈자 차단 + 테스트 커버리지)만 확장한 순수 하드닝이며, 재구성 계층(`buildRetryReentryState`)이나 소비 sink 분류(§1.3 적용 범위) 등 기존 결정의 어떤 부분도 번복하지 않는다. 기각된 대안 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 4개 관점 모두 위반 사례를 찾지 못했다. RESOLUTION.md §2 의 defer 근거는 실제 루프 코드(`information-extractor.handler.ts:1019-1145`, `traceChat:1881-1899`)로 직접 검증한 결과 사실과 일치한다. 유일한 지적 사항은 새 인라인 주석의 TS 일반 규칙 서술이 (실제 동작·결론은 맞지만) 논리적 설명이 다소 불완전하다는 INFO 수준 정밀도 이슈뿐이다.

## 위험도

NONE

STATUS: DONE
