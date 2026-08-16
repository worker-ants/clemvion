# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 신규 "잔여" 항목 문장이 술어 없이 끊긴다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:169` (게이트 169, 신규 추가)
  - 상세: 실측(`Read` 로 현재 파일 직접 확인, `git show HEAD:...`로 재확인)하면 문장이 `...가 영향을 받으므로 blast radius 가 다른 별건`으로 끝나고 바로 다음 줄이 공백, 그 다음이 완전히 다른 맥락(기존에 있던 "왜 그 PR 에서 안 고쳤나" 인용구 — 이번 diff 밖의 기존 텍스트)으로 넘어간다. "다른 별건"은 한국어 문장으로서 술어(`이다`/`이라 별도 PR 로 뗀다` 등)가 빠진 채 명사로 끊기는데, 같은 파일·같은 작성자가 같은 취지를 서술한 다른 곳(`terminal-error-payload.ts:97`)은 `blast radius 가 다른 결정이라 별도 PR 로 뗀다`로 완결된 문장을 쓴다. 즉 이 plan 문서 쪽만 편집 중 마지막 어절이 누락된 것으로 보인다. 이 항목은 "자격증명 없는 연결 문자열·호스트명이 여전히 통과한다"는 **살아있는 보안 잔여 갭**을 추적하는 유일한 기록 지점이라, 문장이 불완전하면 다음 세션이 이 문서를 근거로 판단할 때(예: 이 갭을 닫을지 말지 재조사할 때) 사소하지만 불필요한 확인 비용이 생긴다. 뜻 자체는 문맥으로 유추 가능해 심각도는 낮다.
  - 제안: `blast radius 가 다른 별건이다` 또는 코드 JSDoc 과 동일하게 `blast radius 가 다른 결정이라 별도 PR 로 뗀다`로 문장을 완결.

## 확인한 항목 (이전 라운드 지적이 실제로 해소됨 — 직접 대조)

- **라운드 수 불일치(4 vs 5)** — `09_51_00` documentation 리뷰가 지적한 `plan/in-progress/eia-terminal-error-sanitize.md` 헤더와 `terminal-error-payload.spec.ts` docstring 간 "4라운드 vs 5라운드" 불일치는 현재 두 파일 모두 "5라운드"로 일치함을 `grep` 으로 직접 확인했다(`eia-terminal-error-sanitize.md:11`, `terminal-error-payload.spec.ts:135`).
- **§3.3 → §3.1 인용 오류** — `10_19_30` documentation 리뷰와 `10_19_31` consistency-check(convention_compliance/cross_spec)가 독립적으로 지적한 "EIA outbound webhook" 절 번호 오표기(§3.3, 실제로는 §3.1)는 이번 diff 에서 `CHANGELOG.md`(신규 항목 + 기존 #1174 항목 둘 다) · `plan/in-progress/eia-terminal-error-sanitize.md:27` 세 곳 모두 `§3.1`로 정정돼 있음을 `grep` 으로 확인했다. plan 체크리스트(`:171`)에도 "§3.3→§3.1 인용 오류 정정"으로 근거가 남아 있다.
- **`terminal-error-payload.ts` 안의 "5곳" 중의성** — `10_19_30` documentation 리뷰가 지적한, 같은 파일 인접 JSDoc 에서 "5곳"이 취소 이벤트 호출부와 `toTerminalErrorPayload` 호출부라는 서로 다른 집합을 가리켜 오독 소지가 있던 문제는 현재 파일(`:65`)에 `(위 §"현재 호출부" 의 취소 이벤트 5곳과는 **다른 집합**이다.)`라는 명시적 구분 문구가 들어가 해소됐다.
- **R17 마스킹 카탈로그·§6.4 note 미반영** — `10_19_31` consistency-check(plan_coherence/cross_spec/rationale_continuity)가 지적한 "신규 egress 마스킹이 spec 의 R17 카탈로그·§6.4 표에 반영되지 않음" 문제는 `spec/` 이 developer 쓰기 권한 밖이라 이번 PR 로 해소될 수 없는 항목인데, `plan/in-progress/eia-terminal-error-sanitize.md` "후속" 절(:151-159)에 planner 턴 대상으로 명시적으로 등재돼 있어 유실 위험 없이 추적된다 — 적절한 처리.
- **CHANGELOG 신규 항목의 정확성** — "종결 emit 4곳 + chat-channel fanout"(`CHANGELOG.md:11`)이라는 서술을 `toTerminalErrorPayload` 실제 호출부(`chat-channel.dispatcher.ts:551`, `execution-engine.service.ts:668/3400/5030`, `retry-turn.service.ts:1001`)와 직접 대조해 정확함을 확인했다(4+1=5, 코드 JSDoc 의 "EXECUTION_FAILED 4곳 + chat-channel.dispatcher 1곳"과도 일치).
- **`sanitize-error-message.ts` docstring 정정** — "webhook 알림"이 실제로는 3개 호출부 전부 `in_app`/`email`뿐이라는 주장을 호출부 3곳(`execution-engine.service`·`background-execution.processor`·`schedule-runner`)과 대조해 정확함을 확인했다. 코드 로직(정규식·길이 상한) 변경은 없어 docstring-only 수정이 적절하다.
- **§6.4 절 번호 자체의 정확성** — `spec/5-system/14-external-interaction-api.md` 를 직접 열어 `### 6.4 페이로드 — execution.failed`(line 770)가 실제로 존재함을 확인했다. 코드·CHANGELOG·plan 이 인용하는 "§6.4" 자체는 오표기가 아니다.
- **신규 테스트 8건의 docstring/주석** — `terminal-error-payload.spec.ts` 의 신규 `describe` 블록 docstring 은 "5라운드 미룬 항목", "판별력 있는 입력을 쓴다"는 근거를 명시하고, 잔여 갭 캐너리 테스트(`:206-211`)는 JSDoc 실측표와 짝을 이루도록 "표·CHANGELOG 도 같이 고쳐야 한다는 신호가 된다"는 유지보수 지침까지 남겨 향후 drift 를 코드로 잠글 수 있게 했다 — 문서화 관례상 모범적이다.

## 요약

핵심 코드 변경(`redactTerminalError` egress 마스킹 도입)의 JSDoc·CHANGELOG·plan 문서화는 이례적으로 상세하고, 이전 두 라운드(`09_51_00`, `10_19_30`)의 코드 리뷰와 두 라운드(`09_25_29`, `10_19_31`)의 consistency-check 가 지적한 문서 정확성 문제(라운드 수 불일치, §3.3→§3.1 오인용, JSDoc 내 "5곳" 중의성)는 모두 실제 파일을 직접 열어 대조한 결과 정확히 해소됐음을 확인했다. spec 문서(R17 카탈로그·§6.4 note) 미반영은 developer 권한 밖이라 이번 PR 로 닫을 수 없는데, plan 의 "후속" 절에 planner 턴 대상으로 명시적으로 등재돼 있어 적절히 처리됐다. 이번 라운드에서 새로 발견한 것은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 신규 "잔여 갭" bullet 문장이 술어 없이 끊긴다는 사소한 오탈자성 결함 하나뿐이며, 뜻은 문맥으로 유추 가능해 영향은 낮다.

## 위험도
LOW
