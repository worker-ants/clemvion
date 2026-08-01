# 신규 식별자 충돌 검토 — spec/5-system (--impl-done)

## 발견사항

- **[WARNING]** 신규 구현 audit action `trigger.updated`/`trigger.deleted` 와 문자열상 매우 유사하지만 다른 표기인 `trigger.update`/`trigger.delete` 가 같은 개념을 가리키는 채로 spec 두 곳에 잔존 — 실제 구현·SoT 와 어긋나 조회/문서 신뢰도에 실질 위험
  - target 신규 식별자 (impl-done 으로 실체화됨, `git -C ".../audit-logging" show HEAD:codebase/backend/src/modules/audit-logs/audit-action.const.ts` 로 확인):
    ```
    TRIGGER_CREATED: 'trigger.created',
    TRIGGER_UPDATED: 'trigger.updated',
    TRIGGER_DELETED: 'trigger.deleted',
    ```
    (`triggers.service.ts:268,348,882` 가 `AUDIT_ACTIONS.TRIGGER_CREATED/UPDATED/DELETED` 를 그대로 사용 — 실제 DB 에 적재되는 문자열은 `trigger.created`/`trigger.updated`/`trigger.deleted` 뿐이며, `trigger.update`/`trigger.delete` 문자열은 코드 전체(백엔드+프론트) 어디에도 존재하지 않음, `grep -rn "trigger\.delete\b\|trigger\.update\b" codebase/` 0건).
  - 기존 사용처 (충돌 지점, 둘 다 `origin/main` 대비 본 PR diff 밖 — 즉 target 이 새로 만든 문구는 아니지만, target 이 실체화한 신규 식별자와 지금 처음으로 충돌이 확정됨):
    - `spec/2-navigation/2-trigger-list.md:182` — "API 게이트는 … `trigger.delete` permission 으로 보호되며 audit log 의 `trigger.delete` action 항목으로 기록된다."
    - `spec/2-navigation/2-trigger-list.md:252` — "**audit**: 활성/비활성 전환도 `trigger.update` 로 기록한다 (별도 `trigger.toggle` 동사 없음)."
    - `spec/5-system/15-chat-channel.md:377` — "PATCH 차단의 정당화: … (c) audit log 가 `trigger.update` 와 `chat-channel.rotate-bot-token` 으로 mixed." (이 파일은 target 범위인 `spec/5-system/` 안에 있으나 프롬프트 컨텍스트 예산 초과로 번들에서 생략되어, 직접 `Read` 로 확인함.)
  - 상세: `spec/5-system/1-auth.md §Rationale 4.1.A`("나머지 Planned 액션의 시제도 정규화한다 … `created`/`updated`/`deleted` … 현재형 `create`·`invite` 이탈 정정")가 명시하듯, `trigger.*` 는 한때 현재형(`create`/`update`/`delete`)으로 논의되었다가 과거분사(`created`/`updated`/`deleted`)로 확정·정규화됐다. `1-auth.md §4.1` Planned 표·`conventions/audit-actions.md §3` 레지스트리·이번 impl-done 코드(`audit-action.const.ts`, `triggers.service.ts`, `triggers.service.spec.ts`)는 전부 과거분사로 일관되어 있다. 그런데 `2-trigger-list.md`(§4.1 RBAC 인접 서술)와 `15-chat-channel.md`(§5.4.1 Rationale)만 정규화 이전 현재형 표기를 그대로 들고 있다. 코드가 아직 미구현이던 impl-prep 단계에서는 "미래 계획과 다른 초안 표기" 정도였지만, 이번 impl-done 으로 `trigger.deleted`/`trigger.updated` 가 실제 DB 에 적재되는 지금은 — 누군가 이 spec 문구를 근거로 `audit_log` 를 `action = 'trigger.delete'` 로 필터링하는 쿼리·문서·QA 체크리스트를 작성하면 실제 데이터와 매칭되지 않아 **0건으로 조용히 실패**하는 실질적 결함으로 발전한다. 또한 `2-trigger-list.md:182` 는 `trigger.delete` 를 "permission" 이름으로도 지칭하는데, `spec/5-system/1-auth.md §3` RBAC 절 어디에도 `permission` 이라는 named-identifier 개념 자체가 없다(§3.2 는 role×resource 매트릭스이지 permission 문자열 카탈로그가 아님) — 즉 이 "permission" 은 스펙 내 다른 어떤 곳에서도 정의되지 않는 유령 식별자이며, audit action 표기 오류와 겹쳐 이중으로 오도한다.
  - 제안: `2-navigation/2-trigger-list.md:182,252` 와 `5-system/15-chat-channel.md:377` 의 `trigger.delete`/`trigger.update` 를 각각 `trigger.deleted`/`trigger.updated` 로 정정한다. `2-trigger-list.md:182` 의 "`trigger.delete` permission" 문구는 실재하지 않는 permission 카탈로그를 가리키므로, RBAC 근거를 인용하려면 `§3.2 리소스별 권한 매트릭스`(Trigger 행 CRUD)로 바꾸거나 표현을 "역할 기반 접근 제어(§3.2)로 보호되며, 삭제 시 audit log 에 `trigger.deleted` 액션으로 기록된다"로 다시 쓴다. `plan/in-progress/spec-sync-auth-gaps.md` 가 이미 이 두 라인(L182/L252)을 "planner 턴 필요" 항목으로 추적 중이므로, 이번 조치는 그 계획 항목과 같은 커밋에서 함께 처리하는 것이 재drift 를 막는다(15-chat-channel.md:377 은 plan 문서가 아직 언급하지 않은 세 번째 지점이므로 plan 목록에도 추가 권장).

