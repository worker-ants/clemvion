# 유지보수성(Maintainability) 리뷰

## 발견사항

### Backend

- **[INFO]** `HEALTH_DOT`과 `GAUGE_FILL` 레코드 값이 동일한 클래스 문자열로 중복
  - 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx` — `HEALTH_DOT`(line 911~915) 및 `GAUGE_FILL`(line 923~927)
  - 상세: 두 상수 모두 `healthy:"bg-emerald-500"`, `degraded:"bg-amber-500"`, `down:"bg-red-500"` 로 내용이 동일하다. 현재 용도는 미묘하게 구분(dot vs gauge bar)되나 값이 같아 단일 상수로 통합해도 무방하다.
  - 제안: 두 상수 중 하나를 제거하고 공통 이름(`HEALTH_BG_COLOR` 등)으로 단일화하거나, 의도적 분리라면 주석으로 사유를 명시한다.

- **[INFO]** `QueueHealth` 타입이 백엔드(`system-status-response.dto.ts`)와 프론트엔드(`page.tsx`) 양측에 중복 정의
  - 위치: `codebase/backend/src/modules/system-status/dto/system-status-response.dto.ts` line 67, `codebase/frontend/src/app/(main)/system-status/page.tsx` line 869
  - 상세: `"healthy" | "degraded" | "down"` 유니온 타입이 두 곳에 각각 로컬로 선언된다. API 스키마가 변경될 때 양쪽을 동시에 수정해야 하는 동기화 부담이 있다.
  - 제안: 공유 패키지(`packages/`)에 API 타입을 정의하거나, openapi-typescript 등으로 생성 타입을 활용하는 방향을 중장기적으로 검토한다. 단기적으로는 주석에 "mirror of backend DTO" 표기가 이미 있어 현 상태 유지 가능.

- **[INFO]** `extractData` 헬퍼의 타입 단언이 불안전하며 파일 내부에 private 하게 선언
  - 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx` line 906~909
  - 상세: `res.data as { data?: T }` 후 `(d.data ?? d) as T` 로 이중 단언한다. 이 함수는 여러 페이지에서 재사용될 수 있는 공통 패턴임에도 파일 내부에만 존재한다.
  - 제안: 코드베이스 내 공통 API 클라이언트 레이어에 동일한 래핑 해제 로직이 있다면 그것을 재사용하고, 없다면 `lib/api/` 디렉터리로 추출하여 다른 페이지와 일관성을 유지한다.

- **[INFO]** `system-status.constants.ts` 에서 `process.env` 값을 모듈 로드 시 즉시 평가
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` line 197~198, 231~234
  - 상세: `continuationConcurrency`, `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD` 가 파일 로드 시점에 환경변수를 읽어 상수로 고정된다. 테스트에서 환경변수를 바꿔도 이미 캐시된 값이 사용된다. unit test `system-status.service.spec.ts` 는 임계값을 직접 의존하지 않고 기본값(1, 50)이 적용된다고 가정하므로 현 시점에선 문제 없으나, 테스트 격리성 관점에서 주의가 필요하다.
  - 제안: 임계값을 `ConfigService` 로 주입받거나, 테스트에서 환경변수를 변경할 때 모듈 캐시 무효화가 필요함을 주석으로 명시한다.

- **[INFO]** `QueueHandle` 인터페이스가 service 파일에 정의되어 module 파일에서도 import
  - 위치: `codebase/backend/src/modules/system-status/system-status.service.ts` line 573, `system-status.module.ts` line 310
  - 상세: `QueueHandle` 은 서비스의 내부 구현 세부사항이나 모듈 파일에서 직접 import 하여 DI factory 타입 힌트로 사용한다. 현재 규모에서는 허용 가능하나, 인터페이스가 `constants.ts` 나 별도 `types.ts` 로 이동하면 순환 의존 위험이 줄어든다.
  - 제안: `QueueHandle` 인터페이스를 `system-status.constants.ts` 또는 `system-status.types.ts` 로 이동하는 것을 고려한다.

- **[INFO]** `isCron` 변수명이 그룹 비교 로직을 암묵적으로 표현
  - 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx` line 1057
  - 상세: `const isCron = queue.group === "system"` — `system` 그룹이 모두 cron 은 아닐 수 있으며(예: 비 cron 시스템 큐 추가 시), 그룹명과 변수명의 의미 간격이 생긴다.
  - 제안: `queue.group === "system"` 을 직접 사용하거나, 이름을 `isSystemGroup` 으로 변경하여 타입 표현과 일치시킨다.

- **[INFO]** e2e 테스트 내 `EXPECTED_QUEUE_NAMES` 배열이 `MONITORED_QUEUES` 상수와 별도로 하드코딩
  - 위치: `codebase/backend/test/system-status.e2e-spec.ts` line 728~741
  - 상세: 백엔드 `MONITORED_QUEUES` 를 import 하지 않고 문자열 배열로 다시 나열한다. 큐가 추가/삭제될 때 두 곳을 동시에 수정해야 한다.
  - 제안: e2e 테스트 환경에서 `system-status.constants.ts` 를 import 할 수 있다면 `SYSTEM_STATUS_QUEUE_NAMES` 를 재사용한다. 빌드 경계 문제로 import 가 불가하다면 현 상태를 유지하되 주석에 상수 파일과의 동기화 의무를 명시한다.

---

## 요약

전체적으로 설계가 명확하고 책임 분리가 잘 되어 있다. 백엔드는 상수·DTO·서비스·모듈 파일이 단일 책임으로 분리되어 있고, 서비스 함수 길이도 적절하다. `HEALTH_RANK` 상수를 통한 health 비교 패턴과 `ZERO_COUNTS` 불변 객체 활용은 좋은 관행이다. 프론트엔드 페이지도 `OverallHeader`, `QueueCard`, `CountCell` 로 컴포넌트 분리가 적절하다. 주요 유지보수 위험은 `HEALTH_DOT`/`GAUGE_FILL` 의 값 중복, 프론트-백엔드 간 타입 중복 선언, e2e 테스트의 큐 이름 하드코딩 정도이며 모두 INFO 수준이다.

## 위험도

LOW
