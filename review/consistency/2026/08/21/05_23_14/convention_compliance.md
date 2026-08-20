# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 방법 메모

prompt_file 번들의 `spec/5-system/14-external-interaction-api.md`·`spec/conventions/error-codes.md`·
`spec/5-system/2-api-convention.md`·`<git diff origin/main...HEAD -- code_areas>` 등 핵심 파일이 모두
"컨텍스트 예산 초과로 생략"돼 있었다. 지시대로 이를 "내용 없음"으로 간주하지 않고, 워크트리
절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputoverride-reject-a3f1c9`)에서
`git diff origin/main...HEAD` 와 `Read`로 직접 재확인했다. 이번 변경의 핵심은 `inputOverride`/Manual
파라미터의 **마스킹 마커 서버측 재제출 거부**(`MASKED_VALUE_RESUBMITTED`, 2026-08-20~21) 다.

## 발견사항

- **[INFO]** 새 구현 함수명이 spec 어디에도 등장하지 않는다
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 에러 코드 표 (`masked_value_resubmitted` 행) · `spec/5-system/14-external-interaction-api.md` §R17 소비처 표(`서버 (Manual 실행 경로)` 행)
  - 위반 규약: 엄밀한 규약 위반은 아님 — `spec/conventions/spec-impl-evidence.md` R-1 은 `code:` 글로브가 **≥1 매치**만 요구하고 완전성은 가드 대상이 아니라고 명시한다.
  - 상세: 실제 구현은 `resolveTriggerParametersRejectingMasked` (신규 파일 `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`)이며, 이 함수가 base `resolveTriggerParameters` 를 감싸 raw-우선/resolve-후 2단계 검사를 소유한다. 그런데 두 target spec 문서 모두 이 새 함수·파일명을 한 번도 언급하지 않고 "adapter `resolveTriggerParameters` 전후 2단계"라는 표현만 쓴다. `1-manual-trigger.md` §6 서두는 여전히 "Source of truth: `.../resolve-trigger-parameters.ts`" 라고만 적어, `masked_value_resubmitted` 의 실제 SoT 파일이 다르다는 사실이 드러나지 않는다. 두 spec 문서의 `code:` frontmatter 도 `reject-masked-resubmission.ts` 를 포함하지 않는다(빌드 가드는 통과 — 기존 glob 이 이미 ≥1 매치).
  - 제안: `1-manual-trigger.md` §6 표의 `masked_value_resubmitted` 행과 §6 서두 문장에 실제 함수명(`resolveTriggerParametersRejectingMasked`)을 명시하고, 두 spec 문서의 `code:` 에 `reject-masked-resubmission.ts` 를 추가하면 이 신설 게이트가 "공유 함수 안에 넣지 않는다"는 설계 의도(§R17 본문에 이미 서술됨)가 코드 추적에서도 드러난다. 이 함수가 base `resolveTriggerParameters` 와 의도적으로 분리된 것 자체가 이 PR 의 핵심 설계 결정이라, 그 분리를 spec 텍스트가 이름으로 반영하지 않으면 다음 사람이 base 함수를 직접 고쳐 두 번째 마스킹 게이트를 만들 위험이 있다.

- **[INFO]** 신규 표 행의 볼드 스타일이 형제 행과 불일치
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17, "닫는 조건은 충족됐다" 표 (소비처: 폼 프리필 / Re-run 모달 / 에디터 히스토리 로드 / **서버 (Manual 실행 경로)**)
  - 위반 규약: 명시적 conventions 항목은 없음(문서 스타일 일관성 수준).
  - 상세: 기존 3행(`폼 프리필`, `Re-run 모달`, `에디터 히스토리 로드`)은 소비처 열이 평문인데 신규 4번째 행만 `**서버 (Manual 실행 경로)**` 로 볼드 처리했다.
  - 제안: 형제 행과 스타일을 맞추거나(볼드 제거), 의도적 강조라면 무방 — 차단 사유 아님.

- **[INFO]** `error-codes.md §4` "패턴" 인용은 신규 편차가 아니라 기존 관행의 연장
  - target 위치: `spec/5-system/3-error-handling.md` §1.7, `spec/5-system/12-webhook.md` §5.2, `spec/4-nodes/7-trigger/1-manual-trigger.md` §6
  - 위반 규약: 없음(확인 목적의 기록).
  - 상세: `masked_value_resubmitted`(내부 lower_snake) → `MASKED_VALUE_RESUBMITTED`(public UPPER_SNAKE) 정규화가 `[error-codes 규약 §4](../conventions/error-codes.md#4-내부-전용-분류-코드-정규화-후-발행) 패턴`으로 인용되는데, §4 표 자체는 Code 노드 핸들러 내부 코드(`EXECUTION_TIMEOUT`→`CODE_TIMEOUT` 등)만 나열하고 trigger-parameter reason 문자열은 표에 없다. 다만 이 인용은 diff 의 `-`/`+` 양쪽에 이미 있었다 — 즉 `missing_required`/`coerce_failed`/`invalid_schema` 때부터 있던 기존 서술을 그대로 확장한 것으로, 이번 PR 이 새로 만든 편차가 아니다.
  - 제안(선택): `error-codes.md §4` 표에 trigger-parameter reason 계열(비-Code-노드)을 별도 행 또는 각주로 추가하면 "패턴"이라는 인용이 표에서도 직접 확인 가능해진다 — 규약 문서 자체의 개선 제안이며 이번 PR 을 막을 사유는 아니다.

## 준수 확인 (위반 없음 — 근거 기록)

- **명명 규약**: 신규 public 코드 `MASKED_VALUE_RESUBMITTED` 는 `error-codes.md §1` 의 의미 기반·`UPPER_SNAKE_CASE`·prefix-less 원칙을 따른다 — 형제 field code(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)와 같은 "필드별 사유 코드" 범주라 도메인 prefix 불필요가 정당하다. 내부 분류 문자열 `masked_value_resubmitted` 도 형제들과 동일한 lower_snake_case.
- **출력 포맷 규약**: `TriggerParameterErrorDetail = { field, code, message }` 가 `api-convention.md §5.3` 의 `details[]` 항목 형태(`{ field, message, code }`)와 정확히 일치함을 코드(`trigger-parameter.types.ts`)에서 직접 확인. `BadRequestException({ code, message, details })` → `GlobalExceptionFilter` 경로도 §5.3 봉투와 일치.
- **문서 구조 규약**: 변경된 4개 spec(`3-error-handling.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`1-manual-trigger.md`) 모두 기존 Overview/본문/Rationale 3-섹션 구조를 유지한 채 해당 섹션 안에 신규 내용을 삽입했다(신규 `## `/`### ` 레벨 구조 파괴 없음). `1-manual-trigger.md` 의 신규 Rationale 서브섹션(`### masked_value_resubmitted 검사 시점 — ...`)도 기존 `## Rationale` 헤더 바로 아래, 형제 서브섹션과 동일한 "제목 + 날짜" 스타일로 삽입됐다.
- **API 문서 규약**: 이번 변경은 기존 DTO 필드(`inputOverride`, Manual 파라미터)에 새 검증 로직만 추가했을 뿐 신규 wire 필드가 없어 swagger 데코레이터 갱신 의무가 없다(`re-run.dto.ts` 미변경 확인). 기존 `@ApiBadRequestResponse({ description: 'INVALID_INPUT / ...' })`(`executions.controller.ts`)·`@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })`(`workflows.controller.ts`)는 이미 `INVALID_INPUT` 봉투를 포괄하므로(신규 코드는 그 `details[]` 하위 항목) 갱신 불요.
- **금지 항목**: `resolveTriggerParametersRejectingMasked` 를 `resolveTriggerParameters` **공유 함수 안에 넣지 않고** 별도 래퍼로 둔 설계는 `execution-context.md`/harness 교훈이 반복 지적해온 "공유 프리미티브를 넓히면 무관한 경로가 오염된다"는 원칙을 스스로 인용하며 지킨다 — webhook·schedule 은 대상에서 명시적으로 배제됨을 코드·spec 양쪽에서 확인.
- CHANGELOG.md 신규 Unreleased 항목이 **"Behavior change (breaking)"** 를 명시적으로 라벨했다 — 같은 세션 앞선 라운드(`b355798da`)가 지적한 "breaking 서술만 하고 라벨 누락" 결함이 이번 항목에서는 재발하지 않았다(다만 CHANGELOG 형식을 규정하는 `spec/conventions/*` 문서는 없어 이는 참고 확인일 뿐 공식 규약 판정 대상은 아님).

## 요약

이번 변경(`MASKED_VALUE_RESUBMITTED` 서버측 2층 거부)은 명명(UPPER_SNAKE_CASE·prefix-less field code)·출력 포맷(`{field,code,message}` details 봉투)·문서 3-섹션 구조·API 문서 데코레이터 규약을 모두 기존 정식 규약과 정합하게 따르며, CRITICAL/WARNING 급 위반은 발견되지 않았다. 유일하게 남는 아쉬움은 신규 wrapper 함수(`resolveTriggerParametersRejectingMasked`/`reject-masked-resubmission.ts`)가 두 target spec 문서 어디에도 이름으로 등장하지 않아 "이 게이트를 왜 공유 함수에 넣지 않았는가"라는 설계 의도가 코드 추적선에서 흐려진다는 점인데, 이는 `spec-impl-evidence.md` 가 요구하는 최소 조건(≥1 코드 매치)은 충족하므로 빌드 가드를 통과하며 INFO 수준의 문서 완결성 제안으로만 남긴다.

## 위험도

LOW
