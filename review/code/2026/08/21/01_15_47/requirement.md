# 요구사항(Requirement) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (3차 재검토, 01_15_47)

## 검토 범위

실질 프로덕션 코드 변경 8개 파일 (`trigger-parameter.types.ts` · `reject-masked-resubmission.ts`(신규)
· `reject-masked-resubmission.spec.ts`(신규) · `executions-rerun.service.spec.ts` ·
`executions.service.ts` · `workflows.controller.spec.ts` · `workflows.controller.ts` ·
`sanitize-error-message.ts`) + spec 7곳(`1-data-model.md` · `3-workflow-editor/3-execution.md` ·
`4-nodes/7-trigger/1-manual-trigger.md` · `5-system/12-webhook.md` · `5-system/13-replay-rerun.md`
· `5-system/14-external-interaction-api.md` · `5-system/3-error-handling.md`) + plan 3건. 나머지
(`review/code/2026/08/21/00_03_57/**`, `review/code/2026/08/21/00_39_27/**`,
`review/consistency/2026/08/20-21/**`)는 이전 두 라운드가 이미 검토·처분한 산출물이며, 이번 diff 는
그 처분 결과까지 포함한 브랜치 전체 누적분이다. 아래는 그 처분이 **실제 코드/spec에 반영됐는지**를
직접 소스를 열어 재검증한 결과다.

## 검증 방법

- `reject-masked-resubmission.ts`/`.spec.ts`, `trigger-parameter.types.ts`, 두 호출부
  (`executions.service.ts:493-514`, `workflows.controller.ts:311-328`)를 `Read` 로 직접 열어 diff 가
  아니라 최종 상태를 대조.
- `grep` 으로 `resolveTriggerParameters` 전 호출부(webhook `hooks.service.ts`, schedule
  `schedule-runner.service.ts`, execute/re-run)를 전수 확인해 webhook·schedule 이 실제로 신규 게이트를
  타지 않는지 확인.
