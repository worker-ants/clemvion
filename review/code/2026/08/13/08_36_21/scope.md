# 변경 범위(Scope) 리뷰

대상: `clemvion.redis.fail_open` OTel 카운터 추가 + `IdempotencyInterceptor` 다섯 fail-open
경로 배선 (5개 파일: `CHANGELOG.md`, `idempotency.interceptor.spec.ts`,
`idempotency.interceptor.ts`, `business-metrics.service.ts`,
`plan/in-progress/backend-lint-gate-broken-on-main.md`).

## 발견사항

- **[WARNING]** 신규 테스트 블록이 기존 "캐시 키 스코프" describe 의 docstring 과 그 describe
  본문 사이에 끼워 넣어져, 이 PR 과 무관한 기존 코드의 주석-대상 결합이 깨졌다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1033-1057`
    (게이트 숫자 기준). `1033`~`1047` 줄이 `[Spec EIA §R8 "캐시 키 스코프"]` describe(`1179`
    줄, 이 프롬프트 조립본에서는 게이트 없이 truncate 되어 안 보이지만 실제 파일에서 확인함)를
    설명하는 JSDoc 인데, 그 바로 뒤(`1048`~`1056`)에 이번 PR 이 추가한 "fail-open 관측
    (metrics)" describe 의 JSDoc 이 얹히고 `1057` 부터 새 `describe` 블록이 시작한다. 결과적으로
    "캐시 키 스코프" 문서 주석이 자신이 설명하는 `describe('IdempotencyInterceptor — 캐시 키
    스코프 (Spec EIA §R8)', …)` 블록으로부터 137줄(신규 describe 전체) 떨어지게 됐다.
  - 상세: `git diff` 상으로는 새 블록이 "Redis 런타임 장애 fail-open" describe 의 닫는 `});`
    직후·"캐시 키 스코프" 블록 앞이라는 파일상 유일한 삽입 지점에 들어간 것처럼 보이지만, 실제
    파일을 열어 보면 그 지점이 하필 **기존 docstring 과 그 대상 사이**였다. 기능적으로는 각
    describe 가 독립적이라 테스트 실행에는 영향이 없지만, 리뷰어/유지보수자가 코드를 순서대로
    읽을 때 "캐시 키 스코프" 절의 설명이 엉뚱한 블록(관측 메트릭 테스트) 바로 앞에 놓여 헷갈리게
    된다. 이 PR 의 의도(메트릭 배선)와 무관한 기존 문서 구조를 건드린 부수 효과다.
  - 제안: 새 `describe('IdempotencyInterceptor — fail-open 관측 (metrics)', …)` 블록을
    "Redis 런타임 장애 fail-open" describe 의 JSDoc **앞**(그 파일의 세 번째 describe 시작
    지점, 즉 관측 대상과 더 가까운 자리) 또는 파일 맨 끝(다른 describe 뒤)으로 옮겨, "캐시 키
    스코프" docstring 이 자신의 describe 바로 위에 다시 붙게 한다.

## 요약

핵심 변경(OTel `clemvion.redis.fail_open` 카운터 추가, `BusinessMetricsService` 에 대한
`recordRedisFailOpen()` 메서드 신설, `IdempotencyInterceptor` 다섯 fail-open 경로 배선, 대응
단위 테스트, CHANGELOG 및 `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크리스트
갱신)는 진술된 목적(관측 지표 도입)에 정확히 부합하며 다섯 파일 모두 그 목적과 직결된다.
불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 뒤섞임·불필요한 import 나 설정 변경은
발견되지 않았다. 유일한 흠은 신규 테스트 describe 블록의 삽입 위치가 기존 "캐시 키 스코프"
describe 의 JSDoc 주석과 본문 사이를 갈라놓은 것으로, 기능에는 영향 없는 문서 구조상의 부수
효과이지만 이 PR 이 건드릴 필요가 없었던 기존 코드 영역의 가독성을 저하시킨다.

## 위험도

LOW
