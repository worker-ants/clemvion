# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] `extractClientIpFromHeaders` 반환형 `null → undefined` 통일 — 타입 계약 일관성 향상
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` 전체 / `hooks.service.ts` L149, L259, L629
- 상세: `extractClientIpFromHeaders`의 반환형을 `string | null`에서 `string | undefined`로 변경하고 소비처의 `?? undefined` 변환 표현을 제거했다. `extractClientIp(req)`는 `string | null` 유지(null이 의미상 "모든 소스 소진")로 두 함수 간 반환형이 비대칭이지만, 각 함수의 사용 맥락(헤더-only vs. req 전체)이 다르므로 허용 가능한 의도적 비대칭이다.
- 제안: 두 함수의 반환형 선택 이유를 JSDoc에 명시하는 것이 향후 혼란을 방지한다. 현재 주석에 충분히 설명되어 있어 현 상태 수용 가능.

### [INFO] `HooksService.getActiveExecutionStatus` — private bracket 접근 제거, 캡슐화 복원
- 위치: `hooks.service.ts` L884–L578, `executions.service.ts` L696–L701
- 상세: 과거 `this.executionsService['executionRepository']?.findOne(...)` 브래킷 접근은 TypeScript 가시성 경계를 우회하는 전형적인 캡슐화 위반이었다. 이번 변경에서 `ExecutionsService.getStatusById()` 공개 메서드를 추가하고 소비처를 교체해 모듈 경계를 복원했다. SOLID 의존성 역전 및 정보 은닉 원칙에 부합.
- 제안: 없음. 정방향 수정.

### [WARNING] `HooksService` 단일 책임 과부하 — 메서드 집합이 과도하게 광범위함
- 위치: `hooks.service.ts` — `handleWebhook`, `handleChatChannelWebhook`, `handleFormStep`, `forwardToInteractionService`, `reNoiseFormModal`, `buildInteractionResponse`, `maybeNotifyIgnored`, `sendExecutionStillRunningNotice`, `markChatChannelRateLimited`, `getActiveExecutionStatus` 등 총 10+ 메서드
- 상세: `HooksService`는 일반 webhook 처리, chat-channel 라우팅, Form 다단계 시퀀스, rate-limit 기록, EIA interaction token 구성, 외부 메시지 발송 안내 등을 모두 담당한다. 이는 SRP 위반이며 `handleChatChannelWebhook` 하나만으로도 300줄이 넘는다. `getActiveExecutionStatus`가 `ExecutionsService.getStatusById`의 terminal 필터 래퍼로만 존재하는 것도 이 서비스에 책임이 집중된 증거다.
- 제안: 이번 PR 범위를 벗어나 즉각 리팩터링을 요구하는 것은 부당하나, 향후 `ChatChannelWebhookHandler`(또는 `ChatChannelInboundService`), `FormStepProcessor` 등을 별도 서비스로 추출하는 방향을 백로그에 등록할 것을 권장한다.

### [INFO] `hooks.service.spec.ts` — IIFE mock factory 가독성 저하
- 위치: `hooks.service.spec.ts` L1618–L1633 (변경 diff 기준)
- 상세: `ExecutionsService` mock을 IIFE `(() => { ... })()`로 구성해 `executionRepository.findOne`을 `getStatusById` 구현에 위임한다. 기존 23개 테스트 사이트를 보존하기 위한 결정이지만, mock 안에서 실제 구현 로직을 재현하는 패턴은 테스트의 독립성 원칙(mock은 행동만 정의, 구현을 복사하지 않음)에 어긋난다.
- 제안: 중기적으로 `getStatusById`를 직접 `jest.fn().mockResolvedValue(null)`로 제어하고, `executionRepository.findOne` 의존성을 테스트에서 제거하는 방향으로 테스트를 리팩터링한다. 이번 변경의 과도기적 접근은 수용 가능.

### [INFO] `ExecutionsService.getStatusById` 오류 흡수 정책 — 레이어 경계 책임 배분
- 위치: `executions.service.ts` L696–L701
- 상세: `.catch(() => null)` 패턴으로 DB 조회 실패를 null로 흡수한다. 이는 소비처(`HooksService.getActiveExecutionStatus`)의 분기 단순화를 위해 의도된 결정이나, 오류 원인(네트워크 장애, 쿼리 타임아웃 등)이 조용히 사라진다. `getStatusById`가 null을 반환하면 소비처는 "execution 없음 또는 terminal"로 판정해 새 execution을 시작할 수도 있다.
- 제안: 옵션 A(현상 유지) — 오류 흡수를 명시적으로 주석에 기재하고 logger.warn을 추가해 observability를 보완. 옵션 B — 오류를 throw해 소비처가 fail-safe 결정(ignored 반환 등)을 직접 수행. 운영 맥락상 chat-channel 흐름은 fail-open이 맞으므로 현재 정책은 방향이 옳으나 로그 누락은 개선 필요.

### [INFO] `handleFormStep`의 `MAX_FIELDS_HEURISTIC = 10` 매직 상수 — 추상화 미완성
- 위치: `hooks.service.ts` L3406
- 상세: `handleFormStep` 내부에서 `MAX_FIELDS_HEURISTIC = 10`으로 필드 수를 판단한다. 주석에서 "v1 stub", "PR-E 보강"을 명시하고 있어 임시 결정임이 인지된다. 그러나 이 상수가 외부 설정이나 `formState`의 실제 필드 카탈로그와 연결되지 않아 실제 폼 필드 수와 불일치 가능성이 있다.
- 제안: 이번 PR 범위 외이나, PR-E에서 `state.formState.fieldsCatalog`를 도입할 때 이 상수를 제거하는 것을 명시적 TODO로 남긴다.

### [INFO] `GlobalExceptionFilter` 테스트 — `QueryFailedError` 레이어 의존성 노출
- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` L51–L66
- 상세: 공통 필터(`common/filters`) 테스트가 `typeorm`의 `QueryFailedError`를 직접 import한다. 필터가 DB 예외를 직접 처리하는 것은 인프라 계층 의존성이 프레젠테이션/인프라 크로스-커팅 레이어에 스며드는 것으로, 레이어 책임 분리 관점에서 주의가 필요하다. 그러나 `GlobalExceptionFilter`가 DB 예외를 HTTP 응답으로 매핑하는 cross-cutting concern을 담당한다는 점에서 현실적으로 피하기 어려운 구조다.
- 제안: 필터 내부에서 `QueryFailedError`를 처리할 때 `isUniqueViolation` 같은 추상화 헬퍼를 별도 파일(`db-error.utils.ts`)로 분리해 필터와 DB 인프라 간 직접 결합을 최소화하는 방향을 고려한다.

## 요약

이번 변경의 핵심은 두 가지다. 첫째, `extractClientIpFromHeaders`의 반환형을 `string | undefined`로 통일해 소비처의 `?? undefined` 변환 표현을 제거한 타입 계약 정리다. 둘째이자 더 중요한 것은 `HooksService.getActiveExecutionStatus`에서 `this.executionsService['executionRepository']` 브래킷 접근을 `ExecutionsService.getStatusById()` 공개 메서드로 대체해 모듈 캡슐화 경계를 복원한 것이다. 두 변경 모두 SOLID 원칙(정보 은닉, 인터페이스 분리)과 레이어 경계 명확화 방향에 부합한다. 잔존 우려는 `HooksService`의 단일 책임 과부하(chat-channel, form-step, rate-limit, EIA token 등)로, 이번 PR이 이를 악화시키지는 않으나 장기적 추출 리팩터링이 필요하다. `getStatusById`의 오류 흡수 정책은 fail-open 방향은 맞으나 logger.warn 보강이 권장된다.

## 위험도

LOW
