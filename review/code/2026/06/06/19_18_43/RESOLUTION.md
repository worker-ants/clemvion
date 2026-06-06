# RESOLUTION — review/code/2026/06/06/19_18_43 (exec-park B-1 resume dispatch registry)

ai-review RISK=LOW, Critical 0, Warning 7 (8 reviewer 실행 — security/architecture/requirement/scope/side_effect/maintainability/testing/documentation). disposition.

## 조치 항목

| # | 카테고리 | 판정 | 근거/조치 |
|---|---|---|---|
| W1 | SPEC-DRIFT | **무효(drift 아님)** | §7.5 본문(L905-906/L922)은 "form→processFormResumeTurn, button→processButtonResumeTurn, AI→processAiResumeTurn" **매핑**을 기술. registry 는 정확히 그 매핑으로 라우팅하므로 본문이 그대로 정합 — registry 는 내부 메커니즘(spec 비기재 대상). spec 변경 불요. |
| W2 | SPEC-DRIFT | **무효(pre-existing)** | `blockingInteraction`(handler metadata `kind=blocking`/`interaction=form` 으로 form 식별)은 리팩토링 *이전* driveResumeAwaited/Frame 에 이미 있던 메커니즘. 본 PR 신규 도입 아님. (§5.5 가 rawConfig snapshot 으로 참조.) spec 변경 불요. |
| W3 | Testing | **조치 완료** | `handleAiResumeTurn` 독립 단위테스트 2건 추가 — (a) buildRetryReentryState throw → RESUME_INCOMPATIBLE_STATE 전파, (b) 정상 → cachedOutput 병합+`_resumeState` seed(setNodeOutput) + processAiResumeTurn 결과 전달. execution-engine spec 329→331. |
| W4 | Testing | **조치 완료** | dispatchResumeTurn describe `afterEach` 에 `_resumeTurnRegistry = undefined` 추가 — lazy registry 캐시 테스트 격리. |
| W5 | Documentation | **조치 완료** | `dispatchResumeTurn` JSDoc 에 `@throws {RehydrationError} code='RESUME_CHECKPOINT_MISSING'` + `code='RESUME_INCOMPATIBLE_STATE'` 태그 추가. |
| W6 | Architecture | **수용(주석)** | ai 항목 `selects` 의 `this.isCheckpointEligibleNodeType` 캡처는 의도된 결합 — registry 는 service-bound 가 전제(handle 도 this.processX 호출). 외부 독립 구성 계약 아님을 getter 에 주석 명시. (selector 에 별도 flag 화 시 AI 고유 지식이 generic selector 를 오염 → 주석이 더 적절.) |
| W7 | Security | **검증 완료(본 PR 무관)** | `InteractionTokenService` prod fail-closed 가드는 #504(A~C polish B2)로 이미 origin/main 반영(L98-101 `NODE_ENV==='production'` throw 확인). 본 refactor PR 무관. |

## 참고 (INFO) disposition
- INFO 1/2/4 (Architecture 긍정): 변경 없음. INFO 3(payload:unknown)·5(ai_form_render 흡수)·6(Symbol 싱글톤)·9(null/undefined 혼재, 주석으로 의도 명확)·11/12(에러메시지·DB 신뢰경계 — 기존 동일 수준): 수용. INFO 7(테스트 반복 캐스팅)·8(_resumeTurnRegistry 네이밍)·10(ParkSignal export — dispatch 인터페이스가 ProcessTurnResult 경유 참조 위해 유지)·13(park-release-signal 역참조)·14(plan 참조): 비차단 nitpick, 후속.
- INFO 15(중첩 AI park→rehydration 통합 테스트): 기존 e2e `execution-park-resume.e2e-spec.ts`(중첩 form park→cold rehydration, driveResumeFrame→dispatchResumeTurn 경로) + nested AI re-park 단위테스트(L14662~)로 커버. 무회귀 확인.

## TEST 결과
- lint  : 통과 (eslint 0 error)
- unit  : 통과 (execution-engine 331 + 전체 6404 pass / 1 skip)
- build : 통과 (nest build, 0 TS error)
- e2e   : 통과 (dockerized 29 suites/176 pass — `execution-park-resume.e2e-spec.ts`(중첩 재개) 포함, 무회귀)

## 보류·후속 항목
- INFO nitpick(7/8/10/13/14): 비차단, 후속 polish.
- W1/W2 무효 — spec 변경 없음(registry 는 내부 메커니즘, 본문 매핑 정합).
