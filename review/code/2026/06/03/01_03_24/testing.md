# Testing 리뷰 — system-status-page

## 발견사항

### [INFO] 컨트롤러 단위 테스트 부재
- 위치: `codebase/backend/src/modules/system-status/system-status.controller.ts`
- 상세: `SystemStatusController.getOverview()`는 서비스 위임만 수행하는 단순 구조이지만, 인증 가드(JWT) 적용 여부와 `@ApiOkWrappedResponse` 데코레이터로 인한 래핑 동작을 검증하는 컨트롤러 레벨 단위 테스트가 없다. 401 응답 확인은 e2e에서만 이루어진다.
- 제안: NestJS Testing Module을 사용한 컨트롤러 스펙 파일 추가는 선택 사항이나, 현재 e2e에서 401을 커버하므로 LOW 위험.

### [INFO] 모듈 팩토리 프로바이더 인덱스 매핑 테스트 부재
- 위치: `codebase/backend/src/modules/system-status/system-status.module.ts` (팩토리 useFactory 블록)
- 상세: `MONITORED_QUEUE_HANDLES` 팩토리가 `MONITORED_QUEUES.map((meta, index) => ({ meta, queue: queues[index] }))` 형태로 `index` 기반으로 큐 인스턴스를 매핑한다. `SYSTEM_STATUS_QUEUE_NAMES`는 `MONITORED_QUEUES.map(q => q.name)`으로 파생되므로 현재는 안전하지만, 추후 `inject` 배열을 수동으로 수정할 경우 조용히 잘못된 메타-큐 매핑이 발생할 수 있다. 이 불변식을 검증하는 테스트가 없다.
- 제안: 상수 레벨에서 `SYSTEM_STATUS_QUEUE_NAMES`가 `MONITORED_QUEUES` 순서와 일치함을 검증하는 간단한 단위 테스트 추가 고려.

### [INFO] 환경변수 기반 임계값 변경 테스트 불가
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (FAILED_DEGRADED_THRESHOLD, DELAYED_DEGRADED_THRESHOLD), `system-status.service.spec.ts`
- 상세: 두 임계값 상수가 모듈 로드 시 `process.env`를 읽어 고정된다. 서비스 스펙은 기본값(1, 50)만 테스트하며 환경변수 변경 케이스는 테스트되지 않는다. `deriveHealth`가 이 상수를 직접 참조하므로 테스트에서 값을 변경하기 어렵다.
- 제안: 임계값을 서비스 생성자 파라미터로 주입하는 구조 변경으로 테스트 용이성 향상을 고려하거나, Jest `jest.resetModules()` + 환경변수 재설정 패턴으로 커버.

### [INFO] `deriveHealth` 복합 조건 우선순위 테스트 미비
- 위치: `codebase/backend/src/modules/system-status/system-status.service.spec.ts`
- 상세: `paused=true && failed>=threshold` 동시 성립 시 `down` 반환(paused 우선)은 spec §3 규칙상 올바르나 명시적 테스트가 없다. 또한 `waiting>0 && active=0 && failed>=threshold` 조합에서 `down`이 `degraded`를 이기는 케이스도 미검증이다. spec이 "순서로 평가"를 명시하므로 이 우선순위를 보증하는 테스트가 필요하다.
- 제안: 두 조건 동시 성립 케이스 테스트 추가 — "paused + failed 초과 → down", "waiting>0, active=0, failed>=threshold → down".

### [INFO] e2e 큐 이름 하드코딩으로 인한 드리프트 위험
- 위치: `codebase/backend/test/system-status.e2e-spec.ts` (EXPECTED_QUEUE_NAMES 배열)
- 상세: `EXPECTED_QUEUE_NAMES`가 `system-status.constants.ts`의 `MONITORED_QUEUES`와 독립적으로 하드코딩되어 있다. 큐가 추가/삭제될 때 e2e 파일도 수동으로 갱신해야 하며, 동기화 누락 시 테스트가 틀린 기대값으로 통과할 수 있다.
- 제안: `MONITORED_QUEUES` 상수를 e2e에서 직접 임포트해 `EXPECTED_QUEUE_NAMES`를 파생시키는 방식으로 단일 진실 원칙 적용 고려.

