# 부작용(Side Effect) Review — EIA §R8 idempotency 캐시 스코프 (누적 6차 라운드, 최종 확인)

## 검토 방법

`git log --oneline origin/main..HEAD` 로 누적 8개 커밋을 확인하고, 직전 side_effect 라운드
(`18_37_45`, `git diff 147075a51 HEAD --stat` 기준 "이후 실질 코드 변경 0건" 으로 결론)
이후 실제로 무엇이 더 바뀌었는지 `git show 567c1919d`(테스트 파일만, warn 단언 2건 추가)
· `git show 02e80d699`(plan/consistency 문서만)로 대조했다. 두 커밋 모두 런타임 소스
(`idempotency.interceptor.ts`)는 건드리지 않는다. 이후 `idempotency.interceptor.ts` /
`.spec.ts` / `external-interaction.e2e-spec.ts` 최종 상태를 `Read`로 처음부터 다시 열어
직접 확인했다.

## 발견사항

- **[INFO]** 이번 라운드에서 유일하게 새로 바뀐 런타임 관련 코드(`567c1919d`)는 테스트
  파일뿐이며, 부작용 억제 코드가 아니라 부작용 억제 코드를 검증하는 테스트다 — 새 side effect
  없음
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
    (`'직렬화 불가 payload 여도 원 예외가 그대로 나간다…'`, `'성공 채널에서도 직렬화 불가
    응답이 요청을 죽이지 않는다'` 두 `it` 블록)
  - 상세: `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` 를 두 테스트 모두
    `try { … } finally { warnSpy.mockRestore(); }` 로 감싸 스파이가 테스트 종료 후 반드시
    원복된다 — 다른 테스트로 새는 전역 모킹 잔존이 없다. `Logger.prototype` 은 클래스 전체
    prototype 이라 원복 누락 시 같은 파일의 다른 `describe` 블록까지 오염시킬 수 있는
    자리인데, 그 위험이 `finally` 로 닫혀 있음을 확인했다.
  - 제안: 없음 — 확인 완료.

- **[INFO]** 함수 시그니처·공개 인터페이스 변경 없음 재확인 — `cacheTapped`/`storeEntry`/
  `isErrorStatusCacheable` 모두 `private` 또는 모듈 비공개(파일 스코프) 함수
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:163`
    (`private cacheTapped(...)`), `:214`(`private storeEntry(...)`), `:255`
    (`function isErrorStatusCacheable(...)`, export 아님). `intercept(context, next)`(`:88`)와
    생성자(`:77-86`)는 이번 diff 전체에 걸쳐 무변경.
  - 상세: 세 헬퍼 모두 클래스 내부 또는 파일 스코프에서만 호출되며(`grep` 으로 호출부 3곳
    확인), 컨트롤러(`interaction.controller.ts`)가 참조하는 것은 `@UseInterceptors(
    IdempotencyInterceptor)` 데코레이터뿐이라 이번 재설계가 호출자에 미치는 영향은 없다.
  - 제안: 없음.

- **[INFO]** 이 PR 의 핵심 부작용 — 캐시 SET 이 `409`/`410` 경로에서도 발생하고, 캐시 히트
  시 `409`/`410` 을 `HttpException` 으로 재throw 해 클라이언트가 관측하는 응답이 바뀜 —
  은 이번 diff 전체에 걸쳐 **의도된** 변경이며 CHANGELOG·spec(§R8)·5개 회귀 테스트
  (409/410/5xx/400/404 각 error 채널)·3개 e2e(IDEM-1/2/3)로 충분히 문서화·고정되어 있다
  - 위치: `idempotency.interceptor.ts:135-140`(캐시 히트 → 예외 재현), `:186-201`
    (`catchError` → `storeEntry` 적재), `CHANGELOG.md:26-29`(클라이언트 영향 절,
    `requestId` 는 재현 대상이 아니라는 caveat 포함)
  - 상세: 직전 5개 라운드(`16_29_45`~`18_37_45`)가 각각 이 변경을 코드·테스트·문서 세
    층위에서 독립적으로 검증했고, 이번 라운드는 그 사이 코드가 바뀌지 않았으므로 상태
    재확인일 뿐 새 정보는 아니다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** `external-interaction.e2e-spec.ts` 신규 `redis: Redis` 연결과 3개 신규 e2e
  (`IDEM-1`/`IDEM-2`/`IDEM-3`)는 이 저장소의 기존 e2e 컨벤션과 동형 — 새로운 네트워크
  부작용 패턴 아님
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:142-144`
    (`new Redis({ host: process.env.REDIS_HOST ?? 'redis', port: Number(process.env.REDIS_PORT
    ?? '6379') })`), `:149`(`afterAll` 의 `await redis.quit()`)
  - 상세: 동일한 `REDIS_HOST`/`REDIS_PORT` env-var·기본값 패턴이
    `integration-cache-invalidate.e2e-spec.ts:50-51`, `execution-seq-allocator-load.e2e-spec.ts:
    35-36,121-122` 에 이미 존재함을 `grep` 으로 직접 확인했다. `beforeAll`/`afterAll` 로
    열고 닫아 커넥션 누수가 없다. `IDEM-1`/`IDEM-3` 가 Redis 에 24h TTL 엔트리를 쓰지만
    키가 `` `e2e-409-${randomUUID()}` ``/`` `e2e-410-${randomUUID()}` `` 로 매 실행마다
    유일해 충돌·누적 위험이 낮고, 같은 파일의 다른 시나리오도 DB row 를 정리하지 않는
    동일한 스타일이라 이번 diff 가 새로 도입한 관행이 아니다(직전 라운드 `18_07_36`
    side_effect 리뷰가 I-1/I-2 에 대해 이미 같은 결론).
  - 제안: 없음 — 기존 컨벤션 준수 확인.

