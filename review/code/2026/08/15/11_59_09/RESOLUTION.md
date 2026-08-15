# RESOLUTION — `11_59_09`

ai-review **CRITICAL 0 / WARNING 5**. 4건 조치, 1건 유예(근거 실측 기재).

**이 라운드가 잡은 것 중 하나는 "내가 세 번 거짓말을 했다"는 사실이다.**

## W1 — "별건 등재됨" 이 세 라운드 연속 거짓이었다 (architecture)

**조치 완료 — 그리고 지적의 핵심은 결함이 아니라 내 근거였다.**

리뷰어의 발견은 두 층이다.

1. `emitExecution(payload: unknown)` 이 종결 payload 를 타입으로 강제하지 않아 필드를
   16 호출부에 손으로 스레딩한다 — **이 PR 8라운드 반복 결함의 구조적 원인**
2. 내가 이 항목을 유예하며 `11_29_02` · `11_44_10` · 커밋 메시지에서 **세 번**
   *"별건 등재됨"* 이라 썼는데, `plan/in-progress/**` 전체 grep 결과 **그런 체크박스가
   어디에도 없었다**

두 번째가 실제 지적이다. 내가 만든 것은 **task 칩**이었고 그건 SoT 가 아니다. 이 저장소의
기록된 교훈이 정확히 *"미룬 항목은 그 턴에 `plan/` 에 적어라 — `review/**` 는 SoT 아님"* 다.

`spec-sync-external-interaction-api-gaps.md` 에 실제 절을 만들어 등재했고, **등재 자체가
지적사항이었다는 사실을 그 절에 적어 뒀다**. 타입 파사드 도입은 이번 PR 범위 밖 유예 —
이번엔 그 유예의 근거가 실재한다.

> **교훈**: 유예의 근거로 "등재했다" 를 인용할 때, 그 등재를 실측하지 않았다. 이 저장소의
> 반복 형태(*"유예 근거는 실측해야 한다"*)가 **근거가 참인지**가 아니라 **근거가 존재하는지**
> 층위에서 재발했다.

## W2 — 집계가 안전했던 이유는 방어가 아니라 우연이었다 (side_effect · requirement)

**조치 완료. 이 라운드의 유일한 동작 결함이고, 내 변경이 유발한 것이다.**

세 집계(`dashboard.avgExecutionTime`, `statistics.avgDurationMs` ×2)가 `duration_ms IS NOT
NULL` 로만 걸렀다. **종전에 취소·타임아웃 5경로가 그 컬럼을 비워 뒀기 때문에 자동으로
빠졌던 것**이지, 상태로 거르고 있던 게 아니다.

이 PR 이 그 자리를 채우는 순간 방어가 사라진다. park 상한이 **24.8일**이므로 3일 대기 후
취소된 실행 하나가 259,200,000ms 로 "평균 실행 시간" 에 들어간다 — 대시보드 숫자가 눈에
띄게 망가진다.

세 자리에 `status = 'completed'` 추가. 판별력을 **자리별로** 확인했다:

| 뮤턴트 | 결과 |
|---|---|
| dashboard AVG 필터 제거 | RED (1 failed / 15) |
| statistics 첫 자리(`getSummary`)만 제거 | RED (1 failed / 8) |
| statistics 둘째 자리(`getTopWorkflows`)만 제거 | RED (1 failed / 8) |

한 자리만 지워도 잡힌다 — "둘 다 지워야 RED" 면 자매 누락을 못 잡는다.

**가드가 무엇을 보증하지 않는지도 적었다.** mock 이 SQL 을 실행하지 않으므로 이 테스트는
*집계식에 상태 조건이 들어 있다*만 보증한다(값이 맞는지가 아니다). 주석에 명시했다.

