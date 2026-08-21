# 테스트(Testing) 리뷰 — 마스킹 마커 재제출 서버측 거부 (EIA §R17, Manual 실행 경로)

## 검토 범위

실질 코드 변경은 `codebase/` 하위 12개 파일(+1042/-11)이다. 프롬프트가 diff 를 생략한 5개
파일(`reject-masked-resubmission.ts`/`.spec.ts`, `masked-reject-callers-guard.ts`/
`.spec.ts`, `executions-rerun.service.spec.ts` 증분, `workflows.controller.spec.ts` 증분)은
`Read` 로 원본을 직접 열어 확인했다. 나머지(`review/code/**` 신규 산출물·CHANGELOG·spec·plan
문서)는 이전 라운드(`00_03_57`~`02_49_22`) 자기 자신의 기록이거나 문서 변경이라 테스트 관점
대상에서 제외했다.

핵심 스위트를 직접 실행해 확인함: `reject-masked-resubmission.spec.ts` /
`masked-reject-callers.spec.ts` / `executions-rerun.service.spec.ts` /
`workflows.controller.spec.ts` / `sanitize-error-message.spec.ts` /
`resolve-trigger-parameters.spec.ts` — **7 suites / 172 tests 전부 통과**(실측, stale
빌드 아님).

## 발견사항

- **[INFO]** `schema` 의 `null` 분기가 명시적으로 검증되지 않는다 (`undefined`/`[]` 만 테스트)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.spec.ts:142-149`
    (`'스키마가 없거나 비면 통과한다 (pass-through 호환)'`)
  - 상세: `resolveTriggerParametersRejectingMasked`/`findMaskedResubmissions` 시그니처는
    `schema: TriggerParameterDefinition[] | undefined | null` 을 받고 구현은
    `if (!schema || schema.length === 0) return [];` 로 세 형태(`undefined`/`null`/`[]`)를
    동일하게 처리한다(`reject-masked-resubmission.ts:120`). 테스트는 `undefined` 와 `[]` 만
    직접 호출하고 `null` 은 어느 테스트에서도 인자로 전달되지 않는다. `!schema` 가 `null` 도
    잡으므로 회귀 위험은 낮지만, 타입 시그니처가 명시적으로 `null` 을 허용한다고 선언하는
    이상 그 값이 실제로 안전한 경로를 타는지를 caller 문서가 아니라 테스트가 보증하는 편이
    낫다.
  - 제안: `it.each([undefined, null, []])` 형태로 세 값을 한 번에 매개변수화하면 이 시그니처가
    실제로 세 형태 모두를 pass-through 로 처리함을 명시적으로 고정할 수 있다.

- **[INFO]** `findMaskedResubmissions`(exported)를 직접 겨냥한 단위 테스트가 없다 — 전부
  `resolveTriggerParametersRejectingMasked` 래퍼 경유로만 커버된다
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts:115-130`
    (`export function findMaskedResubmissions(schema, rawSource, values)`)
  - 상세: 이 함수는 `rawSource` 와 `values` 를 **별도 인자**로 받아 "대상 키 집합은 raw 기준,
    검사값은 phase 별로 다르다" 는 계약을 갖는다. 현재 스펙 파일의 모든 케이스는
    `rejectedFields()` 헬퍼를 통해 `resolveTriggerParametersRejectingMasked(schema, raw)` 만
    호출하므로 `rawSource !== values` 인 조합(예: raw 에는 있지만 resolve 결과에서 값 자체가
    사라진 필드, 혹은 raw 는 마커가 아니지만 임의로 다른 `values` 를 넘기는 경우)은 wrapper 의
    내부 두 단계 호출(①raw==values, ②rawSource=raw/values=resolved)로만 간접 커버된다.
    함수가 `export` 로 공개돼 있어 독립적으로 재사용될 여지를 열어 둔 만큼, 직접 호출하는
    테스트가 있으면 그 계약(대상 키는 항상 raw 기준)이 wrapper 구현 세부사항과 무관하게
    고정된다.
  - 제안: 현재 커버리지로도 실질 회귀 위험은 낮다(두 phase 조합이 이미 그 계약을 왕복 검증).
    다음에 이 함수가 세 번째 소비처를 얻게 되면 그때 직접 단위 테스트를 추가하는 정도로 충분.

