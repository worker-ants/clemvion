# 정식 규약 준수 검토 — `spec/2-navigation` (impl-done, scope=spec/2-navigation)

## 검토 방법 메모

- 이 세션의 `_prompts/convention_compliance.md` 는 컨텍스트 예산 초과로 `spec/conventions/**` 전 파일과
  `spec/2-navigation/6-config.md`·`4-integration.md`·`_product-overview.md` 등 다수 파일, 그리고
  `## 구현 변경 사항` diff 본문 자체가 절단되어 있었다 (해당 자리마다 "본문 생략됨" 마커 확인).
  절단 = 부재의 증거가 아니므로, 판정에 필요한 자료는 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/authconfig-dup-delete-7e3a1c`)에서 절대경로로
  직접 `Read`/`git diff` 하여 확인했다 — `spec/conventions/error-codes.md`, `audit-actions.md`,
  `swagger.md`, `secret-store.md`, `spec-impl-evidence.md`, `review-citations.md`,
  `spec/2-navigation/6-config.md` 전문, 그리고 `git diff origin/main` 의 실제 코드 diff(3파일/308줄:
  `auth-configs.service.ts`, `auth-configs.service.spec.ts`,
  `test/auth-config-delete-concurrency.e2e-spec.ts`).
- scope(`spec/2-navigation`) 델타는 실측 0개 파일이 맞다 — 이 PR 은 `spec/2-navigation` 을 건드리지
  않았고, 코드 전용 PR(`auth-configs.service.ts` 의 동시 삭제 감사 중복 수정)이다. 델타 0 자체를
  CRITICAL 근거로 쓰지 않았다.

## 발견사항

없음 — CRITICAL·WARNING 대상 위반을 찾지 못했다.

검토한 항목과 결과:

- **에러 코드 명명** (`error-codes.md` §1): 이번 diff 및 `spec/2-navigation` 본문에 등장하는 코드
  (`RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `AUTH_CONFIG_NOT_FOUND`,
  `TRIGGER_ENDPOINT_PATH_CONFLICT`, `INVALID_FIELD`, `BOT_TOKEN_INVALID` 등)는 모두
  `UPPER_SNAKE_CASE` 이며 신규 코드 신설 없이 기존 `RESOURCE_NOT_FOUND` 를 재사용했다 — §2 "이름
  정확성 향상만을 위한 rename 은 하지 않는다" 와도 부딪히지 않는다(코드 자체를 바꾸지 않고 발행
  경로만 원자화했다).
- **`AUTH_CONFIG_NOT_FOUND` vs `RESOURCE_NOT_FOUND` 구분 근거** — `auth-configs.service.ts` 새 JSDoc 이
  인용하는 `spec/5-system/3-error-handling.md §1.11`("이 저장소의 유일한 `_NOT_FOUND`≠404 예외")을
  직접 대조 확인 — 실제로 그 절이 `AUTH_CONFIG_NOT_FOUND` 를 400 으로 문서화하고 있어 인용이
  정확하다.
- **감사 액션 명명** (`audit-actions.md` §1–§3): `AUDIT_ACTIONS.AUTH_CONFIG_DELETE` →
  `'auth_config.delete'` (`audit-action.const.ts:69`) — resource `auth_config` 는 레지스트리(§3)에
  이미 현재형(§2.2) 패턴으로 등재돼 있고 이번 변경은 그 값을 그대로 재사용했다 (신규 액션 신설
  없음). dot-prefix·언더스코어 토큰 구분자 규칙 위반 없음.
- **Swagger/DTO 명명** (`swagger.md` §1-7, §5-1): 이번 diff 는 신규 DTO/엔드포인트를 추가하지 않았다
  (`remove()` 내부 구현만 변경). `spec/2-navigation` 본문에 등장하는 DTO 명명
  (`UpdateTriggerDto`/`UpdateWorkflowDto` 류의 `Update` 접두 vs `WorkflowSettingsDto`·
  `ChatChannelConfigDto` 류의 nested `<Domain><Role>Dto`, 그리고 `ExportWorkflowDto` 등 응답 DTO)은
  §1-7·§5-1 규칙과 어긋나지 않는다.
- **Secret 노출 정책** (`secret-store.md` §1.1): `2-trigger-list.md` 의 `botTokenRef`/`inboundSigningRef`
  응답 미노출 서술이 인용하는 `secret-store.md#11-비대상-필드도-응답-바디에는-나가지-않는다` 절을
  직접 대조 — 서술이 정확히 그 절의 요구(ref 도 응답 바디에 실리면 안 됨)를 반영한다.
- **문서 구조 3섹션** (CLAUDE.md `spec` 컨벤션): `1-workflow-list.md`/`2-trigger-list.md`/
  `3-schedule.md`/`6-config.md` 모두 Overview(또는 도입부) → 본문(§1~§N) → `## Rationale` 순서를
  유지한다. `6-config.md` 는 `## Overview (제품 정의)` 섹션을 명시적으로 갖춰 CLAUDE.md 권장 포맷을
  가장 명확히 따른다.
- **테스트 파일 명명**: 신규 `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` 는
  기존 형제 파일 7종(`workflow-`/`workspace-`/`trigger-`/`schedule-`/`integration-delete-concurrency`,
  `member-remove-concurrency`)과 동일한 `<단수-리소스>-delete-concurrency.e2e-spec.ts` 패턴을 따른다
  — `auth-configs`(복수)가 아니라 `auth-config`(단수)를 쓴 것도 다른 형제들과 일치.
- **`spec-impl-evidence.md` `code:` frontmatter 갱신 여부**: `6-config.md` 의 `code:` 글롭에는 이번
  신규 e2e 파일이 등재되지 않았다. 다만 이는 편차가 아니다 — 동일 결함 클래스의 선행 형제 PR들이
  건드린 스펙 문서(`1-workflow-list.md` 등)도 각자의 `workflow-delete-concurrency.e2e-spec.ts` 류를
  `code:` 에 등재하지 않는 것이 이 저장소의 기존 관행이다(`spec/` 전수 grep 결과 이런 concurrency
  e2e 파일을 인용하는 spec 문서 0건). 새 파일이 그 관행을 깬 것이 아니라 따른 것이므로 WARNING 으로
  올리지 않는다.

## 요약

이번 diff 는 `spec/2-navigation` 문서 자체를 변경하지 않는 코드 전용 변경(AuthConfig 동시 삭제
감사 중복 수정)이며, 관련 정식 규약(`error-codes.md`·`audit-actions.md`·`swagger.md`·
`secret-store.md`·`spec-impl-evidence.md`)과 `spec/2-navigation` 본문의 교차 인용을 모두 실측
대조한 결과 위반을 발견하지 못했다. 에러 코드·감사 액션 이름은 기존 카탈로그 값을 신설 없이
재사용했고, 새 e2e 테스트 파일명은 형제 6종과 동일 패턴을 따르며, 코드 주석이 인용하는
spec 절(§1.11 등)도 실제 문서와 일치한다. 이 검토 자체의 유일한 특이사항은 orchestrator 가
조립한 `_prompts` 번들이 예산 초과로 `spec/conventions/**` 전체와 `6-config.md` 등 다수 target
파일을 절단했다는 점인데, 절단된 부분은 워킹트리에서 직접 읽어 보완했다.

## 위험도

NONE
