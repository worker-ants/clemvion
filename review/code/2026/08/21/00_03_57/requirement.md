STATUS=success requirement review complete — 0 CRITICAL, 3 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — `inputOverride`/`parameterValues` 마스킹 마커 재제출 서버측 거부 (EIA §R17)

## 검토 방법

`codebase/backend/src/modules/execution-engine/{types,utils}/{trigger-parameter.types,reject-masked-resubmission}.ts`,
호출부 2곳(`executions.service.ts` re-run, `workflows.controller.ts` execute), `sanitize-error-message.ts` 의
`isMaskedMarker`/`MASKED_MARKERS` export 승격, 테스트 3벌을 코드 그대로 읽고 `resolveTriggerParameters`/
`coerceToType`(값 coercion 파이프라인)까지 추적했다. spec 쪽은 `spec/5-system/14-external-interaction-api.md`
§R17, `3-error-handling.md` §1.3/§1.7, `13-replay-rerun.md` §8.1/§10.2, `4-nodes/7-trigger/1-manual-trigger.md` §6,
`1-data-model.md` §2.13, `3-workflow-editor/3-execution.md` §2.2, `12-webhook.md` §5.2 diff 전체와 planner
draft(`plan/in-progress/spec-draft-inputoverride-marker-reject.md`)를 대조했다. 추가로:
- `npx jest reject-masked-resubmission.spec.ts executions-rerun.service.spec.ts workflows.controller.spec.ts` 실행 →
  3 suites / 59 tests 전부 통과.
- `npx tsc --noEmit` 실행 → 이 diff 가 건드린 파일 관련 타입 에러 없음(잔여 에러는 무관한 `carousel`/`chart`/`table`
  handler spec 들, 이 PR 이전부터 있던 것).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 `origin/main` 대비 `git diff` 로 대조.

## 발견사항

- **[WARNING]** `boolean` 타입 트리거 파라미터는 마스킹 마커 재제출 검사를 **완전히 우회**한다 — coercion 이 먼저 돌아 마커 문자열이 검사 전에 `true` 로 바뀐다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/coerce-type.ts:13-17` (`case 'boolean'`) +
    `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:16-34`
    (`isCoerceFailure` — `boolean` 은 어떤 입력에도 실패를 선언하지 않음) + 소비 지점
    `codebase/backend/src/modules/executions/executions.service.ts:497-500` ·
    `codebase/backend/src/modules/workflows/workflows.controller.ts:315-319`
    (둘 다 `resolveTriggerParameters` 로 **coerce 가 끝난 뒤의** `parameters` 를 `findMaskedResubmissions` 에 넘긴다)
  - 상세: `coerceToType(value, 'boolean')` 은 `typeof value === 'boolean'` 이 아니면
    `value === 'true' ? true : value === 'false' ? false : Boolean(value)` 로 **항상 성공**한다 —
    `'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'` 모두 truthy 문자열이라 `Boolean('***') === true` 로 조용히 변환된다.
    반면 `number`/`array`/`object` 타입은 `isCoerceFailure` 가 이 세 마커를 걸러 `coerce_failed` 로 막는다(다만
    이유 코드가 `TYPE_COERCION_FAILED` 라 이 PR 이 신설한 `MASKED_VALUE_RESUBMITTED` 안내와는 다르다). `boolean`
    은 두 층 모두 통과한다: coercion 도 실패로 안 잡고, `findMaskedResubmissions` 는 이미 `true` 로 바뀐 값을
    받으므로 마커 문자열 자체를 볼 기회가 없다(`isMaskedMarker` 는 `typeof v === 'string'` 을 요구).
    `sanitize-error-message.ts` 의 실제 마스킹(`deepRedactObject`, `CREDENTIAL_KEY_PATTERN` 매칭)은 **키 이름
    기반**이고 값의 타입을 안 가린다(`v !== '' && CREDENTIAL_KEY_PATTERN.test(k)` 면 타입 무관하게 `***` 로
    치환) — 즉 트리거 파라미터 이름이 `secret`/`token`/`apiKey` 같은 예약 패턴과 정확히 일치하면서 선언
    타입이 `boolean` 인 경우(드물지만 스키마가 막지 않음), egress 응답에서 그 값은 `***` 로 마스킹되는데
    재제출 시 이 가드가 놓친다 — 이 PR 이 `coerce_failed` 재사용을 명시적으로 기각한 이유("사용자가 취할
    행동이 다르다")가 `boolean` 타입에서는 **아예 적용되지 않고 조용히 통과**하는 형태로 깨진다.
  - 제안: `findMaskedResubmissions` 를 coercion **이전**의 raw override 값에 대해서도(또는 대신) 돌리거나,
    `isCoerceFailure`/`coerceToType` 의 `boolean` 분기에서 마커 리터럴 세 개는 먼저 걸러내도록 특별 취급.
    최소한 회귀 테스트 하나(`type: 'boolean'` 필드에 `'***'` 를 넣었을 때도 거부되는지)를 추가하면 이 경로가
    조용히 다시 뚫려도 잡힌다 — 지금 세 테스트 파일 모두 `string`/`object` 타입 필드만 사용한다.

- **[WARNING]** 가드가 `resolveTriggerParameters` 의 **완전히 resolve 된**(기본값 채움 포함) 출력을 검사해, 선언된 `defaultValue` 가 마커 리터럴과 우연히 일치하면 사용자가 손대지 않은 필드도 매 실행마다 거부된다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:122-128`
    (`effective = def.defaultValue ?? null` — optional 필드가 비어 있으면 기본값을 채운다) →
    `codebase/backend/src/modules/executions/executions.service.ts:497-500` /
    `codebase/backend/src/modules/workflows/workflows.controller.ts:315-319` 가 이 **resolve 후** 결과 전체를
    `findMaskedResubmissions` 에 넘긴다
  - 상세: `findMaskedResubmissions` 는 필드가 "사용자가 되보낸 값"인지 "서버가 채운 기본값"인지 구분하지
    않는다. 워크플로 작성자가 어떤 optional 트리거 파라미터의 `defaultValue` 를 정확히 `'***'`(또는
    `'[REDACTED]'`/`'[REDACTED_DEPTH]'`)로 설정해 두면(플레이스홀더 의도 등, 스키마가 막지 않음), 그 필드를
    사용자가 아예 건드리지 않은 정상 Manual 실행·재실행도 매번 `400 MASKED_VALUE_RESUBMITTED` 로 거부된다 —
    "마스킹된 읽기에서 되돌아온 값" 이 아닌데도 정확 일치라는 이유만으로 막힌다. spec §R17 은 "값 leaf 가
    마커와 정확히 일치하면 거부"라고만 적어(어느 시점의 leaf 인지 명시 안 함) 이 케이스를 배제하지 않는다.
  - 제안: 검사를 raw override(`dto.inputOverride`/`rawValues`)에 실제로 존재하는 키에만 적용하거나, 스키마
    저장 시점에 `defaultValue` 가 마커 리터럴과 일치하면 `invalid_schema` 로 막는 가드를 추가.

