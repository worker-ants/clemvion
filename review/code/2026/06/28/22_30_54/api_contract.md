# API 계약(API Contract) 리뷰 결과

## 발견사항

### [INFO] `extractClientIpFromHeaders` 반환형 `null` → `undefined` 변경 — 내부 API 시그니처 변경
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts` L558-568
- 상세: `extractClientIpFromHeaders`의 반환형이 `string | null`에서 `string | undefined`로 변경되었다. 이 함수는 외부 HTTP 클라이언트가 직접 호출하는 엔드포인트 계약이 아니라 내부 서비스 유틸리티이므로, 하위 호환 파괴의 범위는 동일 레포지토리 내 소비처(hooks.service.ts, 테스트 파일)로 한정된다. 소비처 `hooks.service.ts` 에서 `?? undefined` 중복 제거도 함께 적용되었고, `extractClientIp(req)` (public-facing, `string | null` 유지)와의 반환형 불일치가 명확히 분리되어 있다. 외부 API 응답 형식에는 영향이 없다.
- 제안: 현 처리 방식이 적절하다. 다만 `extractClientIp`(req 버전)가 여전히 `string | null`을 반환하여 두 함수의 반환형이 다른 점은 같은 모듈 내 일관성 관점에서 주석으로 명시되어 있어 drift 위험은 낮다.

### [INFO] `GlobalExceptionFilter` — QueryFailedError(23505) → 409 매핑 확인
- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` L54-68
- 상세: DB 유니크 위반(PostgreSQL error code 23505)을 409 RESOURCE_CONFLICT로 매핑하는 테스트가 추가되었다. 응답 에러 코드가 `RESOURCE_CONFLICT`이고, driver 원문(`duplicate key value`)이 응답 바디에 노출되지 않음을 단언한다. CWE-209 준수 및 에러 응답 형식 일관성 측면에서 올바른 계약이다.
- 제안: 현 방향이 적절하다. 409 상태 코드와 `RESOURCE_CONFLICT` 에러 코드의 조합은 REST 의미론에 부합한다.

### [INFO] `GlobalExceptionFilter` — nested `{ error: { code, message, details } }` 봉투 처리 테스트 추가
- 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` L71-93
- 상세: `HttpException`을 `{ error: { code, message, details } }` 형식으로 throw 했을 때 필터가 올바르게 펼쳐서 외부 응답 봉투로 직렬화함을 검증하는 테스트가 추가되었다. API §5.3 봉투 스키마 준수를 명시적으로 단언한다. `requestId`가 5xx뿐 아니라 4xx에서도 항상 발급됨도 포괄적으로 검증하고 있어, 클라이언트가 에러 응답에서 `requestId`를 신뢰할 수 있다는 계약이 강화된다.
- 제안: 현 테스트 커버리지가 적절하다.

### [INFO] `ExecutionsService.getStatusById` — 공개 메서드 추가 (캡슐화 개선)
- 위치: `codebase/backend/src/modules/executions/executions.service.ts` L699-704
- 상세: `HooksService`가 기존에 `executionsService['executionRepository']` private 브래킷 접근으로 status를 조회하던 패턴을 `getStatusById(id)` 공개 메서드로 캡슐화했다. 이 메서드는 외부 HTTP API로 노출되지 않고 서비스 내부 호출 전용이다. 조회 실패를 `.catch(() => null)`로 흡수하는 fail-soft 정책은 웹훅 처리 흐름(chat-channel 경로)에서 DB 장애가 전체 웹훅 거부로 이어지지 않도록 하는 의도적 결정이다.
- 제안: 현 설계가 적절하다. 다만 status 조회 실패를 null(terminal로 취급)로 흡수하면, DB 장애 시 `waiting_for_input` 상태인 execution에 메시지가 forwarding되지 않고 새 execution이 시작될 수 있다. 이는 이미 코드 주석에 인지된 fail-open 트레이드오프이며 외부 API 계약을 위반하지 않는다.

### [INFO] `HooksService.getActiveExecutionStatus` — private 브래킷 접근 제거
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L884-878 (diff 기준)
- 상세: `this.executionsService['executionRepository']?.findOne?.(...)` private 접근이 `this.executionsService.getStatusById(executionId)` 공개 API 호출로 교체되었다. 이는 TypeScript 타입 시스템 우회를 제거하는 리팩터링이며 외부 API 계약에 직접적 영향이 없다. 행동 동등성(DB 조회 로직, catch → null)은 유지된다.
- 제안: 현 변경이 올바르다.

### [INFO] `hooks.service.ts` — `clientIp ?? undefined` 중복 제거
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` L149/198/259/629 (diff 기준)
- 상세: `extractClientIpFromHeaders`의 반환형이 이제 `string | undefined`이므로, `?? undefined` 연산자가 더 이상 필요하지 않아 4곳에서 제거되었다. `sourceIp` 필드의 값이 `undefined`일 때 API 계약상 소스 IP 없음으로 처리되는 동작은 변하지 않는다. 호출 이력(§A.3) 영속에도 영향 없다.
- 제안: 현 변경이 적절하다.

---

## 요약

이번 변경은 외부 HTTP API 계약에 직접적인 영향을 주는 breaking change가 없다. 주요 변경은 (1) 내부 유틸리티 함수 `extractClientIpFromHeaders`의 반환형 통일(`null` → `undefined`)로 소비처 중복 제거, (2) `GlobalExceptionFilter` 테스트 보강(QueryFailedError 23505 → 409 매핑, nested error 봉투 처리, 5xx requestId 항상 발급), (3) `ExecutionsService.getStatusById` 공개 메서드 추가로 private 브래킷 접근 캡슐화 등이다. 에러 응답 구조(code/message/requestId/details), HTTP 상태 코드 적절성(409 유니크 위반, 410 비활성 트리거, 400 검증 실패, 202 웹훅 수락)이 모두 기존 API 봉투 스키마를 준수하며, 외부 클라이언트에 노출되는 엔드포인트 응답 형식의 변화는 발견되지 않는다.

## 위험도

NONE

STATUS=success ISSUES=0
