# RESOLUTION — `/ai-review` 2R (전수 14명 · Critical 0 · Warning 1)

미리 선언한 정지 규칙은 «Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건» 이다. 이 라운드에서 남은 Warning 은 문서 한 건이고
`codebase/**` 밖(`CHANGELOG.md`)에서 고쳤다. 그래서 이 라운드의 codebase 수정은 0건이고 리뷰는 **여기서 수렴한다**(리뷰 게이트의
freshness 는 `codebase/**` 편집 시각을 본다).

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 CHANGELOG `workflow-assistant 세션` 불릿의 경로에 모듈 세그먼트가 없음 | 사실 — 여섯 경로에 `workflow-assistant/` 를 채웠다. 컨트롤러 prefix(`@Controller('workflow-assistant')` · `'auth/2fa/webauthn'` · `'external/executions'`)와 대조해 네 불릿이 같은 규칙(`/api` 뺀 상대 경로)임을 확인했다 | 이 RESOLUTION 과 같은 커밋 |
| INFO7 테스트 F 가 `[200, 204, 404]` 를 허용 | 트래커 등재(아래) — 기존 줄이고 테스트만 바꾸는 일이라 이 라운드에서 codebase 를 건드리지 않는다 | — |
| INFO8 `sessions/latest` 의 `data: null` 분기를 e2e 가 대조한 적이 없음 | 트래커 등재 — 스키마는 단위 테스트 `api-wrapped.spec.ts` 가 `toStrictEqual` 로 고정한다 | — |
| INFO9 `AssistantToolCallDto` 선택 키 «생략» 쪽이 e2e 에 없음 | 트래커 등재 — 선택 키가 빠진 메시지 쪽(user 행)은 H 가 대조하지만, 도구 호출 안의 선택 키 생략은 없다 | — |
| INFO4 workflow-assistant 핸들러 반환 타입이 DTO 가 아님 | 조치 안 함 — 핸들러는 반환 타입을 적지 않고 서비스가 돌려주는 엔티티를 그대로 낸다(추론 타입의 `createdAt` · `lastInteractionAt` 이 `Date`). DTO(`string`)로 좁히려면 반환 모양을 바꿔야 해서 «반환 모양은 바꾸지 않는다» 는 이 PR 의 방향(plan)과 어긋난다. drift 는 e2e 계약 대조(A · B · F · H)가 잡는다. triggers 는 서비스 반환이 이미 DTO 와 같은 모양이라 좁혔다 | — |
| INFO5 triggers 서비스 반환 타입 | 조치 안 함 — 컨트롤러 반환 타입이 서비스 반환을 DTO 와 대조한다(서비스 모양이 바뀌면 `tsc` 가 컨트롤러 자리를 가리킨다). 같은 파일 `rotateBotToken` 도 컨트롤러에서만 좁힌다 | — |
| INFO1 · 2 · 3 · 6 · 10 ~ 16 | 조치 불필요 — 리뷰어 스스로 «조치 불요 · 기수용 · 해당 없음» 으로 적었다 | — |

## TEST 결과

이 라운드의 수정은 `CHANGELOG.md` 한 파일(문서)이라 테스트 대상 코드가 바뀌지 않았다. 직전 결과(1R 조치 커밋 `bf1fa96fc` 기준)가 그대로다.

- lint: 통과 (`_test_logs/lint-20260926-135719.log`)
- unit: 통과 (`_test_logs/unit-20260926-135815.log`)
- build: 통과 (`_test_logs/build-20260926-135937.log`)
- e2e: 통과 — 412건 (`_test_logs/e2e-20260926-140217.log`)

## 보류·후속 항목

- 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 새 항목 «workflow-assistant e2e 의 남은 계약 대조 세 칸» — INFO7 · 8 · 9.
