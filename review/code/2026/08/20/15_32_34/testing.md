STATUS=success ISSUES=4

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard (15_32_34)

## 검토 방법

프롬프트가 크기 제한으로 다수 파일 diff 를 생략해 `git diff origin/main...HEAD` 로
`codebase/**` 실제 diff 를 직접 열람했다. 이 changeset 은 이미 3차례 코드 리뷰 라운드
(`14_08_45` CRITICAL 2 + WARNING 7, `14_44_08` WARNING 8, `15_10_25` WARNING 2)를 거쳐
fix 가 반영된 상태다. 기존 신규 테스트(backend 71개, frontend 84개)를 직접 실행해 전부
GREEN 을 확인했고, 그 위에서 **직접 뮤테이션 재현**으로 미검증 경로를 찾았다.

- `jest executions.service.spec.ts background-runs.service.spec.ts`: **71 passed**
- `vitest run masked-markers.test.ts rerun-modal.test.tsx editor-toolbar-run-input.test.tsx dynamic-form-ui.test.tsx`: **84 passed**
- **재현 실험** (scratch 테스트 파일을 만들어 실행 후 즉시 삭제, `git status` 로 잔여물 없음
  확인): `ReRunModal` 에 `manual_trigger` 스키마로 `{name:"headers", type:"object"}` 를
  주입하고 원본 `inputData.parameters.headers = {apiKey:"***"}` 를 프리필한 뒤, 화면에 표시된
  유효 JSON 텍스트 `{"apiKey":"***"}` 뒤에 글자 하나(`x`)만 추가했다 — 아래 CRITICAL/WARNING
  항목 참조.

## 발견사항

