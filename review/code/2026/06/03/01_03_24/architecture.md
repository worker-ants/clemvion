# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] `system-status.constants.ts` 가 12개 도메인 모듈에 직접 의존 — 모듈 경계 집중
- 위치: `/codebase/backend/src/modules/system-status/system-status.constants.ts` lines 1–12
- 상세: `MONITORED_QUEUES` 레지스트리가 `execution-engine`, `knowledge-base`, `external-interaction`, `integrations`, `schedules`, `auth`, `triggers`, `chat-channel`, `alerts` 등 9개 이상의 도메인 모듈에서 큐 이름 상수를 직접 import한다. 이 파일이 시스템 전체 큐 이름의 집합체가 되어, 큐가 추가·삭제될 때마다 이 파일을 수정해야 한다. 현재 설계에서 이 의존 방향은 불가피하며(모니터링 모듈이 각 도메인의 상수를 알아야 함), 코드 중복 없이 단일 레지스트리를 구성하는 합리적 선택이다. 다만 모든 큐 소유 모듈에 대한 팬인(fan-in) 결합이 명시적으로 발생하는 구조임을 인지해야 한다.
- 제안: 현재 수준의 결합은 기능의 특성상 허용 범위이나, 이 파일을 "도메인 횡단 레지스트리"로 문서화하고 주석의 SoT 언급(`data-flow/0-overview.md §4`)을 더 강하게 유지하면 향후 드리프트를 방지할 수 있다. 이미 `system-status.constants.ts` 에 SoT 주석이 작성되어 있어 적절히 처리됨.

### [INFO] `system-status.module.ts` DI factory 에서 인덱스 기반 매핑 사용
- 위치: `/codebase/backend/src/modules/system-status/system-status.module.ts` lines 38–43
- 상세: `useFactory` 에서 `MONITORED_QUEUES.map((meta, index) => ({ meta, queue: queues[index] }))` 방식으로 인덱스 기반 매핑을 수행한다. `SYSTEM_STATUS_QUEUE_NAMES.map(getQueueToken)` 의 inject 배열 순서와 `MONITORED_QUEUES` 배열 순서가 일치한다는 암묵적 불변 조건에 의존한다. 두 배열은 동일 소스(`MONITORED_QUEUES`)에서 파생되므로 현재는 안전하다.
- 제안: `SYSTEM_STATUS_QUEUE_NAMES` 가 `MONITORED_QUEUES.map(q => q.name)` 으로 파생되어 있어 두 배열 간 순서 불일치 위험이 구조적으로 없다. 현재 구조 유지는 적절하다. 향후 두 배열이 별도로 편집될 가능성이 생기면 `Map<name, Queue>` 기반 매핑으로 교체를 고려할 수 있다.

### [INFO] `SystemStatusService` 의 `QueueHandle` 인터페이스 — `Pick<Queue, 'getJobCounts' | 'isPaused'>` 추상화 수준 적절
- 위치: `/codebase/backend/src/modules/system-status/system-status.service.ts` lines 573–576
- 상세: `Queue` 전체 타입 대신 필요한 메서드만 `Pick` 으로 추출하여 의존성 역전 원칙(DIP)을 부분적으로 달성한다. 테스트에서 목업이 용이하고(`system-status.service.spec.ts` 에서 직접 구현체 없이 테스트), 실제 BullMQ `Queue` 클래스와의 결합을 최소화한다. 인터페이스 분리 원칙(ISP) 측면에서도 서비스가 모니터링에 필요한 메서드만 의존하도록 올바르게 제한되어 있다.
- 제안: 현재 구조 유지 적절. 향후 큐 메서드가 추가될 경우 `Pick` 목록만 확장하면 된다.