**범위 판단**: `getNodeStats` 의 `ne.duration_ms` 집계는 **건드리지 않았다** —
`git diff origin/main...HEAD` 에 node execution duration 을 쓰는 라인이 **0건**이라
이 PR 이 유발하지 않는다. (앞선 라운드에서 되돌린 정규식이 건드렸던 자리라 확인했다.)

## W3 — 마지막 남은 vacuous mock (testing)

**조치 완료. 같은 형태를 이 브랜치에서 세 번째로 겪었다.**

`cancelParkedExecution` 의 `makeCancelQb` 가 `raw` 를 아예 주지 않아, `RETURNING`
추출 로직이 **한 번도 실행되지 않고** emit 이 초기값 `null` 이 됐다. 단언
`durationMs: null` 은 그 `null` 과 우연히 일치했다 — 추출을 통째로 지워도 GREEN 이다.

`raw: [{ id, duration_ms: 7200000 }]` 를 주고 emit 을 **같은 값으로 정확 매칭**. 자매
4경로는 직전 두 라운드에 이미 같은 방식으로 고쳤고, 이로써 5경로가 동형이 됐다.

> **교훈**: `null` 을 기대하는 단언은 "값이 없음" 과 "코드가 안 돌았음" 을 구분하지 못한다.
> sentinel 을 단언할 때는 **그 sentinel 이 아닌 값**이 나올 수 있는 fixture 를 줘야 한다.

## W4 — 이미 해소한 항목이 트래커에 미해결로 남아 있었다 (testing)

**조치 완료.** `markQueueWaitTimeout` 테스트 갭은 `777698bbe` 가 실제로 해소했는데
트래커만 `[ ]` + *"3라운드 이월"* 로 남아 있었다. `[x]` + 완료 커밋 인용으로 갱신.

W3 이 **새로 발견된 다른 경로**이므로 둘이 섞이지 않게 별개 항목으로 뒀다.

## W5 — REST/push 스키마 비대칭 (api_contract) → **유예**

`GET /api/external/executions/:id` 의 `ExecutionStatusDto` 에 `durationMs` 가 없어
push 계열(webhook/SSE/WS/chat-channel)과 비대칭이다.

**유예 근거 (실측)**: 신규 결함이 아니고 breaking change 도 아니다 — **필드 부재일 뿐**
기존 계약을 깨지 않는다. 이 PR 의 범위는 사용자가 이번 턴에 **`durationMs` 종결 이벤트**로
명시 결정했고(`result.outputs` 제외 결정과 동일 지점), REST projection 추가는 다른 표면이다.

트래커에 방향까지 기재돼 있다 — 이번엔 **그 등재를 확인하고 쓴다**:
`spec-sync-external-interaction-api-gaps.md` 의 REST/push 비대칭 항목.

## INFO 처분

| # | 처분 |
|---|---|
| 1 (`resolveTerminalDurationMs` 이중 호출) | 무조치. O(1) 순수함수 · 지역변수화는 스타일 |
| 2 (JSDoc 이 `2147483647` 리터럴) | **조치** — 산문에도 상수명 병기 |
| 3 (`expect.any(Number)` 약한 단언) | 무조치. 헬퍼 자체가 NaN 을 전수 커버 |
| 4 (필드 의미가 상태별로 다름) | spec §6.5 캐비엇 존재 · 별도 필드 분리는 트래커 |
| 5 (retry-turn DB≠emit) | 알려진 예외 · spec·트래커 기재됨 |
| 6·7 (stale 서술 · 주석 3중 복제) | 비차단, 다음 편집 시 |

## 검증

- 백엔드 **425 suites / 8709 passed** · lint `--max-warnings 0` **0 errors**
- 타입 **199** (래칫 baseline 과 일치) · spec-link-integrity **13 passed**
- W2 판별력: 세 자리 **각각** 독립 뮤턴트로 RED 확인 (위 표)
- `check-doc-links.py` BROKEN=2 는 **선존** — 두 파일 모두 이 PR 의 diff 밖
  (`1-widget-app.md`, `spec-impl-evidence.md`)
