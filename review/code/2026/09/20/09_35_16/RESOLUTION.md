# RESOLUTION — SSRF 가드 소비자의 판정 분기 (1라운드)

SUMMARY: Critical 0 · Warning 5 · INFO 7. 정지 규칙(리뷰 전에 선언): Critical · Warning 0 이거나 `codebase/` 수정 0 인
라운드에서 수렴, 최대 3라운드.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W2 preflight 를 `try` 안으로 옮기며 `AbortSignal.timeout` **뒤**로 밀려 전송 예산을 잠식 | **고침 — 내가 만든 결함이다.** `init`(타임아웃 신호)을 preflight 통과 **뒤**에 만든다. 신호는 생성 시점부터 세므로 가드의 DNS 조회 시간이 `fetch` 예산에서 빠지고 있었다. 회귀 테스트: 차단된 경우 `AbortSignal.timeout` 이 **호출되지 않는다**(신호를 아직 만들지 않았다는 관측). 뮤턴트(신호 생성을 preflight 앞으로 되돌림) RED | `e8d810405` |
| W3 신설 `http-redirect.spec.ts` 가 DNS 가드를 mock 하지 않아 실제 `node:dns` 조회 | **고침.** `assertSafeOutboundHostResolved` 도 mock 에 넣고 `beforeEach` 에서 `mockResolvedValue(undefined)`. 통과 케이스가 네트워크에 의존하지 않는다 | `e8d810405` |
| W1 판정 아닌 오류의 원문 message 가 마스킹 없이 노출 | **고침(내가 새로 내보내는 두 곳).** HTTP 노드는 `toLogError(err).message`(= `sanitizeMessage`)로 감싼 `IntegrationError` 를 `buildPreflightErrorOutput` 에 넘긴다. DB 노드 승격도 `sanitizeMessage`, DB 연결 테스트는 `clampMessage(sanitizeMessage(detail))`. **HTTP 연결 테스트(`describeFailure`→`clampMessage`)는 손대지 않았다** — 그 경로는 이 PR 이 만든 것이 아니라 전송 실패 전부가 쓰는 기존 경로이고, 거기만 규칙을 바꾸면 형제 분기와 어긋난다 | `e8d810405` |
| W4 `database-query.handler.ts` 바깥 catch 의 주석이 «무조건 승격» 시절 서술 | **고침.** 두 갈래(판정=`DB_HOST_BLOCKED` · 비판정=`INTEGRATION_CALL_FAILED`)를 적고, 둘 다 `IntegrationError` 라 `mapDbError` 로 흐르지 않는다는 결론을 유지 | `e8d810405` |
| W5 `1-http-request.md` frontmatter `code:` 에 `http-redirect.ts` 누락 | **코드 밖 — planner 항목으로 등재.** `spec/` 쓰기는 developer 권한 밖이고, 증거 목록 누락이라 자기-반증형 소정정(다섯 조건)에도 해당하지 않는다. 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 «`code:` 에 `http-redirect.ts` · 세 에러 표에 «가드의 고장» 트리거» 로 등재(INFO 6 도 같은 항목) | 마무리 |
| INFO 1 판정 분기가 네 파일에 반복 | 조치 없음 — 공용 헬퍼 추출은 트래커의 «공용 가드를 중립 위치로» 항목과 같은 결(파일 이동 + spec `code:` 동반)이라 그 항목에서 함께 본다 |
| INFO 3 비판정 분기가 `authentication:'integration'` 한 케이스만 | 조치 없음 — 판정 분기는 인증 방식과 무관한 위치(가드 catch)에 있고, 인증별 분기는 usage 로그 기록 여부뿐이라 `none`/`custom` 을 더해도 같은 줄을 다시 지난다. 대신 로그 기록 분기는 이 테스트가 `integration` 으로 이미 관측한다 |
| INFO 4 리다이렉트 **홉** 에서의 비판정 오류 | 조치 없음 — 첫 검사와 같은 함수(`outboundBlockReason`)를 같은 방식으로 부르고, 그 함수의 던지는 계약은 `http-redirect.spec.ts` 가 직접 본다 |
| INFO 2 · 5 · 7 | 2 · 5: `outboundBlockReason` JSDoc 은 이번 변경에서 «판정 아닌 오류는 그대로 던진다» 를 이미 적었다. 테스터 JSDoc 결과표는 코드 목록이라 트리거 열거는 인라인 주석에 둔다 · 7: import 정렬은 그 파일의 기존 스타일 |

## TEST 결과

- lint: 통과
- unit: 통과
- build: 통과
- e2e: 통과 (366) — 첫 실행은 `schedule-trigger` 「D. PATCH cron → nextRunAt 재계산」 1건 실패. 이 PR 과 무관한 **시각 충돌**이다:
  09:59 KST(=00:59 UTC)에는 `0 10 * * *`(Asia/Seoul → `01:00:00Z`)와 `*/1 * * * *`(다음 분 → `01:00:00Z`)가 같은 값이 돼
  «재계산 안 됨» 으로 읽힌다(`_test_logs/e2e-20260920-095855.log`). 10:02 KST 재실행 366 통과. 트래커에 등재했다
  (`spec-draft-nullable-notation-followups.md` — 매일 그 1분에 재발한다).
