# 요구사항(Requirement) 리뷰 — `12_37_14`

## 확인 범위 (호출자 지시 3가지)

- (a) `1-auth.md §4.1` 의 "응답에 새 자격증명 1회 평문 반환" 정정 후, spec 서술이 세 회전/폐기 메서드의 실제 구현(`triggers.service.ts` `rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)과 line-level 로 일치하는가
- (b) `status` 관련 판정이 흔들리지 않는가
- (c) spec 6곳(1-auth §4.1 · audit-actions.md §3 · data-flow/1-audit.md §1.1 · 15-chat-channel.md §5.4.1 · 2-trigger-list.md · 14-external-interaction-api.md)이 서로 모순 없이 정정을 반영했는가
- 덧붙여 `rotateBotToken` 감사 회귀 2건(성공/실패) 추가분의 정확성

## 발견사항

### [WARNING] 정정 문장의 "앞의 둘" 이 실제로 지목하는 두 액션과 어순이 어긋난다

- 위치: `spec/5-system/1-auth.md:431`, `codebase/backend/src/modules/audit-logs/audit-action.const.ts:90`
- 상세: 두 위치 모두 세 액션을 **`notification_secret_rotated`, `chat_channel_bot_token_rotated`, `interaction_token_revoked`** 순서로 먼저 나열한 뒤(1-auth.md 431: `` `trigger.notification_secret_rotated`, `trigger.chat_channel_bot_token_rotated`, `trigger.interaction_token_revoked` ``; audit-action.const.ts 는 const 선언 순서가 `TRIGGER_NOTIFICATION_SECRET_ROTATED` → `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` → `TRIGGER_INTERACTION_TOKEN_REVOKED`), 바로 이어서 "**앞의 둘** 중 `notification_secret_rotated`·`interaction_token_revoked` 는 응답에 새 자격증명을 1회 평문 반환한다" 고 적는다. 그러나 방금 나열한 순서에서 "앞의 둘"(처음 두 개)은 위치상 `notification_secret_rotated`·`chat_channel_bot_token_rotated` 다. 실제로 지목된 두 액션은 1번째·3번째다. `audit-action.const.ts` 쪽은 특히 더 혼란스럽다 — 주석이 `TRIGGER_NOTIFICATION_SECRET_ROTATED` 와 `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 선언 바로 앞에 붙어 있어 "앞의 둘"을 그 두 상수로 오독하기 쉬운데, 바로 다음 문장이 "`chat_channel_bot_token_rotated` 는 ... 반환하지 않는다" 라고 해서 자기모순처럼 읽힌다.
- 실측 확인: 코드상 사실관계 자체(`rotateNotificationSecret`→`{secret,...}`·`revokePerTriggerToken`→`{token,...}`는 서버 생성값 반환, `rotateBotToken`→응답에 토큰 없음, `newBotToken` 은 호출자 입력)는 **정정 문장이 명명한 두 액션(`notification_secret_rotated`·`interaction_token_revoked`) 기준으로는 맞다**. 즉 논리적 사실은 옳고, "앞의"라는 수식어만 실제 순서와 어긋난 채 남아 있다. `15-chat-channel.md:340`(§5.4 응답 계약: `rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity` 3필드만 동봉, 토큰 없음)과도 모순 없음.
- 제안: "앞의 둘" 을 "이 중" 또는 "위 셋 중" 처럼 순서 의존적이지 않은 표현으로 두 위치(spec + 코드 주석) 동시에 바꾼다. CRITICAL 로 보지 않는 이유는 지목된 두 액션명이 명시적으로 함께 적혀 있어 최종적으로 전달되는 사실관계는 정확하고, 코드 동작과 어긋나지 않기 때문 — 어순 수식어의 잔여 혼동일 뿐이다.

### [INFO] plan 의 "1회 평문 반환" 서술은 착수 시점 스냅샷으로 명시적으로 격리돼 있어 정정 대상 아님

- 위치: `plan/in-progress/spec-sync-auth-gaps.md:58`("...응답에 새 시크릿을 1회 평문 반환하므로...")
- 상세: 같은 항목 상단에 "완료 (2026-08-11, ...) ... **아래는 착수 시점 서술로 남긴다**" 라고 명시돼 있어(56번째 줄), 세 액션 모두에 평문 반환을 일반화한 이 문장이 현재도 유효한 주장이 아니라 역사적 기록임이 텍스트 자체로 드러난다. 이 저장소 관행(`feedback_stale_plan_claims_and_checklist_sync`)과 정합. 정정 누락이 아니라 의도된 보존이므로 조치 불필요.

## (a)(b)(c) 판정 요약

- **(a) 정정 후 line-level 일치**: 일치한다. `rotateNotificationSecret`(`return { secret: newSecret, rotatedAt: ... }`, `triggers.service.ts:932-935`)·`revokePerTriggerToken`(`return { token: newToken }`, `triggers.service.ts:980`)은 서버가 생성한 값을 평문으로 1회 반환하고, `rotateBotToken`(`triggers.service.ts:1122-1128`)은 `newBotToken`이 호출자 입력이라 응답 DTO(`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`)에 토큰이 없다 — `15-chat-channel.md §5.4` 기존 응답 계약과도 일치. 유일한 흠은 위 WARNING(어순 수식어)뿐, 사실관계 오류는 없다.
- **(b) `status` 판정**: 흔들리지 않는다. `1-auth.md`/`15-chat-channel.md`/`14-external-interaction-api.md` 의 frontmatter `status: partial` 은 diff 로 건드려지지 않았고, plan 파일의 "`status: implemented` 승격은 여전히 불가 — §1.3 LDAP/SAML 이 남아 있다" 주석도 그대로다. 이번 정정은 §4.1 표 한 행의 서술 정확도 문제이지 구현 완결성 판정과는 무관해 `partial` 유지가 맞다.
- **(c) spec 6곳 상호 모순 여부**: 없음. `audit-actions.md §3`(레지스트리 행 + Rationale 4문단), `data-flow/1-audit.md §1.1`(Writer 표 3행 + 커버리지 갭 문단), `15-chat-channel.md §5.4.1`(액션명 규약위반 정정 — `chat-channel.rotate-bot-token` → `trigger.chat_channel_bot_token_rotated`), `2-trigger-list.md §3`(엔드포인트 3행에 감사 액션 cross-link), `14-external-interaction-api.md`(EIA-NX-12/EIA-AU-07 감사 요건 추가, 특히 EIA-NX-12 는 "응답에 새 secret 을 1회 평문 반환" 이라고 명시 — `notification_secret_rotated` 단독 지목이라 1-auth.md 정정과 충돌 없음) 어디에도 "세 액션 모두 평문 반환" 이라는 되돌아간 blanket 주장이 남아 있지 않다. `grep -rn 평문` 전수 확인 결과 관련 3개 위치(`1-auth.md:431`, `14-external-interaction-api.md:65`, `audit-action.const.ts:90`)뿐이고 셋 다 같은 방향(둘만 반환, `chat_channel_bot_token_rotated` 는 제외)으로 일치한다.

## `rotateBotToken` 감사 회귀 2건 검증

- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`describe('TriggersService.rotateBotToken — 6단계 오케스트레이션'`) — "감사 — 성공 시 ... 남긴다" / "감사 — 오케스트레이션이 중간에 실패하면 남기지 않는다"
- 검증: 해당 `describe` 의 `moduleRef` 는 `AuditLogsService` 를 `{ record: jest.fn() }` 로 provide 하고 있어(`triggers.service.spec.ts` 모듈 설정), 신규 `auditLogs = moduleRef.get(AuditLogsService)` 캐스팅이 실제 mock 을 정확히 잡는다. 실제 서비스 코드(`triggers.service.ts:1101-1121`)를 대조하면 `recordAudit` 호출은 `triggerRepository.update`(6단계) **이후**, `adapter.setupChannel`(4단계) 호출은 그 이전이라 — "성공 시 기록" 테스트와 "setupChannel 실패 시 감사 미기록" 테스트 둘 다 실제 실행 순서와 부합한다. `catch` 로 에러를 삼키는 코드 경로가 `rotateBotToken` 안에 없어(4단계 `catch(err){ throw this.translateSetupChannelError(err) }` 는 재throw), 실패 테스트가 검증하는 "던지면 감사가 안 남는다"는 실제로 관측 가능한 시나리오다. 이전 WARNING(0건 회귀)이 정확히 메워졌다.

