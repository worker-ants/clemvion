# 유지보수성(Maintainability) 리뷰 — `clemvion.redis.fail_open` 카운터 (5차 라운드)

## 검토 방법

이번 라운드의 diff 는 이전 4개 라운드(`08_36_21`·`09_57_11`·`10_13_11`·`10_29_50`)가 이미 발견·조치·재확인을
거친 상태 위에 얹힌 것이다. 핵심 소스 4개 파일(`idempotency.interceptor.ts`,
`idempotency.interceptor.spec.ts`, `business-metrics.service.ts`, `business-metrics.service.spec.ts`)을
`Read`로 직접 열어 현재 상태를 재확인했고, 새로 추가된 `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md`,
`plan/in-progress/backend-lint-gate-broken-on-main.md`, `spec/5-system/_product-overview.md`,
`spec/data-flow/9-observability.md` 도 함께 검토했다.

## 발견사항

(CRITICAL/WARNING 없음 — 신규 발견 없음)

핵심 소스는 4차 라운드(`10_13_11`) 이후 변경이 없고, `idempotency.interceptor.spec.ts` 파일 헤더의
describe 색인(서수 중복 문제)과 `plan/complete/` 미해결 체크박스는 직전 라운드(`10_29_50`)에서 이미
조치됐다. 직접 재확인한 결과:

- `describe` 6개(`W-4 provider 경로` / `캐시 히트 · 응답 형태 방어` / `Redis 런타임 장애 fail-open` /
  `fail-open 관측 (metrics)` / `캐시 키 스코프 (Spec EIA §R8)` / `readKey / hashBody 경계값`, 실제 줄 번호
  200/278/855/1064/1202/1368)가 파일 헤더의 이름 기반 색인과 정확히 대응한다 — 서수 방식에서 이름
  방식으로 전환된 것이 이번에도 유효하다.
- `METRICS_COMPONENT` 상수(`idempotency.interceptor.ts:32`)가 `'idempotency'` 리터럴을 유일하게
  정의하고 4개 호출부(`161`/`257-259`/`344`/`353`)가 전부 그 상수를 참조한다.
- `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온(`business-metrics.service.ts:38,41-46`)이
  `recordRedisFailOpen(component, reason)` 시그니처(`134-137`)를 좁혀 "닫힌 집합" 주장을 타입으로
  강제한다.
- `recordRedisFailOpen()` 자체(`business-metrics.service.ts:134-139`)와 인터셉터 4개 배선 지점 모두
  형제 `record*` 메서드/기존 `@Optional()` DI 패턴을 그대로 따른다 — 함수 길이 3줄, 중첩 없음,
  신규 매직 넘버 없음.
- `spec/5-system/_product-overview.md` NF-OB-07 표 1행 추가, `spec/data-flow/9-observability.md`
  미러 문장 갱신이 동시에 이뤄져 두 문서가 어긋나지 않는다. 표 셀 라벨 값 인라인 방식도 기존 행과
  같은 형식을 따른다.

## 이미 식별·처리된 항목 (참고용 — 재지적 아님)

아래 두 항목은 3개 라운드(`09_57_11`/`10_13_11`/`10_29_50`) 연속으로 INFO 로 식별되고 그때마다
명시적 근거와 함께 조치 보류가 확정된 것들이다. 이번 라운드에서 새로 발견한 것이 아니며, 근거가
바뀌지 않았으므로 다시 조치를 권고하지 않는다(반복 재지적 시 review-fix 루프만 늘어난다).

- 클래스 docstring 의 fail-open 5경로 표(`idempotency.interceptor.ts:74-80`)에 `reason`/metrics 열이
  없다 — "다음에 fail-open 경로가 추가될 때 그 표를 고치는 것이 자연스럽다"는 판단이 3라운드
  연속 유지됨(`10_29_50` RESOLUTION INFO 4).
- `idempotency.interceptor.spec.ts` 가 1600줄대로 계속 커지고 있고 5~6개 관심사가 top-level
  `describe` 로만 나뉘어 있다 — 파일 분리는 이번 diff 범위 밖으로 보류됨(`09_57_11`/`10_13_11`).

## 요약

이번 diff(`clemvion.redis.fail_open` OTel 카운터 신설 + `IdempotencyInterceptor` 5개 fail-open 경로
배선 + spec 카탈로그 등재)의 핵심 코드는 짧고, 기존 `record*`/`@Optional()` DI/`make*` 팩토리
네이밍 패턴을 그대로 따라 가독성·네이밍·함수 길이·중첩·매직 넘버·중복·복잡도·일관성 어느 관점에서도
새로 지적할 사항이 없다. 앞선 4개 라운드가 발견한 모든 WARNING(JSDoc-describe 인접성 붕괴, 헤더
색인 서수 중복, `withMetrics` 네이밍 이탈, 닫힌 집합의 타입 미표현, `plan/complete/` 미해결
체크박스)이 코드를 직접 열어 재확인한 결과 실제로 해소돼 있다. 남은 관찰(docstring 표 열 누락,
spec 파일 크기 증가)은 이미 여러 라운드에 걸쳐 근거와 함께 조치 보류가 확정된 INFO 로, 이번
라운드에서 근거를 뒤집을 새 사실이 없어 재지적하지 않는다.

## 위험도

NONE
