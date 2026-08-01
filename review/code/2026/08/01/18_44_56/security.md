# 보안(Security) 리뷰 — audit-logging

## 발견사항

- **[WARNING]** `TriggersService` 의 시크릿/토큰 회전(재발급) 3개 엔드포인트가 감사 로그를 전혀 남기지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:902` (`rotateNotificationSecret`), `:938` (`revokePerTriggerToken`), `:983` (`rotateBotToken`)
  - 상세: 본 PR 은 `workflow`/`trigger`/`schedule`/`model_config` 리소스의 CRUD 를 감사 로그에 남기는 것이 목적이다. `TriggersService` 는 `create`/`update`/`remove` 에서는 각각 `recordAudit(...)` 를 호출해 `TRIGGER_CREATED`/`TRIGGER_UPDATED`/`TRIGGER_DELETED` 를 남기지만(902줄 이전 구간에서 확인됨: 265, 345, 879), 정작 가장 보안 민감한 세 작업 —
    - `rotateNotificationSecret` (outbound notification HMAC 서명 시크릿 재발급, `wsk_*`)
    - `revokePerTriggerToken` (per-trigger 상호작용 토큰 재발급, `itk_*`)
    - `rotateBotToken` (chat channel bot token 회전, 외부 provider API 재인증까지 수반)

    는 `recordAudit` 를 전혀 호출하지 않는다(`grep -n "recordAudit\|AUDIT_ACTIONS\." triggers.service.ts` 로 확인 — 위 세 메서드 본문에 매치 없음). 이 세 메서드는 모두 트리거 소유 워크스페이스의 Editor+ 권한만 있으면 호출 가능하고, 응답에 새 시크릿/토큰 평문을 1회 반환하는 "특권 작업"이다. 같은 코드베이스에서 개념적으로 대응되는 `auth_config.regenerate`/`auth_config.reveal` 은 `audit-action.const.ts` 에 전용 액션이 정의되어 감사되는 것과 대비된다. `audit-action.const.ts` 상단 주석은 `workflow.executed` 처럼 의도적으로 제외한 액션에 대해서는 근거를 상세히 명문화해 두는데(카디널리티·보존정책 이유), 이 세 회전 작업에 대해서는 그런 의도적 제외 근거가 어디에도 없다 — 누락이 의도된 스코프 제한인지 단순 누락인지 코드만으로는 판별 불가.
    보안적 영향: 계정 탈취(세션/토큰 탈취) 후 공격자가 webhook 서명 시크릿이나 봇 토큰을 조용히 회전시켜 기존 통합을 무력화하거나 자신이 통제하는 값으로 바꿔치기해도, audit_log 에는 아무 흔적이 남지 않는다. 사고 대응(incident response) 시 "누가 언제 어떤 트리거의 시크릿을 회전했는가"를 감사 로그만으로 재구성할 수 없다.
  - 제안: 세 메서드 말미에 각각 새 audit action (예: `trigger.notification_secret_rotated`, `trigger.interaction_token_revoked`, `trigger.chat_channel_bot_token_rotated`)을 `AUDIT_ACTIONS`/`AuditActionFor<'trigger'>` 에 추가하고 `recordAudit` 호출을 추가할 것. 만약 이번 PR 스코프에서 의도적으로 제외한 것이라면 (spec-sync-auth-gaps §4.1 CRUD-only 스코프 등), `audit-action.const.ts` 상단 주석에 `workflow.executed` 와 동일한 수준의 명시적 배제 근거를 남겨 향후 재검토 시 "누락"과 "의도적 제외"를 구분 가능하게 할 것.

- **[INFO]** `recordAudit` 실패에 대한 방어적 격리(isolation) 부재
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts:242-257`(`recordAudit`), `codebase/backend/src/modules/schedules/schedules.service.ts:144-157`, `codebase/backend/src/modules/triggers/triggers.service.ts:212-227`, `codebase/backend/src/modules/workflows/workflows.service.ts:177-192` — 각 서비스의 `recordAudit` 호출부 전반(예: `model-config.service.ts:287`, `schedules.service.ts:191`, `triggers.service.ts:265`, `workflows.service.ts:223`)
  - 상세: 모든 `recordAudit` 호출은 리소스 mutation이 커밋된 **뒤에** 무보호(`await` 그대로, try/catch 없음) 상태로 실행된다. 반면 같은 `ModelConfigService` 안의 `notifyInvalidated` (79-91줄)는 리스너별 try/catch 로 실패를 격리해 mutation 응답을 깨지 않도록 명시적으로 설계돼 있다("무효화는 best-effort 부수효과이지 mutation 성공의 전제가 아니기 때문"). `recordAudit` 은 그런 격리가 없으므로, `AuditLogsService.record()` 가 일시적으로 실패(DB 커넥션 문제 등)하면 이미 커밋된 mutation(트리거/워크플로/스케줄/모델설정 생성·수정·삭제) 에 대해 클라이언트가 5xx 를 받는 상태 불일치가 발생하거나, 상위 예외 처리기가 이를 삼키는 경우 감사 흔적이 조용히 유실될 수 있다. `AuditLogsService.record()` 자체의 오류 처리 전략은 이번 리뷰 대상 파일에 포함되지 않아 실제 방어 수준을 확인하지 못했다.
  - 제안: `AuditLogsService.record()` 내부에서 실패를 삼키고 로깅만 하는 fire-and-forget 전략인지, 아니면 실패를 상위로 전파해 감사 유실을 명시적으로 감지 가능하게 하는 전략인지 SoT 문서에 명문화하고, 두 전략 중 하나로 전 서비스에 일관되게 적용할 것.

## 요약

이번 변경은 `workflow`/`trigger`/`schedule`/`model_config` 리소스의 CRUD 작업에 대한 감사 로그(audit log) 기록을 추가하는 PR 이다. SQL 인젝션(화이트리스트 정렬 컬럼, 파라미터 바인딩 전면 적용), 인가(모든 조회/수정이 `workspaceId` 로 스코프되고 `assertAuthConfigInWorkspace`·`findEntity(expectedKind)` 등 cross-tenant/cross-kind IDOR 방어가 견고), 시크릿 처리(API 키·봇 토큰·서명 시크릿은 암호화 저장 또는 secret store 참조로만 다루며 응답 마스킹·plaintext strip 이 다층으로 구현됨), SSRF(모델 설정 baseUrl 에 대한 사설망 차단) 등 핵심 축에서는 뚜렷한 신규 취약점이 발견되지 않았다. 다만 감사 로깅 기능 자체의 완결성 관점에서, `TriggersService` 의 시크릿/토큰 회전 3개 메서드가 감사 대상에서 빠져 있어 이 PR 의 목적(보안 사건 추적 가능성)에 유의미한 사각지대를 남긴다. 이는 직접적인 익스플로잇 경로는 아니지만 사고 대응 역량을 약화시키므로 WARNING 으로 분류했다.

## 위험도

MEDIUM
