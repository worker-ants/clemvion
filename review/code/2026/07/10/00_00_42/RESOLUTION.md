# RESOLUTION — 잔여 하드닝(구조화 필드 + ai_message) ai-review 2차

리뷰 대상 커밋: `f456adedf`. 리뷰어 3종(security / testing / side-effect) 병렬. fix 는 본 RESOLUTION 뒤 커밋.

## 처분 요약

| # | 출처 | Severity | 판정 | 조치 |
|---|---|---|---|---|
| 1 | security | CRITICAL | Fixed | **nodeOutput.conversationConfig bypass** — `waiting_for_input` emit·`getStatus` 의 `nodeOutput.conversationConfig.{message,messages,presentations}` 가 ai_message·thread 와 동일 텍스트를 **무마스킹** 노출. → ai-turn 두 waiting emit 의 conversationConfig 를 `deepRedactSecrets` 로, `getStatus` 는 nodeOutput 전체를 `deepRedactSecrets` 로 마스킹(에디터 전용 `turnDebug.llmCalls` 는 미변경). |
| 2 | security | WARNING | Fixed | `ai_message.messages[].toolCalls[].arguments`(중첩 raw JSON string)가 `deepRedactSecrets` 의 flat leaf 마스킹으로 **JSON 파괴** 재현. → `deepRedactSecrets` 가 JSON-looking string leaf 를 `redactSecretsInJsonString` 로 라우팅하도록 수정(JSON-safe everywhere). |
| 3 | side-effect | WARNING | Fixed | **깊이 제한 없는 재귀**(sibling `sanitizePayloadForWs` 의 `MAX_SANITIZE_DEPTH` 회귀 재도입). → `MAX_REDACT_DEPTH=10` 추가, 초과 subtree 는 wholesale `***`. |
| 4 | side-effect | WARNING | Fixed | credential-key 마스킹이 string 값만 wholesale → object/array 값은 leaf 미매치 시 노출("mirrors sanitizePayloadForWs" 주장과 불일치). → credential-named 키의 값은 **타입 불문 wholesale** `***`. |
| 5 | security | WARNING | Fixed | `CREDENTIAL_KEY_PATTERN` 이 `x-api-key`/`x-auth-token`(prefixed header) 미커버. → 패턴에 `x[_-]api[_-]?key`·`x[_-]auth[_-]?token` 추가. |
| 6 | security, side-effect | INFO | Fixed | JSON round-trip 이 bare 큰 정수 문자열 정밀도 손실 가능. → `redactSecretsInJsonString` 이 `{`/`[` 로 시작하는 문자열만 파싱(`looksLikeJson` 가드) — 숫자/평문 문자열은 flat 처리. |
| 7 | testing | CRITICAL(coverage) | Fixed | ai_message **terminal branch** 마스킹 미검증 + `presentations` 미검증. → ai-turn spec (b3) 종료-turn 테스트(message·messages·toolCalls.arguments JSON-safe·presentations) 추가, (b2) waiting 테스트와 함께 양 branch 커버. |
| 8 | testing | WARNING(coverage) | Fixed | thread-renderer copy-on-change 가 "구조화 필드 존재 + secret 없음" 케이스 미검증. → turn 참조 동일성 보존 테스트 추가. |
| 9 | side-effect | WARNING | Documented | **Chat Channel 실발송 FP 손상** — emit-site 마스킹이 Telegram/Slack/Discord 능동 발송에도 적용돼 기술 대화체 FP 시 이미 전달된 응답을 `***` 로 손상. → **보안 우선으로 수용**(실 secret 외부 채널 유출 방지 > rare FP), 에디터는 `llmCalls` 로 원문 확인 가능. participant-vs-observer 분리 egress 는 후속 개선. spec §R17 에 명문화. |

추가 테스트: `deepRedactSecrets` credential-key object wholesale·JSON-safe leaf·depth cap; `redactSecretsInJsonString` big-int guard; `getStatus` nodeOutput 마스킹.

## 잔여(문서화)
- conversationConfig 이외 일반 `nodeOutput` 키-allowlist(SSE 는 sanitizePayloadForWs credential-키 마스킹으로 부분 방어).
- participant-vs-observer 분리 egress(Chat Channel FP 최소화).
- DB-at-rest append-time redaction.

## 검증
- unit: 대상 399 suite / 7921 pass(+1 skip). build(tsc build config) clean. lint 0 error.
