# 보안(Security) Review — 델타 `origin/main...HEAD` (5회차 라운드, 신규 커밋 `cec79b004`)

## 조사 방법

`git log --oneline origin/main..HEAD` 로 브랜치 전체 9개 커밋을 확인하고, `git diff origin/main...HEAD --stat -- codebase/` 로 실질 코드 diff 가 여전히 14개 파일(타입 주석/제네릭/단언 + `README.md`/`package.json` 게이트 문구뿐)임을 재확인했다. 이번 라운드가 처음 보는 신규 커밋은 `cec79b004`(`git show cec79b004`로 직접 열람) 하나이며, 그 내용은 `idempotency.interceptor.ts` 의 **주석 텍스트 3곳 정정**(§R8 오귀속 바로잡기)과 `idempotency.interceptor.spec.ts` 의 **테스트 헬퍼 추출(`makeInterceptor`) + 저장값 단언 추가 + 테스트 제목의 마크다운 제거**뿐이다. 소스를 직접 Read 해 현재 `idempotency.interceptor.ts` 전문, `readKey`/`hashBody`(Redis 키 구성·해싱)를 대조했고, `spec/5-system/14-external-interaction-api.md` §R8 원문을 직접 확인했다.

## 발견사항

- **[INFO]** Idempotency 캐시 제외 범위가 Spec EIA §R8 보다 넓다 — 4·5라운드에 걸쳐 이미 추적된 선재 결함, 이번 커밋은 이를 고치지 않고 **주석만** 정정
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`cacheTapped()` 메서드 docstring, `if (statusCode >= 400) return;` 조건부 — 이 조건 자체는 이번 diff 범위 밖, 2026-05-21 원본 구현부터 존재)
  - 상세: R8 원문(`spec/5-system/14-external-interaction-api.md` §R8, 직접 확인)은 "4xx 응답 중 `400 VALIDATION_ERROR` **만** 캐시에서 제외하고 그 외(2xx/`409 Conflict`/`410 Gone`)는 캐시한다"고 명시한다. 실제 구현은 `statusCode >= 400` 하나로 409·410·모든 5xx 를 함께 캐시 제외해, 같은 `Idempotency-Key`+같은 body 로 409/410 을 재요청하면 캐시 재생 대신 downstream 이 매번 재실행된다. 보안 관점에서는 인증 우회·정보 노출·인젝션이 아니라 **멱등성 계약(EIA-RL-02) 미충족** 성격의 결함이다 — 실패 방향은 "캐시를 안 써서 재실행됨"이라 데이터가 새거나 접근 통제가 뚫리는 방향이 아니다. 이번 커밋(`cec79b004`)은 이 동작을 고치지 않고, 그동안 소스 코드 주석이 R8 을 반대로 인용하던 것만 정정했다 — 주석 텍스트 변경은 emit(런타임 바이트)에 영향이 없음을 직접 확인(diff 는 `/** ... */`/`//` 블록만 변경, 조건문·분기 로직 0줄 변경).
  - 제안: 신규 조치 불요 — `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속에 이미 등재되어 있고 `idempotency.interceptor.spec.ts` 의 "409 도 캐시되지 않는다" 캐너리가 현재 동작을 고정한다. 후속 세션에서 `statusCode === 400` 으로 좁힐 때는 5xx 캐싱 여부를 spec 으로 별도 확인할 것(이미 커밋 메시지·테스트 주석에 그 경고가 남아 있음).

- **[INFO]** admission-control(`execution-engine.service.ts`) 쿼리 결과 shape 이 여전히 런타임 미검증 — 4라운드 연속 동일 판정, 이번 커밋은 이 파일을 건드리지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`m.query<{ id: string }[]>(...)` 자리, 이번 diff 범위 밖)
  - 상세: `rows.length === 1` 이 동시 실행 상한(admission control) 판정의 유일한 근거이며 `Array.isArray(rows)` 같은 런타임 가드가 없다. 다만 실패 방향이 fail-closed(`undefined === 1` → false → admission 거부)라 cap 우회로 이어지지 않고, 이 커밋이 새로 만든 위험이 아니다(수정 전에도 암묵 `any` 로 동일하게 신뢰).
  - 제안: 신규 조치 불요 — plan 에 하드닝 제안이 이미 유예 사유와 함께 기록됨.

- **[NONE]** Redis 키 구성·해싱에 인젝션 여지 없음 — 재확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` `readKey()`(`:164-169`)·`hashBody()`(`:171-176`), 둘 다 이번 diff 밖(불변)
  - 상세: `Idempotency-Key` 헤더 원문은 `readKey()` 에서 문자열 타입·trim·길이(`MAX_KEY_LENGTH=200`) 검증을 거친 뒤에만 `redisKey = \`${REDIS_KEY_PREFIX}${rawKey}\`` 로 사용되고, `ioredis` 의 `get`/`set` 은 인자를 커맨드 프로토콜 레벨에서 값으로 취급하므로(Lua `EVAL` 등 커맨드 인젝션 표면이 아님) 문자열 결합 자체가 인젝션이 되지 않는다. 요청 body 는 `JSON.stringify` 후 SHA-256 해시로만 쓰인다.

