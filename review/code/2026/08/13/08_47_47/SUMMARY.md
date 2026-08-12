# Code Review 통합 보고서

## 전체 위험도
**NONE** — 7개 reviewer(강제 화이트리스트 전원) 모두 Critical/Warning 0, INFO만 존재. forced 목록(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 확인됨 — 화이트리스트 미이행 없음.

이번 라운드 실질 diff는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`(+40/-3)와 대응 `.spec.ts`(+267/-1) 두 파일, 그리고 `CHANGELOG.md`/`plan/in-progress/backend-lint-gate-broken-on-main.md` 문서 갱신뿐이다(나머지 60개 파일은 이전 5라운드 `/ai-review` + 2라운드 `/consistency-check` 산출물 아카이빙). 변경 성격은 순수 하드닝: 캐시 엔트리 `statusCode` 검증을 `typeof === 'number'`에서 정수+범위(100–599) 검사(`isHttpStatusCode()`)로 강화하고, `rawKey` null 판정을 truthiness에서 명시적 `=== null` 비교로 전환했다. 7명 reviewer 전원이 독립적으로 소스를 재대조(일부는 뮤테이션 재실행까지 수행)해 CRITICAL/WARNING 없음에 수렴했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항 | `isHttpStatusCode()`의 유효 범위(100–599)가 이 인터셉터의 실제 캐시 **쓰기** 경로(2xx/409/410, `isErrorStatusCacheable`가 별도 관리하는 닫힌 목록)보다 넓다. 다만 이 값은 서버가 스스로 적재한 캐시에서만 오며 외부 입력이 도달할 수 없는 경로라 공격 표면이 아니다. spec은 "읽기 경로 형태 방어의 범위"에 침묵해 SPEC-DRIFT 대상도 아님 | `idempotency.interceptor.ts:397-403` | 조치 불요. 필요 시 하한을 200으로 좁힐 수 있으나 관심사 분리 관점에서 현행 설계도 타당 |
| 2 | 보안 | `isHttpStatusCode()` 신설 + `rawKey === null` 명시 비교 전환은 입력을 더 엄격히 거부하는 방향의 순수 하드닝 — 손상 캐시(`-1`/`0`/`600`/`200.5`)가 express `RangeError`→500을 유발하던 fail-open 위반을 `discardCorruptEntry()` 경로로 흡수. 신규 인젝션·인증 우회·정보 노출 표면 없음 | `idempotency.interceptor.ts:113, 377-385, 397-402` | 조치 불요 |
| 3 | 보안 | Redis 키 조립(`${prefix}${executionId}:${route}:${rawKey}`)의 3요소 중 2개(`executionId`/`route`)는 서버 전용 값, 나머지(`rawKey`)는 타입·길이·비어있음이 제한돼 커맨드 인젝션·크로스 테넌트 충돌 경로 없음 | `idempotency.interceptor.ts:140` | 조치 불요 |
| 4 | 보안 | 손상 로그(`describeShape`)가 캐시 payload 값이 아니라 형태(`typeof`/`array`/`null`)만 기록 — 로그를 통한 민감정보 노출 원천 차단 유지 | `idempotency.interceptor.ts:246-249, 405-410` | 조치 불요 |
| 5 | 요구사항 | `hashBody()`의 `typeof body === 'string'` 분기가 신설 "readKey/hashBody 경계값" 블록을 포함해 스펙 파일 전체에서 한 번도 행사되지 않음 — 블록명이 표방하는 커버리지와 소폭 괴리 | `idempotency.interceptor.ts:430-435`, 테스트 `idempotency.interceptor.spec.ts:1224-1467` | 급하지 않음. 다음에 이 영역을 만질 때 문자열 body 케이스 1건 추가 권장 |
| 6 | 요구사항 | `statusCode` 손상 판정이 `bodyHash` 불일치 판정보다 먼저 개입하는 우선순위가 "동시 손상" 조합으로 캐너리 테스트에 고정돼 있지 않음. 동작 자체는 합리적(spec 위반 아님) | `idempotency.interceptor.ts` `isIdempotencyEntry()` 호출부(~177행) | 급하지 않음 |
| 7 | 부작용 | `intercept()`의 `!rawKey` → `rawKey === null` 전환은 `readKey()`가 항상 `null` 또는 비어있지 않은 1~200자 문자열만 반환하도록 보장돼 있어 관측 가능한 분기 결과를 바꾸지 않는 순수 리팩터(뮤테이션 관측성 개선 목적) | `idempotency.interceptor.ts:113, 423-428` | 조치 불요 |
| 8 | 부작용 | 테스트 헬퍼 `makeContext()`의 `body` 정규화 변경(`opts.body ?? {}` → `'body' in opts ? opts.body : {}`)이 49개 호출부 중 신규 2곳 외 47곳에 영향 없음을 전수 확인 | `idempotency.interceptor.spec.ts:137` | 조치 불요 — 이미 재검증됨 |
| 9 | 유지보수성 | `intercept()`가 여전히 다수 책임(키 판정·스코프 판정·GET 조회·파싱·형태 검증·bodyHash 비교·응답 재현)을 한 메서드에서 처리 — plan에 `resolveCacheHit()` 추출 항목으로 이미 등재, 이번 PR 범위에서 의식적으로 유예 | `idempotency.interceptor.ts:106-226` | 다음에 이 메서드를 만질 때 착수 |
| 10 | 유지보수성 | 에러 메시지 포맷 삼항식(`err instanceof Error ? err.message : String(err)`)이 4곳에서 반복 — 기존부터 유예된 항목, 이번 diff로 반복 횟수 증가 없음 | `idempotency.interceptor.ts:152, 247, 330, 338` | 다섯 번째 호출부 생기면 `formatErr()` 추출 재검토 |
| 11 | 유지보수성 | 스펙 파일이 1,467줄로 큼(`describe` 5개 누적) — 관심축은 명확히 분리돼 있어 기존 유예 유지 | `idempotency.interceptor.spec.ts` 전체 | 여섯 번째 축 추가 시 분리 검토 |
| 12 | 유지보수성 | `jest.spyOn(Logger.prototype, 'warn')` + `try/finally { mockRestore() }` 보일러플레이트가 11회 반복 — `withWarnSpy()` 헬퍼 후보 기존 제안·유예 | `idempotency.interceptor.spec.ts` 전체 | 조치 불요, 리팩터 후보로 유지 |
| 13 | 유지보수성 | 테스트의 `key200`/`key201` 리터럴이 production 상수 `MAX_KEY_LENGTH`를 참조 못함(module-private이라 export 불가한 구조적 제약) | `idempotency.interceptor.spec.ts:1225-1226` | 조치 불요 |
| 14 | 테스트 | `readKey()`의 `typeof raw !== 'string'` 분기가 배열 케이스 1건만 커버 — Express 타입 시스템이 배열 외 non-string 표면을 사실상 닫아 둠 | `idempotency.interceptor.ts:424`, 테스트 `idempotency.interceptor.spec.ts:1286-1310` | 조치 불요, 우선순위 낮음 |
| 15 | 테스트 | `makeContext()`의 `idempotencyKey` 삼항이 "헤더 값이 빈 문자열"과 "헤더 자체 없음"을 구분 못함 — `readKey()`가 두 입력 모두 `null`로 처리해 관측 가능한 차이 없음(기존 라운드에서 확인·유예된 항목) | `idempotency.interceptor.spec.ts:120-122` | 조치 불요 |
| 16 | 테스트 | `bodyHashOf()` 테스트 헬퍼가 프로덕션 `hashBody()`와 동일 알고리즘을 손으로 재구현(mirror-implementation) — 파일 전역 기존 관행의 연장, 갭은 실질적으로 좁음 | `idempotency.interceptor.spec.ts:183-186` vs `idempotency.interceptor.ts:428-433` | 조치 불요 |
| 17 | 문서화 | `spec/data-flow/15-external-interaction.md`의 "전 경로 fail-open(warn)" 서술이 이번 diff로 더 정밀해진 코드 사실(경로 1은 warn 없음)을 아직 반영하지 못함 — developer 권한 밖, 2차례 consistency-check가 이미 WARNING 등재 + plan에 planner 인계 기록 완료 | `plan/in-progress/backend-lint-gate-broken-on-main.md:665-672` | planner 턴에서 spec 갱신(이미 계획됨) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `isHttpStatusCode()`/`rawKey===null` 전환은 입력 검증 강화, 신규 인젝션·인증 우회·시크릿 노출 없음. 캐시 statusCode 유효범위가 실제 쓰기 경로보다 넓지만 외부 입력 도달 불가(INFO) |
| requirement | NONE | R8(캐시 대상 닫힌 목록) 쓰기 경로 미변경, fail-open 원칙 정확히 구현. `hashBody` 문자열 분기 미검증 등 3건 회색지대 INFO, 선행 4라운드 WARNING 전부 반영 재확인 |
| scope | NONE | 발견 없음. 실질 변경 4파일이 plan이 예고한 두 항목과 정확히 대응, 나머지 60파일은 리뷰 워크플로 정상 산출물 |
| side_effect | NONE | `rawKey===null` 전환·`makeContext` body 정규화 변경 모두 관측 가능한 부작용 없음(전수 재확인). 전역변수·환경변수·네트워크·파일시스템 표면 변경 없음 |
| maintainability | NONE | 신규 결함 없음. `intercept()` 다중 책임·에러포맷 반복·스펙파일 크기·warnSpy 보일러플레이트 등 5건은 전부 기존 유예 항목 재확인 |
| testing | NONE | 56/56 pass, 신규 경계값 15건 확인. 뮤테이션 직접 주입(하한 확대, 빈 문자열 검사 제거) 2건 모두 RED 재확인. 커버리지 갭·격리 문제 없음 |
| documentation | NONE | CHANGELOG/JSDoc/docstring 색인/plan 개수 정정 모두 반영 확인. 유일 잔여 항목(spec/data-flow 정밀도 격차)은 이미 planner 인계 기록된 추적 항목 |

## 발견 없는 에이전트

scope — 실질 발견사항 없음(범위 이탈 없음).

## 권장 조치사항

1. (선택, 낮은 우선순위) `hashBody()`의 문자열 `body` 분기를 검증하는 테스트 1건 추가 — 현재 신설된 "경계값" 블록조차 이 분기를 행사하지 않음(#5).
2. (선택, 낮은 우선순위) `statusCode` 손상과 `bodyHash` 불일치가 동시에 발생하는 조합에 대한 캐너리 테스트 추가 — 현재 우선순위 동작은 합리적이나 미고정(#6).
3. (이미 계획됨, planner 턴) `spec/data-flow/15-external-interaction.md`의 fail-open 서술을 코드의 정밀한 5-path 동작(경로 1은 warn 없음)에 맞춰 갱신 — developer 권한 밖, consistency-check가 이미 WARNING 등재 및 인계 완료(#17).
4. 나머지 유지보수성 백로그(`intercept()` 책임 분리, 에러 포맷 헬퍼, warnSpy 보일러플레이트)는 해당 파일을 다음에 만질 때 일괄 재검토 — 이번 PR 범위에서 긴급성 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 실행된 7명 전원이 강제 화이트리스트 대상이며 전원 결과 확보 확인됨(미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff와 무관 (해당 없음, 상세 사유는 `_routing_decision.json` 참고) |
  | architecture | 상동 |
  | dependency | 상동 (package.json/lockfile 변경 없음) |
  | database | 상동 (DB 스키마/쿼리 변경 없음) |
  | concurrency | 상동 (동시성 로직 미변경) |
  | api_contract | 상동 (공개 API/엔드포인트 변경 없음) |
  | user_guide_sync | 상동 (사용자 가이드 대상 변경 없음) |
