# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 프로덕션 코드(`IdempotencyInterceptor`)는 security/scope/side_effect 관점에서 NONE~LOW로 깨끗하고, 이번 라운드의 핵심 수정(`isIdempotencyEntry()` 형태 가드 — 문법은 유효하지만 형태가 아닌 캐시 값이 `TypeError`→500으로 새던 결함 폐쇄)은 실측(뮤테이션 재현) 검증까지 마쳤다. 위험도를 MEDIUM으로 끌어올리는 유일한 요인은 documentation 리뷰어가 지적한 **"코드는 맞는데 그 코드를 요약하는 상위 문서(테스트 docstring·plan 완료 노트)가 최신 수정을 반영하지 못했다"**는 패턴으로, 이 세션 안에서 이미 3차례 지적·조치된 동일 근본원인의 **4번째 재발**이다. forced reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | 테스트 파일 모듈 최상단 docstring 과 두 번째 `describe` 블록 docstring 이 마지막 커밋(`86de12278`)이 추가한 "형태(shape) 검증" 테스트 9건(`it.each` 8-fixture + 독립 테스트 1건)과 프로덕션의 `isIdempotencyEntry()` 신설을 반영하지 않음. 이 세션에서 이미 3회 지적된 "코드 변경 시 요약 docstring 미동반" 패턴의 4번째 재발 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11-14`(모듈 docstring), `:238-245`(describe 블록 docstring) | 두 docstring 에 "문법은 유효하지만 엔트리 형태가 아닌 값(`null`·배열·원시값·필드 누락/타입 불일치)도 `isIdempotencyEntry()` 로 걸러 손상 처리한다" 한 문장 추가 |
| 2 | documentation / requirement (공동 지적) | `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "완료" 선언 노트가 마지막 커밋(`86de12278`)의 `isIdempotencyEntry` 형태 가드 수정("이 PR이 없애려던 바로 그 실패 형태" — `'null'` 이 `TypeError`→500으로 새던 좁은 틈)을 언급하지 않음. requirement 리뷰어는 이를 "체크리스트가 실제보다 좁게 완료된 것처럼 읽힌다"로, documentation 리뷰어는 "완료 선언 이후 추가된 후속 수정이 노트에 없다"로 각각 지적 — 동일 결함 | `plan/in-progress/backend-lint-gate-broken-on-main.md:622-634`(`> **완료 (2026-08-12, eia-idem-responsejson-guard)**` 블록) | 같은 항목에 "후속(2026-08-13, `isIdempotencyEntry` 타입 가드): `JSON.parse` 문법 검사만으로는 `'null'`·`'42'`·`'[]'` 등 형태-불일치 값을 못 걸러 `TypeError`→500 이 재현됐다. 타입 가드를 추가해 닫았다" 문단 보강. 코드/테스트 자체는 수정 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / testing (독립 수렴) | `isIdempotencyEntry()` 가 `statusCode` 를 `typeof === 'number'` 로만 검사, 값 범위(유효 HTTP 코드) 검증 없음 — `NaN`/음수/`Infinity` 도 통과해 `res.status()`/`HttpException` 에 그대로 흘러감. 다만 이 값의 출처는 이 서비스 자신이 쓴 Redis 엔트리라 신뢰 경계가 낮아 실효 위험 낮음 | `idempotency.interceptor.ts:370-378`(`isIdempotencyEntry`), 소비부 `:208,214-215` | 조치 불요(낮은 우선순위). `readKey`/`hashBody` 경계값 테스트를 다룰 때 함께 정리 가능 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/data-flow/15-external-interaction.md` §4 "Redis … 전 경로 fail-open (warn)" 표현이 코드가 세분화한 "5경로 중 4개만 warn(생성자 시점 미주입은 config 상태라 제외)" 보다 거칠다 — 코드가 spec 의도를 더 정확히 충족하는 방향의 세분화이며 spec 문면이 낡음. 이미 `consistency-check`(23_48_39)가 발견해 plan 에 "developer 권한 밖 → planner 인계"로 정상 등재됨, 추가 조치 불요 | `spec/data-flow/15-external-interaction.md:308,331-339` vs `idempotency.interceptor.ts:62-71` | 코드 유지 + planner 턴에서 spec 표현 갱신(이미 plan에 등재됨, 본 리뷰에서 재차 추가 조치 불요) |
| 3 | testing | `describeShape()` 로그 헬퍼가 어떤 테스트로도 값 수준에서 하중을 받지 않음(함수 본문을 상수로 치환해도 41/41 그대로 통과, 직접 뮤테이션 실측). client-observable 동작과 무관해 위험 낮음 | `idempotency.interceptor.ts:380-385`, 호출부 `:173` | 급하지 않음. `it.each` fixture 1~2건에 `형태 불일치 (null)` 등 정확한 문자열 단언 추가 시 완전해짐 |
| 4 | maintainability | `switchMap` 콜백 분기 수가 6→7로 증가, 이전 두 라운드가 설정한 "6번째 분기 시 추출 재고" 트리거를 넘김. 즉시 조치 불요 | `idempotency.interceptor.ts:149-217` | 다음에 이 콜백을 건드릴 때 `resolveCacheHit(...)` private 메서드 추출 실제 검토 |
| 5 | side_effect | 손상 캐시 시 응답이 500→정상 처리로 바뀌는 client-observable 변화 + 바깥 엔트리 손상 시 신규 warn 로그 — 둘 다 CHANGELOG 공시 + 회귀 테스트로 고정된 의도된 변화, 숨은 부작용 아님 | `idempotency.interceptor.ts:196-201,234-243`, `CHANGELOG.md:3-25` | 없음 |
| 6 | scope | 바깥 엔트리 warn 확장(3라운드 연속 지적)과 `isIdempotencyEntry` 형태 가드 신설 모두 "기능 확장"이 아니라 직전 라운드가 실측으로 찾아낸 동일 결함 클래스의 폐쇄로 확인됨 | `idempotency.interceptor.ts` 전반, `plan/in-progress/backend-lint-gate-broken-on-main.md` 제목 갱신 | 없음 — 이미 닫힌 항목 |
| 7 | requirement | spec §R8 3계약(닫힌 캐시 목록 2xx/409/410, 캐시 키 스코프, 전역 fallback 금지) 이번 diff로 미변경, 코드와 정확히 일치 재확인 | `idempotency.interceptor.ts:112-121,133,348-350` | 없음 |
| 8 | maintainability | `discardCorruptEntry` 2번째 파라미터 `err`→`detail` 개명 — 실제 예외/합성 문자열 두 의미를 한 파라미터가 겸함(버그 아님, 타입 시그니처가 두 형태 구분 못함) | `idempotency.interceptor.ts:234-243` | 3번째 호출부 생기면 `Error \| string` 명시화 고려 |
| 9 | security | 로그에 원본 예외 메시지를 새니타이징 없이 삽입(이론적 log-injection, 선재 패턴, 이번 diff로 새 표면 아님). `cachedPayload` 런타임 스키마 미검증(선재 패턴, 신뢰 경계 확장 없음) | `idempotency.interceptor.ts` (logger.warn 호출부, `cachedPayload` 캐스팅) | 조치 불요 |
| 10 | user_guide_sync | doc-sync-matrix 19개 row 전체 대조 결과 매칭 trigger 없음(0/19) — 내부 인터셉터 신뢰성 리팩터로 유저 가이드/i18n/트리거 문서 갱신 대상 아님 | 해당 없음 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 신뢰 경계 확장 없음, `cached.*`는 전부 자체 기록값 재현. statusCode 범위 미검증은 INFO |
| requirement | LOW | spec §R8 3계약 미변경·일치. plan 완료 서술이 형태 가드 수정 누락(WARNING). fail-open 문구 SPEC-DRIFT는 이미 추적 중 |
| scope | NONE | 47파일 중 실질 4파일, 8커밋 전부 단일 결함 폐쇄에 수렴. 무관 파일/포맷팅/은폐 변경 없음 |
| side_effect | LOW | 500→성공 상태변화·신규 warn 로그 둘 다 의도됨+공시+테스트 고정. 공개 인터페이스 변경 없음 |
| maintainability | LOW | `switchMap` 7분기로 재검토 트리거 초과(INFO). 신설 헬퍼 2개는 스타일 일관 |
| testing | LOW | 뮤테이션 실측으로 순서 캐너리·형태 가드 하중 재검증(자기보고와 일치). `describeShape` 미검증·statusCode 범위 테스트 부재는 INFO |
| documentation | MEDIUM | 프로덕션/CHANGELOG/클래스 docstring 규율 높음(선행 WARNING 전부 반영 확인). 단 테스트 docstring 2곳 + plan 완료 노트가 최신 수정 미반영(WARNING 2건, 세션 내 4번째 재발) |
| user_guide_sync | NONE | doc-sync-matrix 0/19 매치, 갱신 대상 아님 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원 최소 INFO 이상 보고(대부분 "조치 불요" 확인 성격).

