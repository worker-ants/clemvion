# 부작용(Side Effect) Review — `clemvion.redis.fail_open` 카운터 배선 (전체 브랜치 diff, `10_13_11`)

이 라운드는 `origin/main` 대비 브랜치 전체 diff(48개 파일)를 대상으로 한다. 그중 실제 런타임
동작을 바꾸는 파일은 `idempotency.interceptor.ts` / `business-metrics.service.ts` / 두 `*.spec.ts`
뿐이고, 나머지(`CHANGELOG.md`, `plan/**`, `review/**`, `spec/**`)는 문서·리뷰 산출물이라
실행 시 부작용 표면이 없다. 코드 두 파일과 constructor 호출부·DI 배선을 직접 열어 확인했다.

## 발견사항

- **[INFO]** `recordRedisFailOpen()` 호출이 fail-open 복구 경로 내부에서 자체 격리 없이 실행된다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — GET
    `catchError` 콜백(154행 `this.metrics?.recordRedisFailOpen(METRICS_COMPONENT, 'get_failed');`),
    `discardCorruptEntry()`(250-253행), 직렬화 실패 catch(337행), SET `.catch()`(346행)
  - 상세: 이 클래스의 존재 이유는 "Redis 가 죽어도 요청은 반드시 산다" 는 fail-open 보장이다.
    새로 추가된 4개 지점의 `this.metrics?.recordRedisFailOpen(...)` 호출은 별도 `try/catch` 로
    감싸지 않았다 — `BusinessMetricsService.recordRedisFailOpen()`(`business-metrics.service.ts:134-139`)
    은 OTel `Counter.add()` 한 줄뿐이라 정상적으로는 던지지 않게 설계돼 있고, `OTEL_ENABLED`
    미설정 시 `getMeter` 가 no-op meter 를 주므로 비활성 환경에서도 무동작이다(CHANGELOG 명시).
    다만 이 설계가 깨지면(예: 향후 OTel SDK 회귀) 그 예외가 `catchError`/`discardCorruptEntry`
    안에서 그대로 전파돼 **fail-open 이 fail-closed 로 뒤집히는** 방향의 표면이 생긴다. 같은
    자리의 기존 `this.logger.warn(...)` 도 동일하게 무방비이므로(이 클래스의 기존 관례) 이번
    변경이 새로 만든 위험이 아니라 기존 무방비 표면이 두 배로 늘어난 정도다 — WARNING 으로 볼
    근거는 없다. 직전 두 라운드(`08_36_21`, `09_57_11`)도 같은 결론(INFO/조치 불요)에 도달했고,
    이번 확인으로도 결론이 바뀌지 않는다.
  - 제안: 당장 조치 불요. metrics 계층이 fail-open 경로에 계속 추가될 경우
    `recordRedisFailOpen` 자체(또는 호출부)에 얇은 방어를 고려.

## 확인된 항목 (문제 없음)

- **생성자 시그니처 변경(`IdempotencyInterceptor`, `idempotency.interceptor.ts:98-104`)** —
  `@Optional() private readonly metrics?: BusinessMetricsService` 를 4번째 파라미터로 끝에
  추가했다. 하위 호환 확인:
  - 프로덕션 배선은 `interaction.controller.ts` 의 `@UseInterceptors(IdempotencyInterceptor)`
    와 `external-interaction.module.ts` 의 providers 배열뿐이며, 둘 다 Nest DI 가 파라미터를
    메타데이터로 resolve 하는 경로다 — 코드베이스 전체에서 `new IdempotencyInterceptor(...)`
    를 수동 호출하는 곳은 spec 파일뿐이다(`grep -rln "IdempotencyInterceptor" codebase/backend/src`
    로 5개 파일 전수 확인).
  - `BusinessMetricsService` 를 제공하는 `MetricsModule` 은 `@Global()`(`metrics.module.ts:8`)
    이고 `AppModule` 에 등록돼 있어(`app.module.ts:163`) `ExternalInteractionModule` 이 별도
    import 하지 않아도 정상 주입된다 — 프로덕션 경로에서 `metrics` 가 조용히 `undefined` 로
    죽는 배선 누락은 없다.
  - 파라미터 순서는 유지(끝에 추가)했고 `@Optional()` 이라 미주입 시 `this.metrics?.` 로
    안전하게 무동작한다("metrics 미주입이어도 fail-open 경로가 죽지 않는다" 테스트로 고정,
    `idempotency.interceptor.spec.ts:1152-1168`).
