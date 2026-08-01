# Security Review — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅)

## 발견사항

- **[WARNING]** 트리거 시크릿/토큰 회전(rotation) 엔드포인트가 감사 로그에 전혀 기록되지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:902` (`rotateNotificationSecret`), `:938` (`revokePerTriggerToken`), `:983` (`rotateBotToken`)
  - 상세: 본 PR 은 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD 액션에 대한 감사 로깅을 추가했다. 그런데 같은 `TriggersService` 안의 세 보안 민감 작업 — 아웃바운드 웹훅 HMAC 서명 시크릿 회전(`rotateNotificationSecret`), per-trigger interaction 토큰 재발급(`revokePerTriggerToken`), 챗채널 bot token 회전(`rotateBotToken`) — 은 성공 시 `this.recordAudit(...)` 호출이 전혀 없다. 세 메서드 모두 새 시크릿/토큰을 `randomBytes(32)` 로 생성해 반환하지만 "누가 언제 회전시켰는지" 를 남기는 audit row 가 없다. 자격증명 회전/폐기는 감사 추적이 가장 필요한 이벤트 클래스(예: 계정 탈취 후 공격자가 봇 토큰을 자기 것으로 바꿔치기해도 흔적이 없음) 이므로 OWASP A09(Security Logging and Monitoring Failures) 관점의 갭이다.
  - 참고: `spec/5-system/1-auth.md §4.1` 의 "현재 구현된 액션"/"Planned" 표 어디에도 이 세 이벤트가 없어 **본 PR 의 명시 스코프(CRUD 카탈로그) 밖**이며, 이번 diff 가 만든 회귀는 아니다. 다만 감사 로깅 기능 자체의 취지(보안 사고 대응 시 "누가·언제·무엇을" 재구성)에 정면으로 걸리는 인접 갭이라 별도 후속 작업으로 남길 것을 권고한다.
  - 제안: `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` / `trigger.bot_token_rotated` 류 액션을 `AUDIT_ACTIONS`(및 spec §4.1 카탈로그)에 추가하고 각 메서드 성공 경로 끝에 `recordAudit` 호출을 추가하는 후속 spec/plan 항목으로 트래킹.

- **[INFO]** 어댑터 실패 메시지가 truncate 후 그대로 `chat_channel_last_error` 에 저장·API 노출
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:804` (`setupChatChannel` catch 블록, `chatChannelLastError: message.slice(0, 1024)`)
  - 상세: `err.message`(외부 provider SDK/HTTP client 가 만든 에러 문자열)를 검증 없이 최대 1024자 잘라 DB 컬럼에 영속하고, 이 필드는 트리거 조회 응답을 통해 워크스페이스 사용자에게 노출될 수 있는 상태다(트리거 detail 응답에 이 컬럼을 제외한다는 별도 strip 로직이 안 보임 — `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 는 `config.chatChannel` 필드만 대상). 일부 HTTP client 라이브러리는 실패한 요청의 URL(쿼리 스트링 포함)을 에러 메시지에 포함시키는 경우가 있어, provider 쪽 구현에 따라 봇 토큰/서명 시크릿이 실수로 URL 이나 헤더 덤프에 섞여 에러 메시지에 노출될 여지를 완전히 배제하기 어렵다. 현재 코드베이스에 이미 존재하는 기존 패턴이며 이번 diff 가 새로 만든 것은 아니다.
  - 제안: 저장/응답 전에 알려진 시크릿 패턴(봇 토큰 접두사 등)에 대한 redaction 필터를 추가하거나, adapter 에러를 status code + 정형 코드로만 매핑해 raw provider 메시지를 저장하지 않는 방향 검토(이미 `translateSetupChannelError` 가 유사 매핑을 하고 있어 참고 가능).

- **[INFO]** 감사 기록 실패 시 주 트랜잭션 이후 요청이 500 으로 실패(가용성 트레이드오프, 취약점 아님)
  - 위치: 4개 서비스 전반의 `await this.recordAudit(...)` 호출부(예: `codebase/backend/src/modules/workflows/workflows.service.ts:223`, `codebase/backend/src/modules/triggers/triggers.service.ts:265`, `codebase/backend/src/modules/schedules/schedules.service.ts:191`, `codebase/backend/src/modules/model-config/model-config.service.ts:289`)
  - 상세: 리소스 커밋 후 `recordAudit` 를 try/catch 없이 await 하므로, `AuditLogsService.record` 가 실패하면(예: DB 장애) 이미 커밋된 mutation 임에도 API 응답은 에러가 된다. 이는 "감사 로그를 조용히 누락시키는" 실패-오픈(fail-open)보다는 안전한 선택(실패-폐쇄, 감사 갭을 숨기지 않음)이라 보안 관점에서는 오히려 바람직한 설계이며 취약점으로 분류하지 않는다. 다만 클라이언트 재시도 시 중복 리소스 생성 가능성 등 신뢰성 이슈가 있을 수 있어 참고용으로만 남긴다.

- **[INFO]** `AuditActionFor<P>` 컴파일 타임 가드로 리소스-액션 교차 오염 방지 — 확인됨, 결함 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:103-124`
  - 상세: `resourceType` 고정 서비스가 다른 도메인 액션(예: `WorkflowsService` 에 `trigger.deleted`)을 실수로 넘기는 것을 타입 레벨에서 차단하는 `_NoCrossDomain` 가드가 `nest build` 대상 소스 파일에 위치해 실제로 빌드 검증됨을 확인. `recordAudit` helper 도 4개 서비스 전부에서 named 파라미터로 `userId`/`workspaceId` 순서 스왑을 방지하고 있고, 각 `resourceId` 는 삭제 전에 읽어둔 id 를 쓰는 등(TypeORM `remove()` 이후 id 널 회귀 방지) 일관되게 올바르다. 별도 조치 불요.

## 점검했지만 이상 없음(참고)

- SQL 인젝션: `SchedulesService.resolveOrderBy`, `WorkflowsService.getSortColumn` 모두 화이트리스트 매핑 + 파라미터 바인딩(`:workspaceId` 등)만 사용, 사용자 입력이 쿼리 문자열에 직접 보간되지 않음.
- 시크릿 처리: `TriggersService` 의 `stripChatChannelPlaintext`/`stripInlineAuthKeys`/`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` allow-list 가 봇 토큰·서명 시크릿 평문이 DB JSONB 나 API 응답에 흘러가지 않도록 이중 방어 중. `rotateBotToken`/`rotateNotificationSecret`/`revokePerTriggerToken` 은 모두 `randomBytes(32)` 기반 안전한 난수 생성 사용.
- SSRF: `ModelConfigService.assertBaseUrlNotSsrf`, `TriggersService.assertNotificationUrlSafe`(`validateNotificationUrl`) 가 기존 그대로 유지되어 audit 로깅 추가로 인한 약화 없음.
- 하드코딩된 시크릿: 5개 파일 전체에서 실제 자격증명·API 키·비밀번호 리터럴 없음(`wsk_`/`itk_` 는 토큰 접두사일 뿐 값 아님).
- 인가/멀티테넌시: 리뷰 대상 모든 조회/수정 메서드가 `workspaceId` 로 스코프됨(`findEntity`, `findById`, `assertAuthConfigInWorkspace` 등) — IDOR 방지 패턴 일관.
- 에러 메시지: `notFound()`, `MODEL_CONFIG_INVALID`, `ENCRYPTION_KEY_MISSING` 등 클라이언트에 반환되는 메시지는 내부 구조/시크릿 값을 노출하지 않음. 사용자 입력(cron 표현식·타임존)을 에러 메시지에 그대로 반영하는 부분은 사용자 자신의 입력을 되돌려주는 것뿐이라 인젝션/정보노출 리스크 아님.

## 요약

이번 변경은 `workflow`/`trigger`/`schedule`/`model_config` 4개 서비스에 CRUD 감사 로깅을 추가하는 작업으로, 커밋 후 기록(트랜잭션 롤백 시 유령 감사 방지), named-parameter helper(행위자·주체 순서 스왑 방지), `AuditActionFor<P>` 컴파일 타임 교차-도메인 가드 등 이미 여러 리뷰 라운드를 거쳐 견고하게 설계되어 있다. 새로 추가된 코드 자체에서 인젝션·하드코딩 시크릿·인가 우회·안전하지 않은 암호화 등 CRITICAL/직접적 취약점은 발견되지 않았다. 다만 같은 파일(`TriggersService`) 안에서 봇 토큰/서명 시크릿 회전·인터랙션 토큰 폐기 같은 고위험 자격증명 작업이 이번 감사 로깅 확장에서 빠져 있어(spec §4.1 카탈로그에도 미포함 — PR 스코프 밖이지만), 감사 추적이라는 기능의 목적을 감안하면 후속 조치로 명시적으로 남겨둘 가치가 있는 갭이다.

## 위험도

LOW
