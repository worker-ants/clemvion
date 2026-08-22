# 요구사항(Requirement) 리뷰 — `reRun` 입력 해석 블록 private 헬퍼 추출

## 검토 범위 및 방법

- `codebase/backend/src/modules/executions/executions.service.ts` — `ExecutionsService.reRun` 의 40줄 입력 해석 블록을 `resolveManualOverrideInput` private 헬퍼로 추출.
- `plan/complete/masked-marker-test-gaps.md`(신규, 이동), `plan/in-progress/masked-marker-test-gaps.md`(삭제), `plan/in-progress/rerun-input-resolution-extract.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(트래커 갱신) — plan 라이프사이클 문서.
- `review/consistency/2026/08/22/21_53_41/*` — 선행 consistency-check 산출물 (BLOCK: NO, WARNING 2건).
- 실측: `Read` 로 diff 전문 대조, `git show 95985e3ee --stat` 로 실제 변경 범위 확인, `npx jest src/modules/executions/executions-rerun.service.spec.ts`(20 passed) · `npx jest src/repo-guards/__tests__/masked-reject-callers.spec.ts`(15 passed) · `npx jest src/modules/executions`(138 passed, 9 suites) 실행, `npx tsc --noEmit`(이 파일 관련 에러 0건 — 잔여 에러는 carousel/chart/table 핸들러 스펙으로 diff 밖 선존 이슈) 확인.

## 발견사항

- **[INFO]** 순수 추출(pure extract-method) 리팩터로 동작 변경 없음 — 확인됨.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:483-490` (호출부), `:546-583` (`resolveManualOverrideInput`)
  - 상세: 이전 인라인 블록(스키마 로드 → `resolveTriggerParametersRejectingMasked` → `TriggerParameterValidationException` 캐치 → `BadRequestException({code:'INVALID_TRIGGER_PARAMETERS', message:'Invalid input override', details: toTriggerParameterErrorDetails(err.errors)})` → `{__triggerSource:'manual', parameters}` 조립)와 추출된 `resolveManualOverrideInput`을 라인 단위로 대조한 결과 에러 코드·메시지·`details` 필드·예외 재던짐·반환 봉투 shape이 문자 그대로 동일하다. `useOriginal` 판정(`dto.useOriginalInput ?? true`)과 `inputModified` 계산은 호출부에 그대로 남아 기본값 이중화 위험이 없다(plan 문서가 명시한 설계 의도와 일치). 자매 호출부 `workflows.controller.ts:324-326`도 동일 `code`/`details` 형태를 유지하고 있어 "자매 호출부와 같은 코드" 주석 주장이 사실과 일치한다.
  - 관련 spec: `spec/5-system/13-replay-rerun.md` §8.1(에러 코드 표, line 246: `INVALID_TRIGGER_PARAMETERS` + `error.details[]`), §8.2(`inputModified` 정의, line 452). 코드가 두 규정과 line-level로 일치.
  - 제안: 없음 (문제 없음, 참고용 기록).

- **[INFO]** 테스트 커버리지가 추출된 코드 경로를 실제로 통과함 — 확인됨.
  - 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` (`useOriginalInput=false` 분기, `INVALID_TRIGGER_PARAMETERS`/`details[]` 회귀 테스트, `[캐너리] inputOverride 에 마스킹 마커가 실리면 거부한다`)
  - 상세: 실행 결과 20/20 통과. `masked-reject-callers.spec.ts`(AST 기반 base-fn 직접 호출 가드)도 15/15 통과 — 이 가드는 파일 전체를 AST 스캔하므로 호출 지점이 `reRun` 본문에서 private 메서드로 이동해도 탐지 축(식별자 `resolveTriggerParameters`)이 그대로 유지된다(plan이 주장한 "가드가 무뎌지지 않는다"는 근거가 코드 구조상 타당함을 확인).
  - 제안: 없음.

- **[WARNING]** `plan/in-progress/rerun-input-resolution-extract.md` 의 작업 체크리스트가 실제 완료 상태를 반영하지 못함.
  - 위치: `plan/in-progress/rerun-input-resolution-extract.md:48-54` (`## 작업` 섹션 6개 항목: `/consistency-check --impl-prep`, `resolveManualOverrideInput` 추출, 뮤테이션 검증, 트래커 종결, `masked-marker-test-gaps.md` 체크박스 갱신, `complete/` 이동)
  - 상세: 커밋 이력(`95985e3ee`, `af0eb4031`)과 실측(`plan/complete/masked-marker-test-gaps.md` 존재 + 잔여 `- [ ]` 0건, `plan/in-progress/masked-marker-test-gaps.md` 부재, 트래커 `reRun` 항목 `[x]` 전환 확인, `95985e3ee` 커밋 메시지에 뮤테이션 3종 결과 명시)로 볼 때 이 6개 항목은 모두 실제로 완료됐다. 그런데 `rerun-input-resolution-extract.md` 자신의 체크리스트는 여전히 전항목 `[ ]` 다. 남은 `TEST WORKFLOW`·`/ai-review` 두 항목이 본 리뷰 실행 시점 기준 진행 중인 것은 자연스럽지만, 이미 끝난 상위 6개까지 미체크 상태로 방치하면 이 문서가 나중에 `complete/`로 이동할 때 "실제로는 이미 끝났던 작업"의 이력이 부정확하게 남는다. CLAUDE.md/`plan-lifecycle.md` 의 "체크박스 = 실제 상태(수행 후에만 체크)" 원칙과 어긋난다. (참고: consistency-check `21_53_41`의 plan_coherence WARNING #2 도 이 plan의 체크리스트 명시성 미비를 별도로 지적했으나, 그 지적은 `masked-marker-test-gaps.md`의 잔여 체크박스 처리 *하위 단계*가 목록에 없다는 것이었고, 본 발견은 그 상위 목록 자체가 완료됐음에도 미체크로 남아 있다는 점을 지적한다 — 관점이 다르다.)
  - 제안: 본 PR을 마무리하는 커밋에서 완료된 6개 항목을 `[x]`로 갱신할 것 (TEST WORKFLOW·`/ai-review` 완료 후 함께 갱신 가능).

- **[SPEC-DRIFT, 참고용 — 이번 diff 범위 밖]** `spec/5-system/13-replay-rerun.md` §8.1/§8.2 의 401 에러 코드가 `UNAUTHORIZED` 로 표기돼 있으나 규약(`spec/conventions`류 §1, `2-api-convention.md` §5.3, `3-error-handling.md` §1.2)은 `AUTH_REQUIRED` 다.
  - 위치: `spec/5-system/13-replay-rerun.md` §8.1(line ~240)·§8.2(line ~269) — 본 diff 파일 목록에 없어 게이트 인용 불가, section 표기로 대체.
  - 상세: 런타임(`http-exception.filter.ts:144-145`)은 이미 `AUTH_REQUIRED`를 내므로 코드는 옳고 spec 문서만 낡았다. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 developer 권한 밖(spec 편집은 `project-planner` 전담) planner-턴 항목으로 정확히 등재돼 있고, consistency-check `21_53_41` convention_compliance WARNING #1 과도 일치한다. 본 리뷰 대상 diff(`reRun` 리팩터)와는 무관한 선존 drift라 이 PR의 결함으로 카운트하지 않는다.
  - 제안: 코드 유지, spec 반영은 `project-planner` 턴에서 `spec/5-system/13-replay-rerun.md` §8.1·§8.2 의 `code` 열을 `UNAUTHORIZED` → `AUTH_REQUIRED` 로 정정.

## TODO/FIXME/HACK/XXX 스캔

diff 및 신규 파일에서 미완성을 시사하는 TODO/FIXME/HACK/XXX 주석 없음.

## 요약

`ExecutionsService.reRun` 의 40줄 입력 해석 블록을 `resolveManualOverrideInput` private 헬퍼로 뽑아낸 순수 추출(pure extract-method) 리팩터다. diff를 이전 코드와 라인 단위로 대조한 결과 에러 코드(`INVALID_TRIGGER_PARAMETERS`)·응답 봉투 필드(`details`)·검증 시점(raw 우선)·반환 shape(`{__triggerSource, parameters}`)이 한 글자도 바뀌지 않았고, `useOriginal` 판정과 `inputModified` 계산이 호출부에 남아 기본값 이중화 위험도 설계상 회피됐다. 실제 테스트 실행(reRun 스펙 20/20, masked-reject-callers 가드 15/15, executions 모듈 전체 138/138)과 타입체크로 무회귀를 확인했으며, spec(`13-replay-rerun.md` §8.1/§8.2)과 line-level 일치도 확인했다. 유일한 결함은 코드가 아니라 plan 문서 자체의 체크리스트 staleness(완료된 6개 항목이 여전히 `[ ]`)이며, 기능/스펙 충족도에는 영향이 없다. 별도로 발견된 401 에러 코드 spec drift는 이번 diff 범위 밖의 선존 이슈로 이미 올바르게 트래커에 등재돼 있다.

## 위험도
LOW
