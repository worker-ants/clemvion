# 보안(Security) Review

## 발견사항

이번 변경은 `chat-channel↔triggers` 양방향 forwardRef 순환 의존을 단방향화하는 순수 구조 리팩터링이다. 신규 비즈니스 로직 없이 코드 위치만 이전(verbatim move)하였으므로, 보안 관점의 신규 취약점 도입 여부를 중심으로 검토한다.

---

### [INFO] `rotateBotToken` 엔드포인트 — `@Roles` 데코레이터 누락
- **위치**: `codebase/backend/src/modules/triggers/triggers.controller.ts` — 새로 추가된 `rotateBotToken` 핸들러 (라인 1493~1516)
- **상세**: 같은 컨트롤러의 `rotateNotificationSecret`, `revokePerTriggerToken` 에는 `@Roles('editor')` 가 명시되어 있으나, 이번에 이전된 `rotateBotToken` 에는 해당 데코레이터가 없다. 삭제된 원본 `ChatChannelController.rotateBotToken` 도 동일하게 `@Roles` 없이 작성되어 있었으므로, 이번 리팩터링에서 새로 도입된 취약점은 아니다. 그러나 bot token 교체는 민감한 보안 작업(외부 provider 인증 자격증명 갱신)이므로 적어도 `editor` 이상 권한으로 제한하는 것이 적합하다. 현재 상태에서는 인증된 모든 워크스페이스 멤버(viewer 포함)가 호출 가능하다.
- **제안**: `@Roles('editor')` 추가. 기존 `rotateNotificationSecret`·`revokePerTriggerToken` 패턴을 그대로 따른다. (이번 PR 범위 외 pre-existing 이슈지만, 코드 이전 시점에 동기화하는 것이 자연스럽다.)

---

### [INFO] `handleHourly` 에러 메시지에 예외 메시지 노출
- **위치**: `codebase/backend/src/modules/triggers/chat-channel-token-rotator.service.ts` 라인 854~856
- **상세**: `err.message` 를 logger.warn 으로 출력한다. 원본 `chat-channel` 위치에서도 동일했던 패턴(verbatim move)이다. logger 출력은 서버 측 로그이므로 클라이언트에 노출되지 않는다. 다만 스택 트레이스 없이 메시지만 남겨 DB 에러 등 내부 구현 세부사항이 서버 로그에 기록될 수 있다. 실제 공격 가능성은 없다.
- **제안**: 현재 패턴 유지로 충분. 필요 시 구조화 로그(JSON, 에러 코드 분리)로 개선 가능하나 보안 결함은 아님.

---

### [INFO] `triggerId` 파라미터 — ParseUUIDPipe 미적용
- **위치**: `codebase/backend/src/modules/triggers/triggers.controller.ts` 라인 1501, `@Param('id') triggerId: string`
- **상세**: 같은 컨트롤러의 다른 엔드포인트(`findOne`, `update`, `remove`, `getHistory`, `rotateNotificationSecret`, `revokePerTriggerToken`)는 `@Param('id', ParseUUIDPipe)` 로 UUID 형식을 강제하지만, 이번에 이전된 `rotateBotToken` 은 `ParseUUIDPipe` 없이 raw string 을 받는다. 원본 `ChatChannelController` 도 동일하게 미적용이었으므로 신규 도입이 아니다. Service 계층에서 workspaceId 기반 권한 검증이 이루어지므로 SQL injection 직접 위험은 없으나, 임의 문자열 값이 DB 쿼리 파라미터로 전달될 수 있다.
- **제안**: `@Param('id', ParseUUIDPipe) triggerId: string` 으로 일관성 맞춤. (pre-existing, 이번 PR에서 동기화 가능)

---

## 요약

본 변경은 DI 순환 구조 해소를 위한 코드 이동(verbatim move)으로, 신규 보안 취약점 도입이 없다. 세 건의 INFO 항목 모두 원본 `ChatChannelController` 에서 그대로 이전된 pre-existing 이슈다. 그 중 `@Roles` 누락은 bot token 이라는 민감한 자격증명 갱신 엔드포인트에 대한 권한 통제 미흡으로 향후 수정이 권장되나, 현재 상태에서도 인증(JWT) 자체는 `@ApiBearerAuth('access-token')` + 컨트롤러 수준 Guard 로 보호된다. 하드코딩된 시크릿, 인젝션 취약점, 안전하지 않은 암호화, 민감정보 응답 노출 등 OWASP Top 10 해당 항목은 발견되지 않았다.

## 위험도

LOW
