# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-done, `patch-null-validation`)

## 검토 방법

`spec/2-navigation/` 델타는 0 파일(이 PR 은 그 spec 영역을 수정하지 않았다). 실제 변경은
`codebase/backend` 의 PATCH 요청 DTO 43개 필드에서 `@IsOptional()` → `@IsOptionalNonNull()`
전환(신설 데코레이터 `common/utils/optional-non-null.ts`)이다 — `null` 을 받으면 이제 400
`VALIDATION_ERROR`, 키 생략은 종전대로 값 불변. 대상은 폴더·워크플로·노드·인증 설정·트리거·알림
규칙·테스트 데이터셋·워크스페이스 설정·내 프로필·스케줄·모델 설정·어시스턴트 세션·통합·지식
베이스 PATCH.

`spec/2-navigation/` 이 이 변경 영역 다수의 API 계약 SoT 이므로(`1-workflow-list.md`
`2-trigger-list.md` `3-schedule.md` `9-user-profile.md`(알림 규칙·워크스페이스 설정 PATCH 포함)
`6-config.md`(인증 설정) `4-integration.md`), 실제 워킹트리(HEAD)의 DTO 파일을 직접 열어
필드별 null 처리와 해당 spec 문서의 서술을 대조했다. 두 건은 **실측으로 검증됐으나, 이미 이
PR 자신의 plan(`plan/in-progress/patch-null-validation.md`)과 선행 `--impl-prep` 리뷰
(`review/consistency/2026/09/27/17_14_44`)가 발견해 트래커에 등재·디스포지션까지 마친 항목**이라
재확인만 하고 신규 발견으로 취급하지 않는다.

## 발견사항

- **[WARNING] §5.4 PATCH tri-state 블록쿼트가 이번 43필드 null-거부와 문언상 어긋난다 (이미 트래커 등재 — 신규 아님)**
  - target 위치: `spec/2-navigation/` 전역의 PATCH 절 다수 — `2-trigger-list.md` §3(`name`/`isActive`/`endpointPath`),
    `1-workflow-list.md` §3(`name`/`isActive`/`tags`), `9-user-profile.md` §371(워크스페이스 설정
    `timezone`/`interactionAllowedOrigins`) §407(알림 규칙 `threshold`/`window`/`channel`/`enabled`) 등 —
    모두 이 PR 이 null 을 거부하도록 바꾼 필드를 문서화한 절.
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4 "부재 표현 — null vs 키 생략" 블록쿼트.
    실측(현재 워킹트리 본문): *"요청 바디는 대상이 아니다 — 특히 PATCH 부분 업데이트는 키 생략(=값
    불변)·`null`(=초기화)·값(=설정)의 tri-state 가 각각 의미를 갖는 별개 계약"* — 예외 조건 없이
    PATCH 의 `null` 을 일반적으로 "초기화" 로 서술한다.
  - 상세: 글자 그대로 읽으면 이 43필드(`null` → 400 거부)는 §5.4 블록쿼트가 선언하는 "PATCH의
    null=초기화" 규칙과 정면으로 어긋난다. **단 이는 새 발견이 아니다** — 이 PR 자신의
    `--impl-prep`(`review/consistency/2026/09/27/17_14_44` W2)이 동일 지점을 이미 짚었고
    BLOCK:NO 로 승인된 뒤 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목
    (10)에 "§5.4 블록쿼트에 '미선언(non-nullable) 필드의 null 은 400' 한 문장 추가"로 등재됐다
    (`plan/in-progress/patch-null-validation.md` §`--impl-prep` 처분 절이 동일 사실을 재확인).
    실측 결과 그 등재는 여전히 정확하고 미해결이다.
  - 제안: 이번 PR 범위에서 조치 불요. planner 턴에서 트래커 (10)을 §5.4 블록쿼트 갱신으로 닫으면
    해소된다. (기존 SPEC-DRIFT 재확인 — 새 후속 항목을 만들 필요 없음.)

