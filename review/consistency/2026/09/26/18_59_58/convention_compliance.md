# 정식 규약 준수 검토 — spec draft `spec-draft-swagger-request-body.md`

검토 대상: `plan/in-progress/spec-draft-swagger-request-body.md` (`swagger.md` §5-4 체크리스트 한 줄 + frontmatter `code:` 가드 등재 + Rationale 한 절)
대조 규약: `spec/conventions/swagger.md` (§1-7, §2-4, §5-4, Rationale)
검토 모드: `--spec`

## 발견사항

- **[WARNING]** 새 체크리스트 문구가 명시하는 면제 범위가 같은 PR 의 구현 plan보다 좁다 — `@ApiExcludeController()` 누락
  - target 위치: draft `### 1. §5-4 체크리스트 — 한 줄 추가` — "저장소 가드 `request-body-advertised` 가 **모든 라우트**에서 `@Body()` 자리의 설계 타입이 클래스가 아닌데 `@ApiBody` 가 없는 자리를 잡는다(`@ApiExcludeEndpoint()` 제외)."
  - 위반 규약: `spec/conventions/swagger.md` 자체가 반복해서 요구하는 "가드가 무엇을 강제하는지(그리고 무엇을 면제하는지) 정확히 적는다" 는 관행(§5-1 `dto-class-name-collision` Rationale — "가드가 무엇을 강제하는지 여기 적지 않으면 다음 사람이 지운다"). 직접적인 조문 위반은 아니지만, swagger.md 가 스스로 세운 정밀 서술 기준에 못 미친다.
  - 상세: 같은 트리오 문서인 `plan/in-progress/request-body-guard.md` (구현 plan, 이 draft 와 같은 PR 묶음)는 새 가드의 면제 대상을 "`@ApiExcludeEndpoint()` · `@ApiExcludeController()` 는 묻지 않는다" 로 **둘 다** 명시한다. 실제로 저장소의 형제 reflection 가드 `forbidden-response-codes-guard.ts` (라인 146)도 핸들러 `@ApiExcludeEndpoint()` 뿐 아니라 클래스 `@ApiExcludeController()` 도 함께 검사한다 — 이 새 가드가 같은 계열(reflection, 컨트롤러 전수 순회)이라 같은 면제축을 물려받을 가능성이 높다. 그런데 정작 spec(SoT)에 들어갈 문구는 `@ApiExcludeEndpoint()` 만 언급한다. 구현이 계획대로 두 데코레이터를 모두 면제하면, 이 문구만 읽는 다음 사람은 "컨트롤러 단위 제외는 이 가드가 여전히 본다" 고 오해할 수 있다(현재 저장소에는 `@ApiExcludeController()` 실사용처가 없어 당장 관측 가능한 오탐은 없다 — grep 결과 0건).
  - 제안: 체크리스트 문구를 "(`@ApiExcludeEndpoint()` · `@ApiExcludeController()` 제외)" 로 맞추거나, 만약 이 가드가 실제로 컨트롤러 단위 제외를 보지 않기로 결정한다면 구현 plan 쪽 문구("`@ApiExcludeController()` 는 묻지 않는다")를 spec 과 일치하도록 좁힌다. 가드가 실제로 구현된 뒤 `--impl-done` 단계에서 최종 확인하고 문구를 실측에 맞출 것.

- **[INFO]** "문서 전용 DTO" 라는 용어가 새로 만들어지는데 선례 코드의 자기 서술과 문구가 다르다
  - target 위치: draft `### 1. §5-4 체크리스트 — 한 줄 추가`의 "**문서 전용 DTO**(class-validator 데코레이터 없이 `@ApiProperty` 만)"
  - 위반 규약: 없음(신규 개념 도입이라 강제 규약 부재) — 순수 용어 일관성 제안.
  - 상세: 이 draft 가 선례로 드는 `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` 는 자신을 "OpenAPI 스키마 전용" 이라고 부른다("`POST /api/workflows/:id/execute` 요청 본문 — **OpenAPI 스키마 전용**"). `swagger.md` 에는 아직 이런 DTO 부류를 가리키는 확정 용어가 없어, 이번에 "문서 전용 DTO" 라는 새 이름이 사실상 SoT 가 된다. 이름이 코드 주석의 자기 서술과 다르면 향후 `grep` 로 "이 패턴을 쓰는 DTO가 몇 개인가" 를 셀 때 두 문구를 다 찾아야 한다.
  - 제안: 사소한 사항이라 이번 반영을 막을 이유는 아니다. 다음에 이 패턴이 §1 로 정식 승격될 때(§1-7 Rationale 이 이미 "가드는 이름과 무관하므로 두 결정을 섞지 않는다" 고 트래커로 미뤄 둔 그 시점) 두 표현 중 하나로 통일하는 것을 권장.

