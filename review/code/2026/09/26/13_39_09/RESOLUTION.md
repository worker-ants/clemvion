# RESOLUTION — `/ai-review` 1R (Critical 0 · Warning 3)

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 메시지 하위 DTO 5종이 e2e 에서 한 번도 대조되지 않음 | e2e `workflow-assistant` H — 두 끝(선택 키가 전부 빠지고 nullable 이 전부 null 인 user · 선택 키를 전부 채운 assistant)을 DB 에 넣고 `AssistantSessionDetailDto` 로 대조한다. 넣은 모양이 그대로 왔는지 먼저 단언해 공허하지 않게 했다. 검증자가 다섯 층(메시지 · 도구 호출 · 계획 · 계획 단계 · 사용량) 모두 내려가는지는 임시 프로브로 확인했다 — 각 층에 심은 키 5개가 전부 `undeclared` 로 걸렸다(프로브는 커밋하지 않음) | `bf1fa96fc` |
| W2 `judgeHandler` SRP 압박 | 데코레이터 분류를 순수 함수 `classifyDecorators` 로 뗐다. `judgeHandler` 는 그 결과로 `violation` · `unadvertised` · `checked` 만 조립한다 | `bf1fa96fc` |
| W3 2xx/3xx 분류 중복 | `@ApiResponse` 분기와 이름 표 분기가 헬퍼 `advertise(status)` 하나를 쓴다 | `bf1fa96fc` |
| INFO11 `title: null` 경로 미대조 | H 가 제목 없는 세션으로 만들어 `AssistantSessionDto` · 상세 양쪽에서 대조한다 | `bf1fa96fc` |
| INFO13 JSDoc 에 `unadvertised` 없음 | `scanHttpStatusAdvertised` · `judgeHandler` JSDoc 에 추가 | `bf1fa96fc` |
| INFO14 triggers 반환 타입이 인라인 리터럴 | `Promise<NotificationRotateSecretDto>` · `Promise<InteractionRevokeTokenDto>` — 같은 파일 `rotateBotToken` 의 관례 | `bf1fa96fc` |
| INFO1 · 2 · 4 · 5 · 7 · 8 · 9 · 12 | 조치 불필요 — 리뷰어 스스로 «조치 불필요 · 관례와 일관 · 참고용» 으로 적었다 | — |
| INFO3 PR-스코프 e2e 파일 | 유지 — 두 라우트(webauthn availability · rotate-secret)는 부르는 e2e 가 없던 자리다. 각 도메인 파일에 흩으면 «새로 광고한 응답을 대조한다» 는 이 파일의 한 줄 목적이 흩어진다. 파일 머리 주석이 다른 두 대조가 어디 있는지 가리킨다 | — |
| INFO6 DTO 크기 사후 기록 | plan 실측 표의 workflow-assistant 행이 이미 «세션 상세 · 메시지 + 중첩 셋» 을 처방으로 적었다 | — |
| INFO10 SSE description 언어 | 이 PR 이 쓴 쪽이 한국어(저장소 관례)다. 기존 영어 쪽은 이 PR 이 건드리지 않은 자리라 범위 밖 | — |

**리팩터가 판정을 바꾸지 않았다는 근거**: 뮤턴트를 새 자리로 다시 돌렸다 — 8/8 예측대로 KILLED, 예측 케이스 전부 사망. S3 는
두 분기로 나눠(S3a `@ApiResponse` 분기만 · S3b 이름 표 분기만) 공유 헬퍼 뒤에서도 각 분기가 따로 덮이는지 봤고, 리팩터가 옮긴
`actualKnown` 도 S7 로 더했다. 표는 plan 에 있다.

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260926-135719.log`)
- unit: 통과 (`_test_logs/unit-20260926-135815.log`)
- build: 통과 (`_test_logs/build-20260926-135937.log`)
- e2e: 통과 — 412건(1R 전 411 + H) (`_test_logs/e2e-20260926-140217.log`)
