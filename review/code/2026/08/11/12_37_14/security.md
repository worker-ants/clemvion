# 보안(Security) 코드 리뷰 — trigger-rotation-audit (재확인 라운드)

## 스코프와 방법

이번 라운드는 신규 코드가 아니라 **직전 라운드(CRITICAL/WARNING 0)의 판정이 이번 delta 로 흔들리는지**를
재확인하는 것이 목적이다. delta = ① `rotateBotToken` 감사 회귀 테스트 2건(직전 라운드 INFO 반영) ②
`audit-action.const.ts`/`15-chat-channel.md`/plan 의 주석·서술 정정 3곳 ③ CHANGELOG 신규 절 ④
`plan/in-progress/spec-sync-auth-gaps.md` 완료 등재(+ 신규 WARNING 항목 1건) ⑤ 신규 `review/consistency/**`
산출물(착수 전 게이트, 코드 아님).

핵심 코드는 `codebase/backend/src/modules/triggers/{triggers.controller.ts,triggers.service.ts}` 와
그 spec 두 파일. `git blame`/`git log`로 신규 도입 상수와 사전 존재 상수를 구분해 대조했다.

## 재확인 1 — 신규 테스트 픽스처가 실제 토큰 형태를 흉내내며 상수를 새로 남기는가

**아니다.** `triggers.controller.spec.ts` 의 `NEW_BOT_TOKEN = '222222222:NewToken'` 과
`triggers.service.spec.ts` 의 `NEW_TOKEN = '222222222:NewToken'` 은 Telegram bot token 형태
(`<numeric_id>:<token>`)를 흉내내지만, `git blame` 확인 결과 **둘 다 2026-05-22 커밋(`ad0ea7cdb5`)에서
이미 존재**했고 이번 delta 는 손대지 않았다. 이번 라운드가 새로 추가한 리터럴은 전부
`'tok'`/`'itk_x'`/`'s'`/`'now'`/`'trig-3'`~`'trig-5'`/`'u-bot'`/`'u-rot'`/`'u-rev'` 류의 자명한
placeholder 이며 실제 토큰 포맷(예: `itk_[a-f0-9]{64}` — 같은 파일의 기존 정상 케이스가 이 정규식으로
검증)을 흉내내지 않는다. 즉 이번 delta 가 저장소에 새로 남긴 "실제 형태를 흉내낸 시크릿류 상수"는 없다.

## 재확인 2 — 정정된 주석이 보안 근거를 약화시키는가

