# 보안(Security) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 검토 범위·방법

`model-config`/`schedules`/`triggers`/`workflows` 4개 모듈에 `AuditLogsService` 를 주입해 CRUD(생성/수정/
삭제/set-default/duplicate/import) 감사 로깅 13개 액션을 추가하는 diff(`git diff origin/main..HEAD`, 20개
대상 파일)를 검토했다. 이 브랜치는 이미 4라운드의 리뷰·조치 사이클(10_05_53 Critical 2·Warning 11 → 조치 →
10_49_18 재검토 → 조치 → 12_06_37 재검토 CRITICAL 0·WARNING 0·INFO 5 → `4b9f50a87`"4차 리뷰 조치"로 C1
순서 위반 수정 + `importWorkflow` 감사 추가 + 순서 가드 확장 → `d538d909b` prettier 포맷)을 거쳤다. 본
세션(`12_44_54`)은 `12_06_37` 리뷰 **이후** 커밋(`4b9f50a87`, `d538d909b`)을 포함한 최신 상태에 대한
fresh 재검증이다.

프롬프트 번들에서 전체 컨텍스트가 생략된 4개 파일(`triggers.service.ts`, `triggers.service.spec.ts`,
`workflows.service.ts`, `workflows.service.spec.ts`)은 `Read`/`git diff`로 직접 전문을 확인했다. 20개
대상 파일 전체를 `git diff origin/main..HEAD`로 개별 대조했고, `12_06_37` 이후 실제로 변경된 파일
(`audit-action.const.ts`, `audit-log-response.dto.ts`, `triggers.service.ts`, `workflows.service.ts` +
4개 spec 파일)에 집중해 재검토했다. 하드코딩 시크릿 패턴(AWS/GitHub/Slack 실 토큰 형식, PEM 프라이빗 키)을
diff 전체에 대해 재스캔했다 — 매치는 기존 테스트 더미(`xoxb-fake-token`)의 들여쓰기 변경뿐, 신규 실
시크릿 0건. `package.json`/`pnpm-lock.yaml` diff 없음(신규 의존성 0건).

## 확인된 안전한 설계 패턴 (직접 재검증)

- **행위자(userId) 스푸핑 불가**: 4개 컨트롤러의 신규 `userId` 파라미터는 전부 `@CurrentUser('sub')`
  (JWT 검증된 `request.user.sub`)에서만 나온다. 4개 create/update DTO 어디에도 client-controlled
  `userId` 필드가 없다.
- **RBAC 회귀 없음**: 이번 diff 가 시그니처를 바꾼 모든 mutating 엔드포인트(model-config/schedules/
  triggers/workflows 의 create/update/remove/setDefault/duplicate/import)에서 `@Roles('editor')`
  데코레이터가 삭제된 hunk 는 0건.
- **IDOR 방지 유지**: `remove`/`setDefault`/`update`/`duplicate` 계열은 전부 감사 기록 이전에
  `findEntity(id, workspaceId)`/`findById(id, workspaceId)` 로 워크스페이스 스코프 조회를 선행한다 —
  `workflows.service.ts:duplicate()`도 원본 조회(`findById(id, workspaceId)`, 283행)가 트랜잭션 밖에서
  선행되어, 신규 `details.duplicatedFrom` 이 크로스-워크스페이스 리소스를 가리킬 경로가 없다.
- **SQL 인젝션 없음**: `schedules.service.ts:resolveOrderBy`(112-121행)는 컬럼 화이트리스트 매핑 후
  문자열 보간하며 미허용 값은 안전한 기본값(`s.created_at`)으로 폴백한다(`schedules.service.spec.ts`
  의 `'미허용 sort 값은 s.created_at 로 폴백 (injection 차단)'` 테스트로 `; DROP TABLE ...` 페이로드
  까지 회귀 고정됨). `triggers.web-chat.spec.ts` 의 JSONB 절(`config->'interaction'->>'enabled'`)도
  고정 문자열 + 파라미터 바인딩(`:interactionEnabled`)만 사용. `recordAudit` 에 전달되는 `resourceId`
  는 항상 `ParseUUIDPipe` 검증 라우트 파라미터이거나 DB 생성 `saved.id`/`created.id`/`duplicated.id`다.