- **공개 API 추가(`business-metrics.service.ts`)** — `RedisFailOpenComponent`/`RedisFailOpenReason`
  타입 export(38행, 41-46행)와 `recordRedisFailOpen()` 메서드(134-139행) 신설은 순수 추가이며
  기존 `record*` 메서드·필드·시그니처를 제거·변경하지 않는다. 기존 소비자에 대한 breaking
  change 없음.
- **전역 상태** — `METRICS_COMPONENT`(`idempotency.interceptor.ts:29`)는 모듈 레벨 상수이지만
  `readonly`·리터럴 타입(`RedisFailOpenComponent`)이라 재할당 불가하고, 클래스 인스턴스 간
  공유되는 mutable 전역 상태가 아니다. 새 mutable 전역 변수는 도입되지 않았다.
  `BusinessMetricsService.redisFailOpen`(67행)은 기존 5개 instrument 와 동일한 패턴으로
  생성자에서 1회 초기화되는 인스턴스 필드이며, OTel `metrics.getMeter('clemvion.business')`
  글로벌 API 사용은 기존 다섯 instrument 가 이미 쓰던 것과 동일한 메커니즘이라 새로운 전역
  등록 표면이 아니다.
- **파일시스템** — 런타임 코드(`idempotency.interceptor.ts`, `business-metrics.service.ts`)
  어디에도 파일 I/O 가 없다. diff 에 포함된 파일 생성(`plan/in-progress/spec-draft-*.md`,
  `review/code/**`, `review/consistency/**`)은 전부 이 작업 사이클이 프로젝트 규약에 따라
  의도적으로 생성한 산출물이며 런타임 코드의 부작용이 아니다.
- **환경 변수** — 이번 diff 는 `OTEL_ENABLED` 를 직접 읽거나 쓰지 않는다. CHANGELOG 가 언급한
  "`OTEL_ENABLED` 미설정 시 no-op" 동작은 기존 `instrumentation.ts`/OTel SDK 초기화 계층의
  기존 동작이고 이번 변경은 그 위에 얹힐 뿐이다.
- **네트워크 호출** — 이 코드가 직접 트리거하는 신규 외부 호출은 없다. `Counter.add()` 는
  로컬 메모리 집계이고, OTel exporter 로의 전송은 SDK 가 비동기·배치로 처리하며 이 코드
  경로와 무관하다(기존 5개 instrument 와 동일).
- **이벤트/콜백 변경** — SET 실패 `.catch()` 콜백이 단일 표현식 화살표(`(err) => this.logger.warn(...)`)
  에서 블록 바디(`(err) => { this.logger.warn(...); this.metrics?.recordRedisFailOpen(...); }`)
  로 바뀌었다(`idempotency.interceptor.ts:341-347`). `void this.redis.set(...).catch(...)` 로
  fire-and-forget 반환값을 애초에 버리므로 화살표의 반환 타입 변화(값 반환 → `undefined` 암묵
  반환)는 관측 가능한 차이를 만들지 않는다. 콜백이 호출되는 트리거 조건(SET 실패) 자체는
  변경되지 않았다.

## 요약

핵심 변경(`BusinessMetricsService.recordRedisFailOpen()` 신설 + `IdempotencyInterceptor` 다섯
fail-open 경로 배선)은 순수 관측성(observability) 확장이다. 생성자 시그니처 변경은 `@Optional()`
+ 파라미터 끝 추가 + `@Global()` 모듈 배선으로 기존 호출자·DI 양쪽에서 하위 호환이 실측으로
확인됐고, 신규 export 는 전부 추가적(additive)이라 공개 API 파괴 변경이 없다. 새 전역 변수·
파일시스템 부작용·환경 변수 읽기/쓰기·의도치 않은 네트워크 호출은 발견되지 않았다. 유일한
관찰은 신규 metrics 호출 4곳이 fail-open 복구 경로 안에서 자체 방어 없이(인접한 기존
`logger.warn` 과 동일한 수준으로) 실행된다는 점인데, `Counter.add()` 는 던지지 않도록 설계돼
있고 기존 관례와 일관되므로 즉시 조치가 필요한 결함은 아니다(직전 두 라운드와 동일 결론).

## 위험도

LOW
