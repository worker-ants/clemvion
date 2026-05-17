# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `POST /notifications/:id/dismiss` 와 `POST /notifications/dismiss-all` 라우트 순서가 Express(NestJS) 라우터에서 잠재적 충돌 가능성
  - 위치: `backend/src/modules/notifications/notifications.controller.ts` — `@Post(':id/dismiss')` 및 `@Post('dismiss-all')`
  - 상세: NestJS/Express 라우터는 등록 순서로 매칭한다. 현재 컨트롤러에서 `@Post(':id/dismiss')`(파라미터 포함)가 `@Post('dismiss-all')`보다 먼저 정의되어 있다. 경로 세그먼트 수가 서로 다르므로(`/dismiss-all` vs `/:id/dismiss`) 실제 충돌은 발생하지 않지만, 순서 의존성이 명확하지 않아 향후 유사 패턴 추가 시 라우트 shadowing이 발생할 수 있다.
  - 제안: 고정 경로(`dismiss-all`)를 파라미터 경로(`:id/dismiss`)보다 먼저 선언해 의도를 명확히 한다. RESTful 관점에서도 고정 경로가 파라미터 경로보다 우선 등록되는 것이 관례이다.

- **[WARNING]** `POST /notifications/dismiss-all`에 `@ApiNotFoundResponse` 누락 — 에러 응답 스펙 불일치
  - 위치: `backend/src/modules/notifications/notifications.controller.ts` 내 `dismissAll` 핸들러
  - 상세: `POST /notifications/:id/dismiss`는 `@ApiNotFoundResponse`가 선언되어 있으나, `dismissAll`에는 없다. 일괄 dismiss의 경우 workspace 자체가 존재하지 않을 때의 응답 스펙이 Swagger 문서에서 누락된다. 런타임 동작은 `WorkspaceId` 데코레이터 레벨에서 처리될 수 있으나, 문서 계약이 불완전하다.
  - 제안: `@ApiBadRequestResponse` 또는 `@ApiUnauthorizedResponse` 외에도 워크스페이스 미존재 등에 대한 응답 스펙을 Swagger에 추가하거나, 에러 처리 범위를 주석으로 명시한다.

- **[INFO]** `DismissNotificationResponseDto`에 `dismissedAt` 필드가 `string` 타입이지만, `NotificationsService.dismiss()`는 `Date` 타입을 반환
  - 위치: `backend/src/modules/notifications/dto/responses/dismiss-notification-response.dto.ts` (`dismissedAt: string`) vs `backend/src/modules/notifications/notifications.service.ts` (`Promise<{ id: string; dismissedAt: Date }>`)
  - 상세: DTO는 `dismissedAt: string`(ISO 8601 문자열)을 선언하나, 서비스 반환값은 `Date` 객체다. NestJS의 직렬화(`ClassSerializerInterceptor` 또는 plain object 직렬화)를 통해 런타임에 자동 변환되더라도, DTO 타입과 실제 반환 타입 간의 불일치가 있다. e2e 테스트에서 `dismissedAt`이 문자열로 수신되는 것을 확인하나, 명시적 변환 레이어가 없으면 타입 계약이 모호하다.
  - 제안: 서비스 반환 타입을 `{ id: string; dismissedAt: string }` 으로 통일하거나, 컨트롤러에서 `toISOString()` 변환을 명시한다.

- **[INFO]** `output.result.*` → `output.*` 내부 스키마 변경이 외부 API 계약에 미치는 영향 확인 필요
  - 위치: `backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `buildConversationConfigFromOutput` 관련 diff (파일 5)
  - 상세: AI agent 핸들러의 `output` shape이 `output.result.{messages, message, turnCount}` 에서 `output.{messages, message, turnCount}` 로 변경(D6 롤백). 이 shape이 WebSocket 프로토콜(spec/5-system/6-websocket-protocol.md §4.4.6)을 통해 클라이언트에게 전달되는 경우, 클라이언트가 기존 `output.result.*` 구조를 소비 중이라면 breaking change가 된다. 코드 변경의 주석("D6 (2026-05-17) — waiting output.result.* 단일 경로")을 삭제하고 이전 shape으로 복귀하는 것이 이번 PR의 의도로 보이나, 클라이언트 측 영향 범위가 이 리뷰 범위에서 확인되지 않는다.
  - 제안: 프론트엔드 측에서 `output.result.*` 경로를 소비하는 코드가 있는지 명시적으로 확인하고, 있다면 동시에 업데이트되었는지 검토한다.

- **[INFO]** `NotificationDto`에 `dismissedAt` 필드 추가 — 기존 클라이언트에 대한 필드 추가는 하위 호환성 유지
  - 위치: `backend/src/modules/notifications/dto/responses/notification-response.dto.ts` (파일 14)
  - 상세: 기존 `NotificationDto`에 `dismissedAt?: string | null` (optional)이 추가되었다. 목록 API는 `dismissed_at IS NULL` 필터를 적용하므로 응답에 나타나는 값은 항상 `null`이 된다. 이는 새 필드를 모르는 기존 클라이언트가 무시하면 되므로 additive change로 하위 호환성이 유지된다.
  - 제안: 현재 구현 적절. `dismissedAt`이 목록 응답에 항상 `null`로 노출되는 것이 의도적임을 DTO 주석에 명확히 기재되어 있어 양호하다.

## 요약

이번 변경은 알림 dismiss(soft delete) 기능을 신규 API 엔드포인트 2개(`POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all`)로 추가한다. 기존 엔드포인트(`GET /notifications`, `GET /notifications/unread-count`, `PATCH /:id/read`, `POST /mark-all-read`)는 변경되지 않으며, `NotificationDto`에 `dismissedAt` 필드가 optional로 추가되어 하위 호환성이 유지된다. 인증/인가는 기존 `@ApiBearerAuth`·`@CurrentUser`·`@WorkspaceId` 데코레이터를 통해 적절히 적용되어 있고, 본인 소유 알림이 아닌 경우 404로 차단된다. 멱등성 설계, 페이지네이션 유지, HTTP 상태코드(200/404) 적용, Swagger 문서화가 전반적으로 양호하다. 다만, `dismissAll`에 대한 Swagger 에러 응답 스펙 불완전, DTO-서비스 반환 타입 간 `Date`/`string` 불일치, 라우트 선언 순서 관례 미준수, 그리고 `output.result.*` shape 롤백의 클라이언트 영향 확인 필요성이 부차적 개선 사항으로 남는다.

## 위험도

LOW