- **[NONE]** `workspace-reflection-canary.ts` — cross-tenant 격리 판별 캐너리 로직 불변, 재확인
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`(이번 diff 범위 밖, 이전 라운드부터 동일)
  - 상세: `handlerConsumesWorkspaceId(cls, handler)` 호출부의 `as object` 제거는 `typeof cls !== 'function'` 가드로 이미 `Function` 으로 좁혀진 값을 그대로 넘기는 것이라 런타임 인자·타입 모두 불변이다. `RolesGuard` 판별 로직 자체는 이 브랜치 전체에서 건드려지지 않았다.

- **[NONE]** 하드코딩된 시크릿·SQL/커맨드 인젝션·인증 우회 패턴 — 미검출 (재확인)
  - 위치: `git diff origin/main...HEAD -- codebase/backend/` 전체
  - 상세: 이번 커밋(`cec79b004`) 포함 누적 diff 14개 코드 파일 전부 타입 주석/제네릭/`as` 단언 또는 주석 텍스트 정정뿐이며, 신규 `import`·신규 API 엔드포인트·인증/인가 분기(`RolesGuard`, `@Roles()`, 멤버십 검증) 변경은 없다. 시크릿 리터럴 패턴 grep 0건.

## 요약

이번 라운드(5회차)가 처음 마주하는 신규 커밋 `cec79b004` 는 `idempotency.interceptor.ts` 의 **주석 텍스트 3곳**을 Spec EIA §R8 원문과 정합하게 정정하고, 스펙 대비 캐시 제외 범위가 넓다는 선재 결함을 docstring 에 명시적으로 남긴 것과, 해당 spec 을 검증하는 스펙 테스트의 헬퍼 추출·저장값 단언 보강·테스트 제목 정리로 구성된다 — 런타임 로직(조건문·분기·쿼리·API 계약)은 한 글자도 바뀌지 않았다. 이 커밋을 포함한 브랜치 전체 누적 코드 diff(14개 backend 파일)는 여전히 라이브러리 경계의 암묵적 `any` 를 명시 타입으로 막은 순수 컴파일타임 강화이며, 새로운 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화·평문 전송 패턴은 발견되지 않았다. 유일하게 실질적인 보안 판단이 필요했던 두 자리 — idempotency 캐시가 Spec EIA §R8 보다 넓게 캐시를 제외하는 것(멱등성 계약 미충족, 데이터 유출·인증 우회 아님)과 admission-control 쿼리의 런타임 shape 미검증(fail-closed 방향) — 은 모두 이 PR 이전부터 있던 선재 결함이고 4~5라운드에 걸쳐 이미 추적·유예·캐너리로 고정되어 있어 이번에도 INFO 로만 재확인한다. Redis 키 처리(`readKey`/`hashBody`)에 인젝션 여지가 없음과 cross-tenant 격리 캐너리(`workspace-reflection-canary.ts`)의 판별 로직이 불변임도 재검증했다. 신규 보안 위험 없음.

## 위험도

NONE

STATUS: OK