- **[INFO]** `AUDIT_ACTIONS` 신규 값(`WORKFLOW_*`/`TRIGGER_*`/`SCHEDULE_*`/`MODEL_CONFIG_*`)·신규 타입 `AuditActionFor<P>` 는 코드베이스 전체에서 이름·문자열 모두 유일 — 충돌 없음
  - target 신규 식별자: `WORKFLOW_CREATED/UPDATED/DELETED`, `TRIGGER_CREATED/UPDATED/DELETED`, `SCHEDULE_CREATED/UPDATED/DELETED`, `MODEL_CONFIG_CREATE/UPDATE/DELETE/SET_DEFAULT` (모두 `audit-action.const.ts` 신규), 신규 유틸 타입 `AuditActionFor<P>`.
  - 확인: `grep -rn` 으로 백엔드 전체(`dist/` 제외)를 검색한 결과 각 상수·타입명이 정의부 1곳 + 소비부(4개 서비스: workflows/triggers/schedules/model-config)에서만 나타나며 다른 의미의 기존 식별자와 겹치지 않는다. `RERUN_WORKFLOW_DELETED`(실행 재시도 에러 코드, `executions.service.ts:352`)는 `WORKFLOW_DELETED` 문자열을 부분 포함하지만 별도 상수·별도 네임스페이스(에러 코드 vs audit action)라 실질 충돌 아님. `spec/` 전역에서도 `workflow.create/update/delete`·`schedule.create/update/delete`·`model_config.create/update/delete` 같은 오표기 잔존은 발견되지 않았다(위 trigger 사례가 유일).
  - 제안: 조치 불요(정보성 확인).

## 요약

이번 --impl-done 검토(scope=`spec/5-system`, 실질 diff 는 `codebase/backend/src/modules/audit-logs/audit-action.const.ts` + 4개 서비스의 감사 로깅 배선)에서 요구사항 ID·엔티티/타입명·API endpoint·환경변수·파일 경로 층위의 신규 식별자 충돌은 발견되지 않았다. 유일한 실질 발견은 **이벤트/메시지명(감사 액션명) 층위**로, 이번에 실체화된 `trigger.deleted`/`trigger.updated` 가 정규화되기 이전의 잔존 표기 `trigger.delete`/`trigger.update`(`2-navigation/2-trigger-list.md` L182·L252, `5-system/15-chat-channel.md` L377)와 문자열상 유사하지만 다른 값으로 spec 안에 남아 있다. `1-auth.md §Rationale 4.1.A`·`conventions/audit-actions.md §3`·실제 구현이 이미 과거분사로 정규화·일관되어 있으므로 "다른 의미로 이미 쓰이는 중"인 CRITICAL 충돌은 아니지만, 실제 DB 에 적재되는 값과 문서 표기가 달라 audit 조회·QA·향후 코드 작성 시 매칭 실패를 유발할 수 있어 WARNING 으로 등재한다. 이 두 라인 중 L182/L252 는 이미 `plan/in-progress/spec-sync-auth-gaps.md` 에 planner 턴 필요 항목으로 추적되어 있어(신규 발견 아님, 재확인), `15-chat-channel.md:377` 만 이번에 추가로 확인된 세 번째 지점이다. 신규로 도입된 `AUDIT_ACTIONS` 상수·`AuditActionFor` 타입 자체는 이름·값 모두 유일해 충돌이 없다.

## 위험도

LOW
