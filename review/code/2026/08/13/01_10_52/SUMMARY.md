# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/신규 결함 없음. Documentation reviewer 가 지적한 WARNING 1건(plan 완료 노트의 테스트 개수 표기가 노트 자신이 서술하는 후속 추가분을 반영 못해 13건 vs 실제 15건 불일치)만 존재하며, forced whitelist(7개 reviewer) 전원의 결과가 확보되어 미이행 항목은 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | plan 완료 노트가 "경계 테스트 13건" 이라 적었으나, 같은 노트가 바로 이어서 서술하는 두 건의 후속 추가(WARNING #2 대응 — 중복 헤더 조인 문자열 테스트 신설, WARNING #1 대응 — `statusCode` 무효 케이스에 `99` 경계 추가)를 반영하지 못해 실제 테스트 수(15건)와 어긋난다. 자기모순(앞 문장 개수 vs 뒷 문단이 설명하는 추가분)이 같은 diff 안에서 발생 | `plan/in-progress/backend-lint-gate-broken-on-main.md:682` (실측 대상: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 신규 `describe('IdempotencyInterceptor — readKey / hashBody 경계값', ...)` 블록) | "경계 테스트 15건(리뷰 라운드에서 조인 문자열·`99` 경계 2건 추가)" 등으로 숫자 갱신, 또는 문단 끝에 최종 개수 재확인 한 줄 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | `isHttpStatusCode()` 의 유효 범위(100~599)가 실제 캐시 대상(2xx/409/410)보다 넓지만, 이 값의 유일한 출처는 서버 자신이 `storeEntry()`로 적재한 캐시이고 별도 함수 `isErrorStatusCacheable()` 이 실질 화이트리스트를 담당하므로 공격자가 제어 가능한 입력 경로가 아니다. spec(§R8) 도 이 형태검증 값 자체를 규정하지 않아 spec fidelity 위반도 아니다 | `idempotency.interceptor.ts:397` (`isHttpStatusCode`, `MIN_HTTP_STATUS_CODE=100`) | 조치 불요. 필요 시 하한을 200(캐시 대상 최소 성공 코드)으로 더 좁히는 것 검토 가능하나 우선순위 낮음 |
| 2 | Security | 손상 캐시 엔트리 로그(`discardCorruptEntry()`)가 원본 payload 가 아니라 `describeShape()`(형태만)를 남기도록 설계되어 민감정보 미노출 유지 (기존 동작, 변경 없음) — 긍정 관찰 | `idempotency.interceptor.ts:406` | 조치 불요 |
| 3 | Security / Requirement | `!rawKey` → `rawKey === null` 전환은 `readKey()` 가 non-string/빈 문자열/길이초과 세 경우 모두 `null` 만 반환하도록 구현돼 있어 런타임 분기 결과를 바꾸지 않는 순수 리팩터다. §R8 "키 미설정 시 캐시 적용 안 함" 요구를 그대로 유지하며 새 공격표면도 없다 | `idempotency.interceptor.ts:112-113` | 조치 불요 |
| 4 | Side Effect | 위 #3 과 연결되나 다른 관점: `rawKey === null` 전환으로 호출부가 `readKey()` 의 "빈 문자열을 반환하지 않는다"는 불변식에 암묵적으로 의존하게 됐다. 현재는 안전하고 JSDoc 에 계약이 명시돼 있으나, 향후 `readKey()` 에 새 반환 경로가 추가될 때 이 불변식이 깨지면 호출부가 더는 빈 키를 걸러내지 못한다 | `idempotency.interceptor.ts:112-113`, `:423-427` | 조치 불요 — 향후 `readKey()` 수정 시 "빈 문자열 미반환" 불변식 유지에 유의 |
| 5 | Side Effect | `isIdempotencyEntry()` 의 `statusCode` 검증 강화(`typeof==='number'`→`isHttpStatusCode()`)로, 범위 밖 손상 엔트리가 "유효"에서 "손상"으로 재분류되어 캐시 hit 이 캐시 miss(재처리)로 강등되는 의도된 동작 변경. CHANGELOG 에 클라이언트 영향 이미 명시됨 | `idempotency.interceptor.ts:383`, `:397-403` | 조치 불요 |
| 6 | Side Effect | 신규 모듈 상수 `MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 는 export 되지 않는 불변 스코프 상수로, 기존 `MAX_KEY_LENGTH`/`TTL_SEC` 와 동일 패턴 — 위험한 가변 전역 상태 아님 | `idempotency.interceptor.ts:25-26` | 조치 불요 |
| 7 | Side Effect / Maintainability | 공유 테스트 헬퍼 `makeContext()` 의 `body` 정규화가 `opts.body ?? {}` → `'body' in opts ? opts.body : {}` 로 변경됐다. 파일 내 `makeContext(` 호출부 전수(49건) grep 결과 `body` 키 생략 호출은 0건이라 기존 테스트 회귀 없음을 확인 | `idempotency.interceptor.spec.ts:137` | 조치 불요 |
| 8 | Scope / Side Effect | `review/code/2026/08/13/00_54_18/**` 신규 파일 11개(RESOLUTION/SUMMARY/개별 reviewer md/상태 json)는 직전 리뷰 라운드 산출물이며 `CLAUDE.md` 가 지정한 정규 저장 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 부합하는 정상 아카이빙 — 무관 파일 혼입 아님 | `review/code/2026/08/13/00_54_18/**` | 조치 불요 |
| 9 | Maintainability | 스펙 파일이 1,463줄로 계속 증가 중이나, 이번 diff 는 기존 다섯 번째 `describe` 축에 케이스를 보강한 것뿐 — 직전 라운드가 이미 지적하고 의식적으로 유예("다음 축 추가 시 분리 검토")한 항목의 연장이며 새로운 문제 아님 | `idempotency.interceptor.spec.ts` (전체) | 조치 불요 — 기존 유예 결정 유지, 6번째 `describe` 축 생길 때 분리 검토 |
| 10 | Maintainability | `jest.spyOn(Logger.prototype, 'warn')` + `try/finally{mockRestore()}` 보일러플레이트가 파일 전체 11회 반복 — 직전 라운드에 이미 지적·유예(`withWarnSpy()` 헬퍼 후보)된 항목이며 이번 라운드에서 카운트 증가 없음 | `idempotency.interceptor.spec.ts` (11곳) | 조치 불요 — 기존 유예 결정 유지 |
| 11 | Testing | 신규 테스트 `hashOf` 헬퍼가 `r.set.mock.calls[0][1]` 을 `storeEntry` 호출 여부 사전 단언 없이 바로 인덱싱 — 회귀 시 `TypeError` 스택트레이스로만 실패 원인이 드러나 진단 비용 증가. 파일 내 유사 자리(730행 근방)는 `toHaveBeenCalledTimes(1)` 을 먼저 단언하는 패턴을 쓰는데 이번 신규 테스트만 빠짐 | `idempotency.interceptor.spec.ts:1375-1378` | `hashOf` 호출 전(또는 내부)에 `expect(r.set).toHaveBeenCalledTimes(1)` 추가 |
| 12 | Testing | `makeContext()` 의 `idempotencyKey` truthy 체크(`opts.idempotencyKey ? {...} : {}`)로 "헤더가 실제 빈 문자열로 전송됨"과 "헤더 자체 부재"를 헬퍼 수준에서 구분할 수 없다. `readKey()` 는 두 입력 모두 `null` 을 반환하므로 현재 코드 경로상 관측 가능한 동작 차이는 없어 실질 갭은 아님 | `idempotency.interceptor.spec.ts:130-132` | 조치 불요(현재 무해). 향후 헤더 부재/빈 문자열을 구분해야 하는 로직 추가 시 `'idempotencyKey' in opts` 기반으로 전환 |
| 13 | Requirement / Testing | 경계값 테스트(문서상 "13건", 실제 15건 — 위 WARNING #1 참고)가 `hashBody()` 의 "키 순서가 다르면 다른 hash", body nullish 동치, 키 길이 상한, 중복 헤더 실제 경로(조인 문자열) 등 문서화된 계약을 line-level 로 정확히 고정함 — 긍정 확인 | `idempotency.interceptor.spec.ts` (경계값 `describe` 블록) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 공격 표면 없음. statusCode 범위/rawKey null 판정 모두 검증을 좁히는 방향(INFO만) |
| requirement | NONE | 전회 WARNING 4건 조치 완료 재확인(56/56 pass, eslint 0/0). spec §R8 부합, spec-drift 없음 |
| scope | NONE | 범위 이탈·불필요 리팩터·무관 파일 혼입 없음. 실제 발견사항 자체가 없음 |
| side_effect | NONE | 공개 인터페이스(생성자·`intercept()`) 불변, 위험한 전역 가변 상태 없음, FS/네트워크/env 부작용 없음 |
| maintainability | LOW | 신규 결함 없음. 기존에 유예된 관찰(스펙 파일 길이, warnSpy 보일러플레이트) 2건이 규모 증가 없이 지속 |
| testing | LOW | 진단 편의성 INFO 2건(사전 단언 부재, 헬퍼 truthy 제약) — 병합 차단 사유 아님 |
| documentation | LOW | WARNING 1건(plan 노트 테스트 개수 자기모순 13 vs 15). 전회 WARNING/INFO 4건은 모두 정확히 반영 확인 |

## 발견 없는 에이전트

- scope — "발견사항: 없음"을 명시적으로 보고. diff 전체가 plan 체크리스트 항목 및 직전 리뷰 라운드(`00_54_18`) RESOLUTION 과 1:1 대응함을 확인.

## 권장 조치사항

1. **(WARNING)** `plan/in-progress/backend-lint-gate-broken-on-main.md:682` 의 "경계 테스트 13건" 을 실제 15건(조인 문자열·`99` 경계 2건 추가분 포함)으로 갱신한다.
2. **(INFO, 선택)** `idempotency.interceptor.spec.ts:1375-1378` 의 `hashOf` 헬퍼 호출 전에 `expect(r.set).toHaveBeenCalledTimes(1)` 을 추가해 회귀 시 진단 메시지를 명확히 한다.
3. 나머지 INFO 항목은 모두 조치 불요로 확인됐으며, 이미 문서(JSDoc/CHANGELOG/plan 노트)로 근거가 남아 있어 별도 조치 없이 병합 가능하다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 참고 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, forced whitelist 전원 = 실행된 7명과 동일 — 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판정 — diff 가 캐시 형태 검증/테스트 보강뿐이라 성능 특성 변경 없음으로 판단 (router skip, 개별 사유 텍스트는 prompt 에 미포함) |
  | architecture | 라우터 판정 — 구조적 변경(모듈 경계·계층) 없음 |
  | dependency | 라우터 판정 — package.json/lockfile 변경 없음 |
  | database | 라우터 판정 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판정 — 동시성 제어 로직 변경 없음 |
  | api_contract | 라우터 판정 — 공개 API 계약 변경 없음(인터셉터 내부 로직만) |
  | user_guide_sync | 라우터 판정 — 사용자 가이드 대상 변경 없음 |