## 요약

정정된 `1-auth.md §4.1` 문장은 세 회전/폐기 메서드의 실제 응답 shape 과 코드 레벨로 일치하며, `chat_channel_bot_token_rotated` 만 새 토큰이 호출자 입력이라 반환하지 않는다는 사실도 `triggers.service.ts`·`15-chat-channel.md §5.4` 와 정합한다. `status` 판정에는 영향이 없고(둘 다 `partial` 유지, LDAP/SAML 미구현이 여전히 남은 사유), 동반 갱신 대상 spec 6곳도 서로 모순 없이 일관되게 반영됐다 — "세 액션 모두 평문 반환" 이라는 원래의 틀린 blanket 주장이 어느 한 문서에도 되돌아가 남아 있지 않다. 유일한 흠은 정정 문장 자체의 "앞의 둘" 이라는 수식어가 방금 나열한 세 액션의 실제 어순(1·2·3)과 어긋나(지목된 건 1·3번째) 순간적으로 오독을 유발할 수 있다는 점인데, 명시적으로 이름을 함께 적어 최종 전달 사실은 정확하므로 CRITICAL 이 아니라 WARNING 으로 등재한다. `rotateBotToken` 감사 회귀 2건은 실제 mock 배선·실행 순서와 부합하는 유효한 테스트다.

## 위험도

LOW

STATUS: DONE
