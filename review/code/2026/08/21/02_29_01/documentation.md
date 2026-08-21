# 문서화(Documentation) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (누적 diff, 6라운드째)

## 검토 범위

`git diff origin/main...HEAD` 는 124개 파일(+10596/-25)이며, 이 중 실질 애플리케이션 코드는
8~10개 파일(핵심: `reject-masked-resubmission.ts`/`.spec.ts`, `masked-reject-callers-guard.ts`/
`.spec.ts`, `trigger-parameter.types.ts`, `executions.service.ts`, `workflows.controller.ts`,
`sanitize-error-message.ts`)이고 나머지는 CHANGELOG·spec 7곳·plan 문서·이전 5라운드
(`00_03_57`~`02_04_38`)의 review/consistency 산출물이다. 프롬프트가 diff 를 생략한 핵심 신규
파일(`reject-masked-resubmission.ts`, `masked-reject-callers-guard.ts`)은 `Read` 로 전체 파일을
직접 열어 확인했고, spec 정정 대상으로 지목된 4곳(`3-error-handling.md:193`,
`12-webhook.md:312`, `1-data-model.md:471`, `1-manual-trigger.md` §6)은 현재 상태를 직접
grep/Read 로 대조했다.

이전 다섯 라운드가 이미 CRITICAL 1건(boolean 완전 우회 — 검사 시점) + WARNING 다수(호출부
중복·`isPlainRecord` 재구현·`errors`→`details` 유실·spec 서술 3곳 stale·가드 자체의 결함 3종)를
전부 수정·재검증했고, 직전 라운드(`02_04_38`)는 CRITICAL 0 / WARNING 0 으로 수렴했다. 이번
라운드는 그 수렴 상태가 실제로 유지되는지와, 그간 다른 관점(보안·유지보수성·부작용)이
집중적으로 훑은 자리 대신 문서화 고유 관점(공개 API 문서·JSDoc·주석 정확성)에서 남은 갭이
있는지를 확인하는 데 집중했다.

## 발견사항

- **[INFO]** `re-run.dto.ts` 의 Swagger `description` 이 실제로는 더 이상 쓰이지 않는 함수명을
  인용하고, 이번에 추가된 마커 거부 제약도 언급하지 않는다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `ReRunRequestDto.inputOverride`
    (`@ApiPropertyOptional({ description: 'useOriginalInput=false 일 때 사용할 입력. Manual
    Trigger parameters 스키마와 호환 (resolveTriggerParameters 검증)', ... })`)
  - 상세: 이 필드는 이제 `resolveTriggerParameters` 가 아니라 `resolveTriggerParametersRejectingMasked`
    로 검증된다(`executions.service.ts` — `resolveTriggerParametersRejectingMasked(schema,
    dto.inputOverride ?? {})`). Swagger 설명이 인용하는 함수명이 코드 사실과 어긋나 있고,
    "마스킹 마커 세 문자열(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)은 값 자리에서 예약어이며
    정확히 일치하면 400 으로 거부된다"는, 이 PR 이 API 직접 호출자를 겨냥해 도입한 바로 그
    제약이 OpenAPI 문서 표면에는 드러나지 않는다. `workflows.controller.ts` 의
    `execute()` 도 동일 패턴이다(`@ApiBadRequestResponse({ description: '트리거 파라미터
    검증 실패' })`, 마스킹 재제출 사유는 언급 없이 일반화됨).
  - 상태: 이전 라운드(`01_38_26` RESOLUTION 미조치 INFO #5)에서 이미 등재됐고 "기존 문서화
    관행과 일치·저장소 밖 소비자 부재 확인됨·다음 DTO 편집 기회"로 조치 불요 판정을 받았다.
    이번 라운드에서 다시 확인한 결과 그 판정의 근거(외부 소비자 부재)는 여전히 유효해
    보이므로 재차 블로킹으로 올리지 않는다 — 다만 함수명 자체가 코드와 어긋난 부분은 다음에
    이 DTO 를 편집할 기회에 `resolveTriggerParametersRejectingMasked` 로 갱신하며 함께
    정리하는 것을 권한다.
  - 제안: 조치 불요(non-blocking, 이월). 다음 `re-run.dto.ts`/`workflows.controller.ts` 편집
    시 설명 문구에 "마스킹 마커 정확 일치 값은 거부됨(EIA §R17)"을 한 줄 추가하고 함수명
    참조를 갱신할 것.

- **[INFO]** `workflows.controller.ts` 의 같은 `try/catch` 블록 안에 신규 한국어 인라인
  주석과 기존 영어 인라인 주석이 언어를 달리해 공존한다 (재확인, 여전히 존재)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 신규 주석
    (`// 마스킹된 값이 그대로 재제출됐는가 — 프런트 가드(EIA §R17)의 서버측 2층. ...`)
    바로 아래 미변경 컨텍스트 (`// `details` so GlobalExceptionFilter surfaces the
    per-field breakdown in the official envelope's `error.details[]` ...`)
  - 상세: 이 diff 가 새로 만든 문제는 아니며(영어 줄은 컨텍스트 라인, 미변경), 이전 두
    라운드(`00_03_57` maintainability, `01_38_26` documentation)에서 이미 INFO 로 등재되고
    조치 불요로 처분된 항목이다. 실물 코드로 재확인한 결과 여전히 그대로 남아 있다. 이
    저장소 최근 커밋 대다수가 서술형 근거 주석을 한국어로 수렴시키는 추세라, 다음에 이
    블록을 여는 사람이 어느 언어로 이어써야 할지 판단 근거가 없다는 지적은 유효하다.
  - 제안: 필수 아님(3라운드 연속 동일 판정). 다음에 이 블록을 편집할 기회가 있으면 영어
    줄도 한국어로 통일 검토.

- **[INFO]** spec 정정 대상 4곳(§R17 표 행 · `3-error-handling.md` · `12-webhook.md` ·
  `1-data-model.md` · `1-manual-trigger.md` §6)이 실제로 정확히 반영되어 있음을 확인 — 발견사항
  아니라 검증 결과로 기록
  - 위치: `spec/5-system/3-error-handling.md:193`, `spec/5-system/12-webhook.md:312`,
    `spec/1-data-model.md:471`, `spec/4-nodes/7-trigger/1-manual-trigger.md:170,197-210`
  - 상세: `plan/complete/spec-update-masked-reject-framing.md` 가 지목한 "재제출 경로 한정"
    → "Manual 실행 경로 한정(저작 주체 기준)" 정정과 "`resolveTriggerParameters` 직후" →
    "전후 2단계(raw 우선 → resolve → 재검사)" 정정 모두 현재 spec 본문에 정확히 반영돼
    있다. `spec/5-system/14-external-interaction-api.md:1669` 표에 남아 있는 "재제출
    경로였으나…" 문구는 별개 맥락(REST 마스킹이 왜 재실행 오염을 안 일으키는지 설명하는
    역사적 서술)이라 이 정정 대상과 혼동할 것이 아니며, 오독 위험도 없다.
  - 제안: 없음(확인만).

