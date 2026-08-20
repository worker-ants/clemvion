# 문서화(Documentation) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (9라운드 누적, 04_20_10)

## 검토 범위·방법

`git log`로 라운드 이력을 대조한 결과 이 브랜치는 이미 8차례 코드 리뷰
(`00_03_57`~`03_14_16`, 문서화 관점만 7회)를 거쳤고, 각 라운드가 CRITICAL·WARNING을
실코드로 재검증·처분해 왔다. 이번 프롬프트에 실린 163개 "파일" 중 대다수
(`review/code/2026/08/21/00_03_57/**` ~ `03_14_16/**`, `review/consistency/**`)는
이전 라운드 산출물이 이번 커밋에 실린 것뿐이라 문서화 재검토 대상이 아니다.

`git diff origin/main...HEAD --stat`로 실제 브랜치 diff를 확인한 결과, 직전 문서화 리뷰
(`03_14_16`) 이후 **신규 커밋은 `e9b942b08` 하나뿐**이고, 실질 코드 변경은
`masked-reject-callers-guard.ts`(정규식→AST 판정으로 재설계) · `masked-reject-callers.spec.ts`
(캐너리 8→15) · `tsconfig.build.json`(`src/repo-guards/**` 빌드 제외 추가) 세 파일에
국한된다. `git show e9b942b08`로 diff를 직접 확인했고, 핵심 프로덕션 파일
(`reject-masked-resubmission.ts`, `trigger-parameter.types.ts`, `sanitize-error-message.ts`,
`executions.service.ts`, `workflows.controller.ts`)과 `re-run.dto.ts`, `CHANGELOG.md`도
현재 파일 상태를 `Read`/`grep`으로 직접 대조했다.

## 발견사항

