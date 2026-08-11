# Security Review — `13_04_55`

## 범위

직전 3라운드(`12_22_23`, `12_37_14`, `12_56_06`) 모두 security 판정 NONE. 이번 라운드의 델타는
커밋 `3db28b205` 단일 커밋이며, `git show 3db28b205`로 확인한 결과 **production 코드 변경은
0건**이다:

- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 자매 두 메서드
  (`rotateNotificationSecret`/`revokePerTriggerToken`)의 실패경로 회귀를 한 `it()`에 몰아
  놓았던 것을 각각 독립된 `it()`로 분리. assertion·mock 값 자체는 그대로, 구조만 바뀌었다.
- `plan/in-progress/spec-sync-auth-gaps.md` — 등재만.
- `review/code/2026/08/11/12_56_06/{SUMMARY,RESOLUTION,_retry_state.json,...}` — 리뷰 산출물
  신규 생성.

델타가 사소하므로 지시대로 **PR 전체(브랜치 `claude/trigger-rotation-audit` vs `origin/main`,
커밋 `d71a53127`~`3db28b205`)를 대상으로 3가지 관점을 직접 코드에서 재확인**했다.

## 1. 회전/폐기 3종 감사 기록이 시크릿·토큰 원문을 `audit_log`에 유출하지 않는가

`triggers.service.ts`의 공용 헬퍼를 확인:

```
private recordAudit(params: {...}): Promise<void> {
  return this.auditLogsService.record({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: params.action,
    resourceType: TRIGGER_RESOURCE_TYPE,
    resourceId: params.resourceId,
    details: { type: params.type },   // ← trigger.type (예: 'webhook') 뿐
  });
}
```

3개 신규 호출부(`rotateNotificationSecret` L924-930, `revokePerTriggerToken` L972-979,
`rotateBotToken` L1112-1119, 실제 줄번호는 아래 "확인 방법" 참고)를 전수 대조한 결과, `details`·
`resourceId` 어디에도 `newSecret`(`wsk_*`) · `newToken`(`itk_*`) · `newBotToken`(호출자 입력
bot token) · `oldPlaintext` 원문이 실리지 않는다. 전달되는 값은 `workspaceId`, `userId`,
액션 상수, `trigger.id`, `trigger.type` 뿐이다.

- `AuditLogsService.record()` (`audit-logs.service.ts` L72-97)도 받은 `entry.details`를
  그대로 저장할 뿐 별도 필드를 추가하지 않으므로 2차 유출 경로가 없다.
- `rotateBotToken`의 `translateSetupChannelError`(제공자 오류 메시지를 `BOT_TOKEN_INVALID`/
  `CHAT_CHANNEL_SETUP_FAILED` HTTP 응답의 `details.reason`에 담는 부분, L1142-1156)은 **HTTP
  에러 응답**이지 `audit_log` 기록이 아니고, 이번 PR이 새로 추가한 코드도 아니다(선행
  `#569`) — 논외.

**결론: 시크릿/토큰 원문의 `audit_log` 유출 없음.**

## 2. 감사가 인가 검증 뒤에만 발화하는가 — 비인가 시도가 감사 로그를 오염시킬 수 있는가

- 세 라우트(`rotate-secret`/`revoke-token`/`rotate-bot-token`) 모두 `@Roles('editor')`가
  붙어 있다(`triggers.controller.ts`).
