# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-inputoverride-marker-reject.md`

## 검토 범위

target: `plan/in-progress/spec-draft-inputoverride-marker-reject.md` (spec draft, `--spec` 모드)
대조: `spec/conventions/error-codes.md` · `spec/conventions/swagger.md` · `spec/conventions/spec-impl-evidence.md` ·
`.claude/docs/plan-lifecycle.md` · `.claude/skills/project-planner/SKILL.md` · 실제 코드
(`trigger-parameter.types.ts`, `executions.service.ts`, `workflows.controller.ts`, `http-exception.filter.ts`,
`3-error-handling.md`, `13-replay-rerun.md`, `14-external-interaction-api.md §R17`)

## 발견사항

- **[INFO]** 신규 `reason` 토큰의 형태가 형제 항목들과 품사가 다르다
  - target 위치: "## 에러 계약 — 기존 헬퍼를 확장한다" 표 (`masked_marker` → `MASKED_VALUE_RESUBMITTED`)
  - 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명) — 직접 위반은 아니고 스타일 관찰
  - 상세: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` 의 기존 세 `reason`
    (`missing_required`/`coerce_failed`/`invalid_schema`)은 전부 "무엇이 잘못됐는가" 를 서술하는
    동사/형용사구다. 신규 `masked_marker` 는 "무엇이 발견됐는가" 를 서술하는 명사구라 형태가 갈린다
    (반면 공개 `code` 인 `MASKED_VALUE_RESUBMITTED` 는 조건 서술형이라 오히려 형제 `code` 들과 더 잘 맞는다).
    기능적 문제는 없다 — `reason` 은 내부 전용 키라 §1 의 클라이언트 계약 대상이 아니다.
  - 제안: 굳이 바꿀 필요는 없으나, 대칭성을 원하면 `reason: 'masked_value_resubmitted'` 로 맞추는 안도
    있다. 구현 단계(`developer`)의 재량으로 남겨도 무방.

- **[INFO]** re-run `INVALID_INPUT` 코드가 같은 표의 형제 코드들과 도메인 prefix 관행이 다르다 (기존 이슈, target 미도입)
  - target 위치: "## spec 변경 4곳" 항목 4(선택 5) — `3-error-handling.md §1.3` 에 `INVALID_INPUT` 등재 제안
  - 위반 규약: `spec/conventions/error-codes.md §1` "도메인 prefix (권장)"
  - 상세: `13-replay-rerun.md §8.1` 표의 나머지 5개 코드(`RERUN_PERMISSION_DENIED`·`RERUN_EXECUTION_NOT_FOUND`·
    `RERUN_WORKFLOW_DELETED`·`RERUN_CHAIN_DEPTH_EXCEEDED`·`RERUN_DRY_RUN_NOT_APPLICABLE`)는 전부 `RERUN_`
    prefix 를 쓰는데 `INVALID_INPUT` 만 없다 — 실측(`executions.service.ts:496`)으로 확인됨. 이는 **이
    draft 가 만든 문제가 아니라 기존 코드**이고, `error-codes.md §2` 상 이름 정확성만을 위한 rename 은
    금지(breaking change)이므로 이 draft 가 손댈 이유도 없다. 다만 "선택 5" 로 이 코드를 중앙
    카탈로그(§1.3)에 처음 등재하면서 이 불일치를 한 문장도 언급하지 않아, 이후 리뷰어가 "왜 prefix 가
    없냐" 를 반복 지적할 여지를 남긴다.
  - 제안: 선택 5 를 채택한다면, `§1.3` 등재 행 옆에 "`RERUN_` 미부여는 §2 rename-stability 상 유지"
    같은 한 줄 각주를 붙여 반복 지적을 예방. 필수는 아님(INFO).

- **[INFO]** Swagger 레벨 에러 문서(`error-response.dto.ts`) 갱신 여부가 draft 범위에 명시돼 있지 않음
  - target 위치: "구현 스코프에 포함" 문단
  - 위반 규약: `spec/conventions/swagger.md §5-5` (`ErrorResponseDto` 가 `GlobalExceptionFilter` 출력을
    1:1 로 표현)
  - 상세: `details[].code` 카탈로그에 `MASKED_VALUE_RESUBMITTED` 가 늘어나는데, Swagger 쪽 열거형/예시가
    있다면 함께 갱신해야 `ErrorResponseDto` 가 실제 출력과 어긋나지 않는다. draft 는 이 표면을 언급하지
    않는다.
  - 제안: spec 레벨 변경 사항이라 필수는 아니나(구현 세부), "구현 스코프" 문단에 "Swagger DTO 예시/enum
    갱신 필요 시 함께" 한 줄을 추가하면 후속 구현 누락을 예방.

## 준수 확인 (위반 아님 — 참고용 근거)

검증 결과 다음은 규약을 정확히 따르고 있다:

- **명명**: `MASKED_VALUE_RESUBMITTED` 는 `UPPER_SNAKE_CASE`(§1)를 지키고, 조건을 의미로 서술하며(§1
  "의미 기반 명명"), 도메인 prefix 미부여는 형제 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/
  `INVALID_SCHEMA` 와 동일 범주라 원칙 위반이 아니다(도메인 prefix 는 `CAFE24_*`/`OAUTH_*` 류 대상,
  권장 사항일 뿐). 기존 코드와 이름 충돌도 없음(grep 확인).
- **rename 금지 원칙(§2) 준수**: `coerce_failed` 재사용을 명시적으로 기각하고 신규 코드를 신설 — §2 의
  "의미가 분기되면 새 코드를 신설" 원칙과 정확히 부합.
- **출력 포맷(§1.7 details[] 계약)**: `executions.service.ts:496-500` 이 `errors: err.errors` 를 쓰고
  `http-exception.filter.ts:73` 이 `details` 만 읽는다는 draft 의 지적을 코드 대조로 확인 — 실재하는
  봉투 계약 위반이며, draft 의 수정안(`details: toTriggerParameterErrorDetails(err.errors)`)은
  `workflows.controller.ts:314-323` 의 기존 패턴과 **완전히 동일**해 §1.7 계약(정의 SoT §1.7, `details[]`
  전달)에 정확히 부합한다.
- **문서 구조**: draft 자체가 `plan/in-progress/spec-draft-<name>.md` 명명 패턴, `worktree`/`started`/
  `owner` frontmatter 필수 3필드, `spec_impact` YAML 리스트 형식(`feedback_spec_impact_gate_c_list.md`
  교훈과 일치), 본문 끝 `## Rationale` 절 — project-planner SKILL.md §"draft 작성" 규칙을 그대로 따른다.