- **[WARNING]** object/array 필드를 편집해 **문법적으로 무효한 JSON**(마커 텍스트는 그대로
  남은 채)으로 만들면 마스킹 차단이 풀린다 — 신규 테스트 전무, 재현 확인
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:345-349`
    (`blockedByMaskedInput` 판정) 및 `:176-187`(`coerceInput` — JSON parse 실패 시 raw
    문자열로 폴백). 대응 테스트 스위트는
    `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:537-706`
    (`describe("ReRunModal — 마스킹 마커 왕복 차단")`, 신규 8개 테스트) 인데 이 경로를 행사하는
    테스트가 하나도 없다.
  - 상세: `blockedByMaskedInput` 은 `hasMaskedMarkerLeaf(paramValues[k])` 로 "현재 값에 마커가
    남아 있는가"를 판정한다. 그런데 object/array 타입 필드는 `onChange` 마다
    `coerceInput(field.type, e.target.value)` 를 거치고, 이 함수는 `JSON.parse` 가 **실패하면
    raw 문자열을 그대로 돌려준다**(`:179-184`, 주석: "편집 중 부분 입력 허용"). 원본 표시값이
    유효 JSON `{"apiKey":"***"}` 인 상태에서 사용자가 글자 하나만 추가해도(예: 커서를 맨 끝에
    두고 오타 입력, 혹은 닫는 따옴표/중괄호 앞뒤로 실수) JSON 은 깨지고, `paramValues[headers]`
    는 파싱되지 않은 raw 문자열 `'{"apiKey":"***"}x'` 가 된다. `hasMaskedMarkerLeaf` 는 문자열
    입력에 대해 **`isMaskedMarker` 정확 일치만** 보므로(`masked-markers.ts` 의 설계된 경계 —
    `a***b`/`***bold***` 오탐 방지용) 이 raw 문자열은 마커로 인식되지 않고, 해당 키의 차단
    조건이 조용히 꺼진다. 다른 마스킹 키가 없다면 **"Re-run" 버튼이 활성화**되고,
    `handleSubmit` 이 `inputOverride.headers = '{"apiKey":"***"}x'` 를 그대로 제출한다 — 실제로
    scratch 테스트로 재현해 확인했다(제출 payload 에 마커 리터럴이 그대로 실림).
    이 PR 이 라운드 1 에서 CRITICAL 로 잡았던 *"object/array 안쪽 마커가 통째로 뚫린다"* 와
    **같은 결함 클래스**가, "정확 일치만 감지" 라는 라운드 1 의 처방 자체의 사각지대(무효
    JSON 폴백)를 통해 재발한다.
  - **완화 요인(검증함, 심각도를 CRITICAL 이 아닌 WARNING 으로 판단한 근거)**: backend
    `resolveTriggerParameters`(`codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:134-138`,
    `isCoerceFailure`)가 object/array 타입 파라미터에 문자열이 들어오면
    `coerce_failed` 로 `TriggerParameterValidationException` 을 던진다 — 코드를 직접 추적해
    확인했다. 즉 이 raw 문자열이 실제로 **새 실행에 원문으로 저장·실행되지는 않는다** — 대신
    "Re-run" 클릭 시 400 이 나고, `ERROR_CODE_TO_KEY` 에 `coerce_failed` 항목이 없어
    `history.rerun.genericError` 라는 **일반 오류 토스트**만 뜬다(`rerun-modal.tsx:369-370`).
    사용자 입장에선 "버튼이 눌리길래 눌렀는데 알 수 없는 오류" 라는 나쁜 UX 이고, 이 PR 이
    의도한 "마스킹 차단 → 안내 문구" 흐름을 우회하지만, 자격증명 리터럴이 저장·실행되는
    데이터 오염(라운드 1 급 CRITICAL)에는 이르지 않는다.
  - 제안: (1) `blockedByMaskedInput` 판정에 "이 키가 object/array 타입인데 현재 값이 문자열이고
    원래 마커를 포함한 원문에서 파생됐다" 경로도 막도록, `coerceInput` 실패 시 raw 문자열 자체에
    대해 (부분 포함이 아니라) *원본 마커가 여전히 값 안에 있는지* 를 별도로 검사하거나, 더 간단히는
    "이 필드가 object/array 타입인데 현재 값이 `string` 이면(=파싱 실패 상태) 무조건 차단 유지"
    조건을 추가한다. (2) 최소한 이 경로를 정확히 재현하는 캐너리 테스트 1개
    (`fireEvent.change` 로 유효 JSON 뒤에 문자를 추가해 무효 JSON을 만들고 버튼이 여전히
    disabled 인지 확인) 를 `rerun-modal.test.tsx` 의 마스킹 describe 블록에 추가해 이 경계를
    고정한다.

- **[INFO]** (라운드 3 `15_10_25` testing.md 에서 이미 지적, 이번 라운드까지 코드 변경 없어 유효)
  Re-run 모달을 같은 인스턴스에서 다른 실행으로 재사용하는 경로(모달이 열린 채 `original` prop 만
  바뀌는 경우)에 대한 `touchedMaskedKeys`/`paramValues` 리셋 테스트가 없다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` (`useEffect(..., [open, originalParameters])` 리셋 블록)
  - 상세: 신규 마스킹 테스트 8개는 전부 매번 새로 `renderModal(...)` 하므로 "열린 채 전환"
    경로는 어느 테스트도 행사하지 않는다. 실제 호출부가 항상 닫았다 다시 여는 패턴이면 위험은
    낮지만 이 가정 자체를 고정하는 테스트는 없다.
  - 제안: (선택) `rerender` 로 `open=true` 를 유지한 채 `original` 만 바꾸는 케이스를 추가하면
    이 가정이 회귀에도 고정된다.

