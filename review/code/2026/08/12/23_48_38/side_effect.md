# 부작용(Side Effect) 리뷰 — `idempotency.interceptor.ts` 캐시 손상 fail-open 완성

## 발견사항

- **[WARNING]** `warnSpy` 복원이 try/finally 로 보호되지 않은 자리가 diff 안에 한 곳 남아 있다 — 실패 시 `Logger.prototype.warn` mock 이 뒤 테스트로 새어나간다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:512` (spy 생성) ~ `:539` (`warnSpy.mockRestore();`, 테스트 `손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재`)
  - 상세: 이번 diff 가 이 기존 테스트에 `const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();` (line 512) 를 추가했는데, 복원(`warnSpy.mockRestore()`, line 539)이 테스트 본문 맨 끝에 무보호로 놓여 있다. `jest.spyOn(Logger.prototype, ...)` 은 **프로토타입 레벨 mutable global** 을 바꾸는 호출이고, `codebase/backend/jest.config.ts` 에는 `restoreMocks`/`clearMocks`/`resetMocks` 도, 스펙 파일에도 `afterEach` 훅이 전혀 없다(grep 확인). 즉 line 512~539 사이 `expect` 단언 중 하나라도 던지면(`toEqual`/`toHaveBeenCalledTimes`/`JSON.parse` 등) `warnSpy.mockRestore()` 는 실행되지 않고 `Logger.prototype.warn` 은 이 spec 파일의 **남은 모든 테스트 동안 mock 상태로 새어나간다** — 실제 warn 로그가 콘솔로 안 새는 대신, 이후 다른 자리에서 새로 거는 `jest.spyOn(Logger.prototype, 'warn')` 이 이미 mock 된 함수를 다시 감싸는 형태가 되어 순서 의존적인 assertion 불일치를 유발할 수 있다.
    같은 diff 가 바로 옆에 추가한 세 신규 테스트(line 546/562, 571/599, 645/682)는 전부 `try { … } finally { warnSpy.mockRestore(); }` 로 이 위험을 정확히 막아 뒀다 — 이 자리만 그 컨벤션에서 빠졌다.
  - 제안: 이 테스트도 형제 테스트와 동형으로 `try { … } finally { warnSpy.mockRestore(); }` 로 감싼다(또는 파일 전체에 `afterEach(() => jest.restoreAllMocks())` 를 두는 더 강한 안전망을 검토).

- **[INFO]** `discardCorruptEntry('엔트리', …)` 경로가 프로덕션에 새 로그 emission 을 추가한다 — 의도된 변경이지만 side-effect 관점에서 명시
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` `discardCorruptEntry` (약 219~228번째 줄) — 바깥 엔트리 손상 호출부는 152~161번째 줄 근방
  - 상세: 종전에는 바깥 JSON 파싱 실패 시 조용히 `processFresh()` 로 강등됐다(로그 없음). 이번 변경으로 이 경로도 `this.logger.warn(...)` 을 호출한다 — CHANGELOG.md/plan 양쪽에 명시적으로 기록돼 있고 의도된 관측성 개선이므로 결함은 아니다. 다만 Redis 가 지속적으로 손상된 값을 돌려주는 장애 시나리오에서는 이 경로가 요청마다 warn 을 찍어 로그 볼륨이 늘어난다 — 로그 기반 알림 임계값을 쓰는 운영 환경이 있다면 참고할 사항.

- **[INFO]** `res.status(cached.statusCode)` 호출 시점이 payload 파싱 성공 이후로 이동 — 부작용 감소(긍정적)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:199~200` (`intercept()` 의 성공 재현 분기)
  - 상세: 종전 코드는 `res.status(cached.statusCode)` 를 먼저 호출한 뒤 `JSON.parse(cached.responseJson)` 를 수행했다 — payload 가 깨져 있으면 응답 객체에 이미 status 를 mutate 한 상태에서 `SyntaxError` 가 올라가 `GlobalExceptionFilter` 가 500 을 씌우는, "부분적으로 mutate 된 응답 객체" 를 남기는 구성이었다. 새 코드는 `cachedPayload` 파싱이 먼저 끝난 뒤에만 `res.status()` 를 호출하므로 이 부분 mutation 부작용이 사라졌다. 결함이 아니라 개선이므로 조치 불요.

그 외 점검 결과 — 이상 없음:
- **전역 변수**: 신규 전역 변수 없음. `REDIS_KEY_PREFIX`/`TTL_SEC`/`MAX_KEY_LENGTH` 는 기존 모듈 상수, 무변경.
- **파일시스템**: 코드 변경 자체는 파일시스템 부작용 없음. `review/code/2026/08/12/23_24_08/**`, `23_36_13/**` 등은 리뷰 산출물이며 CLAUDE.md 가 정한 정규 저장 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)로, 이전 라운드에서 이미 커밋된 정상 아티팩트다(이번 diff 의 부작용이 아님).
- **시그니처 변경**: `intercept()` public 시그니처 무변경(`NestInterceptor` 계약 그대로). 신규 `discardCorruptEntry<T>` 는 `private` 메서드라 외부 호출자 영향 없음. `cacheTapped`/`storeEntry` 시그니처도 무변경.
- **인터페이스 변경**: export 목록(`IDEMPOTENCY_HEADER`, `IdempotencyInterceptor`) 무변경. 공개 API 표면 변화 없음.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: Redis `get`/`set` 호출 패턴 자체는 무변경(추가 네트워크 호출 없음). 캐시를 못 쓰는 세 자리(미스·엔트리 손상·payload 손상)를 `processFresh()` 로 통합한 것은 제어 흐름 리팩터일 뿐 새 호출을 추가하지 않는다.
- **이벤트/콜백**: RxJS 파이프라인(`catchError` → `switchMap` → `tap`/`catchError`) 순서·구독 시맨틱 무변경. `cachedPayload` 를 한 번만 파싱해 재사용하도록 바뀐 것은 콜백 발생 횟수가 아니라 내부 로직 재구성이다.

## 요약

프로덕션 코드(`idempotency.interceptor.ts`) 변경은 부작용 관점에서 건전하다 — 신규 전역 상태·시그니처/인터페이스 파괴·의도치 않은 네트워크·환경 변수 접근이 없고, 오히려 `res.status()` mutate 시점을 payload 파싱 성공 이후로 옮겨 "부분 mutate 된 응답" 부작용을 없앴다. 새로 추가된 `discardCorruptEntry` 의 warn 로그는 CHANGELOG/plan 에 명시된 의도된 관측성 변경이다. 유일한 실질 발견은 테스트 파일 한 곳(`idempotency.interceptor.spec.ts:512~539`)에서 이번 diff 가 추가한 `Logger.prototype.warn` spy 복원이 try/finally 로 보호되지 않아, 그 테스트의 단언이 실패하면 프로토타입 레벨 mock 이 같은 파일의 나머지 테스트로 새어나갈 수 있다는 test-isolation 위험이다 — 같은 diff 가 바로 옆에 추가한 세 테스트는 이미 그 패턴을 올바르게 따르고 있어 이 자리만 누락됐다.

## 위험도
LOW
