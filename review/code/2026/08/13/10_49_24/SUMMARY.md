# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 0건. `clemvion.redis.fail_open` OTel 카운터 배선(순수 관측성 추가)에 대한 누적 리뷰 라운드로, 이전 라운드가 지적한 WARNING(JSDoc-describe 인접성, describe 색인 서수 중복, "닫힌 집합" 주석-구현 갭, 네이밍 불일치, plan 미해결 체크박스 등)이 모두 코드에 실제 반영됐음을 이번 라운드에서 직접 재확인했다. 남은 것은 전부 INFO 수준이며 대부분 3라운드 이상 연속 검토·근거와 함께 조치 보류가 확정된 항목이다. `forced` reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `recordRedisFailOpen` 라벨이 닫힌 리터럴 유니온이라 Prometheus label-cardinality 공격면이 없음 — 외부 입력이 라벨 인자로 흘러드는 경로 없음 | `business-metrics.service.ts` | 조치 불요 |
| 2 | Security | 캐시 payload·요청 body 원문이 새 계측 경로에서도 로그/라벨에 미노출 | `idempotency.interceptor.ts` (`discardCorruptEntry`, `describeShape`) | 조치 불요 |
| 3 | Side Effect / Security | `metrics?.recordRedisFailOpen(...)` 4곳이 try/catch 미격리 — 특히 SET 실패는 fire-and-forget Promise 체인이라 unhandled rejection 파급 가능 | `idempotency.interceptor.ts:161,257-260,344,349-354` | 당장 조치 불요 — 인접 `logger.warn` 도 동일하게 무방비였던 기존 표면. 3라운드 연속 "하나만 감싸면 방어가 불균일해진다" 근거로 무조치 |
| 4 | Architecture | `BusinessMetricsService` 가 여러 도메인 계측을 한 클래스에 누적(6번째 instrument) | `business-metrics.service.ts` | instrument 10개 이상 시 sub-facade 분리 검토 |
| 5 | Architecture | `IdempotencyInterceptor` 가 `BusinessMetricsService` 를 직접 주입 — 다른 도메인 모듈도 동일 패턴이며 순환 의존 없음(확인됨) | `idempotency.interceptor.ts` | 조치 불요 |
| 6 | Architecture | 닫힌 유니온이 신규 소비자마다 `metrics` 모듈 수정을 강제 — 의도된 마찰 | `business-metrics.service.ts` | 소비자 5개 이상이면 등록 테이블 검토 |
| 7 | Maintainability / Documentation | 클래스 docstring 의 fail-open 5경로 표에 `warn` 열은 있으나 `metrics`(reason) 열이 없음 | `idempotency.interceptor.ts` 클래스 docstring | 조치 불요 — 3라운드 연속 유예 확정. 6번째 경로 추가 시 함께 갱신 |
| 8 | Maintainability | `idempotency.interceptor.spec.ts` 가 계속 커지며 5~6개 관심사가 top-level `describe` 로만 분리됨 | 해당 파일 | 파일 분리는 이번 diff 범위 밖 |
| 9 | Testing | "카운터가 오르지 않아야 한다" 역방향 커버리지가 성공(2xx) 경로 1건뿐 — `IDEMPOTENCY_KEY_CONFLICT`/캐시 히트 재생 분기의 false-positive 회귀는 현재 테스트로 못 잡음 | `idempotency.interceptor.spec.ts` 관측 블록 | conflict/캐시-히트 케이스에도 `not.toHaveBeenCalled()` 추가 권장(필수 아님) |
| 10 | Testing | `@Optional() metrics` 가 실제 Nest DI 그래프에서 정상 주입되는지 검증하는 통합/e2e 없음 | `idempotency.interceptor.ts` | 조치 불요 — 기존 4개 소비자도 동일 관례 |
| 11 | Scope | `review/**`·`spec/**`·`plan/**` 변경분이 diff 에 포함 | 다수 | 조치 불요 — 규약이 요구하는 정규 산출물 |
| 12 | Scope | 헤더 docstring 이 서수 색인 → describe 이름 인용으로 전환(전 라운드 WARNING 조치의 일부) | `idempotency.interceptor.spec.ts` 헤더 | 조치 불요 — 재발 방지 자기 수정 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | label-cardinality 공격면 없음, 민감정보 미노출 |
| architecture | LOW | 계측 파사드 확장성·닫힌 유니온 마찰 INFO 3건, 구조적 결함 없음 |
| requirement | NONE | 기능 완전성 충족, 이전 WARNING 5건 전부 코드/spec/plan 반영 재확인 |
| scope | NONE | changeset 이 단일 목적에 정확히 수렴, 무관 변경 없음 |
| side_effect | LOW | try/catch 미격리 INFO, 하위 호환·전역 상태 문제 없음 |
| maintainability | NONE | 신규 발견 없음, 이전 WARNING 전부 실제 해소 확인 |
| testing | LOW | 역방향 커버리지 갭·DI 통합테스트 부재 INFO |
| documentation | NONE | docstring 표 컬럼 누락 INFO 1건 외 전부 정합 |
| user_guide_sync | NONE | doc-sync-matrix 20행 전수 매칭 0건 |

