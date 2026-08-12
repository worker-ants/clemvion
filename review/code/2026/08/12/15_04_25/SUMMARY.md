# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 fix(Redis `get()` 런타임 fail-open, `catchError`→`switchMap` 순서)는 8개 reviewer 전원(강제 화이트리스트 전원 결과 확보, 누락 없음) 독립 재검증에서 정상 확인됨. 신규 CRITICAL 없음. 유일한 실질 이슈는 fail-open 트레이드오프로 인한 다운스트림 중복 실행 위험(WARNING 1건, concurrency·side_effect 두 reviewer 가 동일 근본 원인을 중복 지적해 통합)이며, 이는 spec 이 명시적으로 승인한 가용성 우선 정책이고 이미 문서화·백로그 추적 중이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/부작용 | Redis 장애 지속 구간 동안 `catchError` fail-open 이 `Idempotency-Key` 기반 중복 억제를 무력화해, 같은 키의 재요청이 전부 `next.handle()` 을 다시 태워 다운스트림(예: execution 생성) 부작용이 중복 실행될 수 있다. 평시에도 존재하던 GET→SET 비원자성(TOCTOU) 창이 장애 구간 전체로 확대된다. spec(`spec/data-flow/15-external-interaction.md` "전 경로 fail-open — 가용성 우선")이 명시적으로 요구한 트레이드오프이며 클래스 docstring·`CHANGELOG.md`·`plan/in-progress/backend-lint-gate-broken-on-main.md` 백로그(관측 지표, `SET NX EX` 선점/in-flight dedup 검토)에 이미 문서화·유예되어 있다. 코드로 되돌릴 필요 없음. | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:67-72`(신규 docstring), `:98-112`(신규 `catchError`), `:157-186`(`cacheTapped()`, 이 diff 로 미변경) | 조치 불요 — 이미 취해진 문서화·백로그(관측 알람, in-flight dedup 검토)로 충분. 코드 레벨 완화는 별도 plan 항목으로 계속 추적. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항/동시성 | `catchError`(107행)가 `switchMap`(113행) **앞**에 정확히 위치 — 이전 라운드(`14_27_02`)에서 documentation 리뷰어가 보고한 "순서 역전" CRITICAL 은 공유 워크트리 뮤테이션 아티팩트였음이 이번 라운드에서도 8개 reviewer 전원 독립 재확인으로 재확정. 코드 결함 아님. | `idempotency.interceptor.ts:107,113` | 조치 불요. 회귀 방지용 캐너리 테스트(`fail-open 이 409 충돌까지 삼키지 않는다`)를 향후 리팩터 시에도 유지. |
| 2 | 보안 | GET/SET 캐시 조회 실패 시 fail-open 자체가 spec 이 승인한 트레이드오프(중복 억제 무력화). Redis GET/SET 에러 메시지는 서버 로그에만 남고 클라이언트 미노출 — 정보 노출 없음. | `idempotency.interceptor.ts:98-112`, `:174-180` | 조치 불요. |
| 3 | 보안(선재) | 캐시 제외 범위가 spec R8("400 VALIDATION_ERROR 만 제외") 보다 넓어 `statusCode >= 400` 전체(409·410 포함)가 idempotency 재현 보장에서 제외됨. 이번 diff 로 인한 변경 아님, 이미 docstring·plan 백로그로 추적 중. | `idempotency.interceptor.ts:157-161` (`cacheTapped()`) | 조치 불요 — 스코프 밖, 기추적 중. |
| 4 | 유지보수성 | GET/SET 캐시 실패 로그 메시지 조립·`instanceof Error` 판별 로직이 두 자리(`catchError` 신규 블록, `cacheTapped().catch()` 기존)에서 동일 패턴으로 중복. 두 라운드 연속 "2곳뿐이라 보류"로 의도적 유예. | `idempotency.interceptor.ts:107-110`, `:176-179` | `private warnCacheFailure(op: 'GET'\|'SET', err: unknown)` 추출 고려. 낮은 우선순위, 조치 불요. |
| 5 | 유지보수성 | `catchError` 삽입부 인라인 주석 블록이 8줄로 다소 김 — 다만 로드베어링 위치 결정 근거(뒤로 밀리면 `ConflictException` 을 삼킴)를 캐너리 테스트와 1:1 대응시키는 저장소 기존 관례와 일치. | `idempotency.interceptor.ts:99-106` | 조치 불요. |
| 6 | 테스트 | GET reject fail-open 테스트가 `set()` reject 테스트와 달리 `logger.warn` 호출을 단언하지 않음 — `catchError` 콜백에서 `logger.warn` 한 줄만 삭제하는 뮤턴트를 잡을 테스트가 없음(정독 기반 판단, 직접 뮤테이션 미실행). | `idempotency.interceptor.spec.ts` — `get()` reject 테스트(게이트 355행 부근), 비교 대상 `set()` reject 테스트(게이트 418행) | GET reject 테스트 중 하나에 `Logger.prototype.warn` spy + `cache GET 실패` 문자열 단언 추가해 GET/SET 대칭성 확보. 낮은 우선순위. |
| 7 | 테스트(선재) | `readKey`/`hashBody` 경계값(키 길이 초과, 공백뿐인 키, non-string 헤더) 테스트 부재 — 이번 PR 스코프 밖, `plan/in-progress/backend-lint-gate-broken-on-main.md` `testing INFO 10` 으로 기추적. | `idempotency.interceptor.ts:189-194`(`readKey`), `:196-201`(`hashBody`) | 조치 불요(백로그 추적 중). |
| 8 | 문서화 | 신규 3번째 `describe` 블록의 지역 docstring 이 블록 내 5개 테스트 중 일부만 서술 — 다만 파일 최상단 헤더 docstring 이 이미 4가지(조회 실패·적재 실패·비-Error reject·409 캐너리)를 정확히 요약해 실질 정보 손실 미미. | `idempotency.interceptor.spec.ts:343-352` | 여유 시 지역 docstring 한 줄 보강. 필수 아님. |
| 9 | 스코프 | `bodyHashOf` 헬퍼를 모듈 최상단으로 이동(중복 제거) — 원 fix 범위를 살짝 넘지만 같은 세션 review-fix 워크플로(전 라운드 maintainability WARNING #3 조치)의 정상 산출물. | `idempotency.interceptor.spec.ts:94` | 조치 불요. |
| 10 | 스코프 | plan 문서에 완료 체크박스 외 신규 백로그 항목(관측·중복 억제) 추가 — 코드 fix 와 무관한 확장이 아니라 이번 라운드가 만든 트레이드오프의 정상 부기. | `plan/in-progress/backend-lint-gate-broken-on-main.md:524-530` | 조치 불요. |
| 11 | 스코프 | diff 에 직전 두 리뷰 라운드(`14_27_02`, `14_50_36`) 산출물 24개 파일이 통째로 포함 — developer 스코프 일탈 아니라 프로젝트 규정 review-fix 파이프라인의 정상 산출물(`review/**` 는 커밋 대상). | `review/code/2026/08/12/{14_27_02,14_50_36}/*` | 조치 불요. diff 가독성엔 노이즈이나 참고만. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | fail-open 트레이드오프(INFO), 에러 메시지 서버 로그 한정(INFO), R8 캐시 제외 범위 선재 결함(INFO). Critical 없음. |
| requirement | NONE | spec fidelity 전항목 line-level 일치 확인, 16/16 테스트 GREEN, 순서 역전 오탐 재확인. |
| scope | NONE | `bodyHashOf` 이동·plan 백로그 추가·전 라운드 산출물 포함 모두 정당화된 review-fix 부산물. |
| side_effect | LOW | fail-open 구간 다운스트림 중복 실행 창 확대(WARNING, concurrency 와 중복). |
| maintainability | LOW | GET/SET 로그 조립 중복(INFO, 2라운드 연속 유예), 인라인 주석 길이(INFO). |
| testing | LOW | GET fail-open 경로 warn 로그 미검증(INFO), readKey/hashBody 경계값 선재 갭(INFO). 16/16 GREEN. |
| documentation | NONE | CHANGELOG·docstring·plan 체크리스트 정합. 지역 docstring 완전성 사소한 INFO 1건. |
| concurrency | MEDIUM | fail-open 구간 중복 억제 무력화 + TOCTOU 창 확대(WARNING), `catchError` 위치 정상(INFO). |

## 발견 없는 에이전트

없음 — 전원(8/8) 최소 INFO 이상 보고, 강제 화이트리스트 전원 결과 확보(누락 없음).

## 권장 조치사항

1. (선택, 낮은 우선순위) GET reject fail-open 테스트에 `Logger.prototype.warn` spy 추가해 `cache GET 실패` 로그를 단언 — SET 경로와의 관측 가능성 대칭성 확보.
2. (선택, 낮은 우선순위) GET/SET 캐시 실패 로그 조립 로직을 `warnCacheFailure(op, err)` 헬퍼로 추출.
3. fail-open 구간 중복 억제 무력화(WARNING)는 코드 변경 불요 — 이미 등재된 plan 백로그 항목(Redis GET 실패율 관측 지표/알람, `SET NX EX` 선점 또는 in-flight dedup 검토)을 계속 추적.
4. 그 외 항목은 전부 조치 불요 — merge 차단 사유 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(RxJS 연산자 1개 삽입) 와 낮은 관련성 |
  | architecture | router 판단상 낮은 관련성 |
  | dependency | router 판단상 낮은 관련성(신규 의존성 없음) |
  | database | router 판단상 낮은 관련성(DB 스키마/쿼리 변경 없음) |
  | api_contract | router 판단상 낮은 관련성(공개 API 시그니처 변경 없음) |
  | user_guide_sync | router 판단상 낮은 관련성(사용자 가이드 대상 아님) |
