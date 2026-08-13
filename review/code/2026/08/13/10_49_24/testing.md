# Testing Review — `clemvion.redis.fail_open` 관측 메트릭

## 검증 방법

정적 리뷰에 더해 실제로 실행해 확인했다(worktree 내부에서):

- `jest idempotency.interceptor.spec.ts business-metrics.service.spec.ts` → 2 suites / 72 passed (GREEN).
- `discardCorruptEntry` 의 `what === '엔트리' ? 'entry_corrupt' : 'payload_corrupt'` 를 `'entry_corrupt'` 상수로
  뭉개는 뮤턴트를 직접 주입 → `payload 손상 → reason=payload_corrupt` 테스트가 RED (기대 `payload_corrupt`,
  실제 `entry_corrupt`) → 원복 후 재확인 GREEN. RESOLUTION.md 의 "reason 상수화 뮤턴트 RED" 주장을
  독립 재현했다.
- `business-metrics.service.spec.ts` 옆에 `const x: number = 'not-a-number'` 를 넣은 임시 스펙 파일을
  추가해 실행 → **GREEN(타입 오류가 잡히지 않음)**. spec 파일 주석의 "ts-jest 는 타입을 strip 한다" 주장을
  실측 확인. 프로브 파일은 삭제(`git status` clean 확인).
- `python3 scripts/check-backend-typecheck-ratchet.py` → `OK: backend 타입 진단 199건 / 38파일 — baseline 과
  일치`. RESOLUTION.md 의 "199건, 신규 에러 0건" 주장과 일치 — 타입 캐너리의 실제 감시자가 살아 있고
  현재 baseline 과 맞다.
- `IdempotencyInterceptor — fail-open 관측 (metrics)` JSDoc(라인 1055-1063)이 자기 describe(1064)
  바로 앞에 붙어 있음을 재확인 — RESOLUTION WARNING1·2(JSDoc 탈취)가 실제로 해소돼 있다.

## 발견사항

- **[INFO]** "카운터가 오르지 않아야 한다" 역방향 커버리지가 fresh-success(2xx) 경로 1건뿐이다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1155-1165`
    (`describe('IdempotencyInterceptor — fail-open 관측 (metrics)')` 내 `'정상 경로에서는 카운터가
    오르지 않는다'` 테스트 — 실제 파일을 직접 열어 확인한 줄 번호. 이 파일은 프롬프트에서 크기 제한으로
    diff 가 생략돼 게이트 번호가 없다.)
  - 상세: `recordRedisFailOpen` 은 "Redis 가 fail-open 으로 강등된 경우"에만 불려야 하는데, 그 반대
    방향(불리지 않아야 하는 경우)을 고정하는 테스트는 캐시 미스 뒤 신규 처리 성공(200) 1건뿐이다.
    `IDEMPOTENCY_KEY_CONFLICT` 409(bodyHash 불일치로 인한 정상 충돌), 캐시 히트 재생(2xx/409/410 replay)
    등 — "Redis 는 멀쩡한데 응답이 성공이 아닌" 나머지 정상 분기들에서 카운터가 오르지 않는지는
    검증되지 않는다. 이 카운터는 알람 신뢰도가 라벨 정밀도에 달려 있다고 스스로 문서화했는데
    (WARNING4 RESOLUTION, `entry_corrupt`/`payload_corrupt` 를 갈라 테스트한 것과 같은 이유), false
    positive 방향의 회귀(예: 리팩터 중 conflict 분기에 실수로 metrics 호출이 끼어드는 경우)는 현재
    테스트로 못 잡는다.
  - 제안: `IDEMPOTENCY_KEY_CONFLICT` throw 케이스와 캐시 히트 재생(2xx) 케이스에도
    `expect(m.recordRedisFailOpen).not.toHaveBeenCalled()` 를 추가하면, "성공만이 아니라 Redis 가
    정상 동작한 모든 분기에서 조용하다" 는 더 강한 계약이 된다. 필수는 아니다 — 현재도 다섯 fail-open
    경로 전부와 대표 성공 경로는 확실히 고정돼 있다.

