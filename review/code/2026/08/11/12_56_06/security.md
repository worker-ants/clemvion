# Security Review — `12_56_06`

## 범위

직전 2라운드(`12_22_23`, `12_37_14`) 모두 security 판정 NONE. 이번 라운드의 델타는 커밋
`f5d485a52` 단일 커밋이며, 다음으로 구성된다:

1. `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 실패경로(회전 2종,
   `save()` 자체가 던지는 경우) 회귀 테스트 1건 추가.
2. `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 주석 + `spec/5-system/1-auth.md`
   본문 — "앞의 둘" → "`notification_secret_rotated`·`interaction_token_revoked`" 로 수식어 정정.
3. `plan/in-progress/spec-sync-auth-gaps.md` 등재, `review/code/2026/08/11/12_22_23/{SUMMARY,RESOLUTION}.md`
   신규 생성(밀린 위생 기록).

지시에 따라 이번 라운드는 위 델타, 특히 (2)의 정정 문장이 "어느 액션이 응답에 새 자격증명을
평문 반환하는지"를 정확히 서술하는지에 집중해 코드로 직접 대조했다.

## 정정 문장 사실 대조

`codebase/backend/src/modules/triggers/triggers.service.ts` 를 직접 열어 세 메서드의 반환값을
확인했다.

- `rotateNotificationSecret` (`triggers.service.ts` 함수 정의부, `AUDIT_ACTIONS.TRIGGER_NOTIFICATION_SECRET_ROTATED`
  기록 직후) — `return { secret: newSecret, rotatedAt: ... }`. `newSecret = wsk_${randomBytes(32).toString('hex')}` 로
  서버가 새로 생성한 값을 응답 바디에 **평문으로 1회 반환**한다. → 정정 문장과 일치.
- `revokePerTriggerToken` (같은 파일, `AUDIT_ACTIONS.TRIGGER_INTERACTION_TOKEN_REVOKED` 기록 직후) —
  `return { token: newToken }`. `newToken = itk_${randomBytes(32).toString('hex')}` 도 서버 생성값을
  **평문으로 1회 반환**한다. → 정정 문장과 일치.
- `rotateBotToken` (`AUDIT_ACTIONS.TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 기록 직후) — 반환값은
  `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 뿐이다. 새 토큰(`newBotToken`)은
  컨트롤러 `@Body()` 로 들어온 **호출자 입력**이라 서버가 생성/반환할 대상이 아니며, 실제로
  응답 스키마에 없다. → "새 토큰이 호출자 입력이라 응답에 안 실린다" 서술과 일치.

세 메서드 모두 `recordAudit` 호출부에 `details`/`resourceId` 로 시크릿 원문을 넘기지 않는 것도
확인했다(`workspaceId, userId, action, resourceId: trigger.id, type` 만 전달) — 감사 로그를 통한
2차 평문 노출 경로는 없다.

정정 전 문구("앞의 둘")는 나열 순서상 1·2번째(`notification_secret_rotated`,
`chat_channel_bot_token_rotated`)를 가리키는데, 실제 평문 반환 주체는 1·3번째
(`notification_secret_rotated`, `interaction_token_revoked`)다. 이번 커밋은 순서 참조를
버리고 액션명을 직접 나열하는 방식으로 고쳐, **과대 서술도 과소 서술도 없이** 정확하다.
`CHANGELOG.md:67` 의 "앞의 둘"은 별개 문맥(24h grace 유무 비교, 표의 1·2번째 행)이라 이번
정정 대상과 무관하고 그 자체로도 정확하다 — grep 으로 전수 확인, 잔존하는 stale
"앞의 둘 = 평문반환" 참조는 없다.

## 신규 테스트(`triggers.service.spec.ts`)

추가된 실패경로 테스트는 `triggerRepo.save` 를 reject 시켜 `rotateNotificationSecret` /
`revokePerTriggerToken` 이 저장 실패 시 `recordAudit` 를 호출하지 않는지(`auditLogs.record`
not called)를 검증한다. 테스트 더블 값(`'db down'`, `'u-rot'`, `'u-rev'`, `webhookTrigger`
fixture)에 실제 시크릿·자격증명은 없다. 하드코딩 시크릿, 인젝션 벡터 없음.

## 결론

새로 도입된 보안 취약점 없음. 정정된 문장은 코드 실측과 정확히 일치하며 과대·과소 서술
둘 다 아니다. 새 CRITICAL 없음 — 강제로 만들지 않는다.

## 요약

이번 델타는 순수 문서 정정(주석 2줄) + 테스트 강화(실패경로 회귀 1건) + plan/리뷰 산출물
등재로, 프로덕션 코드 로직 변경이 없다. 정정 문장을 `triggers.service.ts` 세 메서드의 실제
반환값과 대조한 결과 완전히 일치하며, 이전 2라운드에서 지적됐던 "앞의 둘" 오귀속 문제가
액션명 직접 나열로 근본 해소됐다. 새로운 인젝션·시크릿 하드코딩·인증/인가 우회·암호화
약화·에러 노출 소견 없음.

## 위험도

NONE

STATUS: OK