- **[INFO]** `review/code/2026/08/12/{16_29_45,16_53_26,17_07_45,18_07_36,18_37_45}/**`
  (신규 파일 다수) 및 `review/consistency/2026/08/12/18_27_29/**` 는 이번 changeset 과
  함께 커밋되지만 이 저장소의 표준 리뷰/consistency-check 워크플로가 그 소관으로 생성한
  산출물이며, developer 가 임의로 만든 파일시스템 부작용이 아니다
  - 위치: 위 디렉터리 하위 전체
  - 상세: 각 라운드의 RESOLUTION.md 가 그 세션에서 실제로 발견·조치된 CRITICAL/WARNING을
    기록하고 있고(예: `16_29_45` CRITICAL — dead code, `17_07_45` WARNING 4건 — 자매 케이스
    누락 패턴), 이 파일들이 신규로 git에 추가되는 것은 선행 라운드의 scope reviewer 가 이미
    반복 확인한 정상 패턴이다. 이번 라운드에서 새로 관찰된 이상은 없다.
  - 제안: 없음.

- **[INFO]** 환경 변수 — 운영 코드(`idempotency.interceptor.ts`)는 이번 diff 전체에서
  `process.env` 를 직접 읽지 않는다(Redis 연결은 `RedisConnectionProvider` 를 통해 주입).
  e2e 테스트가 읽는 `REDIS_HOST`/`REDIS_PORT` 는 테스트 인프라 설정값이고 기존 다른 e2e
  파일과 동일한 이름·기본값을 쓴다(신규 환경 변수 도입 아님).
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:142-143`
  - 제안: 없음.

## 요약

직전 side_effect 라운드(`18_37_45`) 이후 실제로 바뀐 것은 (1) 테스트 파일에 `Logger.prototype.
warn` 스파이 기반 회귀 단언 2건 추가(`567c1919d`) — `try/finally` 로 원복이 보장돼 테스트 간
오염 없음 — 와 (2) `plan/`·`review/consistency/**` 문서/추적 기록(`02e80d699`) 뿐이며, 둘 다
런타임 부작용 표면이 없다. 3개 런타임 파일(`idempotency.interceptor.ts`/`.spec.ts`,
`external-interaction.e2e-spec.ts`)을 처음부터 다시 읽어 확인한 결과, 이번 PR 전체에 걸쳐
함수 시그니처·공개 인터페이스·전역 상태·환경 변수(운영 코드)·파일시스템에는 변화가 없고,
새로 열리는 네트워크 연결(e2e 의 `new Redis(...)`)도 이 저장소에 이미 확립된 패턴과 동일하다.
이 PR 의 진짜 부작용 — 캐시 SET 이 더 많은 상태코드(409/410)에서 발생하고, 캐시 히트 시
409/410 을 예외로 재현해 클라이언트가 관측하는 응답이 바뀌는 것 — 은 5차례 선행 라운드에 걸쳐
이미 CHANGELOG·spec·단위 테스트·e2e 로 충분히 문서화·검증된 **의도된** 변경이며, 이번 라운드는
그 상태를 훼손하지 않았다. 신규 CRITICAL/WARNING 없음.

## 위험도

LOW
