# 부작용(Side Effect) Review — trigger-rotation-audit

## 발견사항

- **[INFO]** `recordAudit` 가 던져도 회전 자체는 500 으로 죽지 않는다 — 기존 "best-effort swallow" 계약을 그대로 재사용
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:925` (`rotateNotificationSecret`), `:973` (`revokePerTriggerToken`), `:1113` (`rotateBotToken`) — 세 곳 모두 `private recordAudit()`(`triggers.service.ts:212`)를 통해 `AuditLogsService.record()`(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-97`)를 호출한다.
  - 상세: `AuditLogsService.record()` 의 doc comment 가 명시한다 — "Failures are swallowed — audit logging must never break the primary action"(`audit-logs.service.ts:68-70`). 실제 구현도 `try { ...save... } catch (err) { this.logger.warn(...) }` 로 모든 예외를 내부에서 삼키고 항상 resolve 한다(`audit-logs.service.ts:81-96`). 이 계약은 `audit-logs.spec.ts` 의 `AuditLogsService.record — best-effort (swallow)` describe 블록(`audit-logs.spec.ts:86-110`)에서 "save 가 reject 해도 예외를 삼키고 resolve 한다" 로 회귀 방지되고 있고, 그 docstring 자체가 "모든 audit producer(integrations/auth-configs/workspaces 등)... 그 계약의 단일 회귀 방지 지점" 이라고 밝힌다. `TriggersService.recordAudit` 는 이 `record()` 를 그대로 pass-through 하므로(파라미터 조립만 하고 별도 try/catch 없음), 새로 추가된 세 회전 메서드도 `create`/`update`/`remove` 와 완전히 동일한 안전성을 물려받는다 — 감사 적재가 실패해도 이미 커밋된 회전(컬럼 갱신·secret store 반영)이 500 으로 뒤집히지 않는다.
  - 제안: 없음(의도대로 안전). 다만 아래 WARNING 참고.

- **[WARNING]** swallow 계약의 반대급부 — 감사 실패가 `logger.warn` 한 줄로만 남고 별도 관측 수단이 없다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:92-95` (catch 블록) — 이 diff 가 새로 정당화한 목적 서술은 `codebase/backend/src/modules/audit-logs/audit-action.const.ts:82-85`.
  - 상세: 이번 diff 가 세 액션을 감사 대상으로 추가한 근거는 명시적으로 "계정 탈취 후의 조용한 교체를 `audit_log` 만으로 재구성할 수 있어야 한다"(`audit-action.const.ts:83-84`)이다. 그런데 위 INFO 항목에서 확인했듯 `record()` 는 DB 오류를 `logger.warn` 으로만 삼키고 별도 알림·메트릭이 없다 — 즉 "회전은 200 으로 성공 응답, 그런데 감사 행만 조용히 비어 있음" 케이스가 이 diff 로도, 기존 17개 producer 로도 막히지 않는다. 이건 이번 diff 가 만든 회귀가 아니라 프로젝트 전역의 기존 설계(모든 감사 producer 공통)이고, 세 메서드가 그 관례에서 벗어나지 않은 것 자체는 옳은 선택이다. 다만 이번에 명시적으로 끌어올린 "계정 탈취 재구성" 이라는 신뢰 수준과, 그 신뢰를 지탱하는 하부 메커니즘(관측 없는 swallow)의 갭은 이 PR 범위 밖 후속 과제로 남을 필요가 있다.
  - 제안: 이 diff 를 막을 사안은 아님. 별도 후속으로 `audit_log` 적재 실패 카운터/알림을 고려할 것을 plan 에 기록 권고.

- **[NONE]** `rotateBotToken` 의 `recordAudit` 위치 — 컬럼 갱신과 감사 기록 사이에 실패 가능 지점 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1099-1119` (`triggerRepository.update` → 주석 → `recordAudit` → return 객체 조립)
  - 상세: `triggerRepository.update(...)` (6단계 오케스트레이션의 마지막 DB 반영, gate 1101-1110) 완료 직후 바로 `recordAudit` 를 호출하고(gate 1113-1119), 그 사이엔 순수 주석(gate 1111-1112)뿐이다. `recordAudit` 호출 이후에도 return 객체 조립은 이미 확보된 값(`rotatedAt`/`trigger.id`/`mergedChannel.botIdentity`)의 순수 프로퍼티 접근이라 던질 수 없다. 즉 "컬럼은 갱신됐는데 감사만 못 남기는" 갈림 지점 자체가 없고(주석에서도 "컬럼 갱신이 끝난 뒤에 기록한다" 는 의도를 명시), 설령 있었더라도 위 INFO 항목 때문에 `recordAudit` 는 실질적으로 던지지 않는다.
  - 제안: 없음.

