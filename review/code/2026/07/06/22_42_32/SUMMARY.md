# Code Review 통합 보고서 (engine fix 재리뷰, commit 656fc7cce)

## 전체 위험도
**MEDIUM** — Critical 없음. 신규 수정지점(getNotificationsService ModuleRef 지연해석, finalizeResumedExecutionOutcome dispatch)이 unit 화이트박스 미커버·e2e 단일계층 의존이 주 지적. 6개 reviewer(security/performance/scope/documentation/api_contract/user_guide_sync) output 미생성 → 재시도 필요.

## Critical
(없음)

## WARNING
| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| 1 | testing | `getNotificationsService()` 4분기(undefined/성공/throw/캐시) unit 미커버 | moduleRef mock 주입 unit 추가 |
| 2 | testing | `finalizeResumedExecutionOutcome` 의 신규 dispatch 호출이 spec 의 통짜 mock 으로 실행 안 됨 → 회귀 재놓칠 구조 | 직접호출 describe 추가(FAILED→dispatch, CANCELLED→미호출) |
| 3 | testing | `select:false` REST 미노출을 e2e 응답 body 로 미검증(raw SQL 은 우회) | 리스트 e2e 에 not.toHaveProperty('backgroundRunId') 추가 |
| 4 | architecture | DI 순환 인스턴스화 순서를 ModuleRef 우회로만 해소 — 신규 @Optional 의존성 동일 함정 반복 위험 | 아키텍처 부채로 트래커 기록 |
| 5 | maintainability | 초기/재개 세그먼트 FAILED 마킹+dispatch 시퀀스 중복(버그 A 재발 패턴) | 공통 헬퍼 추출 followup |

## INFO (주요)
- requirement NONE: 두 버그 수정 spec §1.1 과 line-level 일치, CANCELLED 제외 로직 올바름. select:false 가 21_23_13 WARNING#1 실질 해소.
- concurrency NONE: 단일스레드 동기 캐시·상호배타 종결경로 → 경쟁조건/이중발사 없음.
- side_effect LOW: 캐시 최초 null 영구고정 이론적 리스크만(실무 낮음).
- 잔여 spec drift 는 spec-update plan 위임된 기지 drift, 이번 커밋 신규 유발 아님.

## Reviewer 위험도
architecture LOW / requirement NONE / side_effect LOW / maintainability LOW / testing MEDIUM / concurrency NONE / (security·performance·scope·documentation·api_contract·user_guide_sync 재시도 필요)

## 조치 계획
1. WARNING#1/#2 → unit 화이트박스 추가 (핵심 회귀 가드).
2. WARNING#3 → e2e select:false 단언.
3. WARNING#4/#5 → followup 트래커 기록(부채/리팩터링).
4. 6개 미생성 reviewer 재실행.