- **[WARNING]** 트래커 W6 체크박스가 **이 PR 이 곧 그 구현**인데도 여전히 `[ ]` 로 남아 있다 — 항목 자신이 적어 둔 종료 조건과 어긋난다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:328`
    (`- [ ] **`inputOverride` 서버측 마커 리터럴 거부**`)
  - 상세: 같은 항목 본문(343~345행)이 명시한다 — *"이 체크박스는 **구현이 머지될 때** 닫는다 — spec 명문화만으로
    닫으면 '가드가 있다' 로 오독된다."* 이 diff 는 정확히 그 구현(서버측 체크 두 곳 + `details[]` 배선 교정 +
    테스트)을 담고 있는데도 체크박스는 미갱신이다(`git diff origin/main -- plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에서 328행 인근에는 hunk 자체가 없음 — 실측 확인). 바로 아래 W5(352행)는 같은 세션에서
    `[x]` 로 갱신됐는데 W6 만 빠졌다 — MEMORY `feedback_plan_checkbox_actual_state.md` 가 지적해 온 "체크박스 ≠
    실제 상태" 패턴.
  - 제안: 같은 커밋에서 W6 을 `[x]` 로 갱신하고, 종결 근거로 이 구현 커밋/PR 을 인용한다(W5 가 닫힌 방식과 동형).

## 참고 (INFO)

- **[INFO]** `1-manual-trigger.md §6` "응답 봉투" 문장 및 reason 표는 최종 diff 에서 `masked_value_resubmitted`/
  `MASKED_VALUE_RESUBMITTED` 를 정확히 반영하고 있고, `23_33_00` 라운드가 지적한 "재제출 경로 한정" 범위
  서술 불일치(Manual JSON 에디터 자유편집도 거부 대상이라는 실제 범위와 어긋남)는 §R17 "가드의 범위 — Manual
  실행 경로 전체다" 캐비엇으로 이미 정정돼 있다 — 코드·spec 모두 이 넓어진 범위(재제출 여부와 무관하게 Manual
  파라미터 값 슬롯 전체에서 마커 세 문자열이 예약어)로 일관됐다. 발견사항 아님, 확인용 기록.

## 요약

핵심 요구사항 — 재제출 API 두 호출부(`executions.service.ts` re-run, `workflows.controller.ts` execute)에서
마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)와 정확히 일치하는 값 leaf 를 깊이 상한(`MAX_REDACT_DEPTH=10`)
까지 값 검사 우선 순서로 탐지해 `400`+`details[].code=MASKED_VALUE_RESUBMITTED` 로 거부하고, `useOriginalInput`
토글 시엔 검사를 건너뛰는 것 — 은 코드·spec(7개 문서, line-level) 모두에서 일관되게 구현·명문화됐고 실제
테스트(59개, 신규 3벌 포함)가 전부 통과하며 tsc 도 이 diff 범위에서 깨끗하다. re-run 호출부가 `errors` 대신
`details` 로 필드별 내역을 봉투에 싣도록 고친 선존 버그 교정도 회귀 테스트로 고정돼 있다. 다만 검사 대상이
"타입 coercion 이 끝난 뒤의 resolve 된 파라미터 전체"라서 두 가지 실질 엣지 케이스가 뚫려 있다 — ①
`boolean` 타입 필드는 마커 문자열이 coercion 단계에서 `true` 로 조용히 바뀌어 가드를 완전히 우회하고, ②
optional 필드의 `defaultValue` 가 마커 리터럴과 우연히 같으면 사용자가 손대지 않은 정상 실행도 매번 거부된다.
두 케이스 모두 이 PR 의 3벌 테스트가 다루지 않는 영역이라 회귀로 잡히지 않는다. 별개로, 이 PR 이 곧 그
구현이라고 스스로 적어 둔 트래커 W6 체크박스가 갱신되지 않아 plan 상태와 실제 상태가 어긋난다. 셋 다
차단급(CRITICAL)은 아니다 — 보안 관점에서 값이 새어나가는 방향이 아니라 반대(과다 차단/과소 차단)이고,
①은 시크릿 필드가 거의 항상 `string` 타입이라 실제 발생 확률이 낮으며, ③은 문서 위생 문제다.

## 위험도

MEDIUM