**약화시키지 않는다, 오히려 더 정확해졌다.** `audit-action.const.ts`(파일 3)와 `spec/5-system/1-auth.md`
(파일 18)에 정정된 문구 — "notification_secret_rotated·interaction_token_revoked 는 응답에 새
자격증명을 1회 평문 반환하고, chat_channel_bot_token_rotated 는 새 토큰이 **호출자 입력**이라 반환하지
않는다" — 는 `triggers.controller.spec.ts` 의 `ROTATE_RESULT`(`rotatedAt`/`triggerId`/
`chatChannelHealth`/`botIdentity` 4필드, `token` 필드 없음)와 정확히 일치한다. 즉 정정 전 주석("셋 다
반환한다")이 실제보다 **정보노출 범위를 과대 서술**하던 오류였고, 이번 정정은 그 과대 서술을 걷어내
실제 응답 계약과 일치시켰다 — 보안 판단에 쓰이는 근거 문서가 더 정확해진 방향이다. `15-chat-channel.md:378`
정정(규약 위반 예시 액션명 → 실제 채택된 `trigger.chat_channel_bot_token_rotated`)도 동일하게 사실
관계를 코드와 맞추는 정정이며 권한/노출 범위 서술을 바꾸지 않는다.

## 재확인 3 — RBAC·인가 (diff 밖이지만 회귀 여부 확인)

세 엔드포인트(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`) 모두
`@Roles('editor')` 가 여전히 붙어 있음을 코드에서 직접 확인했다(`triggers.controller.ts:177,205,239`).
신규 `@CurrentUser('sub') userId` 파라미터는 JWT 클레임에서 추출되며, 같은 컨트롤러의 `create`/`update`/
`remove` 와 동일한 기존 패턴을 그대로 재사용한다 — 새로운 인가 우회 표면이 생기지 않았다.

## 재확인 4 — 신규 회귀 테스트 2건 자체의 보안적 유효성

`triggers.service.spec.ts` 의 "감사 — 성공 시 …를 남긴다" / "감사 — 오케스트레이션이 중간에 실패하면
남기지 않는다" 두 테스트는 (a) 감사 호출이 컬럼 갱신(6단계) **이후**에 일어나 실패 시 거짓 "회전됐다"
기록이 남지 않는다는 fail-safe 순서를 검증하고 (b) 액션명·리소스 타입을 상수 참조가 아니라 문자열
리터럴로 단언해 상수 오변경에 취약하지 않다. 직전 라운드가 지적한 "감사 호출 전체 삭제 뮤턴트가
`rotateBotToken` 한 자리에서만 전부 GREEN" 갭을 실제로 닫는 형태다.

## 재확인 5 — plan 신규 WARNING("audit_log 적재 실패 관측 수단 없음")

이 항목은 이번 PR 이 만든 회귀가 아니라 **기존 17개 audit producer 공통의 사전 설계**(`AuditLogsService.record()`
가 DB 오류를 `logger.warn` 로 삼키고 알림/메트릭이 없음)이며, plan 서술 자체가 그렇게 정확히 밝히고
"이 PR 이 만든 회귀가 아니다"라고 명시한다. 세 회전 메서드는 그 기존 관례를 그대로 따랐을 뿐이라
이번 delta 의 CRITICAL/WARNING 판정에 영향을 주지 않는다 — 별도 트랙(전 producer 공통)으로 적절히
분리·등재됐다.

## 발견사항

- **[INFO]** 신규 테스트 리터럴은 실제 토큰 포맷을 흉내내지 않으며, 형태를 흉내낸 유일한 상수
  (`NEW_BOT_TOKEN`/`NEW_TOKEN` = `'222222222:NewToken'`)는 2026-05-22 사전 존재 상수로 이번 delta 밖.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.spec.ts`,
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
  - 상세/제안: 조치 불요 — 등재만.
- **[INFO]** `audit_log` 적재 실패 관측성 부재는 이 PR 의 회귀가 아니라 기존 17개 producer 공통 설계이며
  plan 이 이미 별도 트랙으로 정확히 분리·등재했다.
  - 위치: `plan/in-progress/spec-sync-auth-gaps.md` (신규 체크박스 항목)
  - 상세/제안: 조치 불요 — 등재만.

CRITICAL·WARNING 수준의 신규 발견은 없다.

## 요약

이번 delta(회귀 테스트 2건, 주석/plan/CHANGELOG 정정 3곳+문서)는 직전 라운드가 지적한 테스트 커버리지
갭을 닫는 방향이며, 새로 추가된 리터럴 중 실제 토큰 형태를 흉내내며 저장소에 남는 것은 없다(유일하게
그런 형태를 가진 상수는 이번 delta 이전인 5월 커밋에서 이미 존재). 정정된 세 곳의 주석·spec 서술은
모두 실제 코드 동작(응답에 토큰이 실제로 반환되는지 여부)과 일치시키는 방향이라 보안 근거를 약화시키지
않고 오히려 정확도를 높였다. RBAC 데코레이터·감사 기록 순서(상태변경 후 기록, 실패 시 미기록)도 diff
밖에서 재확인했고 회귀가 없다. 따라서 직전 라운드의 **CRITICAL 0 / WARNING 0** 판정은 이번 delta 이후에도
그대로 유효하다.

## 위험도

NONE

STATUS: REVIEW_COMPLETE reviewer=security critical=0 warning=0