- **[NONE]** 컨트롤러 시그니처 변경 — 전수 호출부 확인, 파괴적 변경 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:192-202`(`rotateNotificationSecret`), `:220-226`(`revokePerTriggerToken`), `:247-265`(`rotateBotToken`) — 서비스 쪽 대응 시그니처는 `triggers.service.ts:902-906`, `:946-950`, `:999-1003`.
  - 상세: 추가된 `userId` 는 `@CurrentUser('sub')` 로 JWT 에서만 채워지고(이미 `create`/`update`/`remove` 가 쓰던 동일 패턴, `triggers.controller.ts:100,126,166`) HTTP 요청 바디/쿼리에 새 필드가 붙은 게 아니므로 외부 REST 계약은 그대로다 — `codebase/frontend/src/lib/api/triggers.ts:204,223` 의 프론트 클라이언트는 HTTP 호출만 하고 인자 위치에 의존하지 않는다(확인). backend 전체에서 세 메서드의 다른 호출부를 찾았으나 실제 위치 인자를 넘겨 호출하는 곳은 컨트롤러 자신뿐이다: (a) `codebase/backend/src/repo-guards/__tests__/workspace-roles-attachment.spec.ts:56` 는 `rotateBotToken` 을 `Reflect.getMetadata(ROLES_KEY, handler)` 로만 읽고 실제 호출하지 않아 시그니처 변경과 무관, (b) `codebase/backend/test/*.e2e-spec.ts` 전체에서 `rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`/해당 라우트(`rotate-secret`/`revoke-token`/`rotate-bot-token`) 참조 0건(grep) — 깨질 e2e 자체가 없다. 같은 diff 안에서 `triggers.controller.spec.ts`·`triggers.service.spec.ts` 의 모든 호출 지점이 새 인자 순서로 동시 갱신됐고, 컨트롤러→서비스 인자 순서(`id, workspaceId, [newBotToken,] userId`)가 정확히 일치한다(스왑 없음).
  - 제안: 없음.

- **[INFO]** diff 에 트리거 회전 감사와 무관한 파일이 섞여 있음
  - 위치: `.claude/tests/test_consistency_bundle_priority.py` (게이트 504-529, 552-567 부근)
  - 상세: consistency-checker 하네스의 tier-0 번들 우선순위 테스트를 더 견고하게 만드는 변경(단언을 `rank == 0` → `rank < tier0_size` 로 완화)으로, 트리거 시크릿/토큰 회전 감사 기능과는 도메인이 다르다. 변경 자체는 assertion 로직만 건드리고 기존 `cp` 기반 원복(finally 블록)은 그대로라 자체적인 부작용은 없다. 다만 무관한 변경이 같은 changeset 에 섞이면 이후 "이 부작용이 어느 커밋에서 왔나" 추적이 어려워질 수 있어 기록으로 남긴다.
  - 제안: 이번 세션은 이미 병합된 형태라 조치 불필요. 향후 분리 가능하면 분리 권장.

- **[NONE]** `AUDIT_ACTIONS` 상수 3종 추가 — 순수 추가, 기존 코드에 영향 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:86-90`
  - 상세: `as const` 객체 리터럴에 키 3개를 추가하는 순수 additive 변경. `AuditAction` union 이 넓어지지만 `grep` 결과 `AuditAction` 타입을 소비하는 곳은 `auth-configs.service.ts:79` 하나뿐이고 그마저 단순 필드 타입 사용이라 exhaustive switch 로 깨질 지점이 없다. `AuditActionFor<P>` 는 `Extract` 기반이라 신규 리소스 접두를 자동으로 좁혀 받고, 파일 하단의 `_NoCrossDomain` 컴파일 타임 가드도 새 액션과 무관하게 동작한다.
  - 제안: 없음.

## 요약

핵심 우려였던 "`recordAudit` 가 던지면 회전이 500 으로 실패하는가"는 코드 추적 결과 **아니오**로 확인된다 — `AuditLogsService.record()` 자체가 모든 예외를 내부에서 삼키는 "best-effort" 계약(전용 회귀 테스트로 고정됨)을 갖고 있고, 새 세 메서드(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`)는 `create`/`update`/`remove` 와 동일하게 이 계약을 그대로 재사용한다. 다만 그 계약의 반대급부(감사 실패가 `logger.warn` 만 남기고 조용히 사라질 수 있음)는 이번에 새로 명문화된 "계정 탈취 재구성" 이라는 보안 목적의 신뢰 수준과 다소 어긋나므로 별도 관측 수단을 후속 과제로 남길 만하다(회귀는 아님). `rotateBotToken` 의 감사 위치(컬럼 갱신 직후)는 개입 코드가 없어 안전하고, 컨트롤러 시그니처 변경(`userId` 추가)은 서버 측 JWT 파생값이라 외부 API 계약을 바꾸지 않으며, 전수 grep 결과 이 diff 가 갱신하지 않은 다른 호출부(e2e 포함)는 존재하지 않는다. 무관한 하네스 테스트 파일 하나가 같은 diff 에 섞여 있으나 그 자체의 부작용은 없다.

## 위험도

LOW
