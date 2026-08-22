# Requirement Review — `19_36_12`

## 범위 요약

리뷰 대상 diff 는 실질적으로 **4개 backend 코드 파일의 주석/JSDoc/Swagger `description` 문자열 변경**(실행 코드 라인 0줄, `git diff --stat` 로 확인: `+39/-10`, 전부 comment/docstring 범위) + `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` 목록에 `executions.service.ts` 1줄 추가 + plan 트래커/신규 완료 plan 문서 갱신이다. 4개 코드 파일(`trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`, `re-run.dto.ts`, `workflows.controller.ts`)을 `Read` 로 전체 열어 diff 앞뒤 문맥과 실제 로직을 대조했고, 관련 spec(`1-manual-trigger.md §6`, `14-external-interaction-api.md §R17`, `12-webhook.md §5.2`, `3-error-handling.md §1.7`) 본문과 `codebase/packages/masked-markers/src/index.ts`, `reject-masked-resubmission.ts`, `executions.service.ts`, `common/filters/http-exception.filter.ts` 를 직접 열어 새 주석·Swagger 서술이 실제 동작과 line-level 로 맞는지 검증했다.

## 발견사항

- **[WARNING]** plan 문서가 아직 main 에 없는 spec 파일을 "이미 존재"하는 것처럼 단정해 트래커 기록을 생략했다 — 유예 근거 미실측(project 반복 패턴)
  - 위치: `plan/complete/masked-marker-cosmetic-followups.md:67-69`
  - 상세: `/consistency-check --impl-prep` 처분 기록에서 INFO ③(*"이번 diff 가 산문 지점 3곳을 늘렸다"*)을 트래커에 옮기지 않은 근거로 "신설 `egress-masking.md §3` 이 **이미** '기계가 지키지 않는다 + 알려진 stale 트리거' 를 소유하므로 트래커에 덧쓰면 충돌만 만든다" 고 적었다. 그러나 `spec/conventions/egress-masking.md` 는 이 worktree·`origin/main` 어디에도 없다 — `git show origin/main:spec/conventions/egress-masking.md` → `MISSING`. 이 파일은 **별도의, 아직 병합되지 않은 PR #1194**(`claude/egress-masking-convention-531f5b`, `gh pr view 1194` → `state: OPEN`, `mergedAt: null`)에만 존재하며, 그 PR 은 이 PR 과 **같은 base 커밋(`f65ca193c`)에서 갈라진 형제 브랜치**다(`git merge-base` 로 확인) — 병합 순서가 보장되지 않는다. 내용 자체(§3 제목·"기계가 지키지 않는다"·"알려진 stale 트리거" 문구)는 그 브랜치에서 실측해 정확히 일치함을 확인했으나, 시제(**"이미 소유"**)가 실제 병합 상태보다 앞서 있다. 이 PR(`masked-marker-cosmetic-followups`)이 #1194 보다 먼저 `main` 에 merge 되면(현재 상태가 그렇다 — 이 PR 은 이미 RESOLUTION.md·재리뷰까지 거친 반면 #1194 는 아직 review 초기 단계), `main` 기준으로는 그 §3 이 존재하지 않는 시점이 생기고 트래커에도 이 정보가 없어 "이번 diff 가 산문 지점 3곳을 늘렸다"는 사실을 아무도 추적하지 못하는 채로 이 완료 plan 은 `plan/complete/`(status: complete)로 봉인된다.
  - 제안: 병합 순서를 통제할 수 없으므로 낙관적 가정에 의존하지 말고, `spec-sync-external-interaction-api-gaps.md` 트래커에 "이번 diff 가 산문 지점 3곳 증가 — `egress-masking.md`(PR #1194, 미병합) 병합 시 흡수 예정, 병합 실패/철회 시 이 항목을 직접 기록" 형태로 **폴백을 남긴 채** 한 줄이라도 등재한다. 이미 `masked-marker-cosmetic-followups.md` 는 `status: complete` 로 봉인됐으므로 실제 수정은 `spec-sync-external-interaction-api-gaps.md`(in-progress, 계속 편집 가능) 쪽에 보강하는 것이 현실적이다.

