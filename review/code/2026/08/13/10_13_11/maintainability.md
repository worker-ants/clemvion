# 유지보수성(Maintainability) 리뷰 — `clemvion.redis.fail_open` 카운터 (3차 라운드)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 이번 changeset 이 직전 두 라운드(`08_36_21`,
`09_57_11`) 이후 **소스 코드 변경이 전혀 없다**(마지막 소스 커밋은 `409e7ff6c`)는 것을 확인했다
— 이번 diff 에 새로 추가된 파일은 전부 `review/code/2026/08/13/09_57_11/**`,
`review/consistency/2026/08/13/{09_36_31,09_48_44}/**`(직전 라운드들의 산출물)와
`spec/5-system/_product-overview.md`/`spec/data-flow/9-observability.md`(스펙 카탈로그 등재)뿐이다.
핵심 소스 4개 파일(`idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`,
`business-metrics.service.ts`, `business-metrics.service.spec.ts`)을 `Read`/`grep` 으로 직접 열어
현재 상태를 재확인했다.

## 발견사항

(CRITICAL/WARNING 없음)

- **[INFO]** `idempotency.interceptor.spec.ts` 가 1341줄로 계속 커지고 있고, 서로 다른 5개 관심사가
  top-level `describe` 로만 나뉘어 있다 (직전 라운드 `09_57_11` 이 이미 지적한 항목 — 재확인만 함)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` —
    5개 top-level `describe` 실제 줄 번호 185 / 263 / 840 / 1049 / 1187 (직접 grep 으로 재확인)
  - 상세: 파일 헤더 docstring(1-47줄)의 "네 번째 describe 는 fail-open 관측", "다섯 번째 describe 는
    캐시 키 스코프" 서수 요약이 실제 구조와 정확히 일치함을 재확인했다. 다만 이 "N번째 describe" 방식은
    구조적으로 새 블록이 중간에 끼어들 때마다 그 뒤의 서수를 전부 손으로 갱신해야 하고, 이전 라운드에서
    실제로 한 번 stale 됐던 패턴이라 파일이 더 커질수록 재발 위험이 누적된다. 이번 diff 는 새 코드를
    추가하지 않았으므로 이 관찰은 새 문제가 아니라 기존 관찰의 재확인이다.
  - 제안: 조치 불요(반복 재지적 대상 아님). describe 가 하나 더 늘어나는 시점에 파일 분리 또는 서수
    대신 이름 나열 방식으로 전환을 고려.

## 핵심 코드 재확인 (참고용 — 문제 없음)

- `business-metrics.service.ts`: `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온,
  `redisFailOpen` 카운터 필드, `recordRedisFailOpen()` 메서드 모두 형제 `record*` 메서드와 동일한
  네이밍·구조·docstring 밀도를 따른다. 함수 길이(3줄), 중첩 없음, 매직 넘버 없음.
- `idempotency.interceptor.ts`: `METRICS_COMPONENT` 모듈 상수가 `'idempotency'` 리터럴을 유일하게
  정의하고 4개 호출부가 전부 그 상수를 참조함을 grep 으로 재확인(`'idempotency'` 리터럴 문자열이
  파일 안에 정확히 1곳뿐). `.catch()` 콜백이 표현식에서 블록 바디로 바뀐 것(SET 실패 경로)은 metrics
  호출 추가를 위한 최소 구조 변경이며 그 외 제어 흐름은 그대로다.
- `idempotency.interceptor.spec.ts`: `makeMetrics()`/`makeInterceptorWithMetrics()` 헬퍼가 파일
  전역 `make*` 팩토리 네이밍 컨벤션을 따름을 재확인(`withMetrics` 잔존 없음, grep 0건).
- `business-metrics.service.spec.ts`: `recordRedisFailOpen` 전용 단위 테스트 3건이 형제
  `record*` 메서드들과 같은 `mock.counters[...].add` 단언 패턴을 따른다.

## 요약

이번 3차 라운드는 실질적으로 새 소스 변경이 없는 changeset이다 — 앞선 두 라운드(`08_36_21`
WARNING 5건, `09_57_11` 재검증)가 이미 발견·조치·재확인을 마쳤고, 이번 라운드는 그 산출물(리뷰
아티팩트·`/consistency-check` 아티팩트)과 spec 카탈로그 등재만 diff 에 새로 얹혔다. 핵심 소스
4개 파일을 직접 열어 재확인한 결과 가독성·네이밍·함수 길이·중첩·매직 넘버·중복·복잡도·일관성
어느 관점에서도 새로운 결함은 없다. 유일한 잔여 관찰은 테스트 파일이 계속 커지고 있다는 구조적
INFO 하나뿐이며, 이는 이번 diff 가 만든 문제가 아니라 이미 두 차례 보고된 기존 추세의 연장이다.

## 위험도

NONE
