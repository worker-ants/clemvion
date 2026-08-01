STATUS=success 보안 리뷰 완료 — CRITICAL 0 · WARNING 0 · INFO 5
===REPORT_MARKDOWN_BELOW===
# 보안(Security) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위·방법

`model-config`/`schedules`/`triggers`/`workflows` 4개 모듈에 `AuditLogsService` 를 주입해 CRUD(생성/
수정/삭제/set-default/duplicate) 감사 로깅 13개 액션을 추가하는 diff(`origin/main` 대비)를 검토했다.
이 브랜치는 이미 3라운드의 리뷰·조치 사이클(`review/code/2026/08/01/10_05_53` Critical 2·Warning 11 →
조치 → `10_49_18` 재검토 LOW → 조치 → `11_35_19`/`d7d4f67fa` rebase)을 거쳤다. 이번(`12_06_37`) 세션은
그 이후 상태에 대한 fresh 재검증이다.

프롬프트 번들에서 "전체 파일 컨텍스트"가 생략된 4개 파일(`triggers.service.ts`, `triggers.service.spec.ts`,
`workflows.service.ts`, `workflows.service.spec.ts`)을 `Read`로 전문 직접 확인했고, 19개 대상 파일 전체를
`git diff origin/main`으로 개별 대조했다. 직전 라운드가 지적한 항목들의 실제 반영 여부(`UpdateScheduleDto`
import 추가, `notification-config.dto.ts` 무관 hunk 되돌림)를 코드에서 직접 재확인했다. 하드코딩 시크릿
패턴(AWS/GitHub/Slack 실 토큰 형식, PEM 프라이빗 키, JWT)을 diff 전체에 대해 별도로 grep 재스캔했다(매치
0건 — 발견된 문자열은 전부 `sk-test...`/`xoxb-fake-token`/`111:TestToken` 류의 명백한 테스트 더미).
의존성 변경은 0건(`package.json`/`pnpm-lock.yaml` diff 없음)이라 관점 8(의존성 보안)은 해당 없음.

## 확인된 안전한 설계 패턴 (직접 재검증)

- **행위자(userId) 스푸핑 불가**: 4개 컨트롤러의 신규 `userId` 파라미터는 전부 `@CurrentUser('sub')`
  (JWT 검증된 `request.user.sub`)에서만 나온다. 4개 create/update DTO 어디에도 client-controlled
  `userId` 필드가 없다 — 감사 행위자를 요청 바디로 위조할 수 없다.
- **RBAC 회귀 없음**: 이번 diff 가 시그니처를 바꾼 모든 mutating 엔드포인트(model-config/schedules/
  triggers/workflows 의 create/update/remove/setDefault/duplicate)에서 `@Roles('editor')` 데코레이터가
  삭제된 hunk 는 0건(`git diff` 로 `-.*@Roles` 매치 없음 직접 확인).
- **IDOR 방지 유지**: `remove`/`setDefault`/`update`/`duplicate` 계열은 전부 감사 기록 이전에
  `findEntity(id, workspaceId)`/`findById(id, workspaceId)` 로 워크스페이스 스코프 조회를 선행한다 —
  타 워크스페이스 리소스는 그 이전에 404 로 차단되어 신규 `recordAudit` 호출이 크로스-워크스페이스
  리소스에 도달할 경로가 없다.
- **SQL 인젝션 없음**: `schedules.service.ts:resolveOrderBy`(112-121행), `workflows.service.ts:
  getSortColumn`(1103-1110행) 은 컬럼 화이트리스트 매핑 후 문자열 보간하며, 미허용 값은 안전한
  기본값으로 폴백한다. `triggers.service.ts` 의 JSONB 절(`config->'interaction'->>'enabled'`)도
  고정 문자열 + 파라미터 바인딩(`:interactionEnabled`)만 사용. `resourceId` 는 항상 `ParseUUIDPipe` 검증
  라우트 파라미터이거나 DB 생성 `saved.id` 다.
