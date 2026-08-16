# 신규 식별자 충돌 검토 — `eia-internal-rest-error-masking.md`

## 검토 범위 및 방법

target 이 새로 도입하는 식별자를 추출해 `spec/`·`plan/`·`codebase/backend/src` 전체를 grep 으로
교차 검증했다.

- 신규 함수: `redactStoredErrorForResponse` (파일 `shared/utils/redact-stored-error.ts`)
- 신규 private 메서드: `stopInternal`, `toResponseExecution` (`executions.service.ts`)
- 신규 spec 블록: secret-store.md §1 `비대상 — Trigger.config.interaction.triggerToken`
- §R17 카탈로그 불릿 교체본 (`내부 읽기 경로도 같은 마스킹을 적용한다 (결정 2026-08-16)`)
- plan 파일 경로 `plan/in-progress/eia-internal-rest-error-masking.md`

## 발견사항

이번 target 이 새로 도입하는 식별자 6종을 전수 대조했으며 **다른 의미로 이미 쓰이고 있는
충돌은 발견되지 않았다.**

- **함수명 `redactStoredErrorForResponse`** — repo 전체에서 이 신규 파일과 그 소비처
  (`executions.service.ts:40,609,888,926`, `background-runs.service.ts:21,302`) 외에는
  등장하지 않는다. 기존 `redact*` 계열 네이밍(`redactSecrets`/`redactSecretsInJsonString`
  — `sanitize-error-message.ts`, `redactThreadForPublic` — `thread-renderer.ts`)과
  `동사+대상+For+목적` 패턴이 일치해 오히려 컨벤션에 부합한다. target 문서가 스스로
  지적했듯 초안의 옛 이름 `redactExecutionErrorValue` 는 예외 클래스 `ExecutionError`
  (`workflow-errors.ts:33`)를 부분 문자열로 포함해 잠재 충돌이었는데, 실제 patch 될
  spec 초안 텍스트(§R17 교체본, plan 라인 178-213 상당)에는 옛 이름이 남아 있지 않음을
  확인했다 — `redactStoredErrorForResponse` 로 일관되게 치환돼 있다.
- **`stopInternal` / `toResponseExecution`** — `executions.service.ts` 내부에만 존재하는
  private 메서드. 다른 모듈·spec 문서에서 동명의 다른 의미 사용처 없음.
- **`비대상 — Trigger.config.interaction.triggerToken` 블록** — `secret-store.md §1` 은
  이미 같은 패턴(`> **비대상 — AuthConfig.config**: ...`)을 하나 갖고 있다(`:40`). target 이
  추가하는 블록은 **같은 명명 패턴을 재사용하되 대상이 다른 새 항목**이라 형식 충돌이 아니라
  의도된 확장이다. `triggerToken`/`itk_*` 자체는 신규 식별자가 아니라 `spec/5-system/
  14-external-interaction-api.md`(§7.1, §7.3 등)·`spec/data-flow/15-external-interaction.md`·
  `spec/1-data-model.md:638`·`triggers.service.ts`·`interaction.guard.ts`·
  `interaction-token.service.ts` 에 이미 존재하는 필드/토큰 prefix 를 그대로 참조한다 —
  새 의미를 부여하는 것이 아니라 secret-store 예외 목록에 **등재**하는 것뿐이다.
- **§R17 교체 불릿** — 교체 대상 원문(`spec/5-system/14-external-interaction-api.md:1482-1485`,
  `- **내부 REST 와의 비대칭은 미결이다**: ...`)이 target 문서에 인용된 것과 정확히 일치함을
  실측 확인. 교체본이 새로 쓰는 표현("결정 2026-08-16")은 같은 파일의 다른 곳에서 다른 의미로
  쓰이지 않는다(같은 target 문서 안의 D 항목과만 공유하며, 같은 PR·같은 날짜 결정이라 의도된
  재사용).
- **API endpoint** — target 이 언급하는 `GET /executions/:id/background-runs/:id` 는 신규
  endpoint 가 아니라 기존 `background-runs.controller.ts`(`@Controller('executions/:executionId/
  background-runs')` + `@Get(':backgroundRunId')`)를 가리키며, `:id/:id` 축약 표기 역시
  `spec/4-nodes/1-logic/12-background.md:214` 가 이미 쓰는 표기와 동일하다. 새 endpoint 정의
  없음.
- **파일 경로** — `codebase/backend/src/shared/utils/redact-stored-error.ts` 는 이미
  구현되어 존재하며(`terminal-error-payload.ts` 형제 leaf util 패턴), 다른 파일과 경로가
  겹치지 않는다. plan 파일 경로 `plan/in-progress/eia-internal-rest-error-masking.md` 도
  `plan/in-progress/` 기존 34개 파일과 이름이 겹치지 않고 kebab-case 컨벤션을 따른다.
- **요구사항 ID / 환경변수 / 이벤트명** — target 은 신규 `EIA-XX-YY` 류 요구사항 ID, 신규
  ENV var, 신규 webhook/queue/SSE 이벤트명을 도입하지 않는다(모두 기존 식별자를 그대로 참조).
  이 세 관점에서는 해당 사항 없음(N/A).

INFO 수준 관찰 하나만 남긴다 — "결정 2026-08-16" 이라는 캡션이 I1(§R17)과 D(secret-store)
두 서로 다른 결정에 동일 문자열로 붙는다. 같은 target 문서 안에서만 쓰이고 각 블록의 주어
(`Execution.error` 마스킹 vs `triggerToken` 비대상 등재)가 명확히 달라 실질적 혼동 위험은
낮지만, 향후 이 문자열로 grep 할 때 두 항목이 함께 걸리는 점은 참고할 만하다. 등급을 매길
정도의 결함은 아니라 발견사항 표에 별도로 올리지 않는다.

## 요약

target 이 새로 도입하는 함수명(`redactStoredErrorForResponse`)·private 메서드명
(`stopInternal`/`toResponseExecution`)·spec 블록(`비대상 — Trigger.config.interaction.
triggerToken`)·§R17 교체 불릿·plan 파일 경로를 `spec/`·`plan/`·`codebase/backend/src`
전체와 대조했으나 기존에 다른 의미로 사용 중인 동일 식별자는 없었다. 특히 이전 라운드에서
CRITICAL 로 지적됐던 `redactExecutionErrorValue`(→ `ExecutionError` 예외 클래스와 부분
문자열 충돌) 문제는 실제 patch 될 spec 텍스트에서 이미 해소되어 있음을 재확인했다. 신규
endpoint·이벤트명·환경변수는 도입되지 않았고, `secret-store.md` 의 신규 "비대상" 블록은
기존 블록과 같은 명명 패턴을 다른 대상에 대해 재사용하는 의도된 확장이다.

## 위험도

NONE
