# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. `idempotency.interceptor` 경계값 하드닝(테스트 13건 + `isHttpStatusCode()`)은 실사용 경로에서 안전하지만, 테스트 완결성 주장(하한 뮤턴트·중복헤더 근거)과 문서 관행(CHANGELOG·docstring 색인)에 실측으로 반증된 WARNING 4건이 있다. forced reviewer 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `isHttpStatusCode()` 하한(100)의 "바로 아래" 경계(99)가 어느 테스트에도 없음 — 무효 케이스가 0/-1 로 100 에서 멀리 떨어져 있어, 하한을 넓히는 뮤턴트(`>= 100` → `>= 50`)를 직접 주입해도 54개 테스트가 전부 GREEN 으로 남음(뮤테이션 실측 확인, 원복·`git diff` clean 확인). plan 이 "뮤턴트 10개 전부 사살"이라 기록한 것과 부분적으로 어긋남. 실질 위험은 낮음(이 값은 사용자 입력이 아니라 서버 자신이 적재한 캐시를 되읽는 값) | `idempotency.interceptor.ts:394-399`(`isHttpStatusCode`), `idempotency.interceptor.spec.ts:1348-1425` | `it.each` 무효 케이스에 `['하한 바로 아래(99)', 99]` 를 추가해 "100 유효 / 99 무효" 인접 페어 완성(상한은 이미 599/600 페어 있음) |
| 2 | Testing | "헤더가 배열이면(중복 전송)" 테스트의 근거 주석("클라이언트가 헤더를 두 번 보내면 express 가 배열을 넘긴다")이 실제 동작과 다름 — raw socket 으로 중복 헤더를 실제 전송해 검증한 결과 Node `http`(이 앱은 FastifyAdapter 없이 기본 Express/Node http 사용)는 `set-cookie` 를 제외한 중복 헤더를 `", "` 로 조인한 단일 문자열로 만들어(`"a, b"`) `typeof raw !== 'string'` 분기에 닿지 않고, 그대로 유효한 캐시 키로 처리됨. 실제로 발생하는 시나리오(조인된 문자열)는 어떤 테스트도 검증하지 않은 채 남음. 코드의 `typeof` 방어 자체는 여전히 정당(타입이 이론상 허용하는 형태에 대한 방어) | `idempotency.interceptor.spec.ts:1280-1296` | 주석을 실제 동작("이 분기는 타입 방어이며, 실제 중복 헤더는 조인된 문자열로 별도 분기를 탄다")으로 정정하거나, 조인된 문자열 케이스(`headers[...] = 'a, b'`)를 별도 테스트로 추가해 실제 발생 경로도 함께 고정 |
| 3 | Documentation | `CHANGELOG.md` 에 이번 라운드의 클라이언트-가시적 500 방지 수정(`isHttpStatusCode()`)이 빠짐 — 같은 클래스의 이전 500-방지 수정 두 건(엔트리 `responseJson` 손상, 캐시 키 스코프)은 이미 상세한 "Unreleased" 항목으로 등재돼 있어 확립된 관행과 어긋남. 이 함수의 JSDoc 자체가 "`typeof==='number'` 만 보면 `-1`/`600`/`200.5` 가 통과해 express 전송 시점 `RangeError`→500 이 된다"고 명시하는 실제 결함 방지 수정 | `idempotency.interceptor.ts:384-400`, 근거: `plan/in-progress/backend-lint-gate-broken-on-main.md:682-685` | 기존 항목과 같은 형식(문제→원인→클라이언트 영향)으로 CHANGELOG Unreleased 항목 추가 |
| 4 | Documentation | 테스트 파일 최상단 모듈 docstring(각 `describe` 블록을 "두 번째/세 번째/네 번째" 순번으로 요약하는 이 파일 고유 관행)이 이번 diff 가 추가한 다섯 번째 `describe`(`readKey`/`hashBody` 경계값)를 목록에서 빠뜨림 — 블록 자체 로컬 docstring 은 충실해 내용 손실은 없으나, 파일 구조 색인이 실제보다 좁아짐 | `idempotency.interceptor.spec.ts:1-40`(모듈 docstring), `:1208-1218`(신규 블록) | 모듈 docstring 에 "다섯 번째 describe 는 `readKey`/`hashBody` 경계값 — …" 단락 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | `isHttpStatusCode()` 의 유효 범위(100~599)가 인터셉터가 실제로 캐시하는 상태코드(2xx/409/410)보다 넓어 `1xx` 등도 이론상 "정상"으로 통과할 수 있음 — 값의 출처가 서버 자신이 적재한 캐시뿐이라 공격자가 제어 불가하고, 닫힌 목록 판정은 별도 함수(`isErrorStatusCacheable`)가 담당하는 의도된 관심사 분리라 결함이 아님 | `idempotency.interceptor.ts:394-400` | 필요시 하한을 200 으로 좁히는 것 고려 가능하나 우선순위 낮음, 조치 불요 |
| 2 | Security / Requirement / Side Effect | `!rawKey` → `rawKey === null` 전환은 `readKey()` 가 이미 빈 문자열을 `null` 로 필터링하므로 동작을 바꾸지 않는 순수 리팩터 — "책임 분리로 뮤테이션 관측성이 개선됐다"는 커밋/plan 서술을 실제로 검증(변경 전엔 `readKey` 내부 검사를 제거해도 호출부 truthiness 가 가려 GREEN 유지, 변경 후엔 즉시 회귀로 드러남) | `idempotency.interceptor.ts:110` | 조치 불필요 |
| 3 | Side Effect / Testing | 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화가 `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 변경 — 파일 전체 호출부에 영향 범위지만, 기존 호출부는 전부 리터럴 객체/항상-초기화된 변수만 넘겨 grep 으로 회귀 없음 확인. "키 부재"와 "명시적 nullish" 를 구분하는 방향으로 규약이 바뀜 | `idempotency.interceptor.spec.ts:127-131` | 조치 불필요, 향후 동적 `body` 값 전달 시 유의 |
| 4 | Side Effect | `statusCode` 유효성 판정이 좁아져(신규 `isHttpStatusCode`) 기존에 캐시된 손상 엔트리가 `discardCorruptEntry()` 로 처리되도록 경로가 바뀜(의도된 버그 수정) — 이 API 는 애초에 100~599 밖 `statusCode` 를 생성하지 않아 실질 영향 없음 | `idempotency.interceptor.ts`(`isIdempotencyEntry`/`isHttpStatusCode`) | 조치 불필요 |
| 5 | Maintainability | 스펙 파일이 1,426줄로 커짐 — `describe` 블록 5개(W-4/캐시 히트/Redis 장애/캐시 키 스코프/경계값)가 누적, 관심사별 파일 분리 여지 | `idempotency.interceptor.spec.ts:1218` | 다음에 새 `describe` 축 추가 시 `idempotency.interceptor.*.spec.ts` 분리 및 공유 헬퍼 별도 파일화 고려 |
| 6 | Maintainability | `jest.spyOn(Logger.prototype,'warn')` + `try/finally{mockRestore()}` 보일러플레이트가 파일 전체 11회 반복(이번 diff 로 1회 추가) | `idempotency.interceptor.spec.ts:1359` (외 파일 전역 10곳) | `withWarnSpy(async (warnSpy) => {...})` 헬퍼로 감싸는 리팩터 후보로 남김 |
| 7 | Maintainability | `isHttpStatusCode()` 의 100/599 경계가 이름 없는 리터럴 — 같은 파일에 `MAX_KEY_LENGTH`/`TTL_SEC` 처럼 상수화하는 관례가 이미 존재 | `idempotency.interceptor.ts:397-398` | `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 상수화 고려(우선순위 낮음) |
| 8 | Maintainability | 키 길이 상한 테스트가 "허용 경계"와 "거부 경계"를 한 `it` 블록에 결합 — 의도된 설계(주석에 근거 명시)지만 실패 시 테스트 목록에서 어느 쪽인지 즉시 구분 어려움 | `idempotency.interceptor.spec.ts:1222` | 향후 유사 "경계 양쪽" 테스트는 `it.each` 표준화 고려 |
| 9 | Documentation | `readKey()` 헬퍼에만 JSDoc 이 없음 — 파일 내 다른 모든 헬퍼(`describeShape`/`hashBody`/`isErrorStatusCacheable`/`isIdempotencyEntry`/`isHttpStatusCode`)는 문서화됨. `intercept()` 호출부 주석이 `readKey` 의 계약을 대신 서술 중 | `idempotency.interceptor.ts:409` | `readKey` 위에 반환값 규약(`string \| null`, null 의 세 가지 사유) JSDoc 한 줄 추가 |
| 10 | Documentation | plan 체크리스트가 묶었던 3개 서브 항목 중 "클래스 docstring 에 R8 선재 결함 참조 한 줄 추가"의 이행 여부가 완료 노트에 언급 없음 — 실제로 클래스 docstring 은 변경되지 않았고, 체크박스는 `[x]`로 통째로 닫힘 | `plan/in-progress/backend-lint-gate-broken-on-main.md:674`, `:682-696` | 완료 노트에 "docstring 참조 줄 추가는 생략함 — 참조 대상 R8 선재 결함이 이후 라운드에서 이미 수정돼 무효" 등 한 줄 추가 |
| 11 | Security | 캐시 손상 로그가 원본 payload 값이 아닌 형태 문자열(`typeof`/`array`/`null`)만 기록하도록 의도적으로 설계됨(긍정 관찰) | `idempotency.interceptor.ts` `describeShape()` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 인젝션/인증우회/시크릿노출 없음. `isHttpStatusCode` 범위·`rawKey===null` 은 방어 강화. statusCode 1xx 허용 여백은 공격자 제어 불가 경로라 실질 위험 낮음(INFO) |
| requirement | NONE | spec EIA §R8 의 fail-open 원칙을 정확히 구현. 경계값(`MAX_KEY_LENGTH`=200, statusCode 100~599)은 spec 침묵 영역의 구현 방어라 spec 위반 아님. `rawKey===null` 은 회귀 없는 순수 리팩터로 검증됨 |
| scope | NONE | 3개 파일 전부 plan 에 사전 예고된 두 항목(경계값 테스트, statusCode 범위 검사)과 정확히 일치. 무관 리팩터·포맷팅·설정 변경 없음. 커밋 diffstat 대조 완료 |
| side_effect | NONE | 공개 인터페이스(생성자·`intercept()`) 시그니처 불변, 전역변수/파일시스템/네트워크 부작용 없음. `makeContext` body 정규화 변경은 grep 으로 회귀 없음 확인 |
| maintainability | LOW | 파일 길이 증가, warnSpy 보일러플레이트 반복, 매직넘버, 경계 테스트 결합 — 전부 경미한 개선 여지, 이번 diff 단독 책임 아님 |
| testing | LOW | 하한(100) "바로 아래" 경계 미검증 — 뮤테이션 실측으로 생존 확인. "헤더 배열" 테스트 근거 주석이 실제 Express/Node 동작(콤마 조인)과 다름을 실측으로 반증 |
| documentation | LOW | CHANGELOG 관행 미적용, 모듈 docstring 색인이 신규 5번째 블록 누락, `readKey` JSDoc 누락, plan 서브항목 이행 여부 모호 |

