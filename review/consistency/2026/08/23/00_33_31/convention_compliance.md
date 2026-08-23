# 정식 규약 준수 검토 — `spec/5-system/` (--impl-done)

검토 모드: 구현 완료 후 검토, diff-base=`origin/main`, target scope=`spec/5-system/`.
prompt 의 diff 섹션이 예산 초과로 생략돼, HEAD 워킹트리(`execute-body-dto-c37965`)에서
`git diff origin/main...HEAD` 를 직접 재실행해 변경분을 확인했다. 실질 변경은
`codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`(신규) ·
`workflows.controller.ts`(`@ApiBody` 데코레이터 6줄 추가) ·
`workflows-execute-body.spec.ts`(신규 캐너리) — `spec/**` 파일은 이번 diff 에서 **변경 없음**
(`plan/complete/execute-body-openapi.md` 의 `spec_impact: none` 과 일치).

대조 대상 정식 규약: `spec/conventions/swagger.md`(§1-4 열린/동적 map, §3 description 길이
캐비엇 예외), `spec/conventions/error-codes.md`, `spec/5-system/2-api-convention.md`.

## 발견사항

- **[없음 — 확인됨]** 신규 `ExecuteWorkflowDto` 의 `parameterValues`/`input` 필드가
  `swagger.md` §1-4 "열린/동적 map" 표기(`{ type: 'object', additionalProperties: true }`)를
  정확히 따른다.
  - target 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`
  - 상세: 직전 리뷰 사이클(`review/consistency/2026/08/22/23_46_23/convention_compliance.md`
    WARNING)이 지적한 `type: Object` 축약형 문제가 이번 최종 코드에서는 두 필드 모두
    `{ type: 'object', additionalProperties: true }` 로 정정돼 있다. 형제 파일
    `codebase/backend/src/modules/executions/dto/re-run.dto.ts` 의 동일 결함(`type: Object`)은
    이번 PR 범위 밖으로 남겨졌으나, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    에 "`re-run.dto.ts` 가 열린 map 을 `type: Object` 축약형으로 적는다" 항목으로 명시
    등재돼 있어 방치가 아니라 **의도된 스코프 분리 + 추적**이다. 신규 canary
    (`workflows-execute-body.spec.ts` "두 필드 다 열린 map 으로 렌더링된다") 가 이 형태를
    회귀로부터 고정한다.

- **[없음 — 확인됨]** `parameterValues`/`input` description 이 `swagger.md` §3 길이 캐비엇
  (10~40자) 을 넘지만 "요청 값이 정책으로 거부될 수 있는 필드" 예외(2026-08-22 확장분,
  `swagger.md §3 Rationale`)에 정확히 해당한다.
  - target 위치: 같은 파일, 두 `@ApiPropertyOptional({ description })`
  - 상세: 두 필드 모두 `MASKED_VALUE_RESUBMITTED` 거부 규칙과 `SoT: EIA §R17` 링크를 담아
    swagger.md 가 요구하는 "요약 1~2문장 + SoT 링크" 형태를 그대로 따르고, 문구도 형제
    `re-run.dto.ts` `inputOverride` 필드와 **축자적으로 동일**하다(swagger.md 자체가 "마커
    예약어 문구는 re-run.dto.ts 와 같은 사실을 말하되 그 SoT 링크 방식을 따른다"고 명시).
    직전 리뷰가 `input` 필드를 예외 미해당 INFO 로 지적했던 시점(구 문구 "레거시 입력 봉투 …")
    이후, 현재 문구는 "그 값도 동일한 마커 거부 대상" 으로 정책-거부 사유를 명시적으로 포함하도록
    갱신돼 있어 이제는 예외에 정확히 해당한다.

- **[없음 — 확인됨]** `@ApiBody({ type: ExecuteWorkflowDto })` 를 `@Body()` 인라인 타입과
  의도적으로 분리한 패턴이, 코드베이스의 다른 모든 `@ApiBody` 선례(`llm-model-config.controller`
  ·`knowledge-base.controller`·`workflow-assistant.controller`)와 달리 파라미터 타입과
  DTO 가 불일치하는 **새로운 형태**이지만, `swagger.md` 를 위반하지 않는다.
  - 상세: swagger.md 는 `@ApiBody`/`@Body()` 타입 일치를 명문화한 규칙을 두고 있지 않고, 이
    이탈은 클래스 docstring + 컨트롤러 인라인 주석 + 전용 canary 3중으로 근거·의도·회귀
    방지가 모두 문서화돼 있다(계약 축소 회피가 목적). `plan/complete/execute-body-openapi.md`
    가 "검증을 켜는 것은 별개 결정"으로 명시적으로 향후 결정 사항을 트래커에 등재해 둬,
    이 PR 이 조용히 새 관행을 만든 게 아니라 **경계를 명시하며 남겨둔 결정**이다.

- **[INFO]** (carry-forward, 이번 diff 와 무관 · 비차단) `spec/5-system/2-api-convention.md`
  에만 로컬 `## Overview` 섹션이 없음
  - target 위치: `spec/5-system/2-api-convention.md` — 타이틀 직후 바로 `## 1. 기본 원칙`
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조(3섹션 권장)"
  - 상세: 이번 diff 는 `spec/5-system/**` 파일을 전혀 건드리지 않아 신규 결함이 아니다.
    직전 리뷰(`23_46_23`)에서 이미 INFO 로 보고된 항목을 재확인한 것 — 상태 무변화.
  - 제안: 별도 후속(스펙 그루밍)에서 처리. 이번 PR 조치 불필요.

## 요약

이번 diff(`execute-body-dto`)는 `spec/**` 를 전혀 변경하지 않았고(`spec_impact: none`),
실질 변경은 `ExecuteWorkflowDto` 신설 + `@ApiBody` 데코레이터 부착 + 전용 canary 뿐이다.
`swagger.md` §1-4(열린 map 표기)·§3(description 길이 캐비엇 예외, 2026-08-22 확장분 포함)
양쪽 모두 정확히 준수하며, 직전 impl-prep 리뷰(`23_46_23`)가 지적한 WARNING(`type: Object`
축약형)은 신규 파일에서 이미 정정됐고 남은 형제 파일(`re-run.dto.ts`)의 동일 결함은 스코프
밖으로 명시적으로 분리·트래커 등재돼 있어 결함 은폐가 아니다. `@Body()` 파라미터를 DTO 로
승격하지 않고 문서만 붙이는 결정은 swagger.md 가 강제하는 바 없어 규약 위반이 아니며, 계약
축소를 막는 canary 로 뒷받침된다. CRITICAL·WARNING 급 위반은 발견되지 않았다. 유일한 INFO 는
이번 diff 와 무관한 기존 spec 문서 구조(`2-api-convention.md` 의 로컬 Overview 부재) 재확인
뿐이다.

## 위험도
NONE
