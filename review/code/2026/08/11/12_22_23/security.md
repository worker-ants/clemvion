# 보안(Security) 리뷰 — 트리거 시크릿/토큰 회전·폐기 3종 감사 추가

## 조사 방법

`triggers.controller.ts`·`triggers.service.ts` 전체 파일을 직접 `Read`, `recordAudit`
헬퍼(`triggers.service.ts:212-227`)와 `AuditLogsService.record`
(`audit-logs.service.ts:69-96`) 구현을 확인했다. `@Roles`/`RolesGuard`
(`common/guards/roles.guard.ts`) 전문을 읽어 인가 경로를 검증했고, `CurrentUser`
데코레이터가 검증된 JWT claim 에서만 값을 읽는지 확인했다. 회전/폐기 엔드포인트 전수
파악을 위해 `src/modules/**/*.controller.ts` 전체에서 `rotate|revoke|regenerate` 를
grep 하고, `triggers` 모듈 내 별도 `ChatChannelController` 잔존 여부와 cron 기반
승격 서비스(`ChatChannelTokenRotatorService`/`NotificationSecretRotatorService`)의
audit 소비 여부도 확인했다.

## 발견사항

- **[INFO]** `rotateBotToken` — 감사 기록의 성공/실패 양쪽 모두에 대한 회귀 테스트가 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `describe('TriggersService — 감사 로깅 (trigger.*)')` 블록 (게이트 2317~2379 부근에 3개 신규 `it` 만 추가됨)
  - 상세: 실제 소스(`triggers.service.ts:1113-1119`)는 `recordAudit` 를 6단계 오케스트레이션의 **모든 외부 호출·DB 갱신이 끝난 뒤**에 정확히 배치해 두었고(주석으로 의도 명문화됨), `rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` 세 곳 모두 실패 경로에서 `recordAudit` 이전에 throw 하므로 **현재 동작은 의도대로**다(실측 확인). 다만 이번 diff 가 추가한 회귀 테스트는 `rotateNotificationSecret` 성공/실패 1쌍 + `revokePerTriggerToken` 성공 1건뿐이고, 셋 중 가장 실패 표면이 넓은(`CHAT_CHANNEL_NOT_CONFIGURED`/`PROVIDER_UNKNOWN`/`ENDPOINT_REQUIRED`/`setupChannel` 예외 등 5갈래) `rotateBotToken` 은 감사 성공·실패 양쪽 다 **테스트 0건**이다(`grep chat_channel_bot_token_rotated triggers.service.spec.ts` → 무매치). `revokePerTriggerToken` 의 `NOT_PER_TRIGGER_STRATEGY` 실패 경로도 "감사가 안 남는다" 단언이 없다. 이 PR 의 목적 자체가 "회전 실패 시 감사가 남으면 거짓 타임라인" 을 막는 것이므로, 코드는 맞지만 그 불변식이 테스트로 고정돼 있지 않은 두 자리(특히 6단계·복수 throw 지점을 가진 `rotateBotToken`)는 이후 리팩터링이 `recordAudit` 호출 위치를 앞으로 옮겨도 아무 테스트도 못 잡는다. 저장소 메모(뮤테이션 커버리지 관례)와도 맞물리는 지점이다.
  - 제안: `rotateBotToken` 에 (a) 성공 시 `trigger.chat_channel_bot_token_rotated` 로 기록되는지, (b) 6단계 중 임의 지점에서 throw 하면 `auditLogs.record` 가 호출되지 않는지 확인하는 테스트를 추가하고, `revokePerTriggerToken` 에도 `NOT_PER_TRIGGER_STRATEGY` 실패 시 감사 미기록 테스트를 추가.

