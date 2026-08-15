# RESOLUTION — `09_58_24` (+ consistency `--impl-done` `09_58_31` BLOCK: NO)

ai-review **CRITICAL 1 / WARNING 11**. CRITICAL + 실질 WARNING 조치, 나머지는 근거와 함께 넘김.

## 🔴 CRITICAL — 내 SQL 이 오래 대기한 실행을 영구 고착시킬 수 있었다

**지적이 정확하고, 이 PR 이 만든 신규 회귀다.** `duration_ms` 는 `INTEGER`(int4, 최대
≈**24.8일**, `V001__initial_schema.sql:223`)인데 내 SQL 식에 상한이 없었다. `::int` 캐스팅이
`integer out of range` 로 **UPDATE 문 전체를 실패**시킨다.

**하필 그 5경로가 오래 대기한 실행을 다루는 자리다** — park 취소 · 공개 위젯 idle-wait
회수 · 재개 실패 · 큐 대기 타임아웃 · stalled 소진. 24.8일 초과가 예외가 아니라 **정상
시나리오**다. 실패는 최상위 catch 가 삼켜 로그만 남고, 실행은 `WAITING_FOR_INPUT`/`RUNNING`
에 **영구 고착**된다. PR 이전엔 이 경로들이 `durationMs` 를 아예 안 건드려 이 실패 모드가
없었다.

**조치**: `LEAST(2147483647, …)` 클램프. **"UPDATE 실패" 를 "값 saturate + 취소 성공" 으로
바꾼다** — 부정확한 값보다 고착이 훨씬 나쁘다. 컬럼을 `BIGINT` 로 넓히는 건 마이그레이션이
필요해 이 PR 범위 밖이고, 클램프는 스키마 변경 없이 즉시 듣는다.

> **교훈**: 나는 `GREATEST(0, …)` 로 **음수만** 방어하고 상한은 생각하지 않았다. 방어를
> 한 방향으로만 세운 형태다. 컬럼 타입을 안 본 것이 원인이고, `V083` 이 같은 자리에
> `INTEGER` 를 쓴 선례까지 있었다.

## W8 — 같은 이상 상황에 경로마다 다른 신호를 냈다

**조치 완료(CRITICAL 과 같은 편집).** 시계 역행 시 JS 경로는 `null`, SQL 경로는
`GREATEST(0,…)` 로 **`0`** 을 냈다 — 수신자가 "알 수 없음" 과 "0ms 만에 끝남" 중
무엇을 받을지가 경로에 따라 갈렸다. SQL 도 `CASE WHEN … THEN NULL` 로 통일.

## W2 — 헬퍼가 막는 회귀를 형제 4곳이 여전히 안고 있었다

**조치 완료.** 세 reviewer 가 독립적으로 같은 4곳을 지적했다. `resolveTerminalDurationMs`
의 존재 이유가 *"`startedAt.getTime()` 이 throw 해 종결 emit 이 사라진다"* 인데, emit 쪽만
헬퍼를 쓰고 **그 앞의 대입은 여전히 맨손 계산**이었다. 대입이 먼저 실행되므로 방어가
되지 않는다. 전수 grep 으로 6곳(리뷰어가 센 4곳 + `failFirstSegmentSetup` + reload 경로)을
전환했다 — **지적받은 수보다 많았다.**

## W3 — 타입 nullable (consistency 라운드에서 이미 조치)

`durationMs?: number` → `durationMs?: number | null`. 리뷰어는 optional 제거까지 요구했으나
**미채택** — consumer 계약이라 레거시 재생 이벤트엔 키가 없고, 필수화하면 29개 fixture 가
타입 오류를 냈다(직전 PR 의 `error.nodeId` 와 같은 판단). 근거는 타입 옆에 기록.

## W11 — CHANGELOG

**조치 완료.** 직전 항목이 *"durationMs 는 후속으로 분리"* 라고 이 작업을 예고해 뒀다.
REST 비대칭(W4)도 함께 고지했다.

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| W4 (REST `getStatus` 에 `durationMs` 부재) | **유효한 지적.** push 계열만 채워져 "이벤트엔 있는데 재조회하면 없는" 비대칭이 생겼다. 다만 `ExecutionStatusDto`+projection 변경은 **다른 표면**이고, 이 PR 은 이미 16 경로를 건드렸다. CHANGELOG 에 고지하고 트래커 등재 |
| W5 (raw UPDATE 5곳의 바인딩+파싱 복제) | 순수 계산부와 SQL 상수는 이미 추출했다. 나머지는 QueryBuilder 체인이라 얇은 헬퍼로 감싸면 오히려 호출부가 읽기 어려워진다. 6번째가 생기면 재검토 |
| W6 (`cancelParked`↔`markWebChatIdleTimeout` 동형 중복) | docstring 이 이미 자인한 pre-existing. 통합은 별건 |
| W7 (SQL 이 컬럼명 하드코딩) | 유효. 엔티티 메타데이터 대조 assertion 은 다음 편집 때 |
| W9·W10·W14 (emit 값 미단언 · SQL e2e 미검증) | **W10 이 가장 아프다** — SQL 식이 실제 Postgres 에서 값 수준으로 검증된 적이 없다(단위는 문자열 `toContain` 뿐). 부호·단위·클램프 오류를 잡을 안전망이 없다. e2e 에 `duration_ms >= 0` sanity 를 넣는 것을 트래커 등재 |
| W12 (queryBuilder mock 팩토리) | 이 PR 이 비용을 실증한 것은 맞다(22곳 수동 편집). 다음 리팩터 후보 |
| W13 (헬퍼 2회 호출) | 무시할 비용 |

## 검증

- 백엔드 **425 suites / 8699 passed** · lint `--max-warnings 0` · 타입 **199**(래칫 동일)
- 헬퍼 spec **25 tests** — 클램프·NULL sentinel 을 각각 고정
- consistency `--impl-done` `09_58_31` **BLOCK: NO**
