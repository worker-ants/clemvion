# 요구사항(Requirement) 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 방법

핵심 런타임 코드를 diff 뿐 아니라 전체 파일로 직접 열어 대조했다:
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` (신규)
- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (`reRun`)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute`)
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (+ spec)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` + `.spec.ts`
- `codebase/backend/src/common/filters/http-exception.filter.ts` (`details` 소비 확인)
- `codebase/frontend/src/lib/utils/masked-markers.ts` (프런트 미러 대조)
- spec: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6·Rationale, `spec/5-system/3-error-handling.md`,
  `spec/5-system/12-webhook.md`, `spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md` §R17
- `plan/complete/spec-draft-inputoverride-marker-reject.md`, `plan/complete/spec-update-masked-reject-framing.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md`

이번 diff 는 이미 6개 리뷰 라운드(`00_03_57`~`02_49_22`)를 거쳐 CRITICAL 1건(boolean 마커 완전
우회) + WARNING 다수(호출부 중복·`isPlainRecord` 재구현·`errors`→`details` 봉투 유실·spec 서술
3곳 stale·repo-guard 자체 결함 3종·가드 우회 형태 3종)를 해소한 상태로, 그 RESOLUTION 문서들의
주장을 실코드·실spec 과 직접 대조해 재검증했다. 나머지 `review/code/**` 71개 파일은 과거 라운드의
산출물이 그대로 커밋에 실린 것이라 이번 라운드의 재검토 대상이 아니다(각 라운드가 이미 자기
자신을 다뤘다).

## 발견사항

CRITICAL/WARNING 없음 — 아래는 확인 결과 기록(INFO)이다.

- **[INFO]** `masked_value_resubmitted` 의 두 검사 시점(raw 우선 → resolve → 재검사)이
  `1-manual-trigger.md` §6 표·Rationale 서술과 정확히 일치함을 확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `resolveTriggerParametersRejectingMasked`(56~75행) vs
    `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표 행(`masked_value_resubmitted`) 및
    `## Rationale` 절("검사 시점 — raw 우선 + resolve 후 재검사")
  - 상세: 이전 라운드(`00_39_27`)가 짚었던 "spec 이 '직후' 한 지점만 지시"하던 SPEC-DRIFT 는
    `plan/complete/spec-update-masked-reject-framing.md`(planner 턴, status: complete)로 이미
    정정돼 있고, 정정된 문장이 코드의 실제 2단계 검사(① `findMaskedResubmissions(schema,
    rawSource, rawSource)` → `throwIfAny` → ② `resolveTriggerParameters` → `findMaskedResubmissions(...,
    resolved)` → `throwIfAny`)와 line-level 로 대응한다. 표에 문서화된 `webhook·schedule` 제외
    범위도 `hooks.service.ts:183`·`schedule-runner.service.ts:78,88` 가 여전히 base
    `resolveTriggerParameters` 를 직접 호출함(grep 재확인)과 일치한다.
  - 제안: 조치 불요 — 확인용 기록.

- **[INFO]** 에러 봉투 필드(`errors`→`details`) 교정이 `GlobalExceptionFilter` 실코드와
  spec `manual-trigger §6` "응답 봉투" 서술 양쪽과 일치함을 확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts`(`details:
    toTriggerParameterErrorDetails(err.errors)`) vs
    `codebase/backend/src/common/filters/http-exception.filter.ts:73`(`details = resp.details ??
    nested?.details;` — `errors` 키는 어디에서도 읽지 않음)
  - 상세: CHANGELOG·RESOLUTION 문서가 주장하는 "종전 `errors` 키는 필터가 읽지 않아 필드별
    내역이 조용히 버려졌다"는 서술을 필터 실코드로 직접 확인했다 — 실제로 `resp.errors` 참조가
    코드에 전혀 없다. 회귀 테스트(`executions-rerun.service.spec.ts` "[회귀] 거부 응답이
    details[] 로...")도 `body.errors` 가 `undefined` 임을 명시적으로 단언해 재발을 막는다.
  - 제안: 조치 불요.

- **[INFO]** 프런트 마커 미러(`masked-markers.ts`)와 서버 판정(`reject-masked-resubmission.ts`)의
  세 경계(마커 리터럴 3종·정확 일치 전용·`MAX_REDACT_DEPTH`/`MAX_MARKER_SCAN_DEPTH`=10·값 검사가
  깊이 검사보다 선행)가 문자 그대로 대칭임을 확인
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts`(`scanForMarker`) vs
    `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`(`hasMaskedLeaf`)
  - 상세: 두 함수 모두 "값 검사 → 깊이 상한 검사 → 배열/객체 재귀" 순서, 상한 정확히 10,
    `isMaskedMarker` 의 정확 일치(substring 아님) 규칙이 동일하다. 이 대칭이 깨지면 한쪽만
    마커를 못 알아보는 fail-open 이 생기는데(이 시리즈가 반복해 겪은 패턴), 현재는 어긋남이
    없다.
  - 제안: 조치 불요. 다만 두 파일 모두 docstring 에 "다른 쪽을 함께 갱신하라" 경고만 있고
    자동 동기화 가드는 없다 — 기존에 이미 인지된 트레이드오프(사람이 grep 으로 찾는 것을
    전제)이므로 새 지적으로 등재하지 않는다.

- **[INFO]** repo-guard(`masked-reject-callers-guard.ts`)의 세 가지 import 형태 탐지
  (named/namespace/`require`)와 접두 겹침 회피(`resolveTriggerParametersRejectingMasked` 오탐
  방지)가 실제로 정규식·캐너리 테스트로 뒷받침됨을 직접 대조 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수
    `importsBaseFn`(86~107행) vs `masked-reject-callers.spec.ts` `it.each` 캐너리(111~123행)
  - 상세: `\b${BASE_FN}\b(?![A-Za-z0-9_])` 류 경계 정규식이 `resolveTriggerParametersRejectingMasked`
    를 오탐하지 않는 이유(단어 경계 미형성)를 직접 검증했고, `stripCommentsAndStrings` 전처리로
    JSDoc `{@link}`/swagger description 오탐(초판 결함)이 걷힘을 확인했다. 현재 `hooks.service.ts`·
    `schedule-runner.service.ts` 만 허용목록에 있고 실제로 base 를 import함(죽은 항목 캐너리로
    보증)을 grep 재확인했다.
  - 제안: 조치 불요. (참고: 가드는 named/namespace/require 세 형태만 보고 동적 `import()`,
    re-export 배럴 경유 간접 호출은 스코프 밖이나, 리뷰어 스스로 그 경계를 문서화했고 현재
    실제 호출부 2곳 모두 정상 형태다 — 새 지적 아님.)

- **[INFO]** `TODO`/`FIXME`/`HACK`/`XXX` 주석 없음 — 신규 파일 5개(`reject-masked-resubmission.ts`
  및 spec, `masked-reject-callers-guard.ts` 및 spec, `trigger-parameter.types.ts` 변경분) 전수
  grep 확인.

## 요약

핵심 요구사항("egress 마스킹 마커가 Manual 실행 경로(re-run `inputOverride`, execute
`parameterValues`/`input.parameters`)로 재제출되면 서버가 400 `MASKED_VALUE_RESUBMITTED` 로
거부한다")이 코드·테스트·spec 세 층에서 line-level 로 정합하게 구현돼 있다. 검사 시점(raw 우선
→ resolve → 재검사)이 boolean 완전 우회·number 안내 오선점·`defaultValue` 과잉 차단 세 갈래를
모두 막는 구조로 되어 있고 각각 회귀 테스트가 있다. webhook·schedule 은 의도적으로 대상에서
제외되어 있으며 그 경계를 repo-guard 가 CI 시점에 강제한다. 에러 응답 봉투의 선존 결함
(`errors`→`details` 소실)도 함께 교정돼 `GlobalExceptionFilter` 실코드와 일치한다.
`plan/complete/spec-update-masked-reject-framing.md` 가 정리한 spec 정정(검사 시점 "전후 2단계",
"재제출뿐 아니라 Manual 실행 전체") 역시 대상 spec 문서 4곳에 실제로 반영되어 있음을 직접
확인했다. CRITICAL·WARNING 없음 — 독립 재검증 결과 기존 6라운드의 수렴 판정에 동의한다.

## 위험도

NONE