- **spec 본문 배치**: draft 가 제안하는 4곳(§R17 표 행 추가, §1.7 주석 등재 + scope 주석 갱신, §8.1 각주,
  §10.2 갱신)이 각 문서의 기존 절 배치 관행(카탈로그 등재는 §1.7, 정의 SoT 는 도메인 spec)과 일치.
- **부분 포함 매칭·공유 프리미티브 오염 금지**: draft 가 명시적으로 기각한 두 대안(부분 포함 매칭,
  `resolveTriggerParameters` 내부에 공유 로직 삽입)은 이 저장소 MEMORY 의 반복 교훈
  (`feedback_defense_defined_one_notch_narrow.md`)과 정확히 같은 방향의 판단이며 금지 패턴을 답습하지
  않는다.

## 요약

target draft 는 정식 규약(error-codes.md·swagger.md·plan-lifecycle.md·project-planner SKILL.md) 관점에서
CRITICAL/WARNING 급 위반이 없다. 신규 에러 코드(`MASKED_VALUE_RESUBMITTED`)는 명명·rename-안정성·
`details[]` 출력 계약을 정확히 따르고, 문서 구조(frontmatter·`## Rationale`)도 project-planner 컨벤션을
그대로 지킨다. 코드 인용(호출부 5곳의 파일:라인, `errors` vs `details` 필드명 불일치)도 실제 소스와
대조해 정확함을 확인했다. 발견된 3건은 전부 INFO 수준의 스타일/완결성 제안이며, 그중 하나(`INVALID_INPUT`
prefix 불일치)는 이 draft 가 만든 문제가 아니라 기존 코드의 pre-existing 상태다.

## 위험도

LOW