### [INFO] 프론트엔드 `page.tsx` — 타입 정의, 데이터 fetch, 레이아웃 렌더링이 단일 파일에 집중
- 위치: `/codebase/frontend/src/app/(main)/system-status/page.tsx` (284줄)
- 상세: 타입 정의(`QueueHealth`, `QueueStatus`, `SystemStatusOverview`), 헬퍼 함수(`extractData`), 상수(`HEALTH_DOT`, `HEALTH_TEXT`, `GAUGE_FILL`, `GROUP_ORDER`), 데이터 fetch 로직(`useQuery`), 페이지 레이아웃, 3개 하위 컴포넌트(`OverallHeader`, `QueueCard`, `CountCell`)가 모두 한 파일에 존재한다. 이는 이 기능 범위에서 허용 가능한 수준이며, 다른 페이지들(`statistics` 등)과 동일한 패턴을 따른다. 컴포넌트들이 파일 하단에 응집되어 있어 가독성은 유지된다.
- 제안: 현재 규모(284줄)에서는 파일 분리의 이점이 크지 않으나, 향후 큐 드릴다운·필터링 기능이 추가된다면 `hooks/useSystemStatus.ts` 로 fetch 로직을, `components/QueueCard.tsx` 로 카드 컴포넌트를 분리하는 것이 적절하다.

### [INFO] `extractData` 헬퍼의 타입 안전성 — 강제 캐스팅 존재
- 위치: `/codebase/frontend/src/app/(main)/system-status/page.tsx` lines 906–909
- 상세: `extractData` 함수는 `res.data as { data?: T }` 강제 캐스팅 후 `(d.data ?? d) as T` 를 반환한다. API 응답 래핑 구조(`{ data: T }`)를 런타임 추론에 의존하는 패턴으로, 기존 `statistics` 페이지와 동일한 방식이다. 타입 시스템이 실제 응답 구조를 보장하지 않는 구조적 약점이 있다.
- 제안: 프로젝트 전반의 공통 패턴이므로 이 파일만 수정할 사안은 아니다. 향후 API 클라이언트 레이어에서 래핑 해제를 일관되게 처리하는 interceptor 또는 유틸리티로 통합하면 모든 페이지에서 이 패턴을 제거할 수 있다.

### [INFO] 프론트엔드 타입 정의가 백엔드 DTO를 미러링 — 계약 중복
- 위치: `page.tsx` lines 869–895 (프론트) vs `system-status-response.dto.ts` (백엔드)
- 상세: `QueueHealth`, `QueueGroup`, `QueueCounts`, `QueueStatus`, `SystemStatusOverview` 타입이 프론트엔드에서 백엔드 DTO를 수동으로 미러링하고 있다. 이는 프론트-백 분리 monorepo 에서 흔한 구조이며, 타입 드리프트 위험이 있다. 현재 e2e 테스트(`system-status.e2e-spec.ts`)가 구조 정합을 런타임에 검증하므로 실용적 보호망이 존재한다.
- 제안: 기존 프로젝트 패턴을 따른 것으로 현재 허용 범위 내. 향후 OpenAPI 코드젠 또는 공유 `packages/` 타입 패키지를 도입하면 근본적으로 해소 가능하다.

## 요약

`system-status` 모듈은 NestJS 모듈 시스템의 DI 패턴, `Pick` 기반 최소 인터페이스, 읽기 전용 BullMQ 접근, 병렬 `Promise.all` 조회, 단일 장애 격리(큐별 try/catch) 등 아키텍처 관점에서 적절한 설계 결정을 일관되게 적용했다. SOLID 원칙 중 단일 책임(컨트롤러·서비스·상수·DTO 역할 분리), 인터페이스 분리(QueueHandle의 Pick), 의존성 역전(토큰 기반 DI)이 잘 지켜진다. `constants.ts` 의 12개 도메인 모듈 팬인 결합은 모니터링 기능의 본질적 특성에서 비롯된 것으로 불가피하며, SoT 주석으로 적절히 관리된다. 프론트엔드는 단일 파일 내 타입·fetch·렌더링 집중 패턴을 사용하나 이는 기존 페이지들과 일관된 구조이고 현재 규모에서 허용 가능하다. 전체 아키텍처는 안정적이며 즉각적인 수정이 필요한 Critical 또는 Warning 항목이 없다.

## 위험도

LOW
