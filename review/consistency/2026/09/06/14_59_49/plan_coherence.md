# Plan 정합성 검토 — spec/2-navigation/ (impl-done)

## 조사 방법

- target scope(`spec/2-navigation/`) 델타 실측: **0 파일** — 이 브랜치(`user-entity-column-defense`)는 spec/2-navigation 을 변경하지 않았다.
- 구현 diff 실측(`git diff origin/main...HEAD -- codebase/`): 17 파일, `triggers.service.ts`/`triggers.service.spec.ts`, `workflow-versions.service.ts`/`.spec.ts`, `workspace-response.dto.ts`, 신규 가드 3종(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`, `dto-jsdoc-citation-guard.ts`) + 관련 스펙/픽스처, e2e 3종.
- `spec/2-navigation/` 아래 `creator|WorkflowVersion|joinedAt|WorkspaceMember|endpoint_path|TRIGGER_ENDPOINT_PATH_CONFLICT` 전수 grep으로 diff 대상 식별자가 target 문서에 등장하는 자리를 확인.
- `plan/in-progress/**` 전수(파일명) 스캔 + `endpoint_path`/`creator`/`joinedAt` grep으로 diff와 교차하는 plan 항목 식별, 해당 plan 원문(`spec-draft-nullable-notation-followups.md`, `spec-draft-review-citations-enforcement.md`, `spec-sync-auth-gaps.md`) 확인.

## 발견사항

없음.

- **target(spec/2-navigation) 델타 0은 이 리뷰의 결함이 아니다.** 이 브랜치는 `User` 엔티티 컬럼 노출 방어(가드 3종 신설)와 부수적인 `workspace_member.joinedAt` §5.4 표기 정정이 주제이고, spec/2-navigation 영역 자체를 대상으로 하지 않는다.
- diff 중 spec/2-navigation 이 참조 가능한 유일한 접점은 `triggers.service.ts` 의 `rethrowEndpointPathConflict`/`isEndpointPathUniqueViolation` 추가다. 이는 **새 결정이 아니라 기존 결정의 뒤늦은 구현**이다 — `spec/2-navigation/2-trigger-list.md §3`(및 §2.3.1 endpointPath 행)이 이미 "`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT`(세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)" 를 계약으로 명시해 두고 있었고, diff 커밋 코멘트 자체가 "문서한 보장이 구현보다 넓었다"는 code review Critical(`review/consistency/2026/09/06/14_26_32`)을 근거로 인용한다. target 이 plan 에서 "결정 필요"로 남긴 항목을 우회하거나 새 결정을 내리는 형태가 아니다.
- 이 diff와 정확히 교차하는 plan은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 하나이며(`User` 컬럼 방어 결정 항목, `workflow-versions.service.ts#findOne` eager-load 유출 수정, `WorkspaceMemberDto.joinedAt` §5.4 표기), 그 plan 은 이미 diff와 **동일한 내용을 완료(`[x]`) 서술로 반영**해 두었다 — plan과 구현이 서로 어긋나 있지 않다. 다만 그 plan에는 아직 열려 있는 후속 항목(신규 검출 3축의 `code:` 등재, `WorkflowVersion*Dto.creator` §5.4 금지 조합 상환, `User` 노출 금지 규약 문장화 등)이 다수 있으나, 전부 `spec/5-system/*` · `spec/conventions/*` 대상이고 `spec/2-navigation/` 을 겨냥하지 않는다 — 이번 target 범위 밖.
- `spec-sync-auth-gaps.md` 가 과거 `2-navigation/2-trigger-list.md` 의 audit action 오기(`trigger.delete`→`trigger.deleted` 등)를 추적하던 항목은 이미 `[x]` 완료 처리돼 있고, 이번 diff와는 무관하다(재충돌 없음).
- `2-trigger-list.md` 의 Rationale R-2(`TBD`: v1.1 hmacSecret rotate 응답 shape 미결정, `POST /api/triggers/:id/auth/rotate-secret` 언급)와 §3의 "그 v1.1 예약 행은 신설되지 않은 채 폐기됐다(R-14)" 서술 사이에 문서 내부 긴장이 남아 있으나, 이는 이번 diff 이전부터 존재하던 target 문서 **내부** 서술이고 이번 브랜치가 만들거나 건드린 것이 아니며 대응하는 `plan/in-progress` 항목도 없다 — plan-target 정합성(본 체크리스트 범위) 밖이라 판정에서 제외한다.

## 요약

이번 브랜치는 spec/2-navigation 영역 자체를 변경하지 않았고(델타 0), 구현 diff 17개 파일도 `User` 엔티티 컬럼 노출 방어라는 별개 주제를 다룬다. diff가 spec/2-navigation과 접하는 유일한 지점(`triggers.service.ts` 의 endpoint_path UNIQUE 충돌 처리)은 `2-trigger-list.md §3`이 이미 문서화해 둔 계약을 뒤늦게 구현한 것으로, plan이 "결정 필요"로 남긴 항목을 우회하거나 새 결정을 내리는 사례가 아니다. diff와 실제로 교차하는 유일한 plan(`spec-draft-nullable-notation-followups.md`)은 이미 diff 내용을 완료 서술로 반영해 두었고, 그 plan에 남은 후속 항목들은 모두 `spec/5-system/`·`spec/conventions/` 대상이라 이번 target(`spec/2-navigation/`) 범위 밖이다. Plan 정합성 관점에서 이번 target에 대한 CRITICAL/WARNING 소견은 없다.

## 위험도
NONE