## 발견 없는 에이전트

requirement, maintainability, user_guide_sync — 신규 CRITICAL/WARNING/INFO 없음.

## 권장 조치사항

1. (선택) conflict/캐시 히트 재생 분기용 "카운터 미상승" 역방향 테스트 추가.
2. (선택) 6번째 fail-open 경로 추가 시 클래스 docstring 표에 `metrics`(reason) 열 추가.
3. 그 외 즉시 조치 필요 항목 없음 — 머지 가능한 상태.

## 라우터 결정

- `routing_status=done`:
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (9명)
  - **강제 포함(router_safety)**: 7명 전원 결과 확보 — 미이행 없음
  - **제외**: performance · dependency · database · concurrency · api_contract (5명)

---

## 수렴 판정 (main Claude)

CRITICAL·WARNING 0 → `RESOLUTION.md` 불요. 직전 라운드(`10_29_50`)의 WARNING 2건이 실제로
해소됐음을 reviewer 들이 코드 대조로 확인했다.

**INFO 9 는 값어치가 있는 지적이라 무조치 이유를 남긴다.** "정상 경로에서 카운터가 오르지
않는지" 를 2xx 하나로만 고정했는데, `409 CONFLICT` 와 캐시 히트 재생도 **fail-open 이 아닌**
경로다. 거기서 카운터가 오르면 거짓 알람이 된다. 다만 이 브랜치는 이미 5라운드를 돌았고,
테스트 추가는 또 한 번의 전체 라운드를 요구한다. **다음에 이 블록을 만질 때 함께 넣는 것이**
비용 대비 맞다 — 지금 놓치는 것은 "있을 수 있는 회귀" 이지 "현재 있는 결함" 이 아니다.

INFO 3·7 은 3라운드 연속 같은 근거(방어 불균일·트리거 대기)로 유예 확정, 나머지는 확인 결과
문제 없음이거나 규약상 정상 산출물이다.

---

## 절차 메모 — 이 SUMMARY 는 두 번 유실될 뻔했다

기록해 두는 이유는 둘 다 **게이트가 아니라 내 명령 구성**의 문제였고, 둘 다 "게이트가 이상하다"
로 오진할 뻔했기 때문이다.

**① 차단되는 명령에 부수 작업을 붙였다.** `SUMMARY 작성 && commit && (push)` 로 이어 붙였는데,
push 게이트는 **PreToolUse hook** 이라 명령 **전체**를 실행 전에 거부한다. 파일 작성도 커밋도
일어나지 않았고, 게이트는 여전히 이전 세션(`10_29_50`)을 최신 리뷰로 보고 있었다. 나는 잠깐
"왜 방금 만든 세션을 못 보나" 를 게이트 결함으로 의심했다 — 실제로는 그 세션이 **디스크에
존재하지 않았다**. 게이트는 명령 단위 all-or-nothing 이다.

**② 그 사실을 적은 문장이 다시 차단을 유발했다.** ①을 heredoc 본문에 적었더니 hook 의 blind
정규식이 **본문 안의 push 명령 문자열**을 명령으로 오인해 또 막았다. 파일 작성은 Write 도구로
해야 했다.

②는 가드 설계의 성질이다 — blind 정규식은 "무지해서 안전" 한 대신 인용 문맥을 모른다. 그 대가는
이런 오탐이고, 정밀 파서로 바꾸면 무한한 표면을 얻는다. 오탐을 감수하는 쪽이 맞다.
