# 부작용(Side Effect) Review — EIA §R8 idempotency 캐시 스코프 (4차 라운드, 최종 확인)

이번 라운드는 직전 3라운드(`16_29_45`→CRITICAL, `16_53_26`→WARNING 1, `17_07_45`→WARNING 1)가 모두
발견·해소된 뒤의 상태를 다룬다. 이번 diff 에서 실제로 새로 바뀐 런타임 코드는 두 커밋뿐이다 —
(1) `storeEntry()` 에 직렬화 실패 방어(`try/catch`) 추가, (2) `external-interaction.e2e-spec.ts` 에
`Idempotency-Key` e2e 2건(I-1/I-2) 추가. 나머지 파일(`review/code/2026/08/12/{16_29_45,16_53_26,
17_07_45}/**`)은 과거 라운드 산출물을 그대로 커밋한 정적 기록이라 런타임 부작용이 없다.

## 발견사항

- **[INFO]** 직전 라운드(`17_07_45`)가 지적한 WARNING — `catchError` 안에서 `storeEntry` 가 던지는
  `JSON.stringify` 실패가 원래 409/410 예외를 대체할 수 있던 문제 — 가 이번 diff 에서 실제로
  해소됨을 코드로 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:214-241`
    (`storeEntry`, 특히 `:221-233` 의 `try { entry = {...} } catch (err) { this.logger.warn(...); return; }`)
  - 상세: `JSON.stringify(payload ?? null)` 이 이제 `try/catch` 로 감싸여 있고, 실패 시 `warn` 로그만
    남기고 `return` 한다. `storeEntry` 는 `cacheTapped()` 의 `catchError` 콜백(`:186-201`) 안에서
    호출되는데, 이 호출이 예외 없이 항상 반환되므로 그 직후의 `return throwError(() => err)`(`:200`)
    가 어떤 경우에도 실행돼 **원래 409/410 예외가 대체되지 않는다.** 클래스가 스스로 명시한 불변식
    ("응답을 기록할 뿐 삼키지 않는다", `:198-199`)이 이 경로에서도 지켜진다 — 새 코드가 아니라 기존
    WARNING 을 닫는 변경이므로 회귀 아님.
  - 제안: 없음 — 확인 완료.

- **[INFO]** 위 방어(직렬화 실패 시 fail-open)를 실제로 행사하는 회귀 테스트가 없다 — 방어 자체가
  "부작용을 막기 위한 코드"인데 그 부작용 억제가 깨져도 테스트가 못 잡는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` 전체
    (`grep -n "circular\|stringify 실패\|storeEntry"` 결과, `JSON.stringify` 자체를 실패시키는
    케이스 0건 — 전부 `JSON.stringify({...})` 로 정상 직렬화 가능한 payload 만 사용)
  - 상세: 예를 들어 `try { entry = {...} } catch` 블록을 통째로 제거하는 뮤턴트를 넣어도(즉 다시
    `17_07_45` WARNING 상태로 되돌려도) 현재 스위트에서는 어떤 테스트도 RED 가 되지 않을 것으로
    보인다 — `interaction.service.ts` 의 4개 throw 지점이 전부 plain object 만 넘기므로 살아있는
    버그는 아니지만, 이 방어를 지켜주는 캐너리가 없다.
  - 제안: 필수는 아님(현재 실사용 payload 는 전부 직렬화 가능). 여유가 되면
    `makeThrowingHandler(new ConflictException({ error: { code: 'X', circ: <circular> } }))` 류로
    직렬화 불가 payload 를 넣어 "캐시 적재는 실패해도 원 예외가 그대로 나간다"를 고정할 것.

