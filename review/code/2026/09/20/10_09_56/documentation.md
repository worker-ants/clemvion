# 문서화(Documentation) 리뷰 — SSRF 가드 소비자 넷의 catch 판정 분기 (2라운드)

## 발견사항

- **[WARNING]** `followRedirectsSafely` 의 JSDoc이 그 안에서 재사용하는 `outboundBlockReason` 의 새 던짐 동작(이번 diff 의 핵심 변경)을 반영하지 못해 불완전해짐(오래된 주석)
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:51-53` (`followRedirectsSafely` 함수 JSDoc — 이 hunk 자체는 diff 에 없는 기존 코드라 프롬프트 게이트 번호가 없다. 실제 파일을 `Read` 로 열어 확인한 1-기준 줄 번호)
  - 상세: 이번 diff 는 같은 파일의 `outboundBlockReason`(21-38행, diff 에 포함)의 계약을 바꿨다 — 예전에는 가드가 던진 것이 무엇이든 문자열 사유로 삼켰지만(`return err instanceof Error ? err.message : String(err)`), 지금은 `SsrfBlockedError` 만 사유로 돌리고 그 밖은 `throw err` 로 그대로 던진다. `followRedirectsSafely` 는 리다이렉트 홉마다(74행) 이 함수를 그대로 호출하므로, 가드가 홉 검사 중 판정 아닌 오류(예: `TypeError`)를 던지면 이제 `followRedirectsSafely` 밖으로도 그 오류가 전파된다. 그런데 `followRedirectsSafely` 자신의 JSDoc(51-53행)은 "차단(대상 가드 실패·홉 초과)은 던지지 않고 `{ blocked: true, reason }` 으로 돌려준다 ... `fetch` 의 전송 오류는 그대로 던진다" 라고만 적혀 있어, 이 함수를 던짐원이 `fetch` 하나뿐인 것처럼 읽히게 한다. 실제로는 가드의 고장도 이 함수를 통해 던져진다 — 호출부(`http-request.handler.ts` 533행 `catch`)는 그 오류를 `IntegrationError` 가 아니므로 `HTTP_TRANSPORT_FAILED` 로 분류하는데(이는 plan `ssrf-catch-instanceof.md` 표에 이미 의도로 적혀 있어 동작 자체는 옳다), 이 JSDoc 만 보고 판단하는 다음 유지보수자는 "이 함수에서 나가는 예외 = fetch 오류" 로 오인해 새 catch/로깅을 짤 수 있다. 이번 PR 이 "가드의 고장을 정확히 서술"하는 것이 핵심 주제인데, 정작 자신이 바꾼 함수를 재사용하는 인접 함수의 계약 서술이 그 변화를 놓쳤다.
  - 제안: JSDoc 마지막 줄을 "`fetch` 의 전송 오류와, 홉 검사 중 가드가 던진 판정 아닌 오류(가드의 고장)는 그대로 던진다" 정도로 넓혀 두 던짐원을 모두 명시.

- **[INFO]** 인라인 주석의 "§아래 JSDoc" 참조가 실제로는 위쪽을 가리킴(방향 오기)
  - 위치: `codebase/backend/src/modules/integrations/database-connection-tester.ts:146`
  - 상세: `testDatabaseConnection` 의 함수-계약 JSDoc(126-135행, "던지지 않는다 — 결과를 돌려준다")은 함수 선언(136행)보다 **위**에 있다. 그런데 함수 본문 안(146행)의 새 인라인 주석은 "던지지 않는 계약은 그대로다(§아래 JSDoc)" 라고 적어 그 JSDoc 을 "아래" 로 가리킨다 — 파일 순서상 이 주석은 JSDoc 보다 **아래**에 있으므로 참조 방향이 반대다. 내용 자체는 정확하지만(그 JSDoc 을 가리키는 것은 맞다), 방향 표현이 틀려 순간적으로 헷갈릴 수 있다.
  - 제안: "§아래 JSDoc" → "§위 JSDoc" 으로 정정.

- **[INFO]** 트래커 종결 메모와 원본 plan 체크리스트 사이에 뮤턴트 개수 서술 불일치(넷 vs 다섯)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4923-4926`(이번 diff 로 추가된 "2026-09-20 해소" 문구, "뮤턴트 다섯으로 판별력 확인") vs `plan/in-progress/ssrf-catch-instanceof.md:81-83`(같은 작업의 원본 체크리스트, "뮤턴트 넷(각 판정 분기 삭제 = 옛 동작) 전부 RED: redirect · http-request · database-query · db tester" — 넷만 열거)
  - 상세: 원본 plan 의 체크리스트는 이 작업의 SoT 로 뮤턴트 4건(호출부 4곳)만 열거한다. 이번 diff 가 트래커에 새로 적은 종결 문구는 "뮤턴트 다섯"이라고 세는데, 다섯 번째가 무엇인지 트래커·plan 어디에도 명시적으로 나열되지 않는다(정황상 라운드 1 리뷰 조치(`e8d810405`)가 추가한 `AbortSignal.timeout` 순서 회귀 테스트의 뮤턴트로 추정되지만, RESOLUTION.md 의 해당 행은 "뮤턴트(...) RED" 로 개수를 특정하지 않는다). 감사자가 "다섯"이라는 숫자를 근거로 5개 지점을 찾으려 하면 plan 문서에서 4개만 확인되어 혼란을 준다.
  - 제안: 트래커 문구에 다섯 번째 뮤턴트가 무엇인지 괄호로 한 항목 추가(예: "+ AbortSignal.timeout 순서 회귀") 하거나, `ssrf-catch-instanceof.md` 체크리스트 2번째 항목에 라운드 1 조치로 늘어난 뮤턴트를 반영.

