# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-done, diff-base `origin/main`)

## 검토 방법

- 이번 PR 의 실제 diff(9개 파일 / 425줄, `codebase/backend/src/common/utils/omit-undefined.ts` ·
  `folders/dto/responses/folder-response.dto.ts` · `folders/folders.service.ts` ·
  `triggers/triggers.service.ts` · `test/folder-crud.e2e-spec.ts` 등)는 워크트리 절대경로
  (`/Volumes/project/private/clemvion/.claude/worktrees/folders-contract-e2e`)에서 `git diff`로 직접 재확인했다.
- `spec/2-navigation` scope 델타는 0개 파일 — 이 PR 은 spec 을 바꾸지 않았다. 따라서 본 검토는 (a) 이번 diff 가
  기존 spec 이 선언한 계약을 어기지 않는지, (b) `spec/2-navigation` 기존 문서들이 `spec/conventions/**` 를
  이미 준수하고 있는지 두 축으로 진행했다.
- 프롬프트 번들에서 컨텍스트 예산으로 생략된 파일(`error-codes.md`·`swagger.md`·`secret-store.md`·
  `spec-impl-evidence.md`·`4-integration.md`·`6-config.md`·`_product-overview.md`·`_layout.md` 등 총 16개)은
  워크트리에서 **직접 Read** 해 원문으로 대조했다.

## 발견사항

이번 diff 및 재확인한 conventions 범위 안에서 **CRITICAL/WARNING 급 위반을 발견하지 못했다.** 아래는 확인
경과와 INFO 수준 관찰이다.

- **[INFO] FolderDto `parentId` 수정은 오히려 §5.4 위반을 해소하는 방향**
  - target 위치: `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.ts` (diff), 대응 spec:
    `spec/2-navigation/1-workflow-list.md §3.1 폴더 관리 API`
  - 관련 규약: `spec/5-system/2-api-convention.md §5.4`(부재 표현 — `null` vs 키 생략) · `spec/conventions/swagger.md §1-4`
  - 상세: 변경 전 `@ApiPropertyOptional({ nullable: true }) parentId?: string | null` 은 §5.4 가 명시적으로 금지하는
    조합(optional 데코레이터 + nullable + `?` 타입)이었다. 이번 diff 는 이를 "상시 존재 + null" 표준형
    (`@ApiProperty({ type: String, nullable: true }) parentId: string | null`)으로 정정했고, `swagger-dto-contract.spec.ts`
    의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에서 해당 항목을 제거했다(드리프트 감소). 요청 DTO
    (`update-folder.dto.ts`)는 반대로 tri-state 가 필요한 PATCH 부분 갱신이므로 `@ApiPropertyOptional({ nullable: true })
    parentId?: string | null` 를 그대로 유지했는데, 이는 §5.4 가 "요청 바디는 대상이 아니다" 로 명시한 예외와 정확히
    일치한다. `type: String` 을 명시적으로 붙인 것도 plugin 없는 스키마 생성이 `string | null` 유니온을 설계 타입
    `Object` 로 흘려보내는 문제(`swagger.md` §1-6 계열 관행, 응답 DTO 패스스루 예시 `type: String`)를 미리 막는
    선택으로, 규약 취지에 부합한다.
  - 제안: 없음 — 규약을 더 잘 지키는 방향의 수정이라 조치 불필요.

- **[INFO] audit action / error code 명명은 registry 와 일치**
  - target 위치: `spec/2-navigation/2-trigger-list.md §3`(`trigger.notification_secret_rotated` /
    `trigger.chat_channel_bot_token_rotated` / `trigger.interaction_token_revoked`, `trigger.updated`),
    `§2.3.1`·`§3.1`(`VALIDATION_ERROR` / `RESOURCE_CONFLICT` / `TRIGGER_ENDPOINT_PATH_CONFLICT` /
    `AUTH_CONFIG_NOT_FOUND` / `BOT_TOKEN_INVALID` / `INVALID_FIELD`), `1-workflow-list.md §Rationale 3`
    (폴더 순환을 신규 코드 대신 `VALIDATION_ERROR` 재사용)
  - 관련 규약: `spec/conventions/audit-actions.md §1~§3`, `spec/conventions/error-codes.md §1`(의미 기반
    명명)·§3(historical exception registry)
  - 상세: 위 액션 3종은 `audit-actions.md §3` 레지스트리(trigger 과거분사, 2026-08-11 구현)와 토큰까지
    정확히 일치한다. 에러 코드는 전부 `UPPER_SNAKE_CASE` + 의미 기반이며, `error-codes.md` §1 이 요구하는
    "도메인 prefix 는 권장이지 강제 아님"(`VALIDATION_ERROR`/`RESOURCE_CONFLICT` 는 시스템 전역 공용 코드)
    범주에 정확히 든다. `1-workflow-list.md`가 폴더 순환 검증에 전용 코드(`FOLDER_CYCLE` 류)를 신설하지 않고
    기존 `VALIDATION_ERROR` 를 재사용한 것도 "노드 컨테이너 `CONTAINER_CYCLE`·워크플로우 그래프
    `CYCLE_DETECTED` 와 이름·의미가 겹치는 폴더 전용 코드를 신설하지 않는다"는 설명과 함께 명시돼 있어
    `error-codes.md §1`(의미 정확성)·§2(불필요한 rename/증식 회피 정신)와 합치한다.
  - 제안: 없음.