- **[INFO]** 핵심 신규 파일(`reject-masked-resubmission.ts`, `masked-reject-callers-guard.ts`)의
  JSDoc 이 실제 소비처·경계와 정확히 일치함을 확인
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    (`resolveTriggerParametersRejectingMasked`·`findMaskedResubmissions`·`hasMaskedLeaf` 상단
    docstring), `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    (`ALLOWED_DIRECT_CALLERS`·`importsBaseFn` docstring)
  - 상세: "이 함수를 쓰는 곳은 re-run 과 `POST /workflows/:id/execute` 둘뿐" 서술을
    `executions.service.ts:499`/`workflows.controller.ts:317` 실제 호출부와 대조해 정합함을
    확인했고, `hooks.service.ts`/`schedule-runner.service.ts` 가 base 를 계속 직접 호출한다는
    서술도 grep 으로 재확인했다. `frontend/src/lib/utils/masked-markers.ts` 크로스레퍼런스
    (`sanitize-error-message.ts` JSDoc)도 실제 파일·3개 소비처(폼 프리필·Re-run 모달·에디터
    히스토리)와 정확히 일치한다. 문서화 수준이 이 시리즈 중에서도 특히 높다.
  - 제안: 없음(확인만).

## 요약

핵심 코드(`reject-masked-resubmission.ts`, `masked-reject-callers-guard.ts`, `trigger-parameter.types.ts`
증분)의 JSDoc/인라인 주석은 "왜 필요한가·범위·왜 이 순서인가·경계 두 가지"를 코드 옆에
근거와 함께 남기고, 크로스레퍼런스(프런트 미러 경로·호출부 목록)를 실물 코드로 대조해도
전부 정합했다. spec 7곳도 이전 라운드가 지적한 stale 서술(검사 시점·범위 프레이밍) 4곳이
모두 정확히 정정됐음을 이번에 직접 재확인했다. CHANGELOG 는 최상단에 배치되어 이번 기능의
의도·근거·기각한 대안을 요약하고 있다. 새 환경변수·설정 옵션·README 대상 변경은 없어 해당
항목은 대상 외다. 남는 항목은 전부 3~5라운드 전부터 반복 확인된 INFO 두 건(Swagger 설명의
stale 함수명 인용/제약 미노출, try/catch 블록 내 한/영 주석 혼재)뿐이며 둘 다 이 diff 가
새로 만든 문제가 아니고 이전 라운드에서 명시적 근거로 조치 불요 판정을 받았다 — 이번
라운드에서도 그 판정을 뒤집을 새 근거는 찾지 못했다.

## 위험도

NONE