- `RolesGuard`는 `app.module.ts`에 `APP_GUARD`로 전역 등록되며, 순서는
  `JwtAuthGuard → UserThrottlerGuard → RolesGuard`(주석: "RolesGuard 는 JwtAuthGuard 다음에
  실행돼야 한다") — **컨트롤러 핸들러 진입 전에** 인증(JWT) → 역할/멤버십 검증이 끝난다.
  미인증(`request.user` 없음)이거나 역할 미달·비멤버면 가드가 403/401로 요청을 끊고
  컨트롤러 메서드 바디(→ 서비스 → `recordAudit`)는 **아예 실행되지 않는다**.
- 서비스 레이어에서도 `findById(id, workspaceId)`가 `{ id, workspaceId }` 복합 조건으로
  조회해 워크스페이스 스코프 밖 리소스는 `NotFoundException`으로 끊긴다(테넌트 격리
  이중 방어). 이후 `recordAudit`는 검증 통과 + 실제 변경(저장/업데이트) 성공 이후에만
  호출된다 — 검증 실패(`NOTIFICATION_NOT_CONFIGURED`/`NOT_PER_TRIGGER_STRATEGY`/
  `CHAT_CHANNEL_NOT_CONFIGURED` 등) 분기는 `recordAudit` 호출 이전에 `throw`한다.

**결론: 비인가·미인증 시도는 가드 단계에서 차단되어 감사 로그에 도달하지 못한다. 오염 경로 없음.**

## 3. 액터(`userId`) 배선이 JWT `sub`에서 오는가

세 컨트롤러 메서드 모두 `@CurrentUser('sub') userId: string`을 파라미터로 받는다
(`triggers.controller.ts`, `rotateNotificationSecret`/`revokePerTriggerToken`/
`rotateBotToken`). `CurrentUser` 데코레이터(`current-user.decorator.ts`)는
`request.user`(Passport JWT 전략이 토큰 검증 후 채우는 값)에서 `data`로 지정된 키(`'sub'`)를
읽어 반환한다 — `@Body()`가 아니다. `rotateBotToken`은 `@Body() body: { newBotToken?: string }`
을 **별도로** 받아 `newBotToken` 필드만 body에서 꺼내 쓰고, `userId`는 여전히
`@CurrentUser('sub')`로 분리되어 있어 요청 바디로 액터를 위조할 수 없다.

**결론: 액터는 신뢰할 수 있는 JWT claim에서만 배선된다.**

## 부가 확인 — 감사 기록 순서 (audit-before-persist 회귀 여부)

세 메서드 모두 **실제 DB 반영(`triggerRepository.save`/`update`) 완료 이후에** `recordAudit`를
호출하는 순서를 유지하고 있다(확인 시점 `git diff HEAD` clean, 커밋 `3db28b205`
= `HEAD`와 working tree 일치). `rotateBotToken`은 코드 주석으로 그 이유를 명시한다
("컬럼 갱신이 끝난 뒤에 기록한다 … 감사 row 만 남으면 '회전됐다' 는 거짓 기록이 된다").
저장 실패 시 감사가 남지 않는지 검증하는 회귀 테스트(`triggers.service.spec.ts`, 이번
델타가 분리한 바로 그 테스트)를 클린 상태에서 직접 실행해 통과를 확인했다:

```
Tests: 72 skipped, 3 passed, 75 total   (jest -t "저장이 실패하면 감사를 남기지 않는다")
```

(조사 중 한 시점에 `rotateNotificationSecret`의 `recordAudit`↔`save` 순서가 뒤바뀐 것처럼
보여 동일 테스트가 RED로 나온 적이 있었으나, 재확인 결과 `git diff HEAD`가 비어 있는 클린
상태에서는 순서가 항상 올바르고 테스트도 GREEN이었다 — 세션 내 동시 진행 중이던 별도
mutation-testing 프로세스가 파일을 일시적으로 뮤테이션한 상태를 읽은 것으로 판단된다.
코드 자체의 결함이 아니므로 발견사항으로 등재하지 않는다.)

## 발견사항

새 CRITICAL/WARNING 없음.

## 요약

이번 델타(`3db28b205`)는 테스트 구조 분리뿐으로 production 코드 변경이 없다. 지시에 따라
PR 전체를 세 관점(시크릿 유출·인가-후 감사·액터 신뢰 출처)으로 재점검한 결과, `audit_log`에
시크릿/토큰 원문이 실리지 않고, `RolesGuard`(전역 `APP_GUARD`, JWT 인증 이후 실행)가
컨트롤러 진입 전 역할·멤버십을 검증해 비인가 시도가 감사 로그에 도달할 수 없으며, `userId`는
`@CurrentUser('sub')`로 JWT claim에서만 배선되고 요청 바디로 위조 불가능함을 확인했다. 감사
기록이 실제 DB 반영 완료 후에만 발화하는 순서도 세 메서드 전부에서 유지되고 있다(테스트로
재확인). 알려진 미해결 항목(`AuditLogsService.record()`의 DB 오류 삼킴, W3)은 이 PR의 회귀가
아니라 17개 producer 공통의 기존 설계이며 `plan/in-progress/spec-sync-auth-gaps.md`에 이미
별도 트랙으로 등재되어 있어 재-flag하지 않는다.

## 위험도

NONE

STATUS: OK