- **[INFO] `spec/conventions/*` cross-reference 앵커 무결성 — 샘플 확인 결과 정상**
  - target 위치: `2-trigger-list.md` 의 `[secret-store §1.1](../conventions/secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다)`,
    `[Convention §2.3](../conventions/chat-channel-adapter.md#23-chatchannelconfig)`
  - 관련 규약: `spec/conventions/secret-store.md §1.1`, `spec/conventions/chat-channel-adapter.md §2.3`
  - 상세: 두 앵커 모두 실존하며, 인용된 주장(`hasBotToken: boolean` write-only 마스킹 미차용 / `uiMapping.formMode`
    ·`visualNode`·`buttonLayout` enum 값)이 원문과 정확히 일치한다.
  - 제안: 없음.

- **[INFO] frontmatter (spec-impl-evidence 규약) 표본 검사 — 위반 없음**
  - target 위치: `spec/2-navigation/*.md` 전체 (frontmatter)
  - 관련 규약: `spec/conventions/spec-impl-evidence.md §2~§3`
  - 상세: `1-workflow-list.md`(partial, pending_plans 2건 — 하나는 `plan/complete/`로 이미 이동, 규약상 허용되는
    형태), `2-trigger-list.md`(partial, pending_plan 1건 실존 확인), `3-schedule.md`(implemented, pending_plans
    없음), `9-user-profile.md`(partial, pending_plan 실존 확인), `4-integration.md`(partial, pending_plan 실존
    확인), `16-agent-memory.md`(`id: nav-agent-memory` — §2.1 이 명시한 "같은 basename 충돌 시 영역 prefix" 예외
    사례와 정확히 일치), `8-marketplace.md`(backlog, `id` 문자열이 `spec/0-overview.md` 본문에 등장) 모두
    라이프사이클 규칙을 어기지 않는다. `_product-overview.md`/`_layout.md` 는 밑줄 prefix 예외로 frontmatter
    의무 자체가 면제된다.
  - 제안: 없음.

- **[INFO] 3-섹션 문서 구조 — Overview 절 부재는 규약이 예정한 위임 패턴**
  - target 위치: `1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md` 본문 — `## Overview` 헤더가 없고 바로
    `## 1. 화면 구조`로 시작
  - 관련 규약: `CLAUDE.md`(SKILL.md 참조 위임) / `.claude/skills/project-planner/SKILL.md §Spec 문서 구조`
  - 상세: 해당 SKILL 문서는 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 로 Overview 를
    위임할 수 있다고 명시한다. `spec/2-navigation/`는 다중 파일 영역이고 실제로 `_product-overview.md` 가
    존재하며 각 문서 서두가 그 앵커(`./_product-overview.md#3x-...`)로 역참조한다 — 구조 위반이 아니라
    규약이 예정한 패턴이다. 모든 대상 문서가 `## Rationale` 로 종결하는 것도 규약과 일치한다.
  - 제안: 없음.

## 요약

이번 PR 의 코드 변경(폴더 PATCH 부분 갱신의 `omitUndefined` 헬퍼 도입, `FolderDto.parentId` 선언 정정)은
`spec/5-system/2-api-convention.md §5.4` 및 `spec/conventions/swagger.md` 가 요구하는 "null 상시 존재 vs 키
생략" 선언 규칙을 **오히려 더 엄격히 충족**시키는 방향이며, 새로 추가된 e2e/unit 테스트도 그 회귀를 잡도록
설계돼 있다. `spec/2-navigation` 자체는 이번 PR 에서 델타가 0 인데, 표본 대조(감사 액션 명명·에러 코드
명명·`spec/conventions/` 상호 참조 앵커·frontmatter 라이프사이클·문서 3섹션 구조)에서 `spec/conventions/**`
위반을 찾지 못했다. 다만 컨텍스트 예산으로 생략됐던 `4-integration.md`·`6-config.md` 등 대용량 파일은 이번
diff 와 무관한 영역이라 표본 수준으로만 확인했고, 전수 정밀 검토는 아니다.

## 위험도

NONE