- **시크릿 비노출**: `recordAudit` 의 `details` 필드는 `kind`(chat/embedding/rerank), `type`(webhook/
  schedule/chat_channel), `duplicatedFrom`(UUID) 만 기록 — apiKey·webhook HMAC secret·bot token 은
  어디에도 노출되지 않는다. `model-config.service.ts` 의 `maskApiKey`/`encrypt`/`decrypt` 로직은 이번
  diff 로 변경되지 않았다.
- **트랜잭션 경계 정확성 + 회귀 테스트로 고정**: `create`/`update`/`setDefault`/`duplicate` 전부 DB
  커밋 뒤에 `recordAudit` 을 호출하며(트랜잭션 롤백 시 감사 미기록), `triggers`/`schedules` 는 이번
  라운드에서 `order: string[]` 순서 고정 테스트가 추가되어 "커밋 → 감사 → 외부호출(secret store/BullMQ)"
  불변식이 회귀 테스트로 잠겼다(`triggers.service.spec.ts` "W6 순서 고정"·"W5 회귀" describe,
  `schedules.service.spec.ts` 동일 패턴) — 직접 실행하지 않고 diff 로만 재확인.
- **직전 Critical/Warning 조치 실측 확인**: `schedules.service.spec.ts:10`에 `UpdateScheduleDto` import
  존재(2차 라운드 Critical #1 조치), `notification-config.dto.ts` 는 `origin/main` 대비 diff 0줄(무관
  hunk 되돌림, 2차 라운드 Warning #6 조치) — 둘 다 주장이 아니라 `git diff`/`grep` 으로 직접 재현.

## 발견사항

- **[INFO]** `TriggersService` 의 시크릿·토큰 회전/폐기 3개 메서드에 감사 로깅이 없음 — 동일 코드베이스의
  `integration.rotated` 선례와 대비되는 완결성 갭
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:894`(`rotateNotificationSecret`)
    ·`:930`(`revokePerTriggerToken`)·`:975`(`rotateBotToken`) — 세 메서드 어디에도 `recordAudit()` 호출이
    없음을 `grep -n "recordAudit("` 으로 확인(261, 344, 871행 3곳뿐 — 전부 create/update/remove).
    대비: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:51`(`INTEGRATION_ROTATED:
    'integration.rotated'`) — 같은 코드베이스가 "시크릿 회전은 감사 대상"이라는 선례를 이미 갖고 있음.
  - 상세: `rotateNotificationSecret`/`rotateBotToken`은 새 시크릿 평문을 1회 응답으로 반환하고 기존
    값을 무효화하며, `revokePerTriggerToken`은 기존 `itk_*` 토큰을 즉시 무효화한다 — 셋 다 "누가·언제
    수행했는가"가 컴플라이언스·인시던트 대응에서 CRUD 못지않게 중요한 민감 동작이다. 그런데
    `audit-action.const.ts`에는 이 동작에 대응하는 액션 상수 자체가 없어 `AuditLogsService.record()`
    가 원천적으로 호출될 수 없다. `trigger.notification_rotated_at`/`chat_channel_rotated_at` 컬럼이
    "언제"는 남기지만 "누가"는 어디에도 남지 않는다. 이번 PR은 이 3개 메서드를 수정하지 않았다(`git diff`
    로 메서드 바디 무변경 확인) — 이번 diff 가 만든 회귀가 아니라 기존 갭이며, PR 상단 주석(`audit-
    action.const.ts:32-43`)이 밝히는 "CRUD 만" 이라는 명시적 스코프 결정과도 일치한다.
  - 제안: 이번 PR 을 차단할 사유는 아님. 후속으로 `trigger.notification_secret_rotated`/
    `trigger.interaction_token_revoked`/`trigger.chat_channel_token_rotated` 류 액션 추가를 검토하거나,
    최소한 `spec/5-system/1-auth.md §4.1`/`audit-action.const.ts` 에 "시크릿 회전 액션은 별도 트랙"이라고
    명문화해 스코프 결정을 추적 가능하게 할 것.

- **[INFO] (diff 범위 밖 — 재확인)** `TriggersController.rotateBotToken` 에 `@Roles` 데코레이터 부재
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:229-236`(`@Post(':id/chat-
    channel/rotate-bot-token')` ~ `async rotateBotToken(`) — 같은 파일에서 이번 diff 가 손댄
    `rotateNotificationSecret`(174행 `@Roles('editor')`)·`revokePerTriggerToken`(197행 `@Roles('editor')`)
    과 대조.
  - 상세: `RolesGuard` 는 `@Roles()` 가 없는 라우트를 default-allow 하므로, 이 엔드포인트는 워크스페이스
    `viewer` 역할도 chat-channel bot token 회전을 수행할 수 있다. 직전 두 라운드(10_05_53, 10_49_18)의
    security 리뷰가 이미 동일하게 발견했고 diff 범위 밖(이번 PR 이 만든 회귀 아님)으로 triage 됨 — 재확인만.
  - 제안: 이번 PR 차단 사유 아님. 의도된 설계(예: 채널 소유자 자기서비스 목적)인지 확인 후 필요 시
    `@Roles('editor')` 추가 검토.

- **[INFO] (재확인)** FK CASCADE/애플리케이션 레벨 연쇄 삭제로 사라지는 자매 리소스는 그 삭제 자체가
  감사되지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:254-263`(`remove` — `workflow.
    deleted` 만 기록, 소속 `Trigger` 행은 FK CASCADE 로 동반 삭제되지만 `trigger.deleted` 없음) ·
    `codebase/backend/src/modules/triggers/triggers.service.ts:849-878`(`remove` — schedule 타입은 FK
    CASCADE 로 schedule row 동반 삭제되지만 `schedule.deleted` 없음) · `codebase/backend/src/modules/
    schedules/schedules.service.ts:264-279`(`remove` — `triggerRepository.delete()` 로 애플리케이션
    레벨에서 직접 트리거를 지우면서도 `trigger.deleted` 없음)
  - 상세: 직전 두 라운드(architecture INFO#3, security INFO#1)에서 이미 동일하게 식별·triage 된 기존
    갭이며, 이번 조치 커밋들의 대상에도 포함되지 않았다 — 새 회귀 아님. 실제 인가(삭제 자체의 `@Roles`
    + IDOR 스코핑)는 정상 동작하며, 순수하게 감사 트레일 완결성 문제다.
  - 제안: 조치 불요(이미 triage 됨). "루트 액션만 감사, 자매 리소스 별도 기록 안 함"을 `audit-action.
    const.ts`/spec 에 명문화하는 것을 다음 라운드에서 검토.

- **[INFO] (재확인)** 동시 DELETE 요청 시 동일 리소스에 중복 `*.deleted` 감사 행 생성 가능
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:394-409` ·
    `codebase/backend/src/modules/schedules/schedules.service.ts:264-279` ·
    `codebase/backend/src/modules/triggers/triggers.service.ts:849-878` ·
    `codebase/backend/src/modules/workflows/workflows.service.ts:254-263`
  - 상세: 네 `remove()` 모두 `find→remove→recordAudit` 이며 삭제 영향 행 수(`affected`)를 검증하지
    않는다. `AuditLog` 는 append-only 라 유니크 제약이 없어 더블클릭·재시도 시 중복 행이 남을 수 있다.
    `RESOLUTION.md`(`review/code/2026/08/01/10_05_53/RESOLUTION.md` W7)가 "이번 PR 이 만든 회귀가 아니고
    기존 `auth-configs.service.ts` 패턴이 4곳 더 복제된 것이며, 5곳을 함께 바꾸는 별도 트랙"으로 명시적
    으로 이월을 결정했다 — 그 판단은 여전히 유효하다.
  - 제안: 조치 불요(이미 별도 트랙으로 이월 결정됨). 착수 시 `Repository.delete()`/`manager.delete()` +
    `DeleteResult.affected>=1` 가드로 5곳(신규 4 + 기존 auth-configs 1) 일괄 정리 권장.

- **[INFO] (재확인)** 감사 sink 가 쓰기 실패를 삼키고(fail-open), `audit_log` 가 보존 정책 없이 무제한
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:80-96`(`record()` — `try/catch`
    로 감싸 실패 시 `logger.warn` 만 남기고 항상 정상 resolve, 이번 diff 밖의 기존 파일이나 신규 13개
    액션 전부가 이 sink 로 몰림) · `codebase/backend/src/modules/audit-logs/audit-action.const.ts:38-43`
    (신규 주석 — 보존 정책 미정·pruner 없음을 자체 인지, 그래서 고빈도 `workflow.executed` 를 의도적으로
    제외한다고 명시)
  - 상세: OWASP A09(Security Logging and Monitoring Failures) 관점에서, DB 부하·일시 장애 시 다수의
    특권 작업(모델 설정 삭제, 트리거/스케줄 삭제, 워크플로우 삭제 등)이 감사 흔적 없이 조용히 수행될 수
    있다는 점은 유효하다. 다만 사전에 내려진 설계 결정이고 이번 diff 가 그 자체를 바꾸지 않으며, 직전
    두 라운드의 security 리뷰가 이미 동일하게 확인·수용한 기존 트레이드오프다.
  - 제안: 조치 불요(의도된 fail-open, 이미 추적 중). 감사 신뢰도가 중요해지면 `record()` 실패의
    메트릭/알람 승격, 고빈도 액션 추가 전 보존 정책(pruner) 선결을 검토.

## 요약

이번 diff(3라운드 조치 사이클 이후 fresh 재검토)는 4개 모듈(model-config/schedules/triggers/workflows)에
CRUD 감사 로깅을 추가하는 기능 확장이며, 신규로 도입된 인젝션·인증 우회·시크릿 노출·권한 검증 누락
취약점은 발견되지 않았다. 직전 두 라운드가 지적한 Critical/Warning(스펙 import 누락으로 인한 tsc 오류,
`RESOLUTION.md` 커밋 해시 오기, 감사와 무관한 hunk 유입, W6 순서·W5 이중호출 회귀 테스트 부재 등)이
실제로 코드·문서에 반영됐음을 `git diff`/`grep`으로 직접 재검증했다. 행위자(userId)는 검증된 JWT claim
에서만 취해지고, RBAC(`@Roles`)·IDOR 방지(`workspaceId` 스코프 선행 조회)·SQL 인젝션 방지(파라미터
바인딩 + 컬럼 화이트리스트)·시크릿 비노출(`details` 필드 저위험 값만)이 4개 모듈 전수에서 회귀 없이
유지된다. 하드코딩된 실제 시크릿은 diff 전체에서 0건이며 신규 서드파티 의존성도 없다. 남은 항목은 전부
INFO 수준이며 이번 PR 을 차단할 사유가 아니다 — (1) 이번 라운드에서 새로 특정한 관찰로, trigger 도메인의
시크릿·토큰 회전/폐기 3개 메서드(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)에
대응하는 감사 액션이 아예 존재하지 않아 "누가 회전했는가"가 기록되지 않음(동일 코드베이스의
`integration.rotated` 선례와 대비, 이번 PR 의 diff 밖·명시된 CRUD-only 스코프와 일치), (2)~(5)는 직전
라운드에서 이미 확인·triage 된 기존 갭의 재확인(rotateBotToken `@Roles` 부재, FK CASCADE 자매 리소스
미감사, 동시 삭제 중복 감사행, 감사 sink fail-open + 무제한 보존)이다.

## 위험도

LOW