## 권장 조치사항

1. `plan/in-progress/backend-lint-gate-broken-on-main.md:622-634` 의 "완료" 노트에 마지막 커밋(`86de12278`)의 `isIdempotencyEntry` 형태 가드 수정 사실 보강 (requirement + documentation 공동 WARNING, plan 기록 갭 — 코드/테스트 수정 불요)
2. `idempotency.interceptor.spec.ts:11-14`(모듈 최상단), `:238-245`(describe 블록) docstring 에 형태 검증(shape validation) 테스트 축 한 문장 추가 (documentation WARNING)
3. (낮은 우선순위, 이미 plan 에 등재됨) `spec/data-flow/15-external-interaction.md` §4 fail-open 표현을 코드의 "5경로 중 4개, 생성자 미주입은 config 상태로 제외" 세분화에 맞춰 planner 턴에서 갱신 — `[SPEC-DRIFT]`, developer 권한 밖
4. (선택, 급하지 않음) `it.each` fixture 1~2건에 `describeShape` 출력 문자열 단언 추가, `statusCode` 값 범위(NaN/음수) 회귀 테스트 보강

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(범위 밖) |
  | architecture | router 판단(범위 밖) |
  | dependency | router 판단(범위 밖) |
  | database | router 판단(범위 밖) |
  | concurrency | router 판단(범위 밖) |
  | api_contract | router 판단(범위 밖) |