## 검토한 항목 중 위반 없음(양성 확인)

- **명명 규약**: 가드 이름 `request-body-advertised` 는 형제 가드(`http-status-advertised`, `forbidden-response-codes`, `dto-class-name-collision`)의 "형용사/분사형 술어" 명명 패턴과 일치. `code:` glob(`request-body-advertised*.ts`)도 기존 glob 패턴과 동형.
- **frontmatter 규약**: `spec_impact`(리스트, 단일 실재 경로 `spec/conventions/swagger.md`) · `worktree`/`started`/`owner` 3필드 모두 [`plan-lifecycle.md`](../../../../../.claude/docs/plan-lifecycle.md) §4 스키마 충족. `spec-draft-<name>.md` 파일명 패턴도 준수.
- **문서 구조**: draft 자체는 spec 문서가 아니라 `project-planner` SKILL 이 정한 draft 형식("변경안" + 말미 `## Rationale`)을 그대로 따름 — `## Overview`/3섹션 요구는 `spec/` 본 문서에 적용되는 것이지 draft 에는 해당 없음.
- **삽입 위치**: 새 체크리스트 항목을 "경로 UUID 파라미터" 줄 **앞**에 넣는 방식은 과거 "광고한 성공 코드" 항목이 삽입된 위치와 동일한 패턴(§5-4 신규 실질 규칙은 UUID 항목 앞에, 명명류는 맨 뒤) — 일관됨.
- **frontmatter `code:` 삽입**: 새 주석 "§5-4 의 <규칙> — <조건>(reflection, 대조군은 spec 안의 클래스)." 형식이 바로 앞 403 항목의 주석과 동형.
- **Rationale 절 삽입 위치**: 날짜순 append 관행(같은 날짜 `2026-09-26` 의 §2-4 절 → 403 절 → 신설 절 순)과 일치.
- **사실 정확성**(정식 규약이 참조하는 실측치): "`@Body()` 78개"·"DTO 클래스 74·인라인+`@ApiBody` 4" 는 `src/modules/**/*.controller.ts` 전수(80건 grep 매치 − 주석 내 `@Body()` 언급 2건 = 78)와 정확히 일치. 인라인 4곳(`rotate-bot-token`·`execute`·`receiveWebhook`·`continueExecution`) 실재 확인. 선례 `ExecuteWorkflowDto`(class-validator 데코레이터 없음, `@ApiPropertyOptional` 만)와 `CustomValidationPipe.toValidate()`(`String`·`Boolean`·`Number`·`Array`·`Object` 제외) 서술도 코드와 일치. `@ApiBody({ schema: {} })` 웹훅 패턴도 `hooks.controller.ts` 실제 코드와 일치.

## 요약

draft 는 `spec/conventions/swagger.md` 의 기존 §5-4/§1-7/Rationale 관행(체크리스트 삽입 위치, frontmatter `code:` 주석 형식, 날짜순 Rationale append, 가드 명명)을 정확히 모사하고 있고, 인용한 실측 수치·선례 코드 레퍼런스는 저장소 현재 상태와 전부 일치해 정합성이 높다. 유일하게 지적할 사항은 새 가드의 면제 범위 서술(`@ApiExcludeEndpoint()` 만 언급)이 같은 PR 의 구현 plan·형제 가드의 실제 동작(`@ApiExcludeController()` 포함 가능성)보다 좁다는 점으로, 구현 단계에서 문구와 실제 동작을 다시 맞출 필요가 있다. 그 외 명명·구조·API 문서 데코레이터 패턴은 모두 기존 정식 규약과 일치한다.

## 위험도

LOW