## 발견 없는 에이전트

- scope — 발견사항 섹션에 "없음"으로 명시(범위 이탈·무관 변경 확인 결과 확정, 별도 지적 없음)

## 권장 조치사항

1. `isHttpStatusCode()` 하한(100) 바로 아래 값(99)을 무효 케이스에 추가해 인접 경계 페어를 완성한다(Testing WARNING 1).
2. "헤더가 배열이면" 테스트의 근거 주석을 실제 Express/Node 동작(콤마 조인 문자열)으로 정정하고, 조인된 문자열이 실제로 도달하는 경로를 별도 테스트로 고정한다(Testing WARNING 2).
3. `CHANGELOG.md` 에 `isHttpStatusCode()` 500 방지 수정 항목을 기존 항목과 같은 형식으로 추가한다(Documentation WARNING 3).
4. 테스트 파일 모듈 docstring 에 다섯 번째 `describe` 블록(경계값)을 반영한다(Documentation WARNING 4).
5. (선택) `readKey()` JSDoc 추가, plan 완료 노트에 "R8 docstring 참조" 서브항목 생략 사유 한 줄 명기 — 우선순위 낮음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명, router 가 별도 사유 텍스트를 제공하지 않음 — 이번 diff 범위(백엔드 인터셉터 단일 모듈 하드닝)와 무관 축으로 판단된 것으로 추정)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — forced 전원 결과 확보됨(누락 없음, 화이트리스트 미이행 아님)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 텍스트 미제공) — 성능 영향 없는 순수 검증 로직 변경으로 추정 |
  | architecture | 라우터 판단(사유 텍스트 미제공) — 아키텍처 변경 없는 단일 모듈 내부 하드닝으로 추정 |
  | dependency | 라우터 판단(사유 텍스트 미제공) — 의존성 변경 없음 |
  | database | 라우터 판단(사유 텍스트 미제공) — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단(사유 텍스트 미제공) — 동시성 구조 변경 없음 |
  | api_contract | 라우터 판단(사유 텍스트 미제공) — 공개 API 계약 변경 없음(side_effect 리뷰어가 이를 별도 확인) |
  | user_guide_sync | 라우터 판단(사유 텍스트 미제공) — 사용자 가이드 영향 없는 내부 구현 변경 |
