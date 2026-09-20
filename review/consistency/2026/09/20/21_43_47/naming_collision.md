# 신규 식별자 충돌 검토 — `spec/2-navigation` (impl-prep)

## 전제 확인

- `git diff origin/main -- spec/2-navigation` = **빈 diff**. 이번 PR(`plan/in-progress/trigger-dup-delete.md`)의
  `spec_impact: none` 과 일치한다 — target 문서는 이번 작업이 새로 쓰는 것이 아니라 기존에 이미 merge 되어
  있는 스펙을 impl-prep 번들로 그대로 재제시한 것이다.
- 계획 자체도 "동시 DELETE 두 번째 요청을 spec §4.4 대로 404 로 만든다" 는 **기존 spec 서술을 코드로
  사실화**하는 작업이며, 새 요구사항 ID·엔티티·endpoint·이벤트명·ENV·config key·파일 경로를 어느 것도
  신설하지 않는다. 따라서 "신규 식별자" 관점에서 검토할 표면 자체가 사실상 없다.
- 계획이 재사용을 명시한 상수 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는 이미
  `codebase/backend/src/modules/triggers/trigger-config-lock.ts:128` 에 정의돼 있고
  `trigger-resource-releaser.service.ts`·`schedules.service.ts` 가 이미 소비 중이다 — 신규 식별자가 아니라
  기존 상수를 네 번째 삭제 경로(`TriggersService.remove()`)에 그대로 재사용하는 것.

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 번들에 등장하는 요구사항/Rationale ID(`R-1`~`R-17`, `R-CC-10`/`R-CC-11`/`R-CC-21`,
   `WH-EP-02`/`WH-MG-09`/`WH-SC-01`, `CCH-SE-01`/`CCH-SE-03`/`CCH-NF-03`, `NAV-WF-07`)는 전수
   grep 결과 모두 정의처(SoT, 주로 `5-system/12-webhook.md`·`5-system/15-chat-channel.md`·해당
   `_product-overview.md`)와 참조처(`2-navigation/2-trigger-list.md`, `1-workflow-list.md`)가 **같은 의미로만**
   쓰인다. `R-1`~`R-17` 은 각 spec 문서 로컬 스코프의 Rationale 번호(문서마다 독립 카운터)라 다른 문서의
   `R-14` 등과 겹쳐도 이 프로젝트의 기존 컨벤션(문서 앵커 스코프)과 일치한다 — 신규도 아니고 충돌도 아니다.
2. **엔티티/타입명 충돌** — `TriggerDto`, `WorkflowSettingsDto`, `ExportWorkflowDto` 등 언급된 타입은 모두
   기존 문서에 이미 정의된 것이며 이번 target 번들이 새로 도입하는 타입은 없다.
3. **API endpoint 충돌** — §3 표의 모든 endpoint(`POST/GET/PATCH/DELETE /api/triggers*`,
   `/chat-channel/rotate-bot-token`, `/notification/rotate-secret`, `/interaction/revoke-token`,
   `/api/workflows*`, `/api/folders*`)는 기존 merge 상태 그대로다. 신규 endpoint 신설 없음.
4. **이벤트/메시지명 충돌** — `trigger.deleted` / `trigger.updated` / `trigger.chat_channel_bot_token_rotated` /
   `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` 등 audit 이벤트명은
   `5-system/1-auth.md §4.1` 과 이미 일치하며 새로 도입되는 이벤트가 없다.
5. **환경변수·설정키 충돌** — `NEXT_PUBLIC_WEBHOOK_BASE_URL` / `NEXT_PUBLIC_API_URL` 등은 기존 값. 신규
   ENV/설정 키 없음. `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는 위에서 확인했듯 기존 상수 재사용.
6. **파일 경로 충돌** — target 번들에 새 spec 파일 경로 신설이 없다 (번들 3개 파일 모두 기존 경로). 계획이
   추가할 것으로 예상되는 e2e 테스트도 기존 명명 컨벤션(`*.e2e-spec.ts`, 이미 frontmatter `code:` 에 등재된
   `trigger-deletion-releases-resources.e2e-spec.ts` 계열)을 따를 뿐 새 경로 컨벤션을 도입하지 않는다.

## 발견사항

없음 — target 문서가 이번 작업에서 새로 도입하는 식별자가 존재하지 않는다(diff 0, `spec_impact: none`).
따라서 CRITICAL/WARNING/INFO 어느 항목도 성립하지 않는다.

## 요약

이번 impl-prep 대상은 `spec/2-navigation` 을 **변경 없이** 컨텍스트로 재제시한 것이며, 실제 작업은
`TriggersService.remove()` 내부 로직을 기존에 이미 문서화된 §4.4 동작(두 번째 동시 삭제 요청은 404)과
일치시키는 순수 코드 수정이다. 새 요구사항 ID·엔티티·DTO·API endpoint·이벤트명·환경변수·설정키·파일
경로 어느 것도 신설되지 않으며, 재사용되는 유일한 식별자(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)도 기존
정의를 그대로 가져다 쓰는 것으로 확인됐다. 신규 식별자 충돌 관점에서 이 target 은 안전하다.

## 위험도

NONE
