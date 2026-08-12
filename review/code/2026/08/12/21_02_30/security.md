# Security Review — EIA §R8 멱등 캐시 키 스코프 (execution + route)

## 개요

`IdempotencyInterceptor` 의 Redis 캐시 키가 `Idempotency-Key` 헤더 값 단독(`interaction:idempotency:<key>`)이었던 것을 `<executionId>:<route>:<key>` 로 스코프하는 변경. 이는 CWE-639(Authorization Bypass Through User-Controlled Key) 류의 **cross-tenant 캐시 응답 유출/재생** 취약점을 닫는 보안 수정 자체다. 4개 파일(CHANGELOG.md, `idempotency.interceptor.ts`, 그 `.spec.ts`, `external-interaction.e2e-spec.ts`) 모두 이 수정과 회귀 테스트에 관한 것이다.

## 검증한 핵심 로직

- `executionId` 는 `req.interaction?.executionId` — `InteractionGuard.canActivate()` (`interaction.guard.ts`) 가 `iext`/`itk` 토큰 검증을 **통과한 뒤에만** 합성해 `req.interaction` 에 세팅한다(`iext` 는 `token.sub === executionId` 매칭, `itk` 는 trigger↔execution 매칭). Guard 는 인터셉터보다 먼저 실행되므로, 클라이언트가 이 값을 직접 위조해 다른 execution 의 캐시 네임스페이스로 진입할 수 없다 — 코드 주석의 "클라이언트가 조작할 수 없다" 주장은 실제로 확인됨.
- `route` 는 `context.getHandler().name` — `InteractionController` 의 `interact`/`cancel` 두 메서드명과 일치하며, 이 인터셉터는 현재 이 두 라우트에만 부착돼 있어(grep 확인) route 축 충돌 가능성이 없다. 백엔드 빌드는 `nest build`(tsc 기반, webpack/terser 없음)라 함수명 mangling 위험도 없다.
- `req.interaction` 부재 시 **전역 키로 fallback 하지 않고 캐시 자체를 skip** (`idempotency.interceptor.ts` intercept 내 `if (!executionId)` 분기) — 이 fail path 가 fail-open 이 아니라 "캐시만 포기, 요청은 통과"이므로 방금 닫은 cross-execution 유출 표면을 다시 열지 않는다. 정확한 설계.
- GET 과 SET 양쪽 모두 스코프된 키를 사용(`storeEntry` 도 같은 `redisKey` 를 받아 적재) — 한쪽만 스코프되는 회귀는 없음. 단위 테스트(`idempotency.interceptor.spec.ts`)와 e2e(IDEM-4, IDEM-5)가 GET/SET 양쪽, execution 축/route 축 양쪽을 모두 상태코드 기반(행동) 단언으로 고정.
- `rawKey`(`readKey()`)는 길이 제한(≤200)과 trim 만 하고 문자 제한은 없지만, 이 값은 파싱되어 돌아오지 않는 불투명 문자열로만 쓰이므로 콜론 등 구분자 포함 여부가 `executionId`/`route` 경계를 혼동시키지 않는다 — 이 자체가 새 인젝션 표면은 아님.

## 발견사항

- **[INFO]** `context.getHandler().name` 에 의한 route 스코프는 현재 코드베이스(빌드 파이프라인에 minifier 없음, 인터셉터가 정확히 `interact`/`cancel` 두 라우트에만 부착)에서는 안전하지만, 향후 이 인터셉터를 다른 컨트롤러의 동명 핸들러(예: 별도 리소스의 `create`)에 재사용하면서 `executionId` 스코프가 같은 값 공간을 공유하게 되는 상황이 오면 route 축이 다시 붕괴할 수 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:113` (`const route = context.getHandler().name;`)
  - 상세: 현재는 위협이 아니며, 회귀 테스트(IDEM-5, e2e)가 route 이름 안정성을 실 파이프라인에서 고정하고 있어 조기 경보 역할도 한다.
  - 제안: 조치 불요. 이 인터셉터를 다른 컨트롤러에 재사용할 때는 컨트롤러 경로 접두 등을 route 세그먼트에 포함하도록 문서화해 두면 향후 실수를 예방할 수 있다.

## 요약

이번 변경은 그 자체가 실제로 존재했던 cross-execution 캐시 응답 재생(IDOR/CWE-639 계열) 취약점에 대한 수정이다. `executionId` 스코프는 Guard 의 토큰 검증을 거친 서버 합성 값에 근거해 클라이언트 위조가 불가능함을 확인했고, `route` 스코프는 `CancelDto` all-optional 특성으로 인한 실제 hash 충돌(interact↔cancel 캐시 재생)을 정확히 겨냥해 닫았다. ctx 부재 시 전역 키로 fallback하지 않고 캐시만 skip 하는 fail-closed 설계, GET/SET 양쪽 스코프 일치, 상태코드 기반(행동) 회귀 테스트(단위 4건 + e2e 2건, mutation 실측으로 단언 순서까지 교정)까지 모두 확인했다. 새로운 인젝션·인증 우회·시크릿 노출·안전하지 않은 암호화 사용은 발견되지 않았다. 유일한 언급 사항은 향후 확장 시나리오에 대한 INFO 수준 설계 참고이며 현재 코드에 대한 실질적 위험은 없다.

## 위험도

NONE
