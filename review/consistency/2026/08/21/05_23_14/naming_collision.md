STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 0 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법

prompt 의 bundle 은 컨텍스트 예산 초과로 target 파일 자체(`14-external-interaction-api.md`)와
`<git diff origin/main...HEAD -- code_areas>` 를 포함한 16개 파일이 절단돼 있었다. bundle 전문을
근거로 삼지 않고, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputoverride-reject-a3f1c9`)에서
`git diff origin/main...HEAD` 를 직접 산출해 실제 변경분만을 대상으로 검토했다. 이 브랜치는 이미
11 라운드의 code-review + 4 라운드의 consistency-check(naming_collision 포함, 가장 최근
`review/consistency/2026/08/21/00_55_25`)를 거쳤으므로, 이전 라운드가 잡은 결함(HIGH, `19_34_37`:
re-run 경로가 `details` 대신 `errors` 키로 던져 `MASKED_VALUE_RESUBMITTED` 가 응답에서 소실)이
현재 HEAD 에서 실제로 해소됐는지부터 코드로 재확인했다.

## 변경 범위 확정

diff 는 spec 7개 파일 + backend 6개 파일(신규 4·수정 2) + `CHANGELOG.md` + `tsconfig.build.json` +
plan 3개 파일에 걸친다. 신규로 도입되는 식별자는 사실상 하나의 클러스터다:

- 공개 field code: `MASKED_VALUE_RESUBMITTED`
- 내부 분류 문자열: `masked_value_resubmitted`
- 신규 함수: `resolveTriggerParametersRejectingMasked` / `findMaskedResubmissions` (모듈-scoped `hasMaskedLeaf`/`throwIfAny`)
- 신규 파일: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`(+`.spec.ts`)
- 부산물 저장소 가드 2개: `masked-reject-callers-guard.ts`/`.spec.ts`, `production-build-devdep-guard.ts`/`.spec.ts` (+ 각 export 함수)

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 새 요구사항 ID 미도입. 인용되는 `EIA §R17` 은 diff 이전부터 존재(`git show origin/main:spec/5-system/14-external-interaction-api.md` 앵커 §1392 확인). WH-*/RR-PL-* 등 다른 ID 계열도 신규 부여 없음.
2. **엔티티/타입명 충돌** — 새 엔티티·DTO 없음. `TriggerParameterErrorDetail.code` 유니온에 `MASKED_VALUE_RESUBMITTED` 4번째 항이 추가됐을 뿐 기존 3개 값 재정의 없음. `grep -rn "MASKED_VALUE_RESUBMITTED\|masked_value_resubmitted"`(spec+codebase 전체)는 이 diff 가 만든 인용처만 나오고, diff 밖 사전 사용례·근접 동음이의(`RESUBMIT`/`resubmit` 계열)도 0건.
3. **API endpoint 충돌** — 새 endpoint 없음. `POST /executions/:id/re-run`(replay-rerun §8.1)·`POST /workflows/:id/execute`(manual-trigger) 모두 기존 정의를 재사용하고, 코드 diff(`executions.service.ts`/`workflows.controller.ts`)도 기존 호출부 내부 로직 교체일 뿐 새 라우트 추가가 아님을 확인.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 신규 도입 없음.
5. **환경변수·설정키 충돌** — 신규 ENV 없음. `tsconfig.build.json` 변경은 기존 `exclude` 배열에 `"src/repo-guards/**"` 항목을 추가한 것뿐이라 새 config key 가 아님.
6. **파일 경로 충돌** — 신규 spec 파일 없음(기존 7개 spec 편집만). 신규 backend 파일 6개는 기존 디렉토리 명명 컨벤션(kebab-case `*.ts`/`*-guard.ts`/`*.spec.ts`)을 그대로 따르며, `ls`로 확인한 기존 파일(`resolve-trigger-parameters.ts`, `eslint-unicorn-peer-guard.ts` 등)과 이름이 겹치지 않는다. 신규 plan 파일 2개(`plan/complete/spec-draft-inputoverride-marker-reject.md`, `plan/complete/spec-update-masked-reject-framing.md`)도 기존 plan 파일명과 충돌 없음.

## 이전 HIGH 발견(19_34_37)의 현재 상태 — 해소 확인

`19_34_37` 라운드는 re-run 경로가 `BadRequestException({..., errors: err.errors})` 로 던져
`GlobalExceptionFilter`(`details` 키만 인식)가 그 배열을 조용히 버리는 배선 공백을 HIGH 로
지적했다. 현재 HEAD(`codebase/backend/src/modules/executions/executions.service.ts:499-511`)를
직접 열어 재확인한 결과, 이미 `details: toTriggerParameterErrorDetails(err.errors)` 로
교정돼 자매 호출부(`workflows.controller.ts`)와 동일한 봉투 형태를 쓰고 있다 — 이 지적은
살아있지 않다(신규 식별자 충돌은 아니었으나 이 카테고리의 신뢰도를 위해 재확인 기록).

## 요약

target 이 새로 도입하는 식별자 클러스터(`MASKED_VALUE_RESUBMITTED`/`masked_value_resubmitted`
및 그 소비 함수·파일·부산물 가드 2개)는 spec 전체·codebase 전체 grep 기준으로 기존 사용처와
값·키 어느 축에서도 충돌하지 않는다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/
설정키·spec 파일 경로 6개 축 모두 신규 도입 항목이 없거나(엔드포인트는 기존 재사용), 유일한
신규 항목도 충돌이 없다. 이전 라운드가 HIGH 로 지적했던 배선 공백(re-run 의 `errors`→`details`
누락)도 현재 HEAD 코드에서 교정 완료가 실측으로 확인됐다.

## 위험도

NONE
