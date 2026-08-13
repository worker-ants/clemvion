# 유지보수성(Maintainability) 리뷰 — `clemvion.redis.fail_open` 카운터 + 관련 spec/plan/review 산출물

## 검토 방법

프롬프트의 diff·게이트 숫자만으로는 현재 상태(이전 라운드 수정 반영 여부)를 확정할 수 없어, 핵심
소스 4개 파일(`idempotency.interceptor.ts`, `idempotency.interceptor.spec.ts`,
`business-metrics.service.ts`, `business-metrics.service.spec.ts`)은 `Read` 로 전체를 직접
열어 실제 라인 번호를 확인했다. 이번 diff 는 이전 리뷰 라운드(`review/code/2026/08/13/08_36_21/`)가
지적한 WARNING·INFO 를 반영한 **이후** 상태를 포함한다 — 즉 이 문서는 그 수정이 실제로 반영됐는지
재검증하고, 반영 이후에도 남은 유지보수성 이슈를 찾는 것이 목적이다.

## 발견사항

- **[INFO]** `idempotency.interceptor.spec.ts` 가 계속 커지고 있다 (현재 1341줄, 이번 diff 로 +137줄) — 서로 다른 5개 관심사(`W-4 provider 경로`·`캐시 히트`·`Redis 런타임 장애 fail-open`·`fail-open 관측(metrics)`·`캐시 키 스코프`)가 한 파일의 top-level `describe` 로만 나뉘어 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 전체 (5개 top-level `describe`, 실제 줄 번호: 185/263/840/1049/1187)
  - 상세: 이번 diff 는 그 자체로는 정당한 관심사(fail-open 메트릭 관측)를 기존 파일 맨 끝이 아니라 "Redis 런타임 장애 fail-open" describe 바로 뒤(관측 대상과 인접한 자리)에 잘 끼워 넣었고, 파일 헤더 docstring 의 describe 순서 요약도 정확히 동기화돼 있다(34번째 줄 "네 번째 describe 는 fail-open 관측", 41번째 줄 "다섯 번째 describe 는 캐시 키 스코프" — 실제 순서와 일치 확인). 구조적으로 문제는 없지만, 파일이 1300줄을 넘어가면서 헤더의 "N 번째 describe는 ..." 요약 방식 자체가 파일이 커질수록 유지 비용이 커지는 형태(신규 블록을 어디에 추가하든 그 이후 서수를 전부 손으로 갱신해야 함)라는 근본적인 확장성 한계가 있다. 이번 PR 은 그 갱신을 정확히 했지만, 다음 사람이 또 갱신을 빠뜨리면 (이전 라운드에서 실제로 한 번 그랬듯) 헤더가 stale 해지는 패턴이 반복될 여지가 있다.
  - 제안: 당장 조치는 불필요하지만, 향후 describe 가 하나 더 늘어날 때는 헤더의 서수 나열 방식을 파일 분리(`idempotency.interceptor.cache-scope.spec.ts` 등) 또는 목차를 서수가 아닌 describe 이름 그대로 나열하는 방식으로 바꾸는 것을 고려할 것.

## 이전 라운드 대비 확인된 개선 (참고용 — 문제 없음)

- `withMetrics()` → `makeInterceptorWithMetrics()` — 파일 전역 `make*` 팩토리 네이밍 컨벤션(`makeRedis`·`makeContext`·`makeCallHandler`·`makeInterceptor`·`makeMetrics`)에 맞게 정정됨을 확인(`idempotency.interceptor.spec.ts:1053`).
- `'idempotency'` 리터럴 4곳 → `METRICS_COMPONENT` 클래스 상수로 추출(`idempotency.interceptor.ts:29`, 사용처 154/251/337/346).
- `recordRedisFailOpen(component: string, reason: string)` → 리터럴 유니온 `RedisFailOpenComponent`/`RedisFailOpenReason` 으로 시그니처가 좁혀져(`business-metrics.service.ts:38,41-46,134-137`) "닫힌 집합" 이라는 docstring 주장이 타입으로 강제됨. `tsc --noEmit` 프로브로 실제 차단을 확인했다는 기록(RESOLUTION.md)과 일치하며, 프로브 파일 잔존은 없음(확인함).
- `[Spec EIA §R8 "캐시 키 스코프"]` JSDoc(1172줄)과 그 대상 `describe`(1187줄)가 다시 인접해, 이전 라운드에서 지적된 "JSDoc 이 130줄 넘게 떨어짐" 문제가 해소됨을 실측 확인.
- `business-metrics.service.spec.ts` 에 `recordRedisFailOpen` 전용 테스트 2건이 추가돼, 형제 `record*` 메서드들과 동일한 패턴(mock meter `add` 인자 단언)을 따름 — 네이밍·구조 모두 기존 파일 스타일과 일관됨.

## 요약

이번 diff 의 핵심 코드(`BusinessMetricsService.recordRedisFailOpen()` 신설, `IdempotencyInterceptor` 4개 지점 배선)는 짧고 기존 패턴(`@Optional()` DI, `record*` 네이밍, 클래스 상수 추출, 리터럴 유니온)을 그대로 따라 가독성·네이밍·일관성 문제가 없다. 특히 이전 리뷰 라운드가 지적한 4건(JSDoc 위치 이탈, 헤더 서수 stale, 네이밍 컨벤션 이탈, 반복 리터럴/느슨한 타입)이 모두 실제로 반영돼 있음을 코드를 직접 열어 확인했다. 남은 것은 테스트 파일이 계속 단일 파일로 커지고 있다는 구조적 관찰(INFO) 하나뿐이며, 이는 이번 diff 가 만든 새 결함이 아니라 기존 추세의 연장이다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버·중복 코드 관점에서 이번 diff 가 새로 추가한 코드에는 지적할 사항이 없다.

## 위험도

LOW
