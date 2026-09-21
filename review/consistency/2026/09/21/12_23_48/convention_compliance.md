# 정식 규약 준수 검토 — `spec/2-navigation` (--impl-prep)

## 검토 범위와 방법

target 은 `spec/2-navigation` 번들(전문 확보: `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`, 예산 절단으로 프롬프트에는 없었으나 관련성이 있어 디스크에서 직접 열어 확인: `9-user-profile.md`)이다. 대조한 정식 규약은 `spec/conventions/error-codes.md`·`swagger.md`·`audit-actions.md`·`secret-store.md`·`chat-channel-adapter.md`·`spec-impl-evidence.md`·`review-citations.md` (전문을 디스크에서 직접 읽음 — 프롬프트 번들에는 대부분 예산 절단으로 없었다).

이 문서 세트는 이번 turn(`머지했어`)이 트리거한 실제 작업 대상인 `plan/in-progress/member-dup-remove.md` (`WorkspacesService.removeMember()` 동시 DELETE 감사 중복 수정, `spec_impact: none`)와 직접 관련된 문서다. 완료된 형제 plan 4건(`plan/complete/{dup-delete-audit,trigger-dup-delete,schedule-dup-delete,integration-dup-delete}.md`)도 모두 `spec_impact: none`으로 동일 계열의 순수 백엔드 동시성 수정을 처리했다 — 이번 작업의 `spec_impact: none` 선언은 이 선례와 일치하며 `spec-impl-evidence.md` Gate C 관점에서 이상 없다.

## 발견사항

- **[INFO]** 리뷰 인용 규약(§2 bare 시각 금지) 위반 1건 — 단, grandfather 대상이라 이번 작업 범위 밖
  - target 위치: `spec/2-navigation/14-execution-history.md:479` — `` (`10_53_52` security/architecture W2·W3) ``
  - 위반 규약: `spec/conventions/review-citations.md` §2 (bare `hh_mm_ss` 는 금지, 날짜 포함 형태만 허용) — 같은 문서 `4-integration.md:1197`은 `review/consistency/2026/09/10/10_47_01` 처럼 올바른 전체 경로 형태를 쓰고 있어 대조된다.
  - 상세: 날짜 없는 `hh_mm_ss` 인용은 §1 근거상 git 이력으로도 해소 불가능하다. 다만 `review-citations.md` §4 "기존 인용은 소급 정리 대상이 아니다"에 따라 즉시 수정 의무는 없다.
  - 제안: `member-dup-remove` 작업은 `spec_impact: none`이라 이 파일을 건드리지 않는다 — 지금 고칠 필요는 없고, 다음에 `14-execution-history.md`의 그 절을 건드릴 기회가 있으면 날짜를 특정해 `review/consistency/<YYYY>/<MM>/<DD>/hh_mm_ss` 전체 경로로 교체 권장.

- **[INFO]** `member.removed`/`member.invited`/`member.role_changed` 감사 액션이 UI 문서에 인용되지 않음 (규약 위반은 아님, 참고용)
  - target 위치: `spec/2-navigation/9-user-profile.md` §4.1 "멤버 관리" 표 · §6.1 API 표 (`DELETE /api/workspaces/:id/members/:memberId`)
  - 위반 규약: 해당 없음 — `spec/conventions/audit-actions.md`는 액션 命名 규율만 다루고 각 도메인 spec 문서에 액션명을 반드시 인용하라고 요구하지 않는다.
  - 상세: `2-trigger-list.md`는 `trigger.deleted`·`trigger.chat_channel_bot_token_rotated` 등을 명시적으로 인용하는 반면, `9-user-profile.md`·`1-workflow-list.md`는 대응 CRUD 액션(`workflow.deleted` 등)을 전혀 인용하지 않는다 — 이는 이미 문서 간에 존재하던 비일관적 상세도이지 이번 변경이 만든 문제가 아니다(코드 확인: `audit-action.const.ts`에 `MEMBER_REMOVED: 'member.removed'`가 규약대로 이미 구현돼 있다).
  - 제안: 규약 위반이 아니므로 조치 불요. `spec_impact: none` 선언과도 정합적이다(감사 액션명·와이어 계약 자체는 바뀌지 않고 동시성 판정만 바뀐다).

## 검증 완료(위반 없음) — 참고용

- 에러 코드: `VALIDATION_ERROR`·`RESOURCE_CONFLICT`·`TRIGGER_ENDPOINT_PATH_CONFLICT`·`DUPLICATE_NODE_LABEL`·`RESOURCE_NOT_FOUND`·`AUTH_CONFIG_NOT_FOUND` 등 target 이 쓰는 모든 코드가 `error-codes.md` §1(의미 기반 명명·도메인 prefix)·`3-error-handling.md` 카탈로그와 일치.
- 감사 액션: `trigger.deleted`·`trigger.updated`·`trigger.chat_channel_bot_token_rotated`·`trigger.notification_secret_rotated`·`trigger.interaction_token_revoked`·`user.email_changed` 모두 `audit-actions.md` §3 레지스트리와 정확히 일치(과거분사/도메인 접두 규칙 포함).
- DTO 명명: `UpdateWorkflowDto`·`WorkflowSettingsDto`·`ExportWorkflowDto`·`TriggerDto`·`ScheduleDto`·`PaginationQueryDto` 등 top-level 요청 바디는 `Update` 접두, `Patch` 접두 없음 — `swagger.md` §1-7 준수.
- secret 노출 정책: `botToken`/`inboundSigningPlaintext` write-only, `botTokenRef` 등 ref 비노출 서술이 `secret-store.md` §1.1과 정확히 부합(인용 anchor 도 일치).
- chat-channel enum: `formMode`(multi_step/native_modal/auto)·`visualNode`(text/photo/auto)·`buttonLayout`(auto/vertical/horizontal) 값·기본값이 `chat-channel-adapter.md`와 정확히 일치.
- 문서 구조: `spec/2-navigation/*.md` 전체가 "관련 문서 링크 → 번호 섹션 → Rationale" 패턴으로 통일돼 있고 명시적 `## Overview` 헤딩은 conventions 문서 계열(`error-codes.md` 등)에만 쓰인다 — 이는 리포지토리 전역에 걸친 기존 이분 패턴이며 이번 target 문서군만의 이탈이 아니다.
- frontmatter: `1-workflow-list.md`(status: partial, pending_plans 2건 중 1건 in-progress)·`2-trigger-list.md`(status: partial)·`3-schedule.md`(status: implemented, pending_plans 없음) 모두 `spec-impl-evidence.md` §2·§3 스키마·라이프사이클 규칙에 부합.

## 요약

`spec/2-navigation` 번들(workflow-list·trigger-list·schedule·user-profile)은 에러 코드 명명, 감사 액션 명명, Swagger DTO 명명, secret 노출 정책, chat-channel enum 등 확인 가능한 모든 정식 규약 축에서 위반이 발견되지 않았다. 유일한 실제 규약 위반(리뷰 인용 bare 시각, `review-citations.md` §2)은 이번 작업 범위 밖 파일(`14-execution-history.md`)에 있고 grandfather 조항으로 즉시 조치 의무가 없다. `member-dup-remove` 작업 자체의 `spec_impact: none` 선언은 완료된 형제 plan 4건과 일치하는 선례를 따른다.

## 위험도

NONE
