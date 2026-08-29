# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` — AST 기반 정적 가드(캐너리) 강화: `hasDefaultExport()` 헬퍼 신설, `ts.getModifiers(st as ts.HasModifiers)` 캐스트를 `ts.canHaveModifiers(st)` 가드로 교체, `EXPECTED_EXPORTS` 목록의 이름 갱신
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `NotificationEventType` → `InAppNotificationEventType` 단순 개명(값 `'notification.new'` 불변) + JSDoc 갱신
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 위 개명에 따른 import/re-export/사용처 3곳 갱신 (그 외 파일 본문은 unchanged context)
- `plan/in-progress/ws-event-types-extract.md` — 작업 추적 문서(마크다운), 실행 코드 아님

## 발견사항

없음.

이 diff 는 실질적으로 (1) 테스트 전용 AST 정적 분석 헬퍼의 리팩터, (2) enum 심볼 개명(런타임 wire 값 `'notification.new'` 은 그대로), (3) 그 개명의 참조처 3곳 갱신, (4) 계획 문서 갱신으로 구성된다. 사용자 입력을 다루는 경로, 인증/인가 로직, 암호화/마스킹 로직(`CREDENTIAL_KEY_PATTERN`, `deepRedactSecretsPreserving`, `sanitizePayloadForWs`, `allowlistFanoutNodeOutput`, 채널 authorizer 등)은 이번 diff 에서 **한 줄도 변경되지 않았다** — 전체 파일 컨텍스트에 나타나긴 하지만 unified diff 상 `+`/`-` 표시가 없는 순수 문맥이다.

개명 완전성을 별도로 grep 실측했다 — 백엔드 소스 전체에서 `NotificationEventType` 을 참조하는 곳은 개명 대상과 무관한 `triggers/dto/notification-config.dto.ts` 뿐이고(EIA §3.1 외부 webhook 구독 화이트리스트, 별개 타입), `websocket-events.types.ts`/`websocket.service.ts`/spec 세 곳은 모두 `InAppNotificationEventType` 으로 일관되게 갱신되어 있다. 옛 이름을 참조하는 잔여 코드가 없어 컴파일 타임에 조용히 잘못된 심볼로 폴백할 여지가 없다.

`websocket-events.types.spec.ts` 의 `hasDefaultExport()` 는 로컬 파일시스템의 고정 경로(`WS_DIR`, `SRC_ROOT` — 하드코딩된 상대경로, 사용자 입력 아님)만 읽는 dev/test 전용 정적 가드이므로 경로 탐색·인젝션 표면이 아니다. `ts.canHaveModifiers(st)` 가드 도입은 이전의 무조건 캐스트(`st as ts.HasModifiers`)보다 타입 안전성이 개선된 것으로, 보안이 아니라 정확성/유지보수성 개선이다.

enum 개명 자체는 `triggers/dto/notification-config.dto.ts` 의 동명 타입(webhook 구독 화이트리스트)과의 혼동을 이름 수준에서 제거해 "자동완성이 잘못된 심볼을 골라도 컴파일된다" 는 오import 위험을 줄인다 — 방어적 개선이지 새 취약점은 아니다.

## 요약

이번 변경분은 테스트 정적 가드 리팩터(TS AST 소진), enum 개명(값 불변), 그 참조처 갱신, 계획 문서로 구성되며 인젝션·인증/인가·입력 검증·암호화·에러 노출·의존성 표면 어느 것도 건드리지 않는다. 실제 보안 관련 로직(자격증명 키 마스킹, egress redaction, 채널 authorizer)은 이 diff 범위 밖(unchanged context)이다. 개명 완전성을 grep 으로 재확인했고 옛 심볼 잔존이나 참조 불일치는 없었다.

## 위험도

NONE