- **[INFO]** (라운드 3에서 이미 지적, 유효 지속) `Execution.inputData` egress 마스킹 반전에
  대한 e2e(HTTP 왕복) 검증이 없다 — unit 레벨(`ExecutionsService` 직접 호출)에만 있다
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1109-1424`
    (unit, repository mock) 대비 `codebase/backend/test/*.e2e-spec.ts` (실앱 + supertest)
  - 상세: 기존 `re-run.e2e-spec.ts`/`webhook-trigger.e2e-spec.ts` 의 마스킹 관련 단언은 각각
    다른 계층(재실행 payload 재구성, ingestion 시점 헤더 redaction)을 확인할 뿐, 이번 PR 이
    반전시킨 **egress 값-패턴 마스킹**을 `GET /executions/:id` 실 응답에서 확인하는 e2e 는
    범위 밖이다. 이 저장소가 이 계층 전체(outputData/error, 선행 PR #1179/#1180)에서 공유하는
    기존 패턴이라 이번 PR 이 새로 만든 격차는 아니다.
  - 제안: (선택) `re-run.e2e-spec.ts` 케이스 B 의 원본 `inputData` 에 자격증명 패턴 문자열을
    심어 원본 조회 응답이 마스킹되는지 확인하는 어서션을 추가.

- **[INFO]** (라운드 3에서 이미 지적·트래커 등재됨) 클라이언트 측 제출 함수에 버튼 `disabled`
  외의 내부 가드가 없다는 전제를 고정하는 캐너리가 없다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:351`(`handleSubmit`)
  - 상세: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 `14_44_08 W6` 항목
    (서버측 `inputOverride` 마커 리터럴 거부, defer)과 이번 라운드의 WARNING 발견은 서로 다른
    경로다 — W6 은 "UI 를 완전히 우회한 API 직접 호출" 시나리오이고, 이번 WARNING 은 **정상
    UI 조작만으로** 같은 클래스의 차단 우회가 발생한다는 점에서 이미 트래커가 커버하는 범위
    밖이다. 다만 "버튼이 disabled 인 것 자체가 유일한 방어" 라는 전제를 고정하는 테스트가 없다는
    지적 자체는 라운드 3 과 동일하게 유효하다.
  - 제안: 조치 불요에 가깝다(이미 등재·defer). 위 WARNING 항목의 수정과 함께 재검토 권장.

## 긍정적으로 확인된 점

- `rerun-modal.test.tsx`/`editor-toolbar-run-input.test.tsx`/`masked-markers.test.ts` 신규
  테스트는 마커 차단·비-마커 통과·정확 일치 경계(`a***b`)·object/array leaf·마스킹 키 2개
  이상·재-마스킹 재차단까지 3라운드에 걸쳐 지적된 결함 클래스마다 전용 캐너리를 갖췄고, 직접
  실행 결과 backend 71/71·frontend 84/84 전부 GREEN 이다.
- 에디터 히스토리 로드 경로(`editor-toolbar.tsx`)는 **JSON 전체 파싱 실패 시 이미 `jsonError`
  로 Run 을 막고 마커 검사는 아예 수행하지 않는다**(`hasMaskedMarkerLeaf` 이전에 return) — 이
  설계는 이번 리뷰가 찾은 rerun-modal 의 "필드별 부분 파싱 실패" 취약점과 정확히 대칭되는
  안전한 형태다. 즉 같은 문제를 toolbar 는 "전체 JSON 유효성"이라는 단일 게이트로 막아
  회피했고, 모달만 필드별 부분 coercion 설계 때문에 사각을 남겼다.
- backend 방어선(`resolveTriggerParameters` 의 `isCoerceFailure`)이 독립적으로 object/array
  타입 불일치를 걸러내, 위 WARNING 이 실제 데이터 오염(라운드 1 급 CRITICAL)으로 번지는 것은
  막고 있음을 코드 추적으로 확인했다.

## 요약

기존 3라운드 리뷰가 반복 지적한 결함 클래스(object/array 내부 마커 누락, 값 vs 터치 판정
단독 우회, 문서 주제문 방치)는 이번 diff 시점 기준 전부 테스트로 고정돼 있고 직접 실행으로
재확인했다. 다만 독립적으로 뮤테이션 재현을 시도한 결과, **object/array 타입 파라미터 필드를
편집해 무효 JSON(마커 텍스트는 남긴 채)을 만들면 `blockedByMaskedInput` 이 조용히 풀리는
경로**를 새로 찾았고 실제 재현으로 확인했다 — 라운드 1 이 CRITICAL 로 잡았던 결함과 같은
클래스가 그 처방(정확 일치 검사)의 사각지대를 통해 재발한다. backend `isCoerceFailure` 가
실제 데이터 오염(마커 리터럴이 새 실행에 저장·실행됨)까지는 막아 심각도를 WARNING 으로
판단했지만, "차단 문구 대신 알 수 없는 일반 오류" 라는 나쁜 UX 이고 이 경로를 행사하는 테스트가
3라운드 동안 전무했다. 그 외 남은 갭(모달 재사용 리셋, e2e 왕복, 서버측 우회 캐너리)은 이전
라운드가 이미 INFO/트래커로 판정한 항목이 그대로 남아 있을 뿐 이번 PR 을 막을 사안은 아니다.

## 위험도

MEDIUM