- **시크릿 비노출**: 4개 서비스의 `recordAudit`/`details` 는 `kind`(chat/embedding/rerank), `type`
  (webhook/schedule/chat_channel), `duplicatedFrom`(UUID), `imported`(boolean) 만 기록한다 — apiKey·
  webhook HMAC secret·bot token·interaction token 은 신규 audit 경로 어디에도 노출되지 않는다.
  `model-config.service.ts` 의 `maskApiKey`/`encrypt`/`decrypt` 로직은 이번 diff 로 변경되지 않았다.
- **트랜잭션 경계 정확성(C1 수정 반영 확인)**: `12_06_37` 이후 커밋 `4b9f50a87`가 지적된 C1(schedule
  타입 트리거 `update()`에서 `syncScheduleActivation`(BullMQ 외부호출)이 `recordAudit`보다 먼저
  실행되던 순서 위반)을 수정했음을 diff 로 직접 확인했다 — 현재 `triggers.service.ts:update()`는
  `save()` 커밋 직후·`syncScheduleActivation`/`normalizeNotificationSecretRef`/`setupChatChannel`
  이전에 `recordAudit`을 호출한다(외부 호출 실패 시에도 감사가 남는다). `create`/`update`/`setDefault`/
  `duplicate`/`importWorkflow` 전부 동일하게 DB 커밋 뒤 audit 을 기록하며, 신규 `importWorkflow`
  audit(`details.imported: true`)도 `dataSource.transaction` 완료 뒤에 위치한다.
- **행위자·대상 인자 스왑 방지**: 4개 서비스 모두 `recordAudit(params: {...})` 형태의 named-parameter
  private 헬퍼를 통해서만 `AuditLogsService.record()`를 호출한다 — positional 인자였다면 동일 타입
  (string) `workspaceId`/`userId`/`resourceId` 순서 스왑을 컴파일러가 잡지 못했을 위험이 diff 전체에서
  구조적으로 제거되어 있다.

## 발견사항

- **[INFO] (재확인, 조치 불요)** `TriggersService` 의 시크릿·토큰 회전/폐기 3개 메서드에 여전히 감사
  로깅이 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rotateNotificationSecret`
    (899행)·`revokePerTriggerToken`(935행)·`rotateBotToken`(980행). `grep -n "recordAudit("`로 3개
    메서드 어디에도 호출이 없음을 재확인.
  - 상세: 새 시크릿 평문을 1회 응답으로 반환하고 기존 값을 무효화하는 특권 동작인데 "누가 회전했는가"가
    기록되지 않는다(대비: `AUDIT_ACTIONS.INTEGRATION_ROTATED` 선례). `12_06_37` 라운드가 이미 동일하게
    발견했고, `audit-action.const.ts` 상단 주석이 이번 PR 스코프를 "CRUD 만"으로 명시적으로 한정한다는
    점과 일치한다 — 이번 PR 이 만든 회귀가 아니다.
  - 제안: 조치 불요(이번 PR 차단 사유 아님). 후속 트랙으로 `trigger.notification_secret_rotated` 류
    액션 추가 검토.

- **[INFO] (diff 범위 밖, 재확인)** `TriggersController.rotateBotToken` 에 `@Roles` 데코레이터 부재
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:229`(`@Post(':id/chat-channel/
    rotate-bot-token')`) — 같은 파일의 `rotateNotificationSecret`(174행)·`revokePerTriggerToken`
    (197행)은 `@Roles('editor')`를 갖는 것과 대조.
  - 상세: `RolesGuard`는 `@Roles()`가 없는 라우트를 default-allow 하므로 워크스페이스 `viewer`도 chat-
    channel bot token 회전을 수행할 수 있다. 3라운드 전부터 triage 된 기존 갭이며 이번 diff 가 이
    메서드/데코레이터를 건드리지 않았다.
  - 제안: 이번 PR 차단 사유 아님. 별도 후속으로 의도된 설계인지 확인 후 `@Roles('editor')` 추가 검토.

