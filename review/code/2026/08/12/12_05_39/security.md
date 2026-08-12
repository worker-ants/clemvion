# 보안(Security) 리뷰 결과

## 검토 범위

이 델타는 backend eslint `no-unsafe-*` 잔여 warning(46→21 이후 남은 자리들과 그 처분 커밋 이력)을
처분하는 **타입 전용(type-only)** 변경이다. 실제 코드 파일 12개(`package.json` 스크립트 플래그
1개 + TS 소스 11개)와, 이전 리뷰 세션(`11_06_12`)의 산출물 문서 9개(`plan/`, `review/code/...`)가
같은 diff 범위에 포함되어 있다. 문서 파일은 코드가 아니므로 보안 관점에서는 참고만 하고, 실제
런타임 동작에 영향을 주는 11개 TS 파일 diff 를 중심으로 분석했다.

## 발견사항

- **[INFO]** 동시성 admission-control 쿼리의 결과 shape 가 컴파일 타임 단언에만 의존한다 — 이전 세션에서 이미 지적·유예된 항목의 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2911` (게이트 숫자 기준, 함수: 동시 실행 admission 트랜잭션 블록)
  - 상세: `const rows = await m.query<{ id: string }[]>(...)` 로 제네릭만 추가됐고 런타임 검증(`Array.isArray` 등)은 없다. `EntityManager.query` 가 실제로 기대와 다른 shape 을 반환하면(예: 드라이버 버전 변경으로 `RETURNING` 결과가 다른 형태가 되는 등) `rows.length`는 `undefined`가 되고 `rows.length === 1`은 `false`가 되어 **admission이 거부되는 방향(fail-closed)**이다 — cap 우회로 이어지지 않는다. 이 커밋이 새로 만든 위험이 아니라 수정 전에도 암묵 `any`로 동일하게 `.length`를 읽던 자리이며, `plan/in-progress/backend-lint-gate-broken-on-main.md`에 하드닝 제안이 유예 사유와 함께 이미 기록되어 있다(§Rationale: emit 바이트 동일 불변식 유지 목적).
  - 제안: 신규 조치 불요(이미 추적 중). 후속 세션에서 `Array.isArray(rows)` 가드를 추가할 때는 이 파일의 다른 `.query<T>()` 호출부(`:8164`, `:8450`)와 일관된 방식으로 넣을 것.

- **[INFO]** `workspace-reflection-canary.ts`의 `as object` 제거가 cross-tenant 가드 캐너리의 판별 로직에 영향 없음을 시그니처 대조로 확인
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (함수 `countWorkspaceIdConsumingRoutes`, `handlerConsumesWorkspaceId(cls, handler)` 호출부)
  - 상세: `handlerConsumesWorkspaceId(controllerClass: object, handler: Function): boolean` (`codebase/backend/src/common/decorators/workspace.decorator.ts:61-67`)로 첫 인자 타입이 `object`다. `cls`는 직전 `if (typeof cls !== 'function') continue;`로 TS가 이미 `Function`으로 좁혀 놓았고, `Function`은 구조적으로 `object`의 부분집합이라 `as object` 캐스트 없이도 할당 가능하다. 이 파일은 `RolesGuard`의 cross-tenant 멤버십 검증 대상 판별(`#1103` 결함 클래스)을 지키는 fail-closed 캐너리라 조금이라도 판별 로직이 바뀌면 CRITICAL 후보인데, 이번 변경은 순수 `no-unnecessary-type-assertion` 정리이고 런타임 인자 값·타입 모두 동일하다. 문제 없음(발견 아님, 확인 목적 기재).

- **[INFO]** `idempotency.interceptor.ts`의 `getResponse<HttpResponseLike>()` 도입이 기존 방어적 `typeof` 체크를 죽은 코드로 만들지 않도록 의도적으로 얕은 구조 타입을 선택함 — 긍정적 설계
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34-37`(신규 `interface HttpResponseLike`), `:105`, `:128`(적용부)
  - 상세: `HttpResponseLike`는 `status`/`statusCode`를 optional 로만 선언해, 이어지는 `typeof res.status === 'function'`/`typeof res.statusCode === 'number'` 방어가 정적으로 항상 참이 되지 않는다. 만약 여기에 express `Response`를 직접 박았다면 이 인터셉터가 express/fastify 어댑터와 테스트 mock을 가리지 않고 도는 지점이라 방어 로직이 죽은 코드가 될 뻔했다. 제네릭 타입 인자는 컴파일 타임에만 영향을 주므로 `context.switchToHttp().getResponse()`의 실제 런타임 반환값·`res.status(...)` 호출 여부는 변경 전과 동일하다. 문제 없음(발견 아님, 확인 목적 기재).

- **[INFO]** 하드코딩된 시크릿·SQL/커맨드 인젝션·인증 우회 패턴 미검출
  - 위치: 전체 diff (`git diff origin/main...HEAD -- codebase/backend/`)
  - 상세: 시크릿 리터럴 패턴(`api_key|secret|password|token\s*[:=]\s*['"]…`) grep 결과 0건. SQL은 전부 파라미터 바인딩(`$1`, `$2`, ...)을 유지하며 문자열 결합 없음(`triggers.service.ts`의 `let result: SetupResult`, `execution-engine.service.ts`의 쿼리 모두 기존 파라미터 바인딩 그대로). `migrate-node-output-refs.ts`의 정규식들은 중첩 정량자가 없는 선형 패턴이라 ReDoS 형태가 아니며, 해당 스크립트는 사용자 입력이 아니라 저장소 내부 마이그레이션 대상 문자열만 처리하는 1회성 CLI 스크립트다. 인증/인가 관련 분기(`RolesGuard`, `@Roles()`, 멤버십 검증) 코드는 이 diff에서 전혀 수정되지 않았다.

## 요약

이 델타는 TypeScript 컴파일러 경계(`Array.isArray` → `any[]` 좁힘, `EntityManager.query`의 `Promise<any>`, `.bind`의 오버로드 `any` 반환, `Map.keys().next().value`의 `BuiltinIteratorReturn`, `TransformFnParams.value`의 `any`, `getResponse<T = any>()`)에서 새던 암묵적 `any`를 명시 타입·제네릭·구조적 인터페이스로 막는 **순수 타입 강화** 작업이며, 새로운 인젝션·인증 우회·하드코딩 시크릿·안전하지 않은 암호화 패턴은 발견되지 않았다. 유일하게 실질적 판단이 필요했던 자리(`execution-engine.service.ts`의 admission-control `m.query` 결과 shape 미검증)는 이 커밋이 만든 신규 위험이 아니고, 실패 방향이 fail-closed 이며, 이미 이전 리뷰 라운드에서 지적·문서화·의도적 유예가 완료된 항목의 재등장이라 이번에도 정보성으로만 남긴다. `workspace-reflection-canary.ts`처럼 cross-tenant 격리에 직결되는 보안 캐너리 파일의 타입 단언 제거도 시그니처를 직접 대조해 런타임 행위 불변을 확인했다. 전반적으로 이 델타가 도입한 새로운 보안 위험은 없다.

## 위험도
NONE
