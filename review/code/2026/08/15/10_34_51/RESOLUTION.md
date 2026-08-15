# RESOLUTION — `10_34_51`

ai-review **CRITICAL 0 / WARNING 7**. 5건 조치, 2건은 근거와 함께 넘김.

## W2 — 내 정규식이 스코프를 조용히 넓혔다 (되돌림)

**지적이 정확하다.** 직전 라운드가 **`savedExecution` 1곳**을 지적했는데, 내가 "멀티라인까지
세겠다" 며 쓴 정규식이 **파일 전체를 훑어 `NodeExecution` 8곳까지** 바꿨다. 그 8곳은
워크플로 에디터의 노드별 실행시간 표시용이고 **EIA 종결 payload 와 무관**하다.

순수 리팩터도 아니었다 — 무가드 뺄셈이 "음수/NaN → 조용히 null" 로 **동작이 바뀌었다**.
CHANGELOG·plan·커밋 메시지 어디에도 없었고 테스트도 0건이었다.

**8곳 전량 되돌렸다.** 필요하면 별건으로 다룬다.

> **교훈**: 직전 라운드에서 나는 "한 줄 grep 이 멀티라인을 못 셌다" 를 반성하며 정규식을
> 넓혔는데, **넓힌 정규식이 이번엔 대상 밖까지 잡았다.** 한 실패를 고치며 반대쪽 실패를
> 만든 것이 이 브랜치에서 두 번째다(콤마 누락 → trailing comma). **도구를 넓힐 때
> 적용 대상도 함께 좁혀야 한다.**

## W3 — 쓰기를 늘리면서 읽는 쪽을 세지 않았다 (등재)

이번 PR 이 처음 `duration_ms` 를 채우는 5경로 중 다수의 값은 **실행 시간이 아니라 대기
시간**이다(위젯 idle-wait 기본 grace 1시간, park 취소는 무기한). 그런데 이 컬럼을
**status 필터 없이** 평균 내는 소비처가 셋이다 — 대시보드 `avgExecutionTime`, 통계
`avgDurationMs`(프론트 렌더), 실행 목록 Duration 컬럼. `alerts-evaluator` 만
`status='completed'` 필터가 있어 **우연히** 안전하다.

**집계 수정은 이 PR 범위 밖**(다른 모듈·다른 관심사)이라 정본 트래커에 등재했다.

> **두 라운드가 이걸 못 봤다.** spec-to-spec 대조도, 코드 diff 리뷰도 "이 컬럼을 **읽는**
> 쪽" 까지 따라가지 않았다. 쓰기를 늘릴 때 읽는 쪽을 세는 절차가 없었다.

## W4 · W5 — 조치 완료

- **W4** CHANGELOG 가 breaking 으로 고지한 **실제 wire 변환 경계**(dispatcher)에 회귀
  테스트가 없었다. 세 상태 × 숫자·`null`·키부재(레거시) 를 고정 (5 tests)
- **W5** 내가 추가한 §6.5 blockquote 이 CommonMark lazy-continuation 으로 **무관한
  `cancelledBy` disclaimer 를 흡수**했다. 독립 문단으로 분리

## 넘김 (근거 명시)

| # | 처분 |
|---|---|
| W1 (retry-turn 재진입 시 DB↔emit 값 어긋남) | **유효한 지적이고 아프다.** `stop()` 이 커밋한 T1 값이 DB 엔 보존되는데 in-memory 는 갱신 안 돼 emit 은 T2 를 싣는다. 다만 `finalizeGuarded` 의 `COALESCE` 반환값을 되읽는 구조 변경이라 **DB write 경로를 또 바꾼다** — 이 라운드에서 서두르면 W2 같은 과잉 스코프를 반복한다. 트래커 등재 |
| W6 (REST 비대칭) | 이미 트래커 등재·CHANGELOG 고지. 재확인 목적 |
| W7 (TS/SQL 불변식 이중 구현) | 등재된 W10(e2e 값 검증)이 근본 처방. 우선순위 유지 |

## 검증

- 백엔드 **425 suites / 8704 passed** · lint `--max-warnings 0` · 타입 **199**(래칫 동일)
- spec 가드 **2931** · dispatcher **43 tests**(신규 5 포함)
