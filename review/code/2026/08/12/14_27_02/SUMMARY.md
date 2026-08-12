# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — documentation 리뷰어가 보고한 CRITICAL(`catchError`/`switchMap` 순서 역전)은 본 SUMMARY 작성 시점에 `git status`/`git diff HEAD`/소스 직접 열람으로 재검증한 결과 **현재 작업 트리에는 재현되지 않는 오탐**이다(아래 검증 노트 참고). 실질적으로 남는 위험은 WARNING 3건 — (1) Redis 장애 지속 구간 동안 Idempotency-Key 중복 요청의 다운스트림 중복 실행 위험이 넓어진다는 concurrency 지적(spec 승인 트레이드오프이나 관측/문서 보강 필요), (2) `CHANGELOG.md` 에 이번 fix 항목 누락, (3) 테스트 헬퍼(`bodyHashOf`) 중복 — 이며 전부 머지를 막을 사안은 아니다.

### 검증 노트 — documentation 리뷰어 보고 CRITICAL 재검증 결과 (오탐으로 판정)

documentation.md 은 작업 트리의 `idempotency.interceptor.ts` 에서 `catchError` 가 `switchMap` **뒤**에 위치해 있어(코드 자신의 주석·docstring 과 모순) 캐시 충돌 시 던지는 `ConflictException` 이 삼켜질 것이라고 CRITICAL 로 보고했다. 이를 SUMMARY 작성 시점에 직접 재확인했다:

- `git status --porcelain` → `codebase/backend/**` 변경 없음(리뷰 산출물 디렉터리만 untracked).
- `git diff HEAD -- codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` → 빈 출력(커밋 상태와 완전 일치).
- `grep -n "catchError|switchMap"` 실측 → `catchError` 는 100행, `switchMap` 은 106행 — **`catchError` 가 `switchMap` 보다 앞**에 정확히 위치.

즉 documentation 리뷰어가 관측한 "뒤집힌" 상태는 이 SUMMARY 작성 시점 기준 작업 트리에 존재하지 않는다. requirement.md 와 testing.md 모두 같은 세션 동안 "`catchError` 위치 캐너리"를 검증하려고 파일을 직접 뮤테이션했다가 되돌리는 절차를 수행했다고 스스로 기록했고(requirement.md: "다른 리뷰 세션이 같은 파일을 일시적으로 동일한 뮤테이션 상태로 만든 순간을 관측"), 이는 프로젝트가 이미 알고 있는 실패 클래스(병렬 리뷰어가 공유 worktree 를 뮤테이션해 서로를 오염시킴)와 정확히 일치한다. 따라서 이 CRITICAL 은 **코드 결함이 아니라 리뷰 세션 간 일시적 뮤테이션 아티팩트**로 판정하고 Critical 표에서 제외했다 — 단, push 직전 재확인을 권장 조치에 남겨 둔다(아래 참고).

## Critical 발견사항

