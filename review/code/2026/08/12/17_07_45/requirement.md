# 요구사항(Requirement) 리뷰 — EIA §R8 idempotency 캐시 범위 (409/410), 최종 확인 라운드

## 배경

이 세션은 이미 2회의 리뷰 라운드(`16_29_45` CRITICAL 1건 발견→재설계, `16_53_26` WARNING 1건
발견→조치)를 거쳤다. 이번 `17_07_45` 라운드의 diff 는 그 두 라운드의 산출물(RESOLUTION/SUMMARY
등 review 아티팩트)까지 포함한 origin/main 대비 누적 diff다. 과거 라운드의 판정을 그대로 받지
않고, 실제 코드를 직접 읽고 **무수정 mutation 프로브**로 재검증했다.

## 검증 방법

1. `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`,
   `idempotency.interceptor.spec.ts` 전체를 직접 Read.
2. `spec/5-system/14-external-interaction-api.md` §R8 원문, `spec/data-flow/15-external-interaction.md`
   §2.2 표를 직접 Read 해 line-level 대조.
3. `interaction.controller.ts`(`@HttpCode(202)` 확인), `interaction.service.ts`(409/410 throw
   지점 확인), `http-exception.filter.ts`(캐시 재현 시 `HttpException` 이 원 예외와 동일하게
   처리되는지 확인)를 직접 Read.
4. `npx jest idempotency.interceptor.spec.ts` 실행 — 21/21 통과 확인.
5. **무수정 mutation 프로브** — `isErrorStatusCacheable` 을 `statusCode >= 400` 으로 바꿔 재실행 →
   `400`·`404` 테스트 2건 RED 확인(파일은 즉시 원복, `git diff` clean 확인 후 재실행으로
   21/21 복구 확인). 이전 라운드가 자기 mock 을 액면가로 받아 CRITICAL 을 놓쳤던 전철을
   밟지 않기 위해, 이번에도 직접 실측했다.

## 발견사항

