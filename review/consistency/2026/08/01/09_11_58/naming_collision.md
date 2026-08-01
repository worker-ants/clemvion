STATUS=success 신규 식별자 충돌 검토 완료 — WARNING 2건, INFO 1건 (CRITICAL 없음)
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — spec/data-flow/ (--impl-prep)

## 발견사항

- **[WARNING]** `spec/data-flow/1-audit.md`(및 `3-execution.md`)의 endpoint 표기가 global prefix `/api` 를 일관되게 누락 — 형제 문서·SoT 와 동일 endpoint 를 다른 문자열로 표기
  - target 신규 식별자: `spec/data-flow/1-audit.md` §1.1 표·§2 의 endpoint 표기 8건 — `GET /audit-logs`(§2.1, L451), `GET /users/me/login-history`(§2.2, L463), `POST /users/me/change-password`(L382), `POST /users/me/email-change/verify`(L383), `POST /auth/2fa/verify`(L384), `POST /auth/2fa/disable`(L385), `…/webauthn/register/verify`(L386), `…/webauthn/credentials/:id`(L387) — 전부 `/api` prefix 없이 표기됨. 동일 패턴이 `spec/data-flow/3-execution.md` L728("REST `POST /executions/:id/continue`")에도 있음.
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/audit-logging/codebase/backend/src/main.ts:186` — `app.setGlobalPrefix('api')`. 실제 서버 경로는 전부 `/api/*`.
    - `/Volumes/project/private/clemvion/.claude/worktrees/audit-logging/codebase/backend/src/modules/audit-logs/audit-logs.controller.ts` — `@Controller('audit-logs')` + `@Get()` → 실경로는 `GET /api/audit-logs`.
    - `/Volumes/project/private/clemvion/.claude/worktrees/audit-logging/codebase/backend/src/modules/auth/sessions.controller.ts:42,167` — `@Controller('users/me')` + `@Get('login-history')`, 컨트롤러 자체 주석도 "`/api/users/me/sessions` 와 `/api/users/me/login-history`" 로 명기.
    - `spec/5-system/1-auth.md:499` (API 표) — `| GET | /api/audit-logs | 감사 로그 조회 (Admin+) |`.
    - `spec/5-system/1-auth.md:502` — `/api/users/me/sessions`, `/api/users/me/login-history` 를 정본 경로로 cross-ref.
    - 같은 target 번들의 형제 문서 `spec/data-flow/2-auth.md:2051` — `GET /api/users/me/login-history`(**1-audit.md L463 과 동일 엔드포인트**), `2-auth.md:2076` — `#### 1.7.1 이메일 변경 (`/api/users/me/email-change/*`, 인증 §1.1.B)`(**1-audit.md L383 과 동일 엔드포인트**). 둘 다 `/api` 포함.
    - `spec/data-flow/11-workflow.md`·`12-workspace.md`·`7-llm-usage.md`·`0-overview.md` 는 대부분 `/api` prefix 를 일관되게 포함(예: `POST /api/workflows/:id/save`, `POST /api/workspaces`, `POST /api/model-configs`, `POST /api/hooks/:endpointPath`).
  - 상세: 실제로 동일한 REST endpoint(예: 로그인 이력 조회, 이메일 변경 확인)가 `1-audit.md` 에서는 `/api` 없이, 실코드·`spec/5-system/1-auth.md`(SoT)·같은 폴더의 `2-auth.md` 에서는 `/api` 를 포함해 표기된다. `1-audit.md` 는 8건 전부 동일 패턴이라 우연한 오탈자가 아니라 이 문서 전체가 `/api` prefix 를 의도적으로(혹은 관행적으로) 생략하는 것으로 보이며, 이는 같은 target 번들 안에서 이미 확립된 반대 표기(`2-auth.md` 등)와 부딪힌다. 문서만 보고 API 호출부·e2e 테스트·외부 연동 문서를 작성하면 404 를 유발할 수 있는 실질적 리스크다.
  - 제안: `spec/data-flow/1-audit.md`·`3-execution.md` 의 모든 REST endpoint 표기에 `/api` prefix 를 추가해 `2-auth.md`/`11-workflow.md`/`12-workspace.md`/`7-llm-usage.md`/`0-overview.md`(그리고 `spec/5-system/1-auth.md`) 와 통일한다. 재발 방지를 위해 `spec/data-flow/0-overview.md §3`(공통 규약)에 "본문 산문의 endpoint 표기는 항상 `/api/...` 전체 경로를 쓴다(mermaid 시퀀스 다이어그램의 actor↔actor 화살표 라벨은 예외적으로 controller 상대 경로 허용)" 같은 명시 규칙을 추가하는 것을 권장.

- **[WARNING]** `11-workflow.md` §1.3 의 `/sessions` 축약 표기가 인증 도메인의 실제 `/api/users/me/sessions` 와 문자열 층위에서 겹쳐 혼동 유발
  - target 신규 식별자: `spec/data-flow/11-workflow.md:1276-1277` — "`GET /sessions?workflowId=…`(내 세션 목록…)", "`GET /sessions/:id`(메시지 포함 단건)". 같은 문서 L1255 는 바로 위에서 `POST /api/workflow-assistant/sessions` 로 정확히 표기했으나, 두 줄 뒤 이 축약형은 `/api` 뿐 아니라 `workflow-assistant/` 세그먼트까지 함께 생략함.
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/audit-logging/codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:41,50,88` — `@Controller('workflow-assistant')` + `@Get('sessions')`/`@Get('sessions/:id')` → 실경로 `GET /api/workflow-assistant/sessions`, `GET /api/workflow-assistant/sessions/:id`. 반면 `/api/users/me/sessions` 는 완전히 다른 도메인(인증 refresh-token 세션 목록, `sessions.controller.ts` `@Controller('users/me')` `@Get('sessions')`, `spec/data-flow/2-auth.md:2050` 에 문서화)에 이미 존재하는 리소스명이다.
  - 상세: "session(s)" 라는 단어가 이 코드베이스에서 이미 두 개의 서로 다른 리소스(① 인증 도메인의 refresh-token 디바이스 세션, ② Workflow AI Assistant 의 채팅 세션)를 가리키는 상태에서, `11-workflow.md` 가 자신의 것을 `/sessions` 로만 축약하면 다른 리소스(`/api/users/me/sessions`)와 표면적으로 구분이 안 된다. 같은 문서 안에서도 L1255 는 전체 경로, L1276-1277 은 축약 경로라 자기 모순적이다.
  - 제안: L1276-1277 을 `GET /api/workflow-assistant/sessions?workflowId=…`, `GET /api/workflow-assistant/sessions/:id` 로 완전한 경로로 수정해 인증 세션 엔드포인트와 표기 층위에서도 명확히 구분한다.

- **[INFO]** `spec/0-overview.md §8` 문서 맵의 "알파벳 순 숫자 prefix" 서술이 `spec/data-flow/` 의 최근 3개 파일과 어긋남
  - target 신규 식별자: 없음 — `spec/0-overview.md §8`(문서 맵 표)의 서술 "데이터 흐름 … `1-audit ~ 15-external-interaction, 알파벳 순 숫자 prefix`" 자체가 현재 파일 목록과 불일치하는 설명이라는 점을 지적.
  - 기존 사용처: `spec/data-flow/` 실제 파일 목록 — `1-audit.md`~`12-workspace.md`(12개)는 도메인명(`audit, auth, execution, file-storage, integration, knowledge-base, llm-usage, notifications, observability, triggers, workflow, workspace`) 기준으로 완벽히 알파벳 순이나, `13-agent-memory.md`/`14-chat-channel.md`/`15-external-interaction.md` 는 전체 15개를 알파벳 순 정렬했을 때 각각 1번째·4번째·6번째 근방에 와야 함에도 뒤(13/14/15)에 이어 붙어 있다(`spec/data-flow/0-overview.md §2` 도메인 인덱스 표, L145-166 에서 직접 확인).
  - 상세: 뒤 3개 도메인은 최초 12개 세트가 이미 번호 확정된 뒤 나중에 추가되며 기존 파일 재넘버링을 피하기 위해 끝에 순차 추가된 것으로 보인다(합리적인 실무 선택). 다만 root `spec/0-overview.md` 의 요약 문구는 이 예외를 반영하지 못한 채 "전체가 알파벳 순"이라고 서술해, 향후 새 data-flow 도메인 문서를 추가하려는 사람이 "알파벳 순으로 끼워 넣어야 하는가/끝에 추가해야 하는가"를 오판할 수 있다. 기능적 경로 충돌은 아니므로 INFO.
  - 제안: `spec/0-overview.md §8` 서술을 "최초 12개 도메인은 알파벳 순, 이후 신규 도메인은 기존 파일 번호 보존을 위해 끝에 순차 추가"로 정정하거나, `spec/data-flow/0-overview.md §2` 도메인 인덱스 표 부근에 신규 도메인 추가 시 번호 배정 규칙(끝에 추가)을 명문화한다.

## 요약

이번 --impl-prep 검토(scope=`spec/data-flow/`)에서 요구사항 ID·엔티티/타입명·이벤트명·환경변수 층위의 신규 식별자 충돌은 발견되지 않았다 — `AuditAction`/`AUDIT_ACTIONS`, `audit_log`/`login_history` 스키마, action·event 명명 규약(`spec/conventions/audit-actions.md`)은 `spec/5-system/1-auth.md`·`spec/data-flow/12-workspace.md`·`spec/data-flow/2-auth.md`·실제 코드(`audit-action.const.ts`)와 정확히 정합했고, 계획된 신규 액션(`workflow.*`/`trigger.*`/`schedule.*`/`model_config.*`)도 다른 어떤 기존 식별자와도 겹치지 않았다. `RETENTION_DAYS`/`PRUNE_BATCH`/`PRUNE_MAX_BATCHES` 등은 모듈 로컬 상수라 충돌 표면이 없다. 다만 **API endpoint 표기 층위**(관점 3)에서 `spec/data-flow/1-audit.md`(및 `3-execution.md`)가 실제 서버 경로(global prefix `/api`, `main.ts:186`)·SoT(`spec/5-system/1-auth.md`)·같은 target 번들의 형제 문서(`2-auth.md`) 와 다른, prefix 없는 표기를 8곳에서 일관되게 사용하고 있어 동일 endpoint 가 문서마다 다른 문자열로 나타나는 결함을 확인했다. `11-workflow.md` 의 `/sessions` 축약 표기는 한 걸음 더 나아가 인증 도메인에 이미 존재하는 `/api/users/me/sessions` 와 표면 문자열이 겹쳐 두 리소스가 혼동될 위험을 만든다. 부가로 data-flow 폴더 번호 prefix 의 "알파벳 순" 서술이 최근 추가된 3개 파일(agent-memory/chat-channel/external-interaction)과 어긋나는 경미한 문서 정확성 이슈도 함께 발견했다. 세 건 모두 시스템 동작을 직접 깨뜨리는 CRITICAL 은 아니지만, 문서를 근거로 구현·테스트·연동 문서를 작성할 때 잘못된 경로를 만들어낼 수 있는 실질적 리스크라 구현 착수 전 정정을 권장한다.

## 위험도

MEDIUM