- **[INFO]** 상기 WARNING 을 제외한 나머지 코드 변경 전부는 spec·구현과 line-level 로 일치 확인됨 (spec fidelity 통과)
  - 위치: 다음 각 항목
    - `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71` (`REASON_TO_DETAIL` JSDoc 4종) — `resolve-trigger-parameters.ts`(`missing_required`/`coerce_failed`)·`validateTriggerParameterSchema`(`invalid_schema`, 이름 중복/식별자 규칙/배열 아님/미지원 타입)·`reject-masked-resubmission.ts`(`masked_value_resubmitted`)의 실제 발생 조건과 정확히 일치하며 `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 표(164-172행)와도 일치.
    - `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:100-123` (docblock 전면 재작성, 영→한 통일) — `resolveTriggerParametersRejectingMasked` 가 실제로 `POST /workflows/:id/execute`(`workflows.controller.ts:317`)·`POST /executions/:id/re-run`(`executions.service.ts:499`) 두 곳에서만 호출되고 base(`resolveTriggerParameters`)는 직접 호출되지 않음을 grep 으로 확인. `repo-guards/__tests__/masked-reject-callers-guard.ts` 파일 실재 확인.
    - `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24` (Swagger `description`) — 마커 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)이 `codebase/packages/masked-markers/src/index.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 와 정확히 일치, `isMaskedMarker` 가 **정확 일치만** 판정(부분 일치 `a***b` 는 통과)한다는 서술도 구현과 일치. `dto.inputOverride ?? {}` 만 `resolveTriggerParametersRejectingMasked` 의 `rawSource` 로 전달되므로(`executions.service.ts:499-502`) "이 필드의 예약어" 라는 스코프 서술도 정확.
    - `codebase/backend/src/modules/workflows/workflows.controller.ts:320-322` (주석 영→한 통일) — `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts:73`)가 `details` 만 읽는다는 서술을 `http-exception.filter.ts` 로 직접 확인.
    - `spec/4-nodes/7-trigger/1-manual-trigger.md:10` (frontmatter `code:` 에 `executions.service.ts` 추가) — 해당 파일이 실제로 `resolveTriggerParametersRejectingMasked`/`TriggerParameterValidationException`/`INVALID_TRIGGER_PARAMETERS` 를 다루는 것을 확인(그 파일 499-517행), 직전 consistency-check WARNING(`19_03_59`, traceability gap)을 정확히 해소.
  - 제안: 없음 (조치 불요, 참고용 기록)

- **[INFO]** TODO/FIXME/HACK/XXX 계열 주석 없음, 반환값·에러 경로 누락 없음
  - 위치: 리뷰 대상 4개 코드 파일 전체
  - 상세: 4개 파일에 `TODO|FIXME|HACK|XXX` grep 매치 0건. `resolveTriggerParameters`/`resolveTriggerParametersRejectingMasked`/`toTriggerParameterErrorDetails` 모두 모든 분기에서 값 반환 또는 명시적 `throw` 로 종료되며 이번 diff 는 그 로직을 전혀 건드리지 않음(주석·문자열만 변경).
  - 제안: 없음

## 요약

리뷰 대상 4개 backend 코드 파일 변경은 **실행 로직을 전혀 바꾸지 않는 주석/JSDoc/Swagger 설명 전용 diff** 이며, 새로 추가된 모든 서술(마커 3종·정확 일치 판정·wrapper/base 역할 분리·`details` vs `errors` 배선·`REASON_TO_DETAIL` 4종 구분·에러 코드)을 실제 구현(`reject-masked-resubmission.ts`, `resolve-trigger-parameters.ts`, `executions.service.ts`, `http-exception.filter.ts`, `@workflow/masked-markers`)과 관련 spec 본문(`1-manual-trigger.md §6`, `14-external-interaction-api.md §R17` 등)에 대조한 결과 line-level 로 전부 일치했다 — 기능적 결함·spec 불일치·엣지 케이스 누락은 발견되지 않았다. 유일한 발견사항은 코드가 아니라 완료 plan 문서(`plan/complete/masked-marker-cosmetic-followups.md`)의 유예 근거 하나가 **아직 병합되지 않은 형제 PR(#1194)의 존재를 기정사실처럼 서술**해, 그 PR 의 병합 순서·성사 여부에 따라 "이번 diff 가 산문 지점을 3곳 늘렸다"는 추적 정보가 누구의 문서에도 남지 않을 위험을 만든다는 점이다(WARNING, project 의 반복 실패 패턴인 "유예 근거는 실측해야 한다" 에 해당).

## 위험도

LOW
