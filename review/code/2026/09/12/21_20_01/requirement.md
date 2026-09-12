# 요구사항(Requirement) 리뷰 — trigger-uuid-and-guide-codes

## 검증 방법

프롬프트에 실린 unified diff/전체 컨텍스트 외에, 잘린 파일들은 `Read`/`Grep`으로 원본을 직접
열어 대조했고, 다음을 저장소에서 직접 실행해 핵심 주장들을 재현·검증했다 (저장소 트리 변경 없음,
`git status --short` 로 확인):

- `codebase/backend`: `npx jest src/repo-guards/__tests__/param-uuid-pipe.spec.ts
  src/modules/triggers/triggers.controller.spec.ts` → 2 suites / 20 tests 전부 PASS.
- `codebase/frontend`: `npx vitest run src/lib/i18n/__tests__/backend-labels.test.ts` → 1 file /
  20 tests 전부 PASS.
- `GlobalExceptionFilter` (`codebase/backend/src/common/filters/http-exception.filter.ts`) 전문을
  읽어 "500 마스킹" 사슬(HttpException / unique-violation(23505) / http-error-like 세 갈래만
  분기, 나머지는 `Error` → 500 `INTERNAL_ERROR`)이 실제 소스와 일치함을 확인.
- `triggers.service.ts:342-349` (`findById` → `RESOURCE_NOT_FOUND`), `hooks/hooks.service.ts:120`
  (`TRIGGER_NOT_FOUND` 유일 발신처)를 grep 하여 CHANGELOG·MDX·`backend-labels.ts` 주석의 귀속
  정정이 사실과 일치함을 확인.
