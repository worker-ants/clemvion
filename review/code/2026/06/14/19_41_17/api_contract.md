# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] `ApiAcceptedWrappedResponse` / `ApiOkWrappedResponse` 전환 — 응답 스키마 일관성 향상
- 위치: `interaction.controller.ts` 변경 라인 66, 107, 130, 158
- 상세: `@ApiAcceptedResponse({ type: Dto })` / `@ApiOkResponse({ type: Dto })` 를 공용 래퍼 `ApiAcceptedWrappedResponse(Dto)` / `ApiOkWrappedResponse(Dto)` 로 교체. 실제 런타임 응답은 이미 `{ data: ... }` 래퍼로 직렬화되고 있었으나 Swagger 문서는 래퍼 없는 flat 스키마를 노출했던 불일치를 해소. 기존 API 행동(HTTP 상태 코드·바디 구조)은 변경 없이 문서 정합성만 개선된 것이므로 breaking change 없음.
- 제안: 현행 변경 방향 유지. 에러 응답(`@ApiBadRequestResponse` 등)도 공용 `ErrorResponseDto` 래퍼 스키마와 정합하는지 별도 점검 권장(본 변경 범위 외).

### [INFO] `TERMINAL_REVOKE_RECONCILE_QUEUE` 상수 types 파일 분리 — API 계약 간접 영향 없음
- 위치: `terminal-revoke-reconciler.types.ts` 신규 생성, `terminal-revoke-reconciler.service.ts` / `external-interaction.module.ts` / `terminal-revoke-reconciler.service.spec.ts` / `system-status.constants.ts` import 수정
- 상세: BullMQ 큐 이름 상수를 서비스 구현 파일에서 별도 types 파일로 이동. `system-status.constants.ts` (모니터링 레지스트리)가 서비스 파일 전체를 import 하던 순환 의존성 위험을 제거. 큐 이름 리터럴(`'terminal-revoke-reconcile'`)은 변경 없으므로 런타임 큐 연결·메시지 라우팅에 영향 없음.
- 제안: 해당 없음.

### [INFO] `InteractionTokenService` dev fallback secret 교체 — 인증 토큰 서명 키 변경
- 위치: `interaction-token.service.ts` 라인 852, 868-869
- 상세: dev/test 환경 fallback 서명 키를 하드코딩 `'interaction-fallback'` 에서 모듈 로드 시 1회 생성하는 `randomBytes(32)` ephemeral 값으로 변경. 프로덕션(`NODE_ENV=production`)은 fail-closed(throw) 로 이미 보호되며 변경 대상이 아님. dev 환경에서는 프로세스 재시작마다 서명 키가 바뀌어 기존 dev 토큰이 무효화되나 이는 의도된 보안 강화임. API 외부 클라이언트에 대한 계약 변경은 없음 — 프로덕션 토큰 서명에 영향 없음.
- 제안: 경고 로그가 적절히 기록되고 있어 운영자 가시성 확보. 현행 유지.

### [INFO] 토큰 검증 실패 응답 이유 코드 일관성
- 위치: `interaction-token.service.ts` `VerifyResult.reason` 유니온 타입 (라인 958-964)
- 상세: `malformed | expired | blacklisted | audience_mismatch | scope_mismatch` 5가지 이유 코드가 정의되어 있음. 컨트롤러는 이 값을 직접 응답 바디에 노출하지 않고 Guard 레이어(`InteractionGuard`)를 통해 HTTP 401/403 으로 변환하는 구조로 보임. 이유 코드 문자열 자체가 외부 API 응답에 포함되는지, 포함된다면 스키마에 열거형으로 문서화되어 있는지 확인이 필요함.
- 제안: Guard/인터셉터에서 에러 코드를 응답 바디에 그대로 노출할 경우 `ApiUnauthorizedResponse` 에 이유 코드 enum 명세를 추가하면 클라이언트 에러 처리 정합성이 높아짐. 현 변경 범위 내에서는 별도 조치 불요.

## 요약

이번 변경은 API 외부 행동(URL 구조·HTTP 상태 코드·요청/응답 바디 형식)을 변경하지 않는다. 핵심 변경은 세 가지다: (1) Swagger 문서 데코레이터를 실제 런타임 응답 래퍼 구조(`{ data: ... }`)와 일치시켜 문서 정합성을 향상시킨 것, (2) BullMQ 큐 이름 상수를 별도 types 파일로 분리해 의존성 구조를 개선한 것, (3) dev fallback 서명 키를 예측 불가능한 ephemeral 값으로 교체해 개발 환경 보안을 강화한 것. 기존 API 클라이언트에 대한 breaking change 는 없으며 인증/인가 플로우도 그대로 유지된다.

## 위험도

NONE
