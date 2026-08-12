# 부작용(Side Effect) 리뷰 — EIA §R8 idempotency 캐시 스코프 (최종 확인, 누적 7차 라운드)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 전체 changeset(83 files) 을 확인하고, 직전
side_effect 라운드(`18_52_47`, 위험도 LOW)가 "이 축에서 더 나올 것은 없다" 고 결론지은
이후 실제로 무엇이 바뀌었는지 `git show 6298d6fdb`(`18_52_47` WARNING #1 조치 커밋)로
대조했다. 해당 커밋은 `idempotency.interceptor.spec.ts` 모듈 docstring **8줄만** 수정하고
런타임 소스(`idempotency.interceptor.ts`)·e2e 는 건드리지 않는다. 이를 액면가로 받지 않고
런타임 3개 파일(`idempotency.interceptor.ts` 전문, `.spec.ts` 의 `jest.spyOn(Logger.prototype,
'warn')` 4개 블록, `external-interaction.e2e-spec.ts` 의 신규 Redis 연결·IDEM-1/2/3)을 `Read`
로 처음부터 다시 열어 직접 확인했다.

## 발견사항

- **[INFO]** 이번 라운드에서 유일하게 바뀐 것(`6298d6fdb`)은 테스트 파일 모듈 docstring
  문장 하나이며, 부작용 표면 자체에는 변화가 없다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-26`
    (모듈 최상단 docstring)
  - 상세: "이 블록의 테스트는 **전부** `Logger.prototype.warn` 을 함께 단언한다" 를 "**7건
    중 4건**만 단언한다" 로 정정한 순수 문서 수정. 코드·테스트 로직·assertion 은 무변경
    (`git show 6298d6fdb` 확인 — diff 8줄 전부 주석 블록 내부).
  - 제안: 없음.

- **[INFO]** `Logger.prototype.warn` 전역 mock 4곳 모두 `try { … } finally { warnSpy.mockRestore(); }`
  로 감싸져 있음을 직접 재확인 — 다른 테스트로 새는 전역 상태 오염 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:560-582`,
    `:640-663`, `:694-722`, `:727-749` (네 `it` 블록 각각 `jest.spyOn(Logger.prototype, 'warn')`
    → `try/finally`)
  - 상세: `Logger.prototype` 은 클래스 전체가 공유하는 prototype 이라 복원 누락 시 같은 파일의
    다른 `describe` 블록(예: `IdempotencyInterceptor (RedisConnectionProvider 주입)`)까지 조용히
    오염시킬 수 있는 자리인데, 네 곳 모두 예외 발생 여부와 무관하게 `finally` 에서
    `mockRestore()` 가 실행되도록 구성되어 있다. `it.only`/`describe.only`/잔존
    `process.env` 오염도 파일 전체에서 검색해 확인했으나 없음.
  - 제안: 없음 — 확인 완료.

- **[INFO]** 함수 시그니처·공개 인터페이스 변경 없음 재확인 — 신규 심볼(`storeEntry`,
  `isErrorStatusCacheable`)은 모두 클래스 `private` 또는 모듈 비공개(파일 스코프, non-export)
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:73`
    (`export class IdempotencyInterceptor` — 변경 없음), `:88`(`intercept(context, next)` 시그니처
    무변경), `:214`(`private storeEntry(...)`), `:255`(`function isErrorStatusCacheable(...)` —
    파일 최상단 `export const`/`export class` 목록에 없음, `grep '^export'` 로 직접 확인).
  - 상세: `cacheTapped()`(`:163`) 는 여전히 `.pipe()` 에 넘길 수 있는 RxJS operator 를 반환하는
    형태를 유지한다 — 종전엔 `tap({...})` 를 직접 반환했고 지금은 `(source) => source.pipe(tap(...),
    catchError(...))` 를 반환하지만, 호출부(`intercept()` 내부 두 곳, `:120`·`:147`)는
    `.pipe(this.cacheTapped(...))` 형태로 동일하게 소비하므로 호출자 관점의 계약은 바뀌지 않았다.
    컨트롤러(`interaction.controller.ts`)는 `@UseInterceptors(IdempotencyInterceptor)` 데코레이터로만
    참조하므로 이번 재설계가 호출자에 미치는 영향은 없다.
  - 제안: 없음.

- **[INFO]** `cacheTapped()` 의 `catchError` 가 이제 **모든** downstream 에러를 가로채지만,
  `HttpException` 이 아닌 에러(또는 캐시 대상이 아닌 상태코드)에 대해서는 아무 부수효과 없이
  즉시 `throwError(() => err)` 로 재던진다 — 새로운 에러 흡수/변형 없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:186-201`
  - 상세: `intercept()` 가 스스로 명시한 불변식("이 인터셉터는 응답을 기록할 뿐 삼키지 않는다",
    `:198-199` 주석)이 코드상으로도 지켜진다 — `if (err instanceof HttpException)` 분기 밖의
    모든 에러는 그 어떤 상태도 만들지 않고 그대로 통과한다. `storeEntry()` 내부의
    `JSON.stringify` 실패도 `try/catch` 로 흡수되어(`:222-233`) `catchError` 셀렉터 자체가
    새 에러를 던지는 경로는 없다 — 원 예외가 조용히 500 으로 대체될 위험이 구조적으로 막혀
    있음을 재확인했다(직전 라운드 `17_07_45` WARNING #1 의 fix 가 유지됨).
  - 제안: 없음 — 확인용 기록.

- **[INFO]** 이 PR 전체의 핵심 부작용 — 캐시 SET 이 `409`/`410` 경로에서도 발생하고, 캐시
  히트 시 `409`/`410` 을 `HttpException` 으로 재throw 해 클라이언트가 관측하는 응답이 바뀜 —
  은 **의도된** 변경이며 CHANGELOG·spec(§R8)·단위 테스트 다수·e2e 3건(IDEM-1/2/3)으로 충분히
  문서화·고정되어 있음을 최종 재확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:135-140`
    (캐시 히트 → 예외 재현), `:186-201`(`catchError` → `storeEntry` 적재), `CHANGELOG.md:26-29`
    (클라이언트 영향 절 — `requestId` 는 재현 대상이 아니라는 caveat 포함)
  - 상세: `CHANGELOG.md` 는 "같은 `Idempotency-Key` 로 `409`/`410` 을 받은 뒤 재요청하면 이제
    24h 동안 동일 응답이 재현된다… 단, `requestId` 는 예외 필터가 매 응답마다 새로 발급하므로
    재현 대상이 아니다" 라고 서술한다. 이를 코드로 직접 대조했다: `interaction.service.ts` 의
    `ConflictException`/`GoneException` 생성자 인자(`:253`,`:431`,`:478`,`:505`)에는 `requestId`
    필드가 없고, `http-exception.filter.ts:45`(`const requestId = uuidv4();`)가 매 응답마다
    새로 발급해 `:103` 에서 최종 body 에 주입한다 — 캐시에는 필터 이전 payload(`err.getResponse()`)
    가 저장되므로(`isErrorStatusCacheable` 분기, `:186-197`) CHANGELOG 서술이 실제 구현과
    정확히 일치함을 확인했다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** `external-interaction.e2e-spec.ts` 의 신규 `Redis` 연결(3개 e2e: IDEM-1/2/3)은
  기존 e2e 컨벤션과 동형 — 새로운 네트워크/리소스 관리 패턴 아님
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:134-149`(`redis = new Redis(...)`
    in `beforeAll`, `await redis.quit()` in `afterAll`)
  - 상세: 동일한 `REDIS_HOST`/`REDIS_PORT` env-var·기본값 패턴이 이 저장소의 다른 e2e 파일에도
    이미 존재함(직전 라운드들이 `grep` 으로 확인). `beforeAll`/`afterAll` 로 열고 닫아 커넥션
    누수가 없다. IDEM-1/IDEM-3 가 쓰는 Redis 키(`e2e-409-${randomUUID()}` 류)는 매 실행마다
    유일해 충돌 위험이 없고 24h TTL 로 자연 만료된다. 세 e2e 가 삽입하는 DB row(workflow/node/
    execution/node_execution)도 정리하지 않지만, 같은 파일의 다른 시나리오 전체가 동일한
    스타일이라 이번 diff 가 새로 도입한 관행이 아니다.
  - 제안: 없음.

- **[INFO]** 환경 변수 — 운영 코드(`idempotency.interceptor.ts`)는 이번 diff 전체에서
  `process.env` 를 직접 읽지 않음(Redis 연결은 `RedisConnectionProvider` DI 로 주입).
  e2e 가 읽는 `REDIS_HOST`/`REDIS_PORT` 는 기존 다른 e2e 파일과 동일한 이름·기본값의 테스트
  인프라 설정값 — 신규 환경 변수 도입 아님.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:142-143`
  - 제안: 없음.

- **[INFO]** `review/code/2026/08/12/{16_29_45,16_53_26,17_07_45,18_07_36,18_37_45,18_52_47}/**`
  및 `review/consistency/2026/08/12/18_27_29/**` 신규 파일 다수는 이 저장소의 표준 리뷰/
  consistency-check 워크플로가 생성한 산출물이며, developer 가 임의로 만든 파일시스템 부작용이
  아님 — 각 RESOLUTION.md 가 그 세션에서 실제 발견·조치된 항목을 기록하고 있어 추적 가능.
  - 위치: 위 디렉터리 하위 전체
  - 제안: 없음.

## 요약

직전 side_effect 라운드(`18_52_47`, LOW) 이후 실제로 바뀐 것은 테스트 파일 모듈 docstring
문장 하나(`6298d6fdb`)뿐이며 런타임 부작용 표면에는 변화가 없다. 런타임 3개 파일
(`idempotency.interceptor.ts`/`.spec.ts`, `external-interaction.e2e-spec.ts`)을 처음부터
다시 읽어 독립 검증한 결과, 함수 시그니처·공개 인터페이스·전역 상태·환경 변수(운영 코드)·
파일시스템에는 변화가 없고, `Logger.prototype.warn` 전역 mock 4곳 모두 `try/finally` 로
격리되어 있으며, `catchError` 가 도입한 새 인터셉션 지점도 원 예외를 흡수·대체하지 않고
그대로 재던지는 구조임을 코드로 확인했다. 이 PR 의 진짜 부작용 — 캐시 SET 이 더 많은
상태코드(409/410)에서 발생하고, 캐시 히트 시 409/410 을 예외로 재현해 클라이언트가 관측하는
응답이 바뀌는 것, 그리고 그 재현에서 `requestId` 만은 매번 새로 발급된다는 것 — 은 CHANGELOG
서술을 실제 필터/서비스 코드와 직접 대조해 정확함을 재확인했다. 신규 CRITICAL/WARNING 없음.

## 위험도

NONE
