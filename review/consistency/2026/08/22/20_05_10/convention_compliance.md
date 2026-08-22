STATUS=success convention_compliance review complete (2 findings: 0 CRITICAL / 1 WARNING / 1 INFO)
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `spec/4-nodes/7-trigger/`

검토 모드: impl-done (scope=`spec/4-nodes/7-trigger/`, diff-base=`origin/main`). 코드 diff 는
masked marker 재제출 거부 배선(§EIA R17) 관련 — `trigger-parameter.types.ts` JSDoc, `resolve-trigger-parameters.ts`
JSDoc, `re-run.dto.ts` 필드 설명, `workflows.controller.ts` 주석. target spec 자체는 frontmatter 한 줄
(`code:` 에 `executions.service.ts` 추가)만 diff 에 포함되며 본문은 기존 상태 유지.

## 발견사항

- **[WARNING]** `ReRunRequestDto.inputOverride` 의 `@ApiPropertyOptional description` 이 swagger 규약 길이 가이드를 벗어나고, 문서화된 예외의 문면과도 정확히 일치하지 않음
  - target 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`inputOverride` 필드, diff 로 신규 작성된 description)
  - 위반 규약: `spec/conventions/swagger.md` §3 "주석/설명 톤" — "DTO `description`은 10~40자 내외" 및 그 예외 조항("응답 값이 **저장된 값과 다를 수 있는** 필드(egress 마스킹 대상 등)는 위 길이 제한의 예외다")
  - 상세: 신규 description 은 "useOriginalInput=false 일 때 사용할 입력. Manual Trigger parameters 스키마와 호환. 마스킹 마커와 **정확히 일치**하는 값 leaf 는 예약어로 거부된다(400, `details[].code = MASKED_VALUE_RESUBMITTED`) — 부분 일치는 통과. SoT: EIA §R17 (...)." 로 약 190자 — 10~40자 가이드를 크게 초과한다. swagger.md §3 의 "보안·정책 캐비엇" 예외는 명문상 **응답 값이 저장된 값과 다를 수 있는 필드**(egress 마스킹 등)를 대상으로 하는데, `inputOverride` 는 **요청 입력 필드**이고 이 설명이 다루는 것도 "응답이 DB 와 다르다"가 아니라 "요청 시 마스킹 마커 재제출이 거부된다"는 **요청측 검증 caveat** 이다. 즉 이 새 사용례는 예외 조항의 글자 그대로의 적용 범위(응답 필드) 밖에 있다 — 같은 파일의 기존 `dryRun` 필드 설명(≈110자, 이 PR 의 diff 대상 아님)도 유사하게 가이드를 초과하고 있어, 실무 관행이 문서화된 규칙보다 이미 넓게 퍼져 있는 상태로 보인다.
  - 제안: (a) target 을 고친다면 — 상세 근거(2단계 검사·전후 raw/resolve 등)는 spec 본문(`spec/4-nodes/7-trigger/1-manual-trigger.md` §6, `spec/5-system/14-external-interaction-api.md` §R17)에만 두고 DTO description 은 "SoT 링크 + 1문장 요약" 수준으로 축약. (b) 이 형태를 유지하는 것이 의도라면 — `spec/conventions/swagger.md` §3 의 예외 조항 문구를 "응답 값이 저장된 값과 다를 수 있는 필드" 뿐 아니라 "**요청 필드의 보안/거부 규칙 caveat**(masked-marker 재제출 거부 등)"까지 명시적으로 포괄하도록 갱신 — 이미 §3 Rationale 이 "9곳 이상의 기존 관행을 추인" 한 전례가 있으므로 동일 패턴으로 갱신하는 편이 실무와 문서를 재정합시킨다.

- **[INFO]** `1-manual-trigger.md` 의 "CONVENTIONS Principle 2" 라벨이 실제 Principle 제목과 다르게 붙어 있어 `execution-context.md` 규약과 혼동 소지
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §4 실행 로직 6번째 스텝 — `` `meta.source: ...` (CONVENTIONS Principle 2 — 실행 컨텍스트). ``
  - 위반 규약: `spec/conventions/node-output.md` Principle 2 의 실제 제목은 "`meta` 는 "실행 메트릭"만 담는다" (실행 컨텍스트가 아님). 프로젝트에는 별도로 `spec/conventions/execution-context.md`("ExecutionContext 설계 규약")라는 **동명에 가까운 다른 문서**가 존재한다.
  - 상세: 인용 자체는 올바른 Principle 번호(2)와 올바른 문서(node-output.md, 동일 파일 §3 캔버스 표에서 이미 "실행 메트릭만"으로 정확히 서술)를 가리키지만, 괄호 안 부연 설명("— 실행 컨텍스트")이 node-output.md Principle 2 의 실제 제목("실행 메트릭")과 불일치한다. `execution-context.md` 는 `ExecutionContext` 객체의 필드 분류(Stable core 등)를 다루는 전혀 다른 컨벤션이라, 이 라벨을 보고 그 문서를 떠올리면 오독으로 이어질 수 있다. pre-existing 서술(이번 diff 대상 아님)이지만 정식 규약 인용 정확성 관점에서 사소한 drift.
  - 제안: 괄호 부연을 "실행 메트릭" 으로 정정하거나(node-output.md Principle 2 제목과 일치), 혼동 위험을 없애려면 아예 생략하고 `[CONVENTIONS Principle 2](../../conventions/node-output.md)` 형태의 링크만 남긴다.

## 요약

`spec/4-nodes/7-trigger/` 및 이번 PR 이 손댄 코드(마스킹 마커 재제출 거부 배선)는 `spec/conventions/node-output.md`(5필드 invariant·Principle 1.1 직교성·Principle 3.1 pre-flight 분류·Principle 7 config echo·Principle 10 fallback·Principle 11 출력 예시 포맷)와 `spec/conventions/error-codes.md`(§4.2 내부 사유→`UPPER_SNAKE_CASE` 항목 코드 정규화, 신규 `masked_value_resubmitted`→`MASKED_VALUE_RESUBMITTED` 등재, §5 `INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS` rename 이력의 등급 B 인수 서술)를 정확히 인용·준수하고 있으며, swagger.md 의 컨트롤러 데코레이터 패턴(`ApiCreatedWrappedResponse`, `@Roles`+`@ApiForbiddenResponse` 동반 등)도 그대로 따른다. CRITICAL 급 위반(불변식 파손)은 발견되지 않았다. 발견된 두 건은 모두 경미한 문서 정합성 편차(DTO 설명 길이 가이드의 문면-실무 간극, Principle 라벨 오기)로, 시스템 동작이나 다른 팀의 가정에 영향을 주지 않는다.

## 위험도

LOW