- **[INFO]** spec frontmatter `code:` 의 `http-redirect.ts` 누락 — 1라운드 WARNING 이 이번 라운드에 적절히 처리됨(재확인, 조치 불요)
  - 위치: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` (실제 파일 4-8행, 여전히 `http-redirect.ts` 없음) / `plan/in-progress/spec-draft-nullable-notation-followups.md:4934-4940`(이번 diff 로 신설된 planner 항목) / `review/code/2026/09/20/09_35_16/RESOLUTION.md` W5 행
  - 상세: 1라운드 documentation 리뷰가 지적한 WARNING("developer 가 spec 쓰기 권한이 없어 자기-반증형 소정정 대상도 아님")이 이번 diff 에서 정확히 그 근거대로 처리됐다 — 코드를 고치지 않고 `spec-draft-nullable-notation-followups.md` 에 planner 전용 항목으로 등재했고(`code:` 누락 + 세 에러 표의 트리거 누락을 함께), RESOLUTION.md 도 같은 결론을 기록했다. 절차상 올바른 지연 처리라 더 이상 WARNING 으로 유지할 필요는 없다.
  - 제안: 조치 불요(재확인만). planner 턴에서 등재된 항목이 실제로 처리되는지는 이 plan 밖에서 추적.

- **[INFO]** `database-query.handler.ts` 의 기존 인라인 주석(1라운드 WARNING 대상) — 이번 라운드에 정확히 갱신됨
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:340-343`
  - 상세: 1라운드에서 지적된 "SSRF guard 의 plain Error 는 `DB_HOST_BLOCKED` 로 승격되므로" 라는, 무조건-승격 시절 서술이 이번 diff 로 "SSRF 가드가 던진 것은 위에서 두 갈래로 승격돼 온다 — 차단 판정은 `DB_HOST_BLOCKED`, 판정 아닌 오류(가드의 고장)는 `INTEGRATION_CALL_FAILED`. 둘 다 IntegrationError 라 여기서 code 가 보존되고 `mapDbError` 로는 흐르지 않는다." 로 정확히 갱신됐다. 실제 262-284행의 두 갈래 분기와 일치한다.
  - 제안: 없음(모범적 반영).

- **[INFO]** 새로 추가/수정된 인라인 주석·JSDoc 의 인용 근거 교차검증 결과 — 전부 정확
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:274-276`(`spec/5-system/3-error-handling.md` §6.3.1 C2 인용), `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:373-376`(`buildPreflightErrorOutput` 재사용 주장), `codebase/backend/src/nodes/integration/http-request/http-redirect.ts:74`(리다이렉트 홉이 `outboundBlockReason` 을 재사용한다는 주장)
  - 상세: `spec/5-system/3-error-handling.md:569-570` 을 직접 열어 C2("`err` 가 message·name 밖의 민감 정보를 속성으로 들고 있지 않다")와 대조한 결과 인용이 정확했고, `buildPreflightErrorOutput` 은 실제로 이 파일 안 preflight 실패 경로 다섯 곳이 공유하는 함수였다(206·240·373·408·548행). 리다이렉트 홉의 `outboundBlockReason` 재사용도 코드로 확인됨. 세션 간 근거 인용이 지어낸 것이 아님을 확인.
  - 제안: 없음.

- **[INFO]** README·API 문서·CHANGELOG·환경변수 문서는 이번 라운드에도 갱신 불요 — 1라운드 판단 유지
  - 위치: `CHANGELOG.md`(신규 항목 없음), 저장소 전역 README
  - 상세: 이번 diff 는 내부 catch 분류만 바꾸고 wire 계약·응답 코드 표면·설정 옵션을 바꾸지 않는다. plan(`ssrf-catch-instanceof.md` 29-33행)이 "지금 동작 차이가 없다는 것은 실측이다"(가드가 오늘 판정 아닌 오류를 던지는 경로가 없음)를 근거로 남겼고, 이번 diff 도 그 전제를 깨지 않는다. `CHANGELOG.md` 가 기록하는 부류(사용자가 배포 뒤 실제로 관측 가능한 동작 변화, 예 `ea27c21b3`)에 해당하지 않는다.
  - 제안: 조치 불요. 가드에 실제 비판정 실패 경로가 처음 생겨 이 분기가 발동하는 시점에 CHANGELOG 갱신을 고려(참고용, 범위 밖).

## 요약

이번 2라운드 diff 는 1라운드 documentation 리뷰의 WARNING 둘(오래된 `database-query.handler.ts` 주석, spec frontmatter `code:` 누락)을 정확한 근거로 각각 코드 갱신·정당한 지연(planner 항목 등재)으로 잘 마무리했다. 다만 그 처리 과정에서 새로 손댄 `outboundBlockReason` 의 재사용처인 `followRedirectsSafely` 의 JSDoc이 바뀐 던짐 계약을 반영하지 못해 새 WARNING 하나가 남는다 — 이 PR 의 핵심 주제("판정과 가드의 고장을 정확히 서술")가 자신이 바꾼 함수의 이웃 문서에는 미처 미치지 못한 사례다. 그 외에는 방향이 뒤바뀐 주석 참조 하나와 트래커·plan 사이 뮤턴트 개수 서술 불일치 하나가 낮은 비중의 INFO 로 남고, 새로 작성된 주석·JSDoc·테스트 docstring 은 인용 근거(spec §6.3.1 C2, 공용 헬퍼 재사용 등)가 실제 코드와 정확히 일치했다. README·CHANGELOG·환경변수 문서는 이번 변경의 영향 범위 밖이라 갱신 불요 판단을 유지한다.

## 위험도

LOW
