# 요구사항(Requirement) Review — EIA §R8 idempotency 캐시 범위 (409/410) 2차 재설계

## 배경

이 라운드(`16_53_26`)는 직전 라운드(`16_29_45`)에서 CRITICAL("409/410 캐싱이 도달 불가능한
dead code")로 반려된 1차 조건식-치환 fix를, `catchError` 기반 error-채널 재설계로 다시 고친
결과를 검토한다. `RESOLUTION.md`/plan/`CHANGELOG.md` 스스로 "1차는 실패였다"고 정직하게
기록하고 있어, 이번 검토는 **2차 재설계가 실제로 CRITICAL을 해소했는지**를 코드 실행·spec
line-level 대조로 독립 검증하는 데 집중했다.

## 검증 방법 (액면가로 받지 않음)

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` /
  `idempotency.interceptor.spec.ts` 전체를 `Read`로 직접 열어 대조.
- `interaction.controller.ts`에서 `@HttpCode(HttpStatus.ACCEPTED)`(202)가 `interact`/`cancel`
  두 엔드포인트에 실제로 걸려 있고 `@UseInterceptors(IdempotencyInterceptor)`도 같은 메서드에
  걸려 있음을 확인(CHANGELOG/plan의 재설계 근거 전제 검증).
- `interaction.service.ts`에서 409(`STATE_MISMATCH`)/410(`EXECUTION_TERMINATED`)이 실제로
  `ConflictException`/`GoneException`으로 **throw**됨을 확인(253·431·478·505행).
- `GlobalExceptionFilter`를 읽어, 캐시 히트 시 재구성한 일반 `HttpException(payload, statusCode)`
  이 원래의 `ConflictException`/`GoneException`과 동일한 방식(`instanceof HttpException` →
  `getStatus()`/`getResponse()`)으로 처리되어 클라이언트에 동일한 바디를 재현함을 확인.
- `npx jest idempotency.interceptor.spec.ts` 직접 실행 → **21/21 통과** (RESOLUTION.md의
  "backend unit 통과" 주장을 이 파일 범위에서 재현 확인).
- `npx eslint`·`npx tsc --noEmit`을 두 파일에 대해 직접 실행 → 0 에러.
- `spec/5-system/14-external-interaction-api.md` §R8·`EIA-RL-02`(§3.2 표) 원문을 직접 열어
  구현 조건·docstring과 line-level 대조.

## 발견사항

- **[INFO]** 2차 재설계가 1차 CRITICAL의 근본 원인(성공 채널만 보는 `tap({next})`, 컨트롤러
  `@HttpCode(202)`로 인한 `statusCode===409` 불가능성)을 실제로 제거했음을 독립 검증함.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:163-203`
    (`cacheTapped`), `:88-150`(`intercept` 캐시 히트 분기 `:135-140`), `:228-241`
    (`isErrorStatusCacheable`)
  - 상세: `cacheTapped`가 `tap({next})` 뒤에 `catchError`를 추가해 `next.handle()`이 emit하는
    error notification까지 관측 범위에 넣었다. `catchError` 콜백은 `err instanceof HttpException`
    이고 `isErrorStatusCacheable(err.getStatus())`(409·410)일 때만 `err.getResponse()`를
    캐시에 적재한 뒤 **항상** `throwError(() => err)`로 원 예외를 재던진다 — 캐시 여부와 무관하게
    호출자에게 원래 결과가 그대로 나간다. 캐시 히트 경로(`intercept()` 135-140행)는 대칭적으로
    `isErrorStatusCacheable(cached.statusCode)`가 참이면 `new HttpException(cachedBody, statusCode)`
    로 예외를 재구성해 던진다 — 성공 채널로 돌려주면 원래 409였던 응답이 (컨트롤러 `@HttpCode(202)`
    때문에) 202로 왜곡되는 문제를 정확히 피한다. `GlobalExceptionFilter`가 `getStatus()`/
    `getResponse()`만으로 응답을 조립하므로, 재구성한 일반 `HttpException`도 원본
    `ConflictException`/`GoneException`과 클라이언트 관점에서 동일한 바디를 낸다.
  - 신규 테스트(`makeThrowingHandler`로 실제 error 채널을 행사하는 4건: 409/410/5xx/404)가
    실제로 이 경로를 통과하며 `npx jest` 직접 실행 결과 21/21 GREEN. 이는 1차 라운드의
    "GREEN인데 vacuous"였던 상황과 달리, 이번엔 mock이 실제 파이프라인 형태(예외 throw)를
    반영하므로 신뢰할 수 있는 회귀 고정이다.
  - 제안: 없음 — CRITICAL 해소를 확인.

- **[INFO]** Spec EIA §R8·`EIA-RL-02` 원문과 구현이 line-level로 일치.
  - 위치: `spec/5-system/14-external-interaction-api.md:1053-1059`(§R8 본문),
    `:140`(`EIA-RL-02` 표 행) ↔ `idempotency.interceptor.ts:228-241`(`isErrorStatusCacheable`
    docstring·구현), `:171-178`(성공 채널 `2xx` 분기)
  - 상세: spec 원문 "캐시 대상은 닫힌 목록 — `2xx`·`409`·`410` — 이고 `statusCode===400`과
    `statusCode>=400` 둘 다 오답"이라는 서술이 `isErrorStatusCacheable`의 docstring·구현
    (`statusCode === 409 || statusCode === 410`)과 성공 채널의 `(200<=x<300)` 조건에 문자
    그대로 대응한다. `spec/data-flow/15-external-interaction.md:258`(§2.2 표)·`:98`(§1.2
    시퀀스)의 "2xx·409·410 응답을 캐시"도 이 구현과 정합하며, 삭제된 "⚠️ 현행 구현 갭" caveat도
    이제 실제로 해소됐으므로 삭제 상태가 정확하다(SPEC-DRIFT 아님 — spec 이 정의한 목표를
    구현이 이번에 실제로 충족한 케이스).
  - 제안: 없음.

- **[INFO]** 직전 라운드 WARNING #2·#3·#5·#6(CHANGELOG 클라이언트 영향 서술, plan 완료 마킹,
  3xx 조용한 축소, 테스트 파일 docstring)이 모두 코드와 다시 일치하는 상태로 갱신됨을 확인.
  - 위치: `CHANGELOG.md:3-27`, `plan/in-progress/backend-lint-gate-broken-on-main.md:549-610`,
    `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:174-177`
    (3xx 배제 주석), `idempotency.interceptor.spec.ts:352-365`(3xx 회귀 테스트),
    `idempotency.interceptor.spec.ts:11-15`(docstring 갱신)
  - 상세: CHANGELOG는 "조건식만 바꿔서는 고쳐지지 않았다"는 1차 실패 경위까지 포함해 정확한
    최종 상태를 서술한다. plan 체크박스는 `[x]`로 유지되나 본문에 "1차 완료는 실패였다"는 사실을
    솔직하게 남겨(`:592-610`) 시기상조 완료 마킹이 아니라 실제 완료 근거로 뒷받침된다. 3xx
    (`304`) 회귀 테스트가 실제로 추가돼 있고 `statusCode < 200 || statusCode >= 300` 주석도
    "이 API는 3xx를 내지 않는다"를 명시한다. 테스트 파일 모듈 docstring(11-15행)도 "닫힌
    목록을 고정하는 회귀 테스트"로 갱신되고 error-채널 mock이 왜 필요한지까지 설명한다.
  - 제안: 없음.

