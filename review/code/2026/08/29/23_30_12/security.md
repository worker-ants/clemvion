# Security Review — ws-event-types-followups

## 대상 요약

- `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` — JSDoc 에 `InAppNotificationEventType` 과 무관하다는 disambiguation 한 줄 추가. 코드/검증 로직 불변 (SSRF 체크 `checkSsrfSafeUrl`, `IsIn` 화이트리스트 등 전부 그대로).
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `enum NotificationEventType` → `enum InAppNotificationEventType` 순수 개명. enum value(`NOTIFICATION_NEW = 'notification.new'`)는 불변이라 wire 계약 변화 없음.
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 위 개명에 따른 import/re-export/사용처 갱신 3곳. `emitNotificationEvent()`의 채널 인가(`NotificationsChannelAuthorizer`, JWT `sub == userId`, fail-closed) 로직·에러 처리(예외 삼키고 warn log 만)는 diff 밖 — 불변.
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` — 테스트 전용 정적 가드(`hasDefaultExport`) 리팩터. `ts.canHaveModifiers`/`ts.getModifiers` 로 타입-안전 좁히기, `export { X as default }` 별칭 형태 추가 감지, 합성 소스(`ts.createSourceFile`) 기반 테이블 테스트 추가. 실행 대상은 저장소 내 고정 소스 파일 경로(`TYPES_FILE`, `websocket.service.ts`)뿐이라 외부/사용자 입력 없음.
- `plan/in-progress/ws-event-types-extract.md`, `review/**` 산출물 — 문서/리뷰 메타데이터. 시크릿·자격증명·실행 코드 없음.

`git diff --stat origin/main -- codebase/` 로 codebase 변경 범위를 재확인 — prompt 에 표시된 4개 파일이 전부이며 숨겨진 애플리케이션 코드 변경은 없음.

## 점검 관점별 확인

1. **인젝션**: 해당 없음. 신규/변경된 코드에 사용자 입력을 다루는 경로가 없음(enum 개명, 정적 AST 검사기, JSDoc).
2. **하드코딩된 시크릿**: 없음.
3. **인증/인가**: `emitNotificationEvent` 의 채널 인가는 diff 밖(`NotificationsChannelAuthorizer`)이고 이번 변경으로 건드리지 않음. enum 심볼명만 바뀌었고 `broadcastToChannel` 호출 시그니처·인자 값은 동일.
4. **입력 검증**: `notification-config.dto.ts` 의 `IsIn(NOTIFICATION_EVENT_TYPES)`, `checkSsrfSafeUrl` 등 검증 로직 자체는 변경 없음 — JSDoc 만 추가.
5. **OWASP Top 10**: 해당 사항 없음(순수 리팩터/개명/테스트 하드닝).
6. **암호화**: 관련 코드(HMAC 서명 등) 변경 없음.
7. **에러 처리**: `emitNotificationEvent` 의 catch 블록(에러 메시지를 로그에만 남김, WS 클라이언트로 미전파)은 변경 없음. 민감정보 노출 신규 경로 없음.
8. **의존성 보안**: 신규 의존성 추가 없음. TS 컴파일러 API(`typescript` 패키지)의 기존 호출 방식만 확장.

## 발견사항

없음.

## 요약

이번 변경은 `NotificationEventType` → `InAppNotificationEventType` enum 심볼 개명(wire 값 불변) 과 그에 따른 import/재-export/사용처 동기화, disambiguation JSDoc 추가, 그리고 테스트 전용 정적 가드(`hasDefaultExport`)의 타입 안전성·커버리지 개선(별칭 export 형태 감지 + 합성 소스 테이블 테스트)으로 구성된다. 사용자 입력 처리, 인증/인가, 암호화, 에러 응답 경로 중 어느 것도 이번 diff 로 수정되지 않았으며, `codebase/` 전체 diff 재확인 결과 프롬프트에 제시된 4개 파일 외 숨겨진 애플리케이션 코드 변경도 없다. 보안 관점에서 유의미한 리스크가 없다.

## 위험도

NONE