- **[INFO]** `stripCommentsAndStrings`(exported)에 대한 직접 단위 테스트가 없다 — `importsBaseFn`
  경유로만 간접 검증
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:116-123`
  - 상세: 이 가드는 자신의 docstring(66-71행, 87-90행)에서 "초판이 주석·문자열 안의 텍스트를
    실제 import 로 오판했다" 는 구체적 과거 결함을 두 차례 서술한다 — 즉 이 전처리 함수의
    정확성이 가드 전체의 신뢰도에 직결된다는 것을 스스로 인지하고 있다. 그런데 현재
    `masked-reject-callers.spec.ts` 는 이 함수를 직접 호출하는 테스트가 없고, `importsBaseFn`
    을 통한 간접 케이스(named/namespace/require 세 형태, JSDoc 예시 오탐 방지)로만 그 효과를
    확인한다. 이스케이프된 따옴표(`'it\'s ... resolveTriggerParameters ...'`)나 따옴표를 포함한
    블록 주석처럼 정규식 전처리가 실패하기 쉬운 입력이 회귀했을 때, 그 실패가
    `importsBaseFn` 결과에 가려 "어느 단계가 깨졌는지" 진단이 한 단계 더 필요해진다(이
    가드는 스스로 그런 진단 실패를 두 번 겪었다고 적어 뒀다 — `masked-reject-callers-guard.ts`
    35-38행, `masked-reject-callers.spec.ts` 52-58행).
  - 제안: `stripCommentsAndStrings` 를 겨냥한 `it.each` 캐너리(블록 주석 안의 코드 조각·이스케이프
    따옴표·템플릿 리터럴 안의 `${...}` 등)를 몇 개 추가하면, 향후 정규식이 다시 뚫릴 때
    `importsBaseFn` 단이 아니라 전처리 단에서 바로 실패 지점을 좁힐 수 있다. 지금 당장 위험이
    있는 것은 아니다(간접 테스트가 이미 핵심 시나리오를 왕복 검증한다).

## 강점 (반증 아님, 정성적 확인)

- **실행 확인**: 위 7개 spec 을 직접 `npx jest` 로 재실행해 172/172 통과를 실측했다(캐시·stale
  빌드 우려 없음).
- **회귀 테스트가 정확한 반대 부호를 겨눈다**: `[캐너리] boolean 필드의 마커도 거부한다`
  (`reject-masked-resubmission.spec.ts:65-71`)는 초판이 실제로 뚫렸던 `Boolean('***') → true`
  완전 우회를 정확히 재현하는 형태다. `[회귀] 거부 응답이 details[] 로 필드별 코드를 싣는다`
  (`executions-rerun.service.spec.ts`)는 `err.errors` 원문이 아니라 `body.errors` 가
  `undefined` 임을 함께 단언해(`expect(body.errors).toBeUndefined()`) 선존 버그가 되살아나는
  걸 놓치지 않는다.
- **Mock 적절성**: `executions-rerun.service.spec.ts`/`workflows.controller.spec.ts` 모두
  `resolveTriggerParametersRejectingMasked`/`reject-masked-resubmission` 모듈을 mock 하지
  않는다 — 실제 서비스/컨트롤러를 통해 실코드 경로를 그대로 태운다(`jest.mock`/`jest.spyOn`
  호출 목록에 해당 모듈 없음, grep 확인). 마스킹 판정처럼 정확성이 중요한 로직을 스텁으로
  대체하지 않은 점이 신뢰도를 높인다.
- **왕복(round-trip) 통합 테스트**: `[통합] 실제 마스커가 만든 값을 판정기가 잡는다`
  (`reject-masked-resubmission.spec.ts:239-262`)는 손으로 만든 픽스처가 아니라 실제
  `deepRedactSecrets` 산출물을 판정기에 먹인다 — 마스커와 판정기가 `MAX_REDACT_DEPTH` 상수만
  공유하고 재귀 구현은 독립적이라는 사실을 스스로 지적하며, 모델(`nestObj`/`nestArr`)과 실제
  산출물의 괴리를 기계로 봉합한다.
- **테스트 격리**: `masked-reject-callers.spec.ts` 의 합성 fixture 테스트는
  `fs.mkdtempSync`/`try...finally` + `fs.rmSync(recursive:true)` 로 임시 디렉터리를 만들고
  반드시 정리한다 — 다른 테스트나 실행 간 상태 누출이 없다.
- **가독성**: `[캐너리]`/`[경계]`/`[회귀]`/`[통합]` 접두 태그로 각 테스트의 의도(우회 방지 ·
  경계값 · 회귀 고정 · 실물 왕복)가 이름만으로 드러나고, 다수 테스트가 "왜 이 케이스가
  필요한가"를 이전 리뷰 라운드 식별자(`00_03_57` CRITICAL 등)와 함께 doc comment 로 남겨
  다음 사람이 케이스를 지울 때 근거를 다시 찾지 않아도 된다.
- **가드 자체의 mutation 내성**: `masked-reject-callers.spec.ts` 는 "가드가 탐지를 멈춰도
  아무도 모른다"는 자기 반증 시나리오(리뷰어가 필터를 `.filter(() => false)` 로 무력화해도
  기존 두 테스트가 GREEN 이었던 사례)를 합성 fixture 로 직접 고정했고, named/namespace/require
  세 우회 형태와 접두 겹침(`resolveTriggerParametersRejectingMasked` vs
  `resolveTriggerParameters`) 오탐 방지까지 각각 별도 캐너리로 갈라 실패 지점이 바로 드러나게
  했다.
- **경계 커버리지**: 정확 일치 vs 부분 포함(`a***b`), 깊이 상한 `MAX_REDACT_DEPTH`/`+1`,
  객체·배열 동종 중첩과 혼합 중첩(`obj→arr→obj→arr→obj`), 스택 안전성(depth 5000, 상한 없는
  구현이 실제로 터지는 크기로 선택했다는 근거까지 doc comment 로 남김)까지 경계값이 촘촘하다.

## 요약

핵심 신규 로직(`reject-masked-resubmission.ts`)과 두 호출부(`executions.service.ts`
`reRun`, `workflows.controller.ts` `execute`)는 전용 spec·왕복 통합 테스트·회귀 캐너리로
두텁게 커버돼 있고, 실제로 실행해 172/172 통과를 확인했다. Mock 은 서비스/컨트롤러 레이어의
기존 관례(리포지토리·큐 등 I/O 경계)만 stub 하고 신규 판정 로직 자체는 실코드로 태워 실제
동작과의 괴리가 없다. 신규 repo-guard(`masked-reject-callers*`)는 스스로 세 차례 자기
결함(언급-매칭 오탐·죽은 허용목록·boolean 단언의 진단 불가)을 겪고 그 각각을 별도 캐너리로
고정한 드문 수준의 mutation 내성을 갖췄고, 임시 파일 격리도 올바르다. 남은 갭은 전부 INFO
수준이다 — `schema=null` 명시적 케이스 미검증, `findMaskedResubmissions`/
`stripCommentsAndStrings` 두 exported 헬퍼가 직접 단위 테스트 없이 상위 함수 경유로만
간접 커버된다는 점으로, 현재 간접 커버리지가 이미 핵심 시나리오를 왕복 검증하고 있어 실질
회귀 위험은 낮다. 이전 라운드들이 이미 CRITICAL 1건(boolean 완전 우회)과 다수 WARNING을
실코드 재검증으로 해소했고, 이번 최종 diff에서 테스트 관점의 새로운 CRITICAL/WARNING 은
발견되지 않았다.

## 위험도

LOW
