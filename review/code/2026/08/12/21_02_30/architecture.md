# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 캐시 스코프의 `route` 축을 `context.getHandler().name` 리플렉션에 암묵적으로 의존
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:113` (`const route = context.getHandler().name;`), 소비: `:115` (`redisKey` 조립)
  - 상세: 라우트 축 스코프(§R8)를 컴파일 타임에 강제되는 명시적 식별자(예: 데코레이터 인자, enum)가 아니라 런타임 리플렉션(`Function.name`)으로 얻는다. 현재는 `interact`/`cancel` 두 핸들러만 이 인터셉터를 쓰고, 빌드가 minify 없는 표준 `tsc`(Nest CLI, `nest-cli.json` 확인됨)라 이름이 안정적으로 보존되므로 실질 위험은 낮다. e2e(IDEM-5)가 `getHandler().name` 이 실제로 그 값을 낸다는 것까지 고정해 뒀다. 다만 "핸들러 이름이 스코프 축의 유일한 소스"라는 불변식은 타입 시스템이 강제하지 않는다 — 향후 다른 컨트롤러가 같은 `IdempotencyInterceptor` 를 재사용하면서 우연히 동일한 메서드명(`interact`/`cancel`)을 쓰면, 서로 다른 리소스 네임스페이스인데도 조용히 같은 스코프 축 값을 공유하게 된다(단, `executionId` 가 여전히 분리축이라 실제 충돌엔 execution 까지 같아야 한다는 이중 조건이 있어 실전 발생 가능성은 낮다).
  - 제안: 현재 범위에서는 수정 불필요(과설계 방지). 이 인터셉터가 세 번째 컨트롤러/핸들러로 확장될 때, `route` 를 리플렉션 대신 명시적 상수(예: `@IdempotencyRoute('interact')` 커스텀 데코레이터 또는 controller-local enum)로 바꾸는 것을 검토.

- **[INFO]** 캐시 키 포맷 문자열이 프로덕션·유닛 테스트·e2e 테스트 세 곳에 독립적으로 하드코딩
  - 위치: 프로덕션 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:21`(`REDIS_KEY_PREFIX`) + `:115`; 유닛 테스트 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:68-74`(`scopedKey`); e2e `codebase/backend/test/external-interaction.e2e-spec.ts:129-135`(`idempotencyCacheKey`)
  - 상세: `interaction:idempotency:<executionId>:<route>:<key>` 형태가 세 파일에 각각 리터럴/템플릿으로 재구현돼 있다. 블랙박스 회귀 테스트로서는 정당한 선택(구현 세부를 import 하면 구현 버그와 테스트가 같이 깨지는 것을 막는 취지)이지만, 이 모듈의 기존 관례(`interaction-token.service.ts` 의 `BLACKLIST_KEY_PREFIX` 도 동일하게 모듈-로컬 상수+인라인 템플릿)와 일관되므로 이번 diff 가 새로 만든 패턴은 아니다. SSoT 노출(export) 없이 세 곳이 수동 동기화에 의존한다는 점만 인지해 둘 것.
  - 제안: 현 시점 조치 불필요. 포맷이 세 번째로 바뀌는 변경(예: 축 추가)이 생기면 프로덕션 상수/빌더 함수를 export 해 테스트가 import 하는 형태로 리팩터 고려.

## 레이어·결합도 확인 (문제 없음, 근거 기록)

- Guard→Interceptor 데이터 전달(`req.interaction`)은 이 모듈의 기존 패턴(`RequestWithInteraction`, `interaction.guard.ts`)을 그대로 재사용한 것이며, `idempotency.interceptor.ts` 가 `interaction.guard.ts` 의 타입을 `import type` 으로만 참조해 런타임 순환 의존이 없다(런타임에서 `interaction.guard.ts` 는 `idempotency.interceptor.ts` 를 참조하지 않음 — 확인됨).
- 등록 순서(`interaction.controller.ts:58` 클래스 레벨 `@UseGuards(InteractionGuard, ...)` + 메서드 레벨 `@UseInterceptors(IdempotencyInterceptor)`, `:66`/`:112`)는 Nest 요청 라이프사이클상 Guard 전체가 Interceptor 이전에 실행되므로, CHANGELOG 가 서술한 "InteractionGuard 가 인터셉터보다 먼저 돈다" 전제와 실제 배선이 일치한다.
- `req.interaction` 의 타입(`ExternalInteractionRequestContext`)은 Guard 가 합성하는 값으로 컴파일러가 제한돼 있고, in-process trusted caller(`in_process_trusted`, hooks/execution-engine 등)는 HTTP 컨트롤러를 거치지 않고 서비스 메서드를 직접 호출하므로 이 인터셉터의 스코프 로직과 아예 경로가 겹치지 않는다 — Internal 컨텍스트가 실수로 이 캐시 키 조립 로직에 흘러들 표면이 없다.
- 스코프 실패(`executionId` 부재) 시 조용한 전역 키 폴백 대신 캐시 자체를 skip 하는 설계는 이 인터셉터의 다른 fail-open 경로(Redis 미주입/GET·SET 실패/직렬화 실패)와 동일한 정책으로 통일돼 있어 인터셉터 내부의 정책 일관성이 유지된다.

## 요약

변경은 `IdempotencyInterceptor` 한 클래스 내부에 스코프 축(execution+route) 계산을 추가하는 좁은 범위의 수정이며, 기존 레이어 경계(Guard=인증/컨텍스트 합성, Interceptor=캐싱 cross-cutting, Controller=프레젠테이션, Service=비즈니스)를 침범하지 않는다. Guard→Interceptor 간 결합은 이 모듈이 이미 채택한 패턴을 재사용한 것이고 순환 의존도 없다. 유일한 주목할 점은 `route` 축을 얻는 방식이 명시적 계약이 아니라 함수명 리플렉션이라는 것과, 캐시 키 포맷이 세 파일에 독립 하드코딩돼 있다는 것인데 둘 다 현재 규모에서는 실질 위험이 낮고 기존 모듈 관례와 부합해 INFO 수준으로만 기록한다.

## 위험도
LOW
