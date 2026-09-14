# API 계약(API Contract) 리뷰

## 검토 범위

`git diff origin/main...HEAD --name-only` 로 변경 파일 전수를 확인했다. 컨트롤러
(`triggers.controller.ts`, `hooks.controller.ts`, `schedules.controller.ts`)와 DTO(`dto/**`),
`*.module.ts` 는 이번 배치(6개 커밋, `369852b4f`~`a92bce095`) 전체를 통틀어 **diff 0건**이다 —
`git diff origin/main...HEAD --name-only | grep -iE "controller|dto|\.module\.ts"` 가 빈 결과를
반환함을 직접 확인했다. 라우트·HTTP 메서드·요청 검증 스키마는 한 번도 건드려지지 않았다.

실제 변경은 서비스/영속성 계층(`triggers.service.ts` · `chat-channel-binder.service.ts` ·
신규 `trigger-config-lock.ts` · `hooks.service.ts` · `schedules.service.ts` ·
`chat-channel-input-rules.ts`)의 `trigger.config` lost-update 동시성 수정과, 그 수정을 지키는
테스트·정적 가드(`endpoint-path-conflict-wrap-guard.ts` 등)다. `CHANGELOG.md`·`plan/**`·
`review/**` 는 문서/산출물이라 API 표면과 무관하다.

이전 라운드(21_50_09)까지 이미 API 계약 관점 NONE 이 확정돼 있었다. 이번 라운드가 추가로
검토해야 할 신규 델타는 커밋 `a92bce095`(락 없이 `save(entity)` 하던 나머지 일곱 자리를 닫은
커밋)이며, 그 diff(`git show a92bce095 --stat`)를 직접 열어 다음을 확인했다.

## 발견사항

이번 델타에서도 API 계약 표면(라우트·응답 스키마·에러 코드·인증/인가·페이지네이션)에 영향을
주는 변경은 없다. 신규로 락 안 재작성/컬럼 한정 갱신으로 바뀐 일곱 자리를 개별 확인한 결과:

- **[정보/비-이슈]** `revokePerTriggerToken`(`POST /api/triggers/:id/interaction/revoke-token`)이
  삭제-경합 시 `throwTriggerNotFound()` 로 404 를 던지도록 바뀌었다(`triggers.service.ts` —
  `revokePerTriggerToken`, `if (!wroteInteraction) this.throwTriggerNotFound();`). 이 엔드포인트의
  컨트롤러 데코레이터는 이미 `@ApiNotFoundResponse({ description: 'Trigger 없음' })` 를 선언하고
  있어(`triggers.controller.ts` — `revokePerTriggerToken` 데코레이터), 신규로 관측 가능해진 이
  경로도 기존 문서화된 상태 코드 범위 안에 있다. 응답 바디 형태(`{ token: string }`)도 변경 없음.
- **[정보/비-이슈]** `rotateNotificationSecret`(`POST /api/triggers/:id/notification/rotate-secret`)은
  이번 델타에서 `save(trigger)` 대신 컬럼 한정 `update({ id }, { notificationSecretV2,
  notificationRotatedAt })` 로 바뀌었을 뿐, 응답 바디(`{ secret, rotatedAt }`)는 로컬 변수
  `newSecret`/`trigger.notificationRotatedAt` 에서 그대로 구성돼 저장 방식 변경과 무관하다.
  `BadRequestException({ code: 'NOTIFICATION_NOT_CONFIGURED' })` 400 분기도 그대로다.
- **[정보/비-이슈]** `schedules.service.ts` 의 schedule 편집이 trigger 를 동기화하는 자리(`name`·
  `isActive` 컬럼)도 `save(trigger)` → `triggerRepository.update({ id }, patch)` 로 바뀌었다.
  이 서비스가 노출하는 엔드포인트(`schedules.controller.ts`, diff 0건)의 응답은 `Schedule` 엔티티
  기반이라 `Trigger` 컬럼 쓰기 방식 변경이 응답 스키마에 영향을 주지 않는다.
- **[정보/비-이슈]** `promoteRotatedNotificationSecrets`·`cleanupRotatedChatChannelTokens` 는 cron
  전용 내부 메서드로 컨트롤러 어디에도 노출되지 않는다(`grep` 확인, 호출부는 스케줄러뿐) — API
  계약과 무관.
- **[정보/비-이슈]** `hooks.service.ts` 의 `touchLastTriggeredAt` 추출(두 호출부 공유)은 웹훅
  인입 hot path 의 응답 바디 조립 경로(`engine.execute()`/어댑터 결과)와 무관하며, 이전 라운드가
  이미 확인한 내용이 이번 델타(주석·JSDoc 정정)로도 유지된다.

## 관점별 확인

1. **하위 호환성**: 컨트롤러·DTO·라우트 서명 변경 없음. 유일한 관측 가능 변화(삭제-경합 시
   `revokePerTriggerToken` 이 404 를 던지는 것)는 기존에 문서화된 `@ApiNotFoundResponse` 범위
   안이고, 종전 버그(락 없이 통째 저장 시 삭제된 행이 되살아나거나 조용히 무시됐을 가능성)의
   수정이므로 breaking change 가 아니다.
2. **버전 관리**: 새 엔드포인트·버전 분기 없음 — 해당 없음.
3. **응답 형식**: `rotateNotificationSecret`/`revokePerTriggerToken`/`create`/`update` 의 응답
   바디는 저장 계층 변경과 무관하게 기존 로컬 변수/재조회 엔티티에서 그대로 구성된다 — 스키마
   변경 없음.
4. **에러 응답**: 신규 에러 코드 없음. 기존 `RESOURCE_NOT_FOUND`/`NOTIFICATION_NOT_CONFIGURED`/
   `NOT_PER_TRIGGER_STRATEGY` 포맷을 그대로 재사용.
5. **요청 검증**: DTO·validation pipe 변경 없음.
6. **URL/경로 설계**: 라우트 변경 없음.
7. **페이지네이션**: 목록 API 변경 없음 — 해당 없음.
8. **인증/인가**: 엔드포인트 자체 인증/인가 미들웨어 변경 없음. 이번 델타도 인입 웹훅 서명 검증
   (`inboundSigningRef`) fail-open 을 막는 이전 수정의 연장으로, 인가 성격의 보증을 약화하지
   않는다.

## 요약

이번 배치는 컨트롤러·DTO·라우트·페이지네이션·인증 미들웨어를 전혀 건드리지 않는 서비스/영속성
계층 동시성(lost-update) 버그 수정이며, 최신 델타(커밋 `a92bce095`)가 추가로 닫은 일곱 자리
(notification secret 정규화/회전, per-trigger 토큰 폐기, 승격 cron 둘, chat-channel v2 정리
cron, schedule 편집의 trigger 동기화)도 저장 방식(`save(entity)` → 락 안 재작성 또는 컬럼 한정
`update`)만 바뀌었을 뿐 응답 스키마·에러 코드·상태 코드는 그대로다. 유일하게 새로 관측 가능해진
동작(삭제 경합 시 `revokePerTriggerToken` 의 404)도 기존 Swagger 문서의 `@ApiNotFoundResponse`
범위 안에 있어 클라이언트 계약을 깨지 않는다. API 계약 관점에서 이번 배치를 막을 사유가 없다.

## 위험도

NONE
