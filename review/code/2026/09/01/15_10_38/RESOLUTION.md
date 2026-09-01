# RESOLUTION — 감사 로깅 잔여 리뷰 2라운드 반영

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **3** · INFO 10

1라운드 WARNING 5건이 전부 해소됐음을 리뷰가 **실측으로 재검증**했다(jest 77/77, tsc 0-에러,
뮤테이션 `try`/`catch` 제거 → RED). 이번 3건은 전부 **위생** 문제이고, 셋 다 고쳤다.

## W2·W3 은 같은 클래스다 — 내 삽입이 기존 설명을 원래 대상에서 떼어놨다

두 건은 별개 지적이지만 원인이 하나다. 새 코드를 **기존 선언과 그 설명 사이**에 끼워 넣어,
설명이 엉뚱한 것을 가리키게 만들었다.

| # | 무엇이 떨어졌나 | 결과 |
|---|---|---|
| W2 | `BusinessMetricsService` 클래스 JSDoc ↔ `@Injectable()` 사이에 `PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 블록 | 클래스 JSDoc 이 **어떤 선언에도 안 붙어** IDE hover·TypeDoc 에서 클래스 설명이 사라진다 |
| W3 | `recordRedisFailOpen` 설명 주석 ↔ 그 테스트 사이에 내 새 테스트 | 주석이 **내 테스트**를 설명하게 되고, 원래 대상은 설명 없이 남는다 |

둘 다 삽입 지점을 옮겨 원래 귀속을 복구했다 — 유틸 블록은 클래스 JSDoc **위**로, 원 주석은
`recordRedisFailOpen` 테스트 **바로 위**로. 내 새 테스트의 주석은 "아래 `recordRedisFailOpen`
주석이 이미 적어 둔 함정" 으로 방향을 맞췄다(원래는 "위" 였다).

**같은 파일에서 이미 한 번 냈던 실수다.** 1라운드에서 같은 블록을 `@Injectable()` 과 클래스
**사이**에 넣어 데코레이터가 `const` 에 붙었고, 그때는 prettier 가 잡았다. 이번엔 문법은
맞아서 도구가 못 잡고 리뷰어가 잡았다 — **삽입 지점을 옮길 때 "무엇과 무엇 사이인가" 를
보지 않는** 습관이 두 번 연속 나왔다.

## W1 — draft 를 `complete/` 로

`spec-draft-audit-write-failed-metric.md` 가 §A~§C 를 전부 적용한 뒤에도 `in-progress/` 에
`status: in-progress` 로 남아 있었다. 이 저장소에서 두 번 재발한 패턴이라 리뷰가 세 번째
후보로 지목했다.

`plan-lifecycle.md §5` 자가점검을 반영해 옮겼다 — `status: applied` + `completed` 날짜 +
적용 배너, 그리고 `spec-sync-auth-gaps.md:128` 의 인입 상대링크를 `../complete/` 로 정정.

**draft 자체는 지우지 않는다** — spec 경계를 정당화하는 근거 산출물이고, 이 저장소의 보존
관례가 `plan/complete/` 다.

## INFO 10건

전부 미조치. 리뷰가 "확인됨(해소) / 이월 / 저우선순위 / 긍정적 개선" 으로 판정한 것들이다.
그중 둘(INFO 1·2)은 **1라운드 지적과 auth-configs 타입 좁힘이 실제로 성립하는지 재검증한
기록**이다 — jest 77/77, tsc 0-에러, 기존 46개 테스트 무수정 GREEN.

이 PR 의 가드가 **의도적으로 닫지 않은 경계**를 짚은 셋(제네릭 인자 미비교 · 화살표 함수
필드 미인식 · fixture 에 "잘못된 리소스 바인딩" 케이스 부재)은 전부 가드 헤더에 트레이드
오프로 이미 적혀 있고, 이번에 고친 "맨 union" 결함 자체는 정확히 잡는다.

## 검증

lint(`--max-warnings 0`) · prettier · backend **442 suites / 9202 passed, 1 skipped** ·
docs 가드 **3113** · e2e.