- `GlobalExceptionFilter`(`http-exception.filter.ts:73`)가 `details` 만 읽는지 실코드로 확인.
- 프런트 마커 미러(`codebase/frontend/src/lib/utils/masked-markers.ts`)와 백엔드
  `MASKED_MARKERS`(세 마커: `***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 값 일치 확인.
- `npx jest reject-masked-resubmission executions-rerun.service.spec.ts workflows.controller.spec.ts`
  직접 실행 — 3 suites 전부 GREEN (20+47 = 67 tests pass).
- 이전 두 라운드가 지적한 CRITICAL 1건 + WARNING 다수가 실제로 반영됐는지 spec 본문·코드 라인을
  하나씩 재대조(아래 발견사항 참조).

## 발견사항

- **[INFO]** 이전 CRITICAL(`boolean` 파라미터 완전 우회)과 WARNING 전량이 실코드/spec에 반영돼 있음을
  직접 확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    (함수 `resolveTriggerParametersRejectingMasked`, raw 우선 검사 → `resolveTriggerParameters` →
    resolve 후 재검사 2단계 구조) · `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표
    (`전후 2단계` 로 정정됨) + `## Rationale` 절(`### masked_value_resubmitted 검사 시점`)
  - 상세: `rejectedFields` 헬퍼로 `boolean`/`number`/object-as-JSON-string/`defaultValue` 네 갈래를
    각각 캐너리로 고정한 스펙 테스트(`reject-masked-resubmission.spec.ts`)가 실제로 GREEN 이며,
    `hasMaskedLeaf` 는 스칼라 마커를 depth 0 에서 `coerceToType` 이전에 검사하므로
    `Boolean('***') → true` 우회 경로가 더 이상 존재하지 않는다. `isPlainRecord` 재구현
    (이전 WARNING)도 해소돼 `./to-record` 의 `isRecord` 를 그대로 import 한다(라인 11). 두 호출부의
    `find+length+throw` 중복(이전 WARNING)도 `resolveTriggerParametersRejectingMasked` 단일 호출로
    캡슐화돼 해소됨을 `executions.service.ts:499`·`workflows.controller.ts:317` 실물로 확인.
  - 제안: 조치 불요 — 확인 완료 기록.

- **[INFO]** 에러 봉투 선존 버그(`errors` 키로 던져 `GlobalExceptionFilter` 가 조용히 버리던 문제)가
  실제로 교정돼 있고 회귀 캐너리로 고정됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512`
    (`details: toTriggerParameterErrorDetails(err.errors)`), 회귀 테스트
    `executions-rerun.service.spec.ts` `[회귀] 거부 응답이 details[] 로 필드별 코드를 싣는다`
  - 상세: `GlobalExceptionFilter`(`http-exception.filter.ts:73`)는 `resp.details ?? nested?.details`
    만 읽고 `errors` 키를 전혀 참조하지 않음을 직접 확인 — 종전 `errors: err.errors` 는 봉투에서
    누락되는 사장(死藏) 필드였다. 교정 후 `body.errors` 는 `undefined`, `body.details` 에
    `{ field, code: 'MASKED_VALUE_RESUBMITTED', message }` 가 실린다는 것을 테스트가 명시적으로
    단언한다.
  - 제안: 조치 불요.

- **[INFO]** webhook·schedule 경로는 신규 거부 게이트를 타지 않음을 호출부 전수로 확인 (SPEC-DRIFT
  아님, spec 원칙과 정확히 일치)
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:183`
    (`resolveTriggerParameters(schema, input.body)`, 원본 함수 그대로), `codebase/backend/src/modules/schedules/schedule-runner.service.ts:78,88`
    (동일) — 대조군: `executions.service.ts:499`, `workflows.controller.ts:317` 만
    `resolveTriggerParametersRejectingMasked` 로 교체됨
  - 상세: `spec/5-system/14-external-interaction-api.md` §R17 캐비엇("webhook ingestion 과
    schedule 은 대상이 아니다 — 그쪽 body 는 외부 시스템이 저작하는 임의 페이로드")과 코드 docstring
    (`reject-masked-resubmission.ts` "## 범위 — Manual 실행 경로 한정")이 정확히 같은 근거를
    서술하고, 실제 호출 그래프도 그 경계를 지킨다.
  - 제안: 조치 불요.

- **[INFO]** spec 3문서("재제출 경로 한정" 프레이밍)의 정정이 실제로 적용돼 있음을 확인 —
  `spec-update-masked-reject-framing.md` 가 서술한 "→ 교체" 대상이 이미 반영된 최종 상태
  - 위치: `spec/5-system/3-error-handling.md:193`, `spec/5-system/12-webhook.md:312`,
    `spec/1-data-model.md:471` — 전부 `Manual 실행 경로 한정(저작 주체 기준)` 형태로 통일
  - 상세: `grep -n "재제출 경로" spec/**` 결과 0건 — 폐기된 프레이밍이 spec 본문에 잔존하지 않는다.
    선행 plan(`spec-draft-inputoverride-marker-reject.md:158-161`)의 stale "직후" 지시도 삭제가
    아니라 취소선 + 각주로 정정 이력이 남아 있음을 확인(RESOLUTION.md 서술과 일치).
  - 제안: 조치 불요. 다만 `plan/in-progress/spec-update-masked-reject-framing.md` 의 frontmatter
    `status: in-progress` 는 본문이 서술하는 정정(정정 1·2)이 이미 spec 실물에 반영된 상태와
    어긋난다 — plan 라이프사이클 관점의 사소한 stale 이므로 별도 plan 정리 턴에서 `complete/` 이동
    여부를 판단할 것(코드 결함 아님, 이번 라운드 조치 불요).

## 요약

이번 변경은 Manual 실행 진입점 두 곳(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`)에서
egress 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)가 그대로 재제출/입력되는 것을 서버측 2차
방어층으로 거부하는 기능을 완전히 구현한다. 핵심 요구사항 — raw 우선 검사(coerce 가 문자열을 지우기
전), resolve 후 재검사(JSON 문자열로 감싼 object/array 대응), 정확 일치만 판정(과잉 차단 방지), 깊이
상한을 마스커와 공유(off-by-one 방지), webhook/schedule 제외(공유 함수 오염 방지), `details[]` 로
필드별 사유 전달 — 이 전부 실코드·테스트·spec 본문에 line-level 로 일치함을 직접 대조했다. 이전
두 라운드가 잡은 CRITICAL 1건(boolean 완전 우회)과 WARNING 다수(호출부 중복, `isRecord` 재구현,
에러 봉투 `errors`→`details` 버그, spec 서술 3곳의 "재제출 경로 한정" stale 프레이밍, plan lineage
동기화)는 전부 실제 파일 상태로 재검증했으며 해소가 확인됐다. TODO/FIXME/HACK 마커 없음, 모든 에러
경로가 `TriggerParameterValidationException` → `BadRequestException({code, details})` 로 수렴해
반환값 누락 없음. 새로 발견된 CRITICAL/WARNING 은 없다.

## 위험도

NONE