- **[INFO]** `isErrorStatusCacheable` docstring 의 "네 경우 모두 spec 에 회귀 테스트가 있다" 라는
  문장이 어색하다 — 회귀 테스트는 spec 문서가 아니라 `idempotency.interceptor.spec.ts` 에 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:237`
  - 상세: 기능에는 영향 없는 문구 표현 문제. "spec 에 대응하는 회귀 테스트가 있다" 류로 바꾸면
    더 정확하다.
  - 제안: 선택적 경미한 wording 수정. 이번 PR 을 막을 사유 아님.

## 확인된 사항 (문제 없음 — 근거를 남겨 둔다)

- **§R8 닫힌 목록과 구현의 line-level 일치**: spec 원문 "**캐시 대상은 닫힌 목록이다**: 위에
  열거한 `2xx`·`409`·`410` 이 전부다... `statusCode === 400` 은... `statusCode >= 400` 은
  반대로 `409`·`410` 을 떨궈..." (`spec/5-system/14-external-interaction-api.md` §R8) 가
  `isErrorStatusCacheable(statusCode) { return statusCode === 409 || statusCode === 410; }`
  (성공 쪽은 `cacheTapped` 내부 `statusCode < 200 || statusCode >= 300` 인라인 조건)로 정확히
  옮겨졌다. `spec/data-flow/15-external-interaction.md:258` 의 "⚠️ 현행 구현 갭" caveat 삭제도
  이제 실제로 참 — 이전 두 라운드에서 지적됐던 "spec 은 맞는데 코드가 못 따라간다" 상태가
  **실측으로 해소**됐다(mutation 프로브로 재확인).
- **RxJS 채널 분리가 실제로 살아 있다**: `409`·`410` 은 `interaction.service.ts` 가
  `ConflictException`(478·505행)/`GoneException`(253·431행) 으로 throw 하므로 error 채널로
  흐르고, `cacheTapped()` 는 `tap({next})` 뿐 아니라 `catchError` 도 갖춰 `err instanceof
  HttpException` 판정 후 `isErrorStatusCacheable(err.getStatus())` 로 적재한다(같은 파일
  163-203행). 컨트롤러가 `@HttpCode(HttpStatus.ACCEPTED)`(202) 로 고정돼 있음을
  `interaction.controller.ts:65,111` 에서 직접 확인 — 과거 CRITICAL 의 전제("성공 채널의
  `res.statusCode` 는 409 가 될 수 없다")가 실측과 일치한다.
  이 배선이 실제로 도는지는 mock 신뢰가 아니라 **mutation 으로 직접 확인**했다
  (`isErrorStatusCacheable` → `>= 400` 뮤턴트에서 `400`·`404` 테스트 RED).
- **캐시 재현이 왜곡 없이 재현된다**: 캐시 히트 시 `409`/`410` 이면
  `throw new HttpException(JSON.parse(cached.responseJson), cached.statusCode)`
  (`idempotency.interceptor.ts:135-140`) 로 원 예외를 그대로 재현한다.
  `GlobalExceptionFilter.catch()` (`http-exception.filter.ts:52-77`) 는 `exception instanceof
  HttpException` 만 보고 하위 타입을 구분하지 않으므로, 일반 `HttpException` 으로 재구성해도
  `error.code`/`error.message` 가 원본과 동일하게 재현된다 — 다만 `requestId` 는
  `uuidv4()` 로 매 응답마다 새로 발급되어 재현 대상이 아니다. CHANGELOG.md:28-29 이 정확히 이
  예외를 명시하고 있어 문서와 동작이 일치한다.
- **닫힌 목록 경계가 회귀 테스트로 잠겨 있다**: `409`(캐시)·`410`(캐시)·`400`(제외, 이번에
  error 채널로 교체됨)·`5xx`(제외)·`404`(제외)·`3xx`(제외, 조용한 축소 아님 — docstring 에
  명시) 6개 분기 모두 `makeThrowingHandler`/성공 mock 을 상황에 맞게 써서 실제 파이프라인을
  재현한다. `=== 400` 오답과 `>= 400` 오답을 각각 가르는 자매 테스트 쌍이 존재해 두 축약
  오류 모두 재발 시 잡힌다(RESOLUTION.md 뮤테이션 표와 이번 세션 재실측이 일치).
- **문서 3종(CHANGELOG·plan·spec) 이 실제 동작과 사실 정합**: CHANGELOG 는 1차 시도가
  실패였다는 경위와 재설계 근거를 정직하게 담고 있고(`CHANGELOG.md:13-18`), plan 체크리스트는
  1차 "완료" 판단이 틀렸다는 사실과 2차 재설계를 그대로 남겼다(`plan/in-progress/
  backend-lint-gate-broken-on-main.md:592-611`), spec 캐비트 삭제는 이제 참이다. 세 문서 모두
  "코드가 spec 을 따라잡았다"는 사실과 어긋나지 않는다 — SPEC-DRIFT 아님, 오히려 이전
  라운드가 지적한 "코드가 spec 요구를 실제로 충족 못 했다"는 상태가 **실측으로 해소**됨.

## 요약

이번 라운드는 `IdempotencyInterceptor` 의 §R8 닫힌 목록(`2xx`·`409`·`410`) 캐싱을 다루는
전체 diff(CHANGELOG·구현·테스트·plan·spec, 그리고 두 차례 선행 리뷰 아티팩트)를 대상으로
했다. 과거 라운드가 지적한 CRITICAL(dead code)·WARNING(자매 테스트 케이스 누락)은 모두
실측으로 해소가 확인됐다 — 이번에도 그 사실을 신뢰하지 않고 무수정 mutation 프로브
(`isErrorStatusCacheable` → `>= 400`)로 재검증했으며, 예상대로 `400`·`404` 테스트가 RED가
되어 error 채널 배선과 닫힌 목록 조건이 실제로 살아 있음을 직접 확인했다. spec
(`5-system/14-external-interaction-api.md` §R8, `data-flow/15-external-interaction.md` §2.2)
과 구현이 line-level 로 일치하고, 캐시 재현 시 `requestId` 를 제외한 `statusCode`/`code`/
`message` 가 왜곡 없이 재현됨도 예외 필터 소스 대조로 확인했다. 새로 발견된 문제는 없으며,
유일한 발견은 docstring 문구 하나("spec 에 회귀 테스트가 있다")의 경미한 표현 오류로 기능에
영향 없는 INFO 수준이다.

## 위험도

NONE