- `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표, `spec/conventions/swagger.md` §5-4 체크리스트,
  `spec/data-flow/10-triggers.md` 를 직접 열어 spec fidelity 를 대조.
- `.env.example:331` / `mcp.config.ts` / `production-guards.ts` 등에서 실재 환경변수명이
  `MCP_ALLOW_INSECURE_URL` 임을 확인 (MDX 수정과 일치).

## 발견사항

- **[WARNING] `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표에 신규 `400
  VALIDATION_ERROR` (`:id` 가 UUID 형식이 아님) 행이 없다.**
  - 위치: `spec/5-system/15-chat-channel.md:367-379` (표 본문). 코드 쪽 대응은
    `codebase/backend/src/modules/triggers/triggers.controller.ts` 의
    `@Param('id', ParseUUIDPipe)` (`rotateBotToken`).
  - 상세: 이 PR 이전엔 비-UUID `:id` 가 500 으로 마스킹돼 관측 가능한 400 분기가 없었다. 이제
    `ParseUUIDPipe` 가 실제로 400 `VALIDATION_ERROR` 를 낸다(컨트롤러 `@ApiBadRequestResponse` ·
    CHANGELOG 에는 반영). 그런데 §5.4 표는 여전히 `X-Workspace-Id` 헤더 형식 오류에 대한
    `VALIDATION_ERROR` 행(374번째 줄)만 있고, `:id` 경로 파라미터 축에 대한 행이 없다 — 같은
    canonical 표가 실제 계약의 부분집합만 나열하는 상태다. 코드가 옳고 spec 표가 낡았다
    (developer 가 그 문장을 쓴 당사자가 아니므로 자기-반증형 소정정 조건 1 미충족 — 직접 고칠 수
    없음이 맞다).
  - 확인: `plan/in-progress/trigger-uuid-and-guide-error-codes.md` (신규 파일, 2996~2762행대)에
    이 항목이 **planner 항목**으로 이미 등재돼 있다("15-chat-channel.md §5.4 실패 응답 표에
    rotate-bot-token 의 신규 400 행이 없다"). 즉 발견 자체는 developer 도 인지하고 정확히
    분리했다 — 이 항목은 새 지적이 아니라 **이미 열려 있는 spec 갱신 채무**의 확인이다.
  - 제안: 코드는 유지. `spec/5-system/15-chat-channel.md` §5.4 표에
    `400 | VALIDATION_ERROR | :id 가 UUID 형식이 아님 (ParseUUIDPipe)` 행 추가는 project-planner
    턴에서 처리.

- **[WARNING] `[SPEC-DRIFT]` `spec/conventions/swagger.md` §5-4 체크리스트가 UUID 경로
  파라미터의 런타임 축(`ParseUUIDPipe`)을 요구하지 않는다.**
  - 위치: `spec/conventions/swagger.md:493` (`- [ ] 경로 UUID 파라미터는 @ApiParam({ format:
    'uuid' }) 일관 적용` 한 줄만 존재, `ParseUUIDPipe` 는 이 문서에 0건).
  - 상세: 이 PR 이 신규로 추가한 `repo-guards/__tests__/param-uuid-pipe` 가드는 문서 축
    (`@ApiParam format:'uuid'`)과 런타임 축(`ParseUUIDPipe`)을 **함께** 베이스라인 0 으로
    강제한다 — 즉 가드가 규약(§5-4)보다 넓게 문다. 저장소 실측(id-형 `@Param` 136/136 이 파이프를
    갖춤, 이 PR 이 마지막 1건을 채움)은 이미 이 규약을 관례로 굳혔는데 문서에는 반영이 안 됐다.
  - 확인: 이 항목도 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 에 **planner
    항목**으로 이미 등재돼 있고, developer 턴에서 안 고친 이유(조건 1 미충족 — 이 문장은
    developer 가 쓴 게 아니고 드리프트도 이 PR 이 만든 게 아니라 이전부터 있던 공백)까지
    명시돼 있다. 처리 프로세스는 정확하다.
  - 제안: `spec/conventions/swagger.md` §5-4 체크리스트에 `@Param('<id>', ParseUUIDPipe)` 항목
    추가 + §2-3 예시 코드 반영은 project-planner 턴에서.

- **[INFO] 가이드 정정(`backend-labels.ts`/`backend-labels.test.ts`)은 주석 귀속만 고치고
  `TRIGGER_NOT_FOUND` 매핑 자체는 남겨둔다 — 의도된 스코프 제한.**
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts:605-613`,
    `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:339-342`.
  - 상세: `TRIGGER_NOT_FOUND` 는 chat-channel API 코드가 아니라 인입 webhook(`hooks.service.ts`)
    전용 코드임이 실측으로 확인됐는데(위 검증), `ERROR_KO`/`LOCALIZED_ERROR_CODES` 에서 항목을
    지우지 않고 주석 귀속만 정정했다. `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 가
    그 이유("지우려면 프런트엔드가 이 코드를 렌더할 일이 없다는 도달성 증명이 필요한데 이번
    배치에서 하지 않았다")를 명시하고 있어 결함이 아니라 신중한 스코프 제한이다. 별도 조치 불필요.

## 요약

핵심 변경(`rotateBotToken`의 `:id`에 `ParseUUIDPipe` 부착으로 500 마스킹 → 400 VALIDATION_ERROR,
그리고 유저 가이드/`backend-labels.ts`가 적던 존재하지 않는 식별자 두 종(`TRIGGER_NOT_FOUND`
오귀속, `MCP_INSECURE_URL_ALLOWED` 오기) 정정)은 `GlobalExceptionFilter`·`triggers.service.ts`·
`hooks.service.ts`·`.env.example` 등 SoT 소스를 직접 대조한 결과 전부 사실과 일치했고, 신규 AST
가드(`param-uuid-pipe`)와 HTTP 왕복 테스트(3케이스, `GlobalExceptionFilter` 실제 배선)를 직접
실행해 GREEN 을 확인했다. 기능 완전성·에러 시나리오·반환값·비즈니스 로직 모두 구현과 spec CCH-SE-04
의도가 일치한다. 유일한 잔여 이슈는 `spec/5-system/15-chat-channel.md` §5.4 표와
`spec/conventions/swagger.md` §5-4 체크리스트가 이번에 확정된 새 계약(경로 UUID 파라미터의
런타임+문서 양 축, `:id` 형식 오류의 400 분기)을 아직 반영하지 못한 SPEC-DRIFT 인데, 이는 developer
자신이 쓴 문장이 아니라서 이번 PR 스코프 밖으로 정확히 분리돼 `plan/in-progress/
trigger-uuid-and-guide-error-codes.md` 에 planner 항목으로 이미 등재돼 있다 — 신규로 지적할
결함이 아니라 이미 추적 중인 채무의 재확인이다. TODO/FIXME/HACK/XXX 잔존 없음.

## 위험도

LOW — Critical 0. WARNING 2건은 모두 코드가 아니라 spec 문서 갱신 채무(SPEC-DRIFT)이며 이미
plan 트래커에 planner 항목으로 등재돼 있어 후속 조치 경로가 명확하다.