- **[INFO]** 신규 e2e 테스트가 실제 Redis 연결을 새로 연다 — 기존 컨벤션과 동일한 형태, 새로운
  부작용 패턴 아님
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:136`(`let redis: Redis`),
    `:141-144`(`redis = new Redis({ host: process.env.REDIS_HOST ?? 'redis', port: ... })`),
    `:149`(`await redis.quit()` in `afterAll`)
  - 상세: `integration-cache-invalidate.e2e-spec.ts:49-51`, `execution-seq-allocator-load.e2e-spec.ts:35-36,121-122`
    와 동일한 env-var 패턴(`REDIS_HOST`/`REDIS_PORT`, docker-compose 서비스명 `redis` 기본값)이라
    이 파일만의 새 관행이 아니다. `beforeAll`/`afterAll` 로 열고 닫아 커넥션 누수도 없다.
  - 제안: 없음 — 기존 컨벤션 준수 확인.

- **[INFO]** I-1/I-2 e2e 가 실 Redis 인스턴스에 24h TTL 캐시 엔트리를 쓰지만 테스트 종료 후 명시적
  삭제가 없다 — 다만 키가 `randomUUID()` 로 스코프돼 충돌·누적 위험은 낮고, 같은 파일의 다른 테스트도
  DB row 정리를 하지 않는 것과 동형의 기존 관행이다
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:371-444`(I-1, `idempotencyKey =
    \`e2e-409-${randomUUID()}\``), `:446-509`(I-2, `\`e2e-400-${randomUUID()}\``)
  - 상세: `redis.set(redisKey, ..., 'EX', TTL_SEC)`(TTL 24h, `idempotency.interceptor.ts:22,235`)로
    적재된 엔트리가 테스트 종료 후에도 24h 간 Redis 에 남는다. 다만 키 자체가 매 실행마다 유일해
    다른 테스트·다음 실행과 충돌하지 않고, 이 파일의 다른 시나리오(A~H)도 삽입한 `workflow`/
    `execution`/`node` row 를 정리하지 않는 동일한 스타일이라 이번 diff 가 새로 도입한 관행은 아니다.
  - 제안: 없음 — 기존 e2e 컨벤션과 일관됨. 참고용 기록.

- **[INFO]** 함수 시그니처·공개 인터페이스·전역 변수·환경 변수(운영 코드)·파일시스템에는 변화 없음 확인
  - 위치: `idempotency.interceptor.ts` 의 `intercept(context, next)`(`:88`)·생성자(`:77-86`) 무변경,
    `cacheTapped`/`storeEntry`/`isErrorStatusCacheable` 는 모두 `private`/모듈 비공개라 외부 호출자
    영향 없음. 새 `import { HttpException } from '@nestjs/common'`, `throwError` (rxjs) 는 이미
    프로젝트 의존성 범위 내.
  - 제안: 없음.

## 요약

이번 라운드에서 실제로 바뀐 두 곳(운영 코드의 `storeEntry` 직렬화 방어, e2e 의 Redis 관측 커넥션)은
모두 **직전 라운드가 지적한 WARNING 을 닫거나(전자), 기존 e2e 관행을 그대로 따르는(후자) 안전한
변경**이다. 함수 시그니처·공개 API·전역 상태·환경 변수 읽기/쓰기(운영 코드)·파일시스템에는 변화가
없고, 새로 열리는 네트워크 연결(e2e 의 `new Redis(...)`)도 이 저장소에 이미 확립된 패턴과 동일하다.
유일하게 남는 것은 이번에 추가된 직렬화-실패 fail-open 경로 자체를 행사하는 회귀 테스트가 없다는
점인데, 현재 실제 payload 가 전부 직렬화 가능해 살아있는 결함은 아니고 방어의 안전망 갭 수준이라
INFO 로 남긴다. 캐시 SET 빈도 증가·캐시-히트 시 409/410 을 예외로 재현하는 인터페이스 변경 등 핵심
부작용은 이전 라운드에서 이미 CHANGELOG·테스트·plan 으로 충분히 문서화·검증된 상태이며 이번 라운드
diff 는 그 상태를 훼손하지 않는다.

## 위험도

LOW