- **[INFO]** `IdempotencyInterceptor` 생성자의 `@Optional() metrics?: BusinessMetricsService` 가 실제
  Nest DI 그래프(`@Global() MetricsModule` → `ExternalInteractionModule`)에서 정상 주입되는지 검증하는
  통합/e2e 테스트는 없다 — 단위 테스트는 전부 생성자를 수동 호출해 `{ recordRedisFailOpen: jest.fn() }`
  또는 `undefined` 를 직접 넘긴다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:106`
    (생성자 파라미터), `codebase/backend/src/modules/metrics/metrics.module.ts` (`@Global()` 선언)
  - 상세: 다만 이는 이 변경이 새로 만든 리스크가 아니다 — `execution-engine.service.ts`,
    `continuation-dlq-monitor.service.ts`, `llm-usage-log.service.ts` 등 기존 4곳이 이미 같은 패턴으로
    `BusinessMetricsService` 를 주입받고 있고, 그 어느 곳도 실제 DI 해석을 검증하는 테스트를 갖고 있지
    않다(grep 확인). Nest 의 reflect-metadata 기반 생성자 주입은 신뢰도가 높은 boilerplate 라 위험은
    낮다. 기존 관례와의 일관성 유지 관점에서만 기록한다 — 조치를 요구하지 않는다.

## 긍정적으로 확인된 점

- 다섯 fail-open 경로(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`)
  전부가 `it.each` + 개별 테스트로 각각 독립 검증되고, 두 손상 갈래(`entry_corrupt`/`payload_corrupt`)를
  뭉개는 회귀를 직접 뮤테이션으로 재현해 킬을 확인했다(위 "검증 방법" 참고) — "총량만 보면 못 잡는다"는
  자체 지적이 실제로 유효하다.
- `metrics 미주입이어도 fail-open 경로가 죽지 않는다 (optional DI)` 테스트로 `@Optional()` 계약을
  런타임까지 고정했다 — MetricsModule 미구성 환경(OTEL 비활성 등)에서의 크래시를 막는 실질적 회귀 테스트다.
- `business-metrics.service.spec.ts` 에 `recordRedisFailOpen` 자체를 실행하는 테스트를 3건 추가해
  WARNING4(인터셉터 테스트가 이 메서드를 스텁으로 대체해 구현 본문이 한 번도 실행되지 않던 갭)를 정확히
  닫았다 — mock 경계(호출부는 mock 으로 격리, 실제 구현은 별도 spec 으로 직접 검증)가 교과서적으로
  적용됐다.
- 타입 캐너리(`@ts-expect-error` 두 축)가 "이 테스트를 실행하는 것만으로는 검사되지 않는다" 는 것을
  스스로 문서화하고 실제 감시자(`check-backend-typecheck-ratchet.py`)를 명시했는데, 두 주장(ts-jest
  타입 미검사, ratchet 199건 baseline 일치) 모두 독립 재현으로 사실임을 확인했다. 근거 없는 자신감이
  아니라 실측에 기반한 문서화다.
- `Logger.prototype.warn` 스파이가 매 테스트마다 `try/finally` 로 생성·복원돼 테스트 간 오염이 없다 —
  전체 스위트 실행에서도 순서 무관하게 GREEN.
- WARNING1·2(신규 describe 삽입이 JSDoc 을 가로챈 문제)의 수정이 실제로 반영돼 있음을 파일을 직접
  읽어 재확인했다 — `fail-open 관측 (metrics)` JSDoc 이 자기 describe 바로 앞에 붙어 있다.

## 요약

`recordRedisFailOpen` 관측 메트릭 추가는 다섯 fail-open 경로 전부에 대해 개별 회귀 테스트(라벨 뒤바뀜을
뮤테이션으로 직접 킬 확인)를 갖추고, 구현 메서드 자체를 실행하는 테스트(이전 WARNING4 갭)와 리터럴
유니온 타입 강제를 고정하는 캐너리(그 캐너리가 jest 로는 검증되지 않고 별도 tsc ratchet 스크립트가
실제 감시자임을 스스로 문서화하고 실측 확인)까지 갖춰 이번 세션에서 리뷰한 변경 중 테스트 엄밀도가
가장 높은 축에 든다. 남은 갭은 전부 INFO 수준이다 — "카운터가 안 올라야 하는" 역방향 커버리지가
성공 경로 1건뿐이라 conflict/캐시-히트 재생 분기의 false-positive 회귀는 못 잡는 점, 그리고 실제 Nest
DI 그래프에서의 주입을 검증하는 통합 테스트가 없는 점(단, 기존 4개 소비자와 동일한 관례라 신규 리스크는
아니다). 둘 다 즉시 조치를 요구할 수준이 아니다.

## 위험도

LOW