### [INFO] `utilization > 1.0` 엣지 케이스 미처리 및 테스트 부재
- 위치: `codebase/backend/src/modules/system-status/system-status.service.ts` (computeUtilization), `codebase/frontend/src/app/(main)/system-status/page.tsx` (utilPct 계산)
- 상세: 백엔드 `computeUtilization`은 상한 없이 `active / concurrency`를 반환한다. BullMQ에서 `active > concurrency`가 발생하면 `utilization > 1.0`이 반환될 수 있다. 프론트엔드는 `Math.min(..., 100)`으로 상한을 처리하지만 백엔드 스펙/테스트에는 이 케이스가 없다. 서비스 스펙에 `active > concurrency` 케이스가 미검증 상태다.
- 제안: 서비스 스펙에 `makeHandle('x', 'execution', 1, { active: 3 })` 케이스 추가. 백엔드에서도 `Math.min(result, 1)`로 상한 처리 또는 스펙 코멘트로 프론트엔드 의존 명시.

### [INFO] 프론트엔드 컴포넌트 테스트 전무
- 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx`
- 상세: `SystemStatusPage`, `OverallHeader`, `QueueCard`, `CountCell`, `extractData` 헬퍼에 대한 단위/통합 테스트가 없다. 특히 `extractData<T>` 함수(`res.data.data ?? res.data` 래핑 처리)와 `QueueCard`의 `system` 그룹 vs 일반 그룹 분기(게이지 vs "정기 작업" 표기)는 로직 분기가 있어 테스트 가치가 높다.
- 제안: `extractData` 헬퍼 단위 테스트, `QueueCard` 그룹별 렌더링 분기 테스트 추가. 프로젝트의 프론트엔드 테스트 작성 패턴에 따라 우선순위 조정.

### [INFO] Redis 실패 시 `totalFailed` 과소 집계 케이스 테스트 주석 미흡
- 위치: `codebase/backend/src/modules/system-status/system-status.service.spec.ts` (lines 505-526)
- 상세: Redis 실패 큐는 `counts.failed = 0`으로 대체되어 `totalFailed`에 기여하지 않는다. 현재 테스트에서 이 동작은 검증되지만, 실제로 많은 failed job이 있던 큐가 Redis 다운으로 0으로 집계되는 경우에 대한 설명이 테스트 설명에 없다. 이는 버그가 아닌 의도된 동작이나 운영자가 오해할 수 있다.
- 제안: 해당 테스트 설명(it 문자열)에 "Redis 다운 큐의 failed는 0 대체 — totalFailed 과소 집계 가능" 주석 추가로 의도 명확화.

---

## 요약

백엔드 서비스 단위 테스트(`system-status.service.spec.ts`)는 10개 케이스로 health 파생 로직, utilization 계산, overall 집계, Redis 실패 격리 등 핵심 비즈니스 로직을 양호하게 커버하며 mock 설계(`QueueHandle` 인터페이스 부분 구현)도 적절하다. e2e 테스트는 인증, 12개 큐 열거, 필드 구조, 워크스페이스 무관성을 커버해 spec 요구사항(NAV-SS-01~06)을 충분히 검증한다. 주요 갭은 (1) 환경변수 기반 임계값 테스트 불가 — `deriveHealth`가 모듈 레벨 상수를 직접 참조하여 테스트 격리가 어려운 구조적 문제, (2) 프론트엔드 컴포넌트 테스트 전무, (3) `utilization > 1.0` 엣지 케이스, (4) e2e 큐 이름 하드코딩 드리프트 위험이다. 모두 INFO 등급으로 현재 구현의 기능 정확성에 즉각적 위험은 없으나, 임계값 테스트 불가는 환경변수 조정 후 회귀 검증이 어렵다는 구조적 약점으로 중장기 개선이 권장된다.

## 위험도

LOW