- **[INFO]** `Idempotency-Key` e2e 부재는 여전히 남아 있으나, 이번 diff 범위 밖으로 명시적으로
  분리·추적됨을 확인 — 은폐된 갭이 아님.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:539-545`
  - 상세: 실제 Nest 파이프라인(예외 필터·`@HttpCode`·직렬화)을 통과하는 e2e는 여전히 0건이라,
    이번 단위 테스트가 통과해도 "실서버에서" 완전히 검증된 것은 아니다. 다만 이 항목은
    `[ ]`(미완료)로 plan에 명시 등재돼 있고, RESOLUTION.md도 "docker 인프라가 필요해 별 작업으로
    분리"라고 이유를 남겼다 — 문서·plan·CHANGELOG가 이 잔여 리스크를 숨기지 않는다. 단위 테스트
    수준에서는 이번에 실제 예외 throw 경로를 행사하고, 컨트롤러 데코레이터·서비스 throw 지점을
    소스 대조로 직접 확인했으므로 회귀 리스크는 낮다고 판단하나, e2e 없이는 100% 확정은 아니다.
  - 제안: (선택) `Idempotency-Key` e2e를 가까운 후속 스프린트에서 처리 — 이미 plan에 등재돼
    추가 조치 불요.

- **[INFO]** `410 도 캐시된다` 테스트는 `stored.statusCode`만 단언하고 `409` 테스트처럼
  `stored.responseJson`(payload) 내용까지는 단언하지 않음 — 잔존 커버리지 비대칭.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:286-305`
  - 상세: 직전 라운드 INFO #10("410 테스트가 statusCode 미단언")은 조치됐으나(`stored.statusCode
    ).toBe(410)` 추가), `409` 테스트(`:255-284`)가 갖춘 `JSON.parse(stored.responseJson)
    .toMatchObject({error: {code: 'EXECUTION_TERMINATED'}})` 수준의 payload 단언은 410 테스트에
    없다. `storeEntry`가 두 상태코드에 동일 로직으로 적용되므로 회귀 위험은 낮지만, 완전한 대칭은
    아니다.
  - 제안: (선택, 경미) `409` 테스트와 동형으로 `stored.responseJson` payload 단언 추가.

## 요약

직전 라운드(`16_29_45`)의 CRITICAL — "409/410 캐싱 분기가 RxJS error 채널을 보지 못해
프로덕션 트래픽에서 도달 불가능한 dead code"였다는 지적 — 은 이번 재설계(`cacheTapped`에
`catchError` 추가 + 캐시 히트 시 `409`/`410`을 `HttpException`으로 재throw)로 실제로
해소됐음을 코드 직접 대조·`interaction.controller.ts`의 `@HttpCode(202)` 확인·
`interaction.service.ts`의 실제 throw 지점 확인·`GlobalExceptionFilter`의 재구성 예외 처리
방식 확인·`npx jest`/`eslint`/`tsc` 직접 실행(21/21 통과, 0 에러)으로 독립 검증했다. Spec EIA
§R8/`EIA-RL-02` 원문과 구현이 닫힌 목록(`2xx`·`409`·`410`, `>=400`/`===400` 두 오답 모두 배제)
수준에서 line-level로 일치하며, CHANGELOG·plan·spec `data-flow/15`·테스트 docstring 등 직전
라운드 WARNING이 지적했던 문서-실제 괴리도 모두 사실과 일치하는 방향으로 갱신됐다(관련 spec
caveat 삭제는 SPEC-DRIFT가 아니라 실제로 갭이 닫힌 것). 유일하게 남는 잔여 리스크는 실제 Nest
전체 파이프라인을 통과하는 e2e 부재인데, 이는 plan에 명시적으로 등재·추적되고 있어 은폐된 갭이
아니다. 이번 라운드에서 새로운 CRITICAL/WARNING은 발견되지 않았다.

## 위험도
NONE