- **[WARNING] `settings.maxConcurrentExecutions`(워크플로·워크스페이스)는 이번 null-거부 스윕에서 제외돼, 같은 spec 문서의 "hard-fail" 서술과 실측이 어긋난다 (이미 트래커 등재 — 신규 아님)**
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 import 검증 순서 6번("미지 키·비양수·
    비정수는 400 `VALIDATION_ERROR`") 및 `## Rationale` §2("워크플로 `settings`(admission-gate
    파라미터)는... write 경계에서 strict nested DTO(`WorkflowSettingsDto`)로 hard-fail 한다").
  - 충돌 대상: 실제 구현 —
    `codebase/backend/src/modules/workflows/dto/workflow-settings.dto.ts`(`maxConcurrentExecutions`,
    `@IsOptional() @IsInt() @Min(1)`, 이번 PR 미변경) 및
    `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` 의 동명 필드
    (같은 파일의 `interactionAllowedOrigins`/`timezone` 은 이번에 `IsOptionalNonNull` 로 바뀌었지만
    `maxConcurrentExecutions` 는 그대로 `@IsOptional()`).
  - 상세: **실측**(HEAD 워킹트리에서 `class-validator`/`class-transformer` 직접 호출) —
    `plainToInstance(UpdateWorkflowDto, { settings: { maxConcurrentExecutions: null } })` 를
    `validate(..., { whitelist: true, forbidNonWhitelisted: true })` 에 넣으면 에러 0건,
    `dto.settings` 는 `{"maxConcurrentExecutions":null}` 로 파싱된다. `UpdateWorkspaceSettingsDto`
    도 `{ maxConcurrentExecutions: null }` 에 대해 에러 0건이다. `common/utils/omit-undefined.ts`
    는 `null` 을 명시적으로 보존하도록 설계돼 있어("`null` 은 남긴다 — «값을 지운다» 는 명시적
    요청이다") 이 값은 그대로 `Workflow.settings`/`Workspace.settings` 에 병합·저장된다. 즉 spec
    이 명시한 "미지 키·비양수·비정수는 400" 규칙에서 `null` 만 예외적으로 빠져나가 hard-fail
    되지 않는다(런타임 `resolveConcurrencyCap` 류 backstop 이 부적합 값을 기본값으로 무시해 즉각적
    장애는 없다는 완충은 있음).
    **이 역시 새 발견이 아니다** — `plan/in-progress/patch-null-validation.md` §범위가 이 두 필드를
    "넘긴다(트래커)" 로 명시적으로 이번 PR 스코프 밖에 뒀고,
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "PATCH null 후속" 항목
    (미해결 체크박스, 2026-09-27 등재)이 정확히 "워크플로·워크스페이스 `settings.maxConcurrentExecutions`
    (기본값으로 복귀)... 그 의미를 계약할지(nullable 선언) 거부할지(`IsOptionalNonNull`) 정한다"
    로 이 갭을 이미 등재하고 있다.
  - 제안: 이번 PR 범위에서 조치 불요(의도적 제외, 후속 트래커에 열려 있음). 후속 PR 에서 두 필드
    모두 `@IsOptionalNonNull()` 로 전환하거나(hard-fail 서술을 실제로 만족시키는 방향), 또는
    spec 의 "hard-fail" 서술을 "`null` 은 nullable 로 선언해 backstop 기본값을 쓴다" 로 완화하는
    명시적 결정이 필요 — 트래커 항목이 이미 그 갈림을 정확히 프레이밍하고 있다.

## 확인했으나 충돌 없음 (신규 조사 — 특기)

- `UpdateFolderDto.parentId`(루트 이동 시 null 허용), `UpdateWorkflowDto.description`/`folderId`,
  `UpdateTriggerDto.authConfigId`/`config`/`notification`/`interaction`/`chatChannel`,
  `UpdateAuthConfigDto.ipWhitelist`(null·빈 배열 = 전체 삭제) — 모두 이번 PR 에서
  `@IsOptional()` 그대로 **의도적으로 미변경**을 HEAD 워킹트리에서 직접 확인. 각각의 spec
  서술("null 이면 루트로 이동", "null 이면 설명을 지운다", "`null` = 인증 없음",
  "null·빈 배열이면 전체 삭제")과 정확히 부합한다 — nullable-clearing 필드와
  NOT-NULL/hard-fail 필드를 구분한 이번 PR 의 설계 원칙(`optional-non-null.ts` 주석)이 실제로
  지켜졌다.
- `spec/2-navigation/9-user-profile.md` §407(`PATCH /api/alerts/:id` — `threshold`/`window`/
  `channel`/`enabled`)이 이번에 `IsOptionalNonNull` 로 바뀐 네 필드와 정확히 일치하며, null-클리어
  의미를 문서 어디에도 약속하지 않는다 — 충돌 없음.
- `spec/2-navigation/4-integration.md`(별칭 `name` PATCH), `spec/2-navigation/6-config.md`
  (인증 설정 `name`/`isActive` PATCH), `spec/2-navigation/3-schedule.md`(`isActive`/
  `parameterValues` PATCH) — 모두 null-클리어 의미를 선언하지 않아 이번 변경과 충돌 없음.

## 요약

이 PR 의 코드 변경(43필드 null-거부 스윕)은 `spec/2-navigation/` 이 명시하는 nullable-clearing
필드(폴더 `parentId`, 워크플로 `description`/`folderId`, 트리거 `authConfigId`, 인증 설정
`ipWhitelist` 등)를 정확히 비껴가고, hard-fail 대상 필드(트리거 `endpointPath`/`name`/`isActive`,
워크플로 `name`/`isActive`/`tags`, 알림 규칙 4필드, 워크스페이스 설정 `timezone`/
`interactionAllowedOrigins`, 폴더 `name`/`sortOrder` 등)에 대해서는 `spec/2-navigation/` 의 각
API 절 서술과 새 CRITICAL/WARNING 급 모순을 만들지 않는다. 다만 두 개의 실측 확인된 spec-drift —
(1) `spec/5-system/2-api-convention.md` §5.4 블록쿼트의 "PATCH null=초기화" 일반 서술과의 문언
불일치, (2) `WorkflowSettingsDto`/`UpdateWorkspaceSettingsDto` 의 `maxConcurrentExecutions` 가
spec 의 "hard-fail" 약속에도 불구하고 `null` 을 여전히 조용히 통과시키는 것 — 은 둘 다 이 PR 자신의
plan 과 선행 `--impl-prep` 리뷰가 이미 발견·등재·디스포지션(BLOCK:NO, planner 트래커 이관)까지
마친 기존 항목이며, 이번 재확인으로 그 등재가 정확함을 확인했을 뿐 새로 막을 사유는 아니다.

## 위험도

LOW