_(없음 — 위 검증 노트 참고. documentation 리뷰어가 보고한 1건은 재검증 결과 현재 작업 트리에 재현되지 않는 오탐으로 판정되어 별도 표기함.)_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | Redis `get()` fail-open 이 GET→SET 비원자 구조(선재)와 결합해, Redis 장애가 지속되는 동안 동일 `Idempotency-Key` 로 도착하는 모든 중복 요청이 (좁은 타이밍 창이 아니라 장애 구간 전체에 걸쳐) 캐시 미스로 판정돼 다운스트림(execution 생성 등)이 중복 실행될 위험이 커진다 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:91-106`(신설 `catchError`), `:162-173`(기존 `set()`, 이 diff 로 미변경) | spec 이 승인한 가용성 우선 트레이드오프라 되돌릴 필요는 없음. (1) docstring/`spec/data-flow/15-external-interaction.md` 에 "fail-open 중 Idempotency-Key 중복 억제가 무력화될 수 있다"를 한 줄 명시, (2) Redis GET 실패율 관측 지표/알람 추가 검토 |
| 2 | documentation | `CHANGELOG.md` 에 이번 fix(Redis 런타임 장애 시 500 으로 fail-closed 되던 결함 수정) 항목이 없다 — 유사 규모 fix 45건 이상이 `## Unreleased — <제목>` 형식으로 기록돼 온 저장소 관례와 어긋남 | `CHANGELOG.md`(루트, 신규 섹션 부재) | `## Unreleased — Redis 런타임 장애 시 멱등성 캐시 조회 실패가 API 500 으로 번지던 결함 수정` 류의 섹션 추가 |
| 3 | maintainability / testing (중복 보고) | `bodyHashOf` 헬퍼가 describe 블록마다 문자 단위로 동일하게 복제됨(기존 `:162-165` + 신규 `:350-353`) — 같은 파일에서 `makeRedis`/`makeInterceptor` 등은 이미 모듈 최상단 공유 패턴을 따르는데 이 헬퍼만 예외 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:350-353`(신규), `:162-165`(기존) | `bodyHashOf` 를 파일 최상단(모듈 스코프)으로 옮겨 여러 describe 가 공유하도록 통합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect (중복 보고) | `catchError` 가 Redis GET 의 **모든** 예외(장애뿐 아니라 잠재적 프로그래밍 버그까지)를 무차별 캐시 미스로 강등 — spec 이 명시한 fail-open 요구를 정확히 구현한 것이나, 원인이 연결 장애가 아닌 다른 버그여도 동일하게 은폐될 수 있음 | `idempotency.interceptor.ts:91-106` | 조치 불요(spec 의도). 필요 시 fail-open 발생 빈도를 메트릭/알람으로 노출 검토 |
| 2 | side_effect | Redis 전면 장애 시 GET 실패(`:100-105`)와 SET 실패(`:167-173`, 기존 코드)가 요청당 각각 warn 로그를 남겨 완전 장애 구간에서 로그가 이중으로 발생할 수 있음 | `idempotency.interceptor.ts:100-105`, `:167-173` | 조치 불요, 운영 참고 사항 |
| 3 | security | 기존 R8 캐시 제외 범위(`statusCode >= 400`)가 409·410 까지 떨궈 spec §R8("400 VALIDATION_ERROR 만 제외")보다 넓음 — 이번 diff 대상 아닌 선재 결함, plan 에서 이미 추적 중 | `idempotency.interceptor.ts:159-161`(`cacheTapped`) | 조치 불요(스코프 밖, 이미 백로그 추적: `plan/in-progress/backend-lint-gate-broken-on-main.md`) |
| 4 | testing | 클래스 docstring 이 주장하는 "fail-open 세 경로" 중 `set()` 적재 실패 경로가 유닛 테스트로 직접 커버되지 않음(선재 코드, `.catch()` 로 fire-and-forget 처리라 구조상 안전하나 테스트 부재) | `idempotency.interceptor.ts:61-65`(docstring), `:167-173`(구현) | `redis.set.mockRejectedValue(...)` 로 SET 실패 시에도 정상 반환됨을 고정하는 테스트 추가 검토(선택) |
| 5 | testing | `catchError` 핸들러의 비-`Error` reject 분기(`String(err)`)가 어떤 테스트에서도 실행되지 않음(mutation testing 관점에서 죽은 분기로 보일 수 있음) | `idempotency.interceptor.ts:102` | `redis.get.mockRejectedValue('some-string')` 케이스 추가 검토(선택) |
| 6 | maintainability / documentation (중복 보고) | 인터셉터의 GET/SET 캐시 실패 로그 포맷 조립 로직이 두 자리에서 중복, 테스트 파일 헤더 docstring 이 신규 3번째 describe 블록을 나열하지 않음 | `idempotency.interceptor.ts:100-105` vs `:167-173`; `idempotency.interceptor.spec.ts:1-14` | `warnCacheFailure(op, err)` private 메서드로 추출(선택); 헤더에 3번째 describe 한 줄 추가(선택) |
| 7 | concurrency | GET→SET 비원자 구조 자체는 이번 diff 가 만든 것이 아니라 선재 — 정상 동작 시에도 좁은 타이밍 창에서 동시 요청이 둘 다 캐시 미스로 판정될 수 있음 | `idempotency.interceptor.ts` intercept()/cacheTapped() | 이번 PR 스코프 밖. 후속으로 `SET NX EX` 선점 방식 또는 in-flight dedup 검토, backlog 항목화 권장 |
| 8 | scope | `catchError` 삽입부 주석 블록이 8줄로 다소 길다 — 다만 로드베어링 위치 결정에 대한 저장소 기존 관례(docstring 밀도)와 일치하고 캐너리 테스트와 1:1 대응 | `idempotency.interceptor.ts:92-99` | 조치 불요, 스타일 판단 |
| 9 | requirement / testing | 캐시 미스 강등 테스트(`get() 이 reject 하면...`)가 `bodyHash` 만 단언하고 `statusCode`/`responseJson` 은 단언하지 않음; 캐너리 테스트와 기존 409 테스트의 assertion 로직이 사실상 동일(의도된 중복, 주석으로 근거 명시됨) | `idempotency.interceptor.spec.ts:386-390`, `:393-416` | 필요 시 `stored.statusCode`/`stored.responseJson` 단언 추가(선택, 낮은 우선순위) |
| 10 | security | Redis 클라이언트 예외의 `err.message` 를 서버 로그에만 기록(클라이언트 미노출) — 정보 노출 취약점 아님 | `idempotency.interceptor.ts:101-103`, `:169-172` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도(보고) | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | fail-open 트레이드오프(INFO), R8 캐시 제외 범위(기존, INFO) |
| requirement | NONE | spec 인용/구현 정합 확인, 캐너리 뮤테이션 재현 검증 성공, bodyHashOf 중복 관측(INFO) |
| scope | NONE | 변경이 fix 목적에 정확히 수렴, 주석 길이만 스타일 참고(INFO) |
| side_effect | LOW | catchError 무차별 강등(INFO), 로그 이중 발생 가능성(INFO) |
| maintainability | LOW | bodyHashOf 중복(WARNING), 로그 포맷 중복(INFO), 헤더 docstring 갱신 필요(INFO) |
| testing | LOW | 14/14 통과 + 캐너리 뮤테이션 재현(4건 RED) 실측 검증, set()/non-Error 분기 미검증(INFO) |
| documentation | HIGH(보고) → 검증 후 MEDIUM 요인으로 하향 | CRITICAL 1건 보고했으나 SUMMARY 재검증 결과 오탐(위 검증 노트); CHANGELOG 누락은 WARNING 으로 유효 |
| concurrency | MEDIUM | catchError 위치 정확성 확인(양호), Redis 장애 시 중복 실행 위험 확대(WARNING) |

## 발견 없는 에이전트

해당 없음 — 실행된 8개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고함.

## 권장 조치사항

1. **(최우선)** `CHANGELOG.md` 에 이번 fix(`Redis 런타임 장애 시 idempotency 캐시 조회 실패가 API 500 으로 번지던 결함 수정`) 항목을 저장소 관례 형식(`## Unreleased — <제목>`)으로 추가한다.
2. concurrency 지적대로, fail-open 상태에서 Idempotency-Key 중복 억제가 무력화될 수 있다는 트레이드오프를 docstring/spec 에 한 줄 명시하고, Redis GET 실패율에 대한 관측 지표/알람 추가를 검토한다(운영이 장애 구간의 잠재적 중복 처리를 인지할 수 있도록).
3. 테스트 파일의 `bodyHashOf` 헬퍼를 모듈 최상단으로 통합해 두 describe 블록이 공유하도록 리팩터한다.
4. (선택, 낮은 우선순위) `set()` 실패 경로·`catchError` 의 non-Error reject 분기에 대한 테스트를 추가하고, GET/SET 로그 포맷 조립을 `warnCacheFailure` 헬퍼로 추출해 중복을 줄인다.
5. push/merge 직전 `git status`/`git diff HEAD -- codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 로 작업 트리가 clean(=`catchError` 가 `switchMap` 앞)한지 재확인한다 — 이번 SUMMARY 작성 시점엔 이미 확인 완료(clean, 오탐 판정)이나, 공유 worktree 에서 병렬 리뷰 세션이 재차 뮤테이션했을 가능성을 배제하기 위해 최종 push 직전 한 번 더 확인 권장.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위 밖(성능 영향 없는 에러 핸들링 변경) |
  | architecture | router 판단상 이번 diff 범위 밖(아키텍처 변경 없음) |
  | dependency | router 판단상 이번 diff 범위 밖(의존성 변경 없음) |
  | database | router 판단상 이번 diff 범위 밖(DB 스키마/쿼리 변경 없음) |
  | api_contract | router 판단상 이번 diff 범위 밖(API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 범위 밖(사용자 가이드 대상 변경 없음) |