- **[INFO] (재확인)** FK CASCADE/애플리케이션 레벨 연쇄 삭제로 사라지는 자매 리소스는 그 삭제 자체가
  감사되지 않음
  - 위치: `workflows.service.ts` `remove()`(`workflow.deleted`만 기록, 소속 `Trigger`는 FK CASCADE
    동반 삭제되지만 `trigger.deleted` 없음) · `triggers.service.ts` `remove()`(schedule 타입은 FK
    CASCADE로 schedule row 동반 삭제되지만 `schedule.deleted` 없음) · `schedules.service.ts` `remove()`
    (`triggerRepository.delete()`로 애플리케이션 레벨에서 직접 트리거를 지우면서도 `trigger.deleted`
    없음).
  - 상세: `audit-action.const.ts`의 신규 주석(2026-08-01 추가, "1:1 결합 리소스는 주 리소스만 기록한다")
    이 이를 **의도된 설계**로 명문화했다 — 인가(`@Roles`/IDOR 스코핑)는 정상 동작하며, 순수 감사
    완결성 트레이드오프다. 새 회귀 아님.
  - 제안: 조치 불요(이미 문서화됨).

- **[INFO] (재확인)** 동시 DELETE 요청 시 동일 리소스에 중복 `*.deleted` 감사 행 생성 가능 + 감사 sink
  fail-open
  - 위치: 4개 서비스의 `remove()` 전부(`find→remove→recordAudit`, 삭제 영향 행 수 미검증) ·
    `audit-logs.service.ts:record()`(80-96행, DB 쓰기 실패를 `logger.warn`만 남기고 삼킴 — try/catch).
  - 상세: 두 항목 모두 `10_05_53`/`12_06_37` 라운드에서 이미 확인·triage 된 기존 트레이드오프이며
    이번 diff 로 변경되지 않았다.
  - 제안: 조치 불요(이미 별도 트랙으로 이월 결정됨).

## 요약

`12_06_37` 라운드 이후 실제로 변경된 부분(C1 트랜잭션-순서 수정, `importWorkflow` 감사 추가, W6 순서
가드 확장, Swagger 설명 SoT 참조 전환, prettier 포맷)을 포함해 diff 전체를 fresh 재검증한 결과, 신규로
도입된 인젝션·인증 우회·시크릿 노출·권한 검증 누락 취약점은 없다. 행위자(userId)는 검증된 JWT claim에서만
취해지고, RBAC(`@Roles`)·IDOR 방지(workspaceId 스코프 선행 조회)·SQL 인젝션 방지(파라미터 바인딩 +
컬럼 화이트리스트, DROP TABLE 페이로드 회귀 테스트로 고정)·시크릿 비노출(`details` 필드는 kind/type/
duplicatedFrom/imported 등 저위험 값만)이 4개 모듈 전수에서 유지된다. 특히 이전 라운드가 지적한 C1
(schedule 타입 트리거 update 경로의 트랜잭션-커밋-후-감사 불변식 위반)이 실제로 코드에서 수정됐음을
`recordAudit` 호출 위치를 직접 대조해 확인했다. 남은 항목은 전부 INFO 수준이며 모두 이전 라운드에서 이미
triage 되어 이번 PR 의 명시된 CRUD-only 스코프 밖(시크릿 회전 감사 부재, `rotateBotToken` RBAC 부재,
FK CASCADE 자매 리소스 미감사, 동시 삭제 중복 행/감사 sink fail-open)이다. 이번 PR 을 차단할 보안
사유는 없다.

## 위험도

LOW