- **[INFO]** (신규 확인, 조치 불요) 정규식→AST 전환의 문서화가 코드와 정확히 정합한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`
    함수 `importsBaseFn` 상단 JSDoc, `ALLOWED_DIRECT_CALLERS` 배열의 신규 주석 3줄
    (base 모듈 자신을 선언 식별자로 등재하는 이유)
  - 상세: JSDoc이 옛 주석의 단언("문법 표면이 좁다")이 네 번 반증된 경위, AST로 전환한
    판정 기준 두 줄(식별자 위치의 `BASE_FN` / element access의 문자열 인자), 부수 효과
    (`stripCommentsAndStrings` 소멸·접두 겹침 자동 해결)를 표와 함께 남겼다. 실제 구현
    (`ts.createSourceFile` + `ts.forEachChild` 방문, `ts.isElementAccessExpression` 분기)과
    직접 대조한 결과 서술과 정확히 일치한다. `resolveTriggerParameters`(base 모듈 선언
    자체)가 `ALLOWED_DIRECT_CALLERS`에 새로 등재된 이유("AST는 선언 이름도 식별자로
    본다")도 코드 동작과 일치함을 확인했다. 발견사항이 아니라 검증 결과로 기록.
  - 제안: 없음.

- **[INFO]** (신규 확인, 조치 불요) `tsconfig.build.json`의 신규 제외 패턴 주석이 근거를
  정확히 서술한다
  - 위치: `codebase/backend/tsconfig.build.json` — `"src/repo-guards/**"` 제외 항목의
    인라인 주석
  - 상세: "`*-guard.ts`는 `*spec.ts` 패턴에 안 걸려 dist로 나가고 있었다" · "devDependency인
    `typescript`를 import하면서 오염이 실제 위험이 됐다"는 서술이 실물과 일치한다
    (`masked-reject-callers-guard.ts`가 `import * as ts from 'typescript'`를 추가했고,
    `package.json`에서 `typescript`는 `devDependencies`에만 있음을 확인). 커밋 메시지도
    같은 근거(클린 빌드 후 dist 내 `require("typescript")` 0건, ratchet은 `tsconfig.json`
    사용이라 사각지대 없음)를 남겼다. 발견사항이 아니라 검증 결과로 기록.
  - 제안: 없음.

- **[INFO]** (이월, 5개 라운드째 동일 판정 — `01_15_47`부터) `ReRunRequestDto.inputOverride`
  Swagger `description`이 마스킹 마커 예약어 제약을 언급하지 않는다
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `inputOverride`
    필드 `@ApiPropertyOptional({ description: ... })` (이번 PR이 건드리지 않은 기존 줄,
    함수/필드명으로 특정: `ReRunRequestDto.inputOverride`)
  - 상세: 현재 문구("useOriginalInput=false 일 때 사용할 입력. Manual Trigger parameters
    스키마와 호환 (resolveTriggerParameters 검증)")를 실물로 재확인했다. `'***'`/
    `'[REDACTED]'`/`'[REDACTED_DEPTH]'`가 값 자리에서 예약어가 되어 400
    (`MASKED_VALUE_RESUBMITTED`)으로 거부된다는 사실을 담지 않을 뿐 아니라, 언급하는
    검증 함수명(`resolveTriggerParameters`)도 실제로는 `resolveTriggerParametersRejectingMasked`
    로 바뀌어 있어 **약하게 stale**하다(base 함수도 여전히 내부적으로 쓰이므로 완전히
    틀린 것은 아니나, 재제출 거부 규칙은 이 문구만 보고는 알 수 없다). 신규 결함이 아니라
    `01_15_47`/`01_38_26`/`02_49_22`/`03_14_16` 네 라운드가 이미 같은 항목을 "다음 DTO
    편집 기회에"로 유예해 둔 것과 동일 상태.
  - 제안: 이번 PR 스코프 강제 사안 아님. 다음에 이 DTO 또는 execute body를 정식 DTO로
    승격할 기회에 `description`을 `resolveTriggerParametersRejectingMasked` 배선에 맞춰
    한 줄 갱신.

- **[INFO]** (이월, 4개 라운드째 동일 결론 반복 확인) `workflows.controller.ts` 신규
  한국어 인라인 주석과 인접한 기존 영어 인라인 주석이 같은 `try/catch` 블록에 공존
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — `execute`
    메서드의 `resolveTriggerParametersRejectingMasked` 호출 앞 한국어 주석 3줄, 바로 아래
    기존 영어 주석(`// `details` so GlobalExceptionFilter surfaces the per-field
    breakdown ...`, 컨텍스트 라인, 이번 diff 미변경)
  - 상세: 두 주석 모두 현재 코드와 정확히 일치한다(오래된/틀린 주석 아님) — 순수 스타일
    불일치. `00_03_57`/`01_38_26`/`02_49_22`/`03_14_16` 네 라운드가 모두 같은 지점을
    INFO로 이미 등재·유예했다.
  - 제안: 필수 아님. 다음에 이 블록을 편집할 기회가 있으면 함께 한국어로 통일.

## 검증한 항목 (문제 없음)

- `reject-masked-resubmission.ts` 전체를 재독해 docstring이 실제 구현(raw 우선 검사 →
  resolve → resolve 후 재검사, 값 검사가 깊이 검사보다 먼저, `MAX_REDACT_DEPTH` 상한
  공유, 대상 키는 `rawSource` 기준)과 정확히 일치함을 재확인했다.
- `resolveTriggerParametersRejectingMasked`의 docstring이 "이 함수를 쓰는 곳은 re-run과
  `POST /workflows/:id/execute` 둘뿐"이라고 서술한 것을 `grep`으로 재검증 — 실제 소비처는
  `executions.service.ts:499`, `workflows.controller.ts:317` 두 곳뿐이며, `hooks.service.ts`/
  `schedule-runner.service.ts`는 여전히 base `resolveTriggerParameters`를 직접 호출함을
  확인했다. 문서-코드 불일치 없음.
- `trigger-parameter.types.ts`의 `masked_value_resubmitted` 매핑 doc comment("`coerce_failed`
  재사용을 기각한 이유")가 현재 코드와 정합한다.
- `CHANGELOG.md` 최상단 항목이 raw/resolve 2단계 검사, webhook·schedule 제외 근거,
  `errors`→`details` 선존 버그 교정을 정확히 서술하며 실제 코드와 어긋나지 않는다.
  라운드8(가드 AST 전환)에 대한 CHANGELOG 별도 언급은 없으나, 이는 사용자에게 보이는
  동작·API 계약을 바꾸지 않는 내부 test-only repo-guard 강화라 이 저장소의 기존 관례
  (라운드4~7의 다른 가드 보강도 커밋 메시지에만 기록)와 일치한다 — 신규 결함 아님.

## 요약

이번 라운드에서 실제 신규였던 변경(`e9b942b08`, repo-guard 정규식→AST 재설계)의 문서화는
함수 JSDoc·spec docstring·커밋 메시지·`tsconfig.build.json` 인라인 주석 네 곳 모두에서
"무엇이 왜 틀렸는지 → 어떻게 다시 설계했는지"가 코드와 정확히 정합함을 직접 대조로
확인했다. 핵심 프로덕션 코드(거부 로직·타입 매핑·두 호출부·마커 상수 export)의 docstring,
CHANGELOG, spec 7곳은 이전 라운드들이 이미 실코드 대조로 검증을 마쳤고, 이번 재확인에서도
불일치가 발견되지 않았다. 새 환경변수·설정 옵션·API 엔드포인트 시그니처 변경은 없어
README/API 문서 업데이트 필요성도 해당 없음. 남은 항목은 4~5개 라운드째 동일하게
"조치 불요/다음 기회에"로 유예돼 온 이월 INFO 2건(Swagger description 미반영·언어 혼재
인라인 주석)뿐이며, 신규로 발견된 문서화 결함은 없다.

## 위험도

NONE
