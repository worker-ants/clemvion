# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] 모듈 등록 시 환경변수 즉시 평가 — 컨테이너 기동 순서 의존

- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` 라인 197-198, 231-234
- 상세: `continuationConcurrency`, `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD` 세 상수가 모듈 최상위 스코프에서 `process.env.*`를 즉시 읽어 평가된다. NestJS 모듈 로딩은 ConfigModule이 완전히 초기화되기 전에 발생할 수 있으므로, dotenv 주입이 늦거나 환경변수가 컨테이너 시작 시 아직 세팅되지 않았을 경우 기본값(`1`, `1`, `50`)으로 굳어진다. 런타임 중에는 변경이 불가능하다.
- 제안: `ConfigService`를 주입받아 서비스 초기화 시점에 읽거나, 적어도 테스트에서 환경변수 오염 방지를 위해 `jest.resetModules()`를 사용할 것. 단, 현재 `system-status.service.spec.ts`는 직접 임계값을 확인하지 않으므로 테스트는 통과하지만 환경변수 재설정 후 테스트 격리에 주의가 필요하다.

---

### [WARNING] `MONITORED_QUEUES` 배열과 `useFactory` inject 순서 암묵적 결합

- 위치: `codebase/backend/src/modules/system-status/system-status.module.ts` 라인 338-345
- 상세: `useFactory: (...queues: Queue[]) => MONITORED_QUEUES.map((meta, index) => ({ meta, queue: queues[index] }))` 는 `queues` 배열 인덱스와 `MONITORED_QUEUES` 배열 인덱스가 `SYSTEM_STATUS_QUEUE_NAMES` 생성 순서와 일치한다고 가정한다. `inject: SYSTEM_STATUS_QUEUE_NAMES.map((name) => getQueueToken(name))`는 동일 순서를 따르므로 현재는 정합성이 유지된다. 그러나 `MONITORED_QUEUES`에 큐를 추가하거나 순서를 변경할 때 `useFactory` 내부 인덱스 매핑이 자동으로 검증되지 않아 런타임까지 잘못된 `meta ↔ queue` 쌍이 탐지되지 않는 잠재적 부작용이 있다.
- 제안: `useFactory` 내에서 인덱스 매핑 대신 `queue.name`(BullMQ `Queue` 인스턴스에는 `name` 프로퍼티가 있음)으로 `meta`를 조회하는 방식으로 교체하거나, 최소한 주석으로 "inject 순서 = MONITORED_QUEUES 순서" 의존임을 명시한다.

---

### [INFO] `sharedConnection: true` 로 BullMQ 큐 12개 재등록 — 기존 큐 설정 덮어쓰기 가능성

- 위치: `codebase/backend/src/modules/system-status/system-status.module.ts` 라인 326-332
- 상세: `BullModule.registerQueue(...SYSTEM_STATUS_QUEUE_NAMES.map((name) => ({ name, sharedConnection: true })))` 는 이미 다른 모듈(execution-engine, knowledge-base 등)에서 `registerQueue`된 큐들을 `sharedConnection: true` 옵션으로 재등록한다. BullMQ NestJS 어댑터가 동일 이름 큐를 중복 등록할 때 마지막 옵션으로 병합하거나 기존 설정을 덮어쓸 수 있다. 기존 큐 모듈이 `sharedConnection: false`(기본값)로 등록된 경우 이 재등록이 해당 큐의 연결 모드에 부작용을 줄 가능성이 있다.
- 제안: `@nestjs/bullmq`의 모듈 중복 등록 동작을 확인하고, 모니터링 전용 읽기 Queue 인스턴스를 생성하는 것이 의도라면 별도 `Queue` 인스턴스를 직접 생성(BullMQ 네이티브 API)하거나 `forRoot`/`forFeature` 분리 패턴을 검토한다. `ai-review INFO-12`(공유 Redis 연결 정책)와의 정합성을 함께 확인해야 한다.

---

### [INFO] `refetchInterval: 5000` — 인증 실패 시 무한 폴링 요청

- 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx` 라인 932-940
- 상세: `useQuery`에 `refetchInterval: 5000`이 설정되어 있다. React Query 기본 동작에서 쿼리가 `isError` 상태가 되어도 `refetchInterval`은 계속 동작한다. 인증 토큰 만료 후 401이 반환되면 5초마다 401 요청이 반복된다. 이는 서버 로그 오염 및 불필요한 네트워크 요청의 의도하지 않은 부작용이다.
- 제안: 401 응답 시 `refetchInterval`을 중단하는 로직(`refetchInterval: (data, query) => query.state.status === 'error' ? false : 5000`) 또는 전역 401 인터셉터와 연동을 검토한다.

---

### [INFO] `navItems` 배열에 새 항목 추가 — 전역 사이드바에 즉시 반영

- 위치: `codebase/frontend/src/components/layout/sidebar.tsx` 라인 118 (변경)
- 상세: `navItems`는 모듈 수준 상수 배열이다. 새 항목 추가는 의도된 변경이며, 모든 로그인 사용자에게 "System Status" 메뉴가 즉시 노출된다. role 기반 필터링이 없음을 인지하고 진행한 변경이다.
- 제안: 현재 설계(전체 로그인 사용자 노출)가 의도이므로 추가 조치 불필요. NAV-SS-06 요구사항과 일치.

---

### [INFO] i18n 딕셔너리 타입 선언 불일치

- 위치: `codebase/frontend/src/lib/i18n/dict/ko/systemStatus.ts`, `codebase/frontend/src/lib/i18n/dict/en/systemStatus.ts`
- 상세: `en/systemStatus.ts`는 `Dict["systemStatus"]` 타입을 명시하는 반면, `ko/systemStatus.ts`는 `as const`로만 선언한다. `ko/index.ts`에서 최상위 타입 체크가 이루어지지 않으면 키 누락이 컴파일 타임에 탐지되지 않는다.
- 제안: `ko/systemStatus.ts`도 `Dict["systemStatus"]` 타입 어노테이션을 명시하거나, `ko/index.ts`에서 최상위 타입 체크가 이루어지는지 확인한다.

---

## 요약

이번 변경은 신규 `SystemStatusModule` 및 프론트엔드 페이지를 독립적으로 추가하는 비침습적 구성이다. 기존 모듈의 공개 API·함수 시그니처 변경 없고, 전역 가변 상태를 도입하지 않는다. 가장 주목할 부작용 위험은 두 가지다. 첫째, `system-status.constants.ts`에서 환경변수를 모듈 로딩 시점에 즉시 평가하여 임계값이 프로세스 시작 시 고정되는 점(ConfigModule 로딩 순서 의존). 둘째, `BullModule.registerQueue` 재등록이 기존 큐 모듈의 옵션에 예상치 못한 영향을 줄 가능성. `useFactory` 인덱스 의존 패턴과 프론트엔드 폴링의 401 무한 반복은 낮은 수준이지만 주의를 요한다. 전반적으로 읽기 전용 집계 API이고 부작용 범위가 좁아 위험도는 낮다.

## 위험도

LOW

STATUS: SUCCESS