- **[INFO]** companion 문서 2건(`spec/data-flow/14-chat-channel.md §1.3`, `spec/data-flow/15-external-interaction.md`)이 신규 audit action 을 여전히 반영하지 않음
  - 위치: 해당 문서(이번 diff 대상 밖 — 파일 목록에 없음)
  - 상세: 착수 전 게이트(`review/consistency/2026/08/11/11_48_48/cross_spec.md` 발견 #7)가 이미 INFO 로 지목했고 "구현 시점에" 처리하라고 적어 뒀는데, 이번이 그 구현 PR 임에도 두 문서는 갱신되지 않았다(`git diff --stat` 확인). 코드 취약점은 아니고, 회전/revoke 파이프라인을 서술하는 인접 문서에서 audit 기록 단계가 계속 안 보이는 문서 완결성 문제.
  - 제안: 별도 후속 커밋(또는 이번 PR 범위 확장)으로 두 문서에 audit action cross-ref 추가.

## 점검했지만 문제 없음(확인된 안전 사항)

- **감사 `details` 자격증명 미포함**: `recordAudit`(`triggers.service.ts:212-227`)는 항상 `details: { type: params.type }` 만 채우고, `type` 은 trigger 의 리소스 타입(webhook/schedule/chat_channel)일 뿐 시크릿·토큰 평문이 아니다. 세 신규 호출부(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`) 모두 `newSecret`/`newToken`/`newBotToken` 값을 `resourceId`·`type` 어디에도 넘기지 않음을 소스에서 직접 확인.
- **실패 시 감사 미기록(의도대로)**: 세 메서드 모두 `recordAudit` 호출을 DB/외부 부수효과가 **성공적으로 끝난 뒤**에 배치했다(`rotateNotificationSecret` 924→925, `revokePerTriggerToken` 972→973, `rotateBotToken` 1110→1113 — 코드 주석이 "컬럼 갱신이 끝난 뒤에 기록한다" 로 의도를 명문화). 실패 경로(400 계열 예외 전부)는 `recordAudit` 이전에 throw 하므로 거짓 감사 row 가 남지 않는다. `rotateNotificationSecret` 실패 시 미기록은 테스트로도 고정됨(위 INFO 참고, 나머지 둘은 코드로만 보장).
- **인가 불변**: `@Roles('editor')` 는 세 엔드포인트 모두 diff 전후로 그대로다(`rotateNotificationSecret` 177행, `revokePerTriggerToken` 205행, `rotateBotToken` 239행 — `triggers.controller.ts` 직접 대조). 추가된 것은 `@CurrentUser('sub') userId` 파라미터뿐이고, `@WorkspaceId()`·`@Roles()` 순서/존재는 불변. `RolesGuard`(`common/guards/roles.guard.ts`)를 읽어 `@Roles()` 가 붙은 라우트는 `requiredRoles` 가 비지 않아 **멤버십+역할 검증을 항상 수행**함을 확인 — 별도 known-gap(`@Roles()` 미부착 73건, `plan/in-progress/spec-sync-auth-gaps.md`)과 무관.
- **액터 배선 무결성**: `CurrentUser('sub')` 는 `request.user`(JWT 검증 후 채워짐)에서만 값을 읽어 사용자가 위조할 수 없다. `triggers.controller.spec.ts` 신규 테스트 3건이 `id`·`workspaceId`·`userId`(전부 string) 인자 자리 스왑을 `objectContaining` 이 아닌 위치 고정 단언으로 잡도록 추가됐다 — 이 저장소의 반복 결함 패턴(동일 타입 인자 스왑이 컴파일을 통과)에 대한 적절한 방어.
- **IDOR/cross-tenant**: `findById(id, workspaceId)`(`triggers.service.ts:173-185`)가 `where: { id, workspaceId }` 로 스코프돼 있어 타 워크스페이스 트리거를 회전/폐기할 수 없다(diff 로 변경되지 않은 기존 가드, 재확인만).
- **엔드포인트 전수 확인**: `src/modules/**/*.controller.ts` 전체에서 `rotate|revoke|regenerate` grep 결과, 트리거 회전/폐기는 `triggers.controller.ts` 의 이 3곳(`/notification/rotate-secret`, `/interaction/revoke-token`, `/chat-channel/rotate-bot-token`)이 전부다. 별도 `ChatChannelController` 는 존재하지 않는다(C-2 리팩터로 통합됨, 확인). `sessions`/`webauthn`/`integrations`/`auth-configs`/`workspaces` 의 rotate/revoke/regenerate 는 이 PR 과 무관한 기존 엔드포인트이며 이미 자체 audit 액션(`INTEGRATION_ROTATED`, `AUTH_CONFIG_REGENERATE` 등)을 갖고 있다. cron 기반 grace 승격 서비스(`ChatChannelTokenRotatorService`/`NotificationSecretRotatorService`)는 사용자 액터가 없는 시스템 잡이라 `recordAudit` 을 호출하지 않는데, 이는 이번 diff 의 변경 범위 밖이고 별도 설계 판단 영역이라 이 리뷰의 지적 대상에 포함하지 않는다(필요시 별도 백로그화 권장).
- **랜덤성**: 신규 시크릿/토큰은 `randomBytes(32)`(Node crypto CSPRNG)로 생성 — 예측 불가능.
- **인젝션/로깅**: `AuditLogsService.record` 는 TypeORM repository `create`+`save` 만 사용(파라미터화, SQL 인젝션 없음). `LoggingInterceptor` 는 응답 바디를 로깅하지 않고 method/url/statusCode/duration 만 남겨, 회전 응답에 포함된 평문 secret 이 access log 로 새지 않는다.
- **감사 액션 타입 격리**: `AuditActionFor<'trigger'>` + `_NoCrossDomain` 컴파일 타임 가드(`audit-action.const.ts`)가 신규 3개 액션도 `trigger.` prefix 로 강제해, 다른 리소스 서비스가 실수로 이 액션을 재사용하는 경로를 원천 차단.

## 요약

핵심 목적(트리거 시크릿/토큰 회전·폐기 3종의 감사 공백을 닫는다)은 정확히 구현됐다.
`recordAudit` 의 `details` 는 시크릿을 담지 않고, 세 엔드포인트 모두 부수효과가 확정된
뒤에만 감사를 기록해 "회전 실패인데 감사만 남는" 거짓 타임라인을 만들지 않으며,
`@Roles('editor')` 인가는 diff 로 훼손되지 않았고 액터(`userId`) 배선도 인자 스왑에
강한 위치 고정 테스트로 보호된다. IDOR·인젝션·시크릿 로깅 경로도 확인했으나 문제
없음. 유일하게 남는 아쉬움은 테스트 커버리지 비대칭이다 — 실패 표면이 가장 넓은
`rotateBotToken` 의 감사 기록(성공/실패 둘 다)이 회귀 테스트로 고정되지 않아, 이번
PR 이 막으려던 바로 그 결함이 향후 리팩터링에서 조용히 재발해도 CI 가 못 잡는다.
코드 자체에 CRITICAL/WARNING 급 보안 결함은 없다.

## 위험도

LOW
