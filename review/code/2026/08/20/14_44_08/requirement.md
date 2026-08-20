STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — `Execution.inputData` 카브아웃 폐지 + 재제출 소비처 3곳 마커 가드

## 발견사항

- **[SPEC-DRIFT]** Re-run 모달 마커 가드의 차단 조건을 두 spec 문서가 "값이 비어 있는가"(value-based)로 서술하지만, 실제 구현은 "사용자가 그 키를 건드렸는가"(touched-based)다 — 리뷰 라운드 도중 의도적으로 바뀌었는데 spec 이 그 변경을 못 따라갔다
  - 위치(코드, 권위): `codebase/frontend/src/components/executions/rerun-modal.tsx` — `blockedByMaskedInput = !useOriginalInput && maskedKeys.some((k) => !touchedMaskedKeys.has(k))` (`setParam`이 값에 관계없이 키를 `touchedMaskedKeys`에 추가하는 지점 포함)
  - 위치(spec, 갱신 대상):
    - `spec/5-system/13-replay-rerun.md:358-361` — *"프리필 값이 마스킹 마커면 프리필하지 않고 해당 필드를 비운 채 재입력을 안내하며, **그 필드가 비어 있는 동안** Re-run 제출을 막는다."*
    - `spec/5-system/14-external-interaction-api.md:1570` (§R17 "닫는 조건" 표, Re-run 모달 행) — *"마커면 프리필 스킵 + **비어 있는 동안 제출 차단**."*
    - (참고, spec 은 아니지만 같은 문구가 남은 곳) `plan/in-progress/eia-inputdata-marker-guard.md:118-119` 체크리스트 항목도 동일하게 "비어 있는 동안 제출 차단"으로 적혀 있다.
  - 상세: `git log`로 확인하면 이 changeset 은 두 커밋으로 나뉜다 — 먼저 `37da9b593`(feat)이 spec 문구 그대로 **값(빈 문자열/undefined/null) 기반** 차단을 구현했고(`v === "" || v === undefined || v === null`), 이후 `b0d841923`(fix, `14_08_45` 리뷰 라운드 WARNING #2 처분)이 "스키마가 늦게 로드되면 재조정 이펙트의 `coerceInput('boolean','')`가 `false`를 만들어 값 기반 판정이 조용히 풀린다"는 실측 결함을 잡아 판정 축 자체를 **"사용자가 그 키를 건드렸는가"**로 바꿨다. 이 두 번째 변경은 코드 주석(`14_08_45 W2` 인용)이 근거를 명확히 남긴 **의도적이고 타당한 개선**이라 코드 자체는 옳다. 문제는 이 판정 축 전환이 spec 본문에는 전혀 전파되지 않았다는 점 — `13-replay-rerun.md`와 `14-external-interaction-api.md` §R17 "닫는 조건" 표는 지금도 최초(버그 있던) 설계인 "비어 있는가"를 권위 있는 동작 명세로 서술한다. 두 서술은 실제로 다른 동작을 낳는다: 값 기반이면 필드가 다시 비워질 때마다 재차단되지만, touched 기반은 **한 번 건드리면 그 세션 동안 영구 해제**된다(값이 나중에 다시 비워지거나 마커 그대로 남아도 재차단하지 않는다) — 단순 문구 차이가 아니라 관측 가능한 동작 차이다.
  - 제안: 코드는 유지한다(리뷰가 이미 검증한 타당한 fix). `spec/5-system/13-replay-rerun.md` §10.2 캐비엇 문단과 `spec/5-system/14-external-interaction-api.md` §R17 "닫는 조건" 표의 Re-run 모달 행을 "필드가 비어 있는 동안" → "사용자가 해당 필드를 편집하기 전까지(마스킹 값 그대로 재제출되는 것을 막기 위해 touched 여부로 판정)"로 재작성해 `project-planner` 턴에서 반영한다. 같은 문구가 남은 `plan/in-progress/eia-inputdata-marker-guard.md` 체크리스트도 함께 정정하면 다음 독자의 혼동을 막는다.

- **[WARNING]** Re-run 모달에서 마스킹 키를 한 번이라도 "건드리면" 그 값이 여전히(또는 다시) 마스킹 마커 리터럴이어도 제출 차단이 영구 해제된다 — 최종 제출 직전 재검증이 없다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` — `setParam`(터치 시 값 무관하게 `touchedMaskedKeys`에 추가) · `blockedByMaskedInput`(터치 여부만 보고 현재 값은 안 봄) · `handleSubmit`(`inputOverride: paramValues`를 `isMaskedMarker`/`hasMaskedMarkerLeaf` 재검증 없이 그대로 전송)
  - 상세: 위 SPEC-DRIFT 항목에서 설명한 touched 기반 전환은 "값이 늦게 `false`로 재조정돼 차단이 풀리는" 특정 버그(coercion bypass)는 정확히 막지만, 그 대가로 **더 넓은 범주의 새 우회 경로**를 연다 — `setParam`은 `value`가 무엇이든(빈 문자열, undefined, 심지어 마스킹 마커 문자열 그 자체 `"***"`) 호출되기만 하면 그 키를 영구히 "안전"으로 표시한다. 이 PR 이 막으려는 정확한 실패 형태(리터럴 `'***'`가 `inputOverride`로 제출돼 새 실행의 실제 입력이 되는 것, EIA §R17 "잔여 ②"·이 PR 의 CHANGELOG 서두가 명시한 그 문제)가 "사용자가 그 필드를 편집했지만 최종 값이 여전히 마커"인 경로로 재현 가능하다 — 예: 사용자가 필드를 클릭해 타이핑을 시작했다가 실행 취소(undo)로 값이 다시 비워지거나, alert 안내 문구(`history.rerun.maskedInputBlocked`: `"Some inputs were masked as credentials..."`, 툴바 쪽 `editor.runWithInputMasked`: `"Masked credential values (***) remain..."`)가 마커 표기 `***`를 리터럴로 노출하는 상황에서 사용자가 그 예시 문자열을 그대로 입력란에 타이핑하는 경우. `handleSubmit`은 `paramValues`를 그대로 `executionsApi.reRun`에 넘기며 어디에도 `isMaskedMarker`/`hasMaskedMarkerLeaf` 최종 재검증이 없다(전수 grep 확인 — `rerun-modal.tsx` 안에서 이 두 함수는 `splitMaskedParameters` 한 곳에서만 쓰인다). 대응하는 신규 테스트(`rerun-modal.test.tsx`의 "ReRunModal — 마스킹 마커 왕복 차단" describe, 6개 `it`)에도 "터치했지만 값이 여전히 마커"인 경로를 다루는 케이스가 없다 — 전부 실제 값(`"real-key"`)으로 채우는 성공 경로만 고정한다. 에디터 툴바 쪽(`editor-toolbar.tsx`)은 이 문제가 없다 — `jsonError`가 `jsonInput` 값이 바뀔 때마다 `hasMaskedMarkerLeaf(parsed)`를 매번 재평가하는 **값 기반**(re-computed on every render, `useMemo` deps `[jsonInput, t]`)이라 최종 값이 마커면 항상 다시 차단된다. Re-run 모달만 이 구조적 차이를 갖는다.
  - 제안: `blockedByMaskedInput` 판정에 "터치됨" AND "현재 값이 더 이상 마커가 아님"을 함께 요구한다 — 예: `maskedKeys.some((k) => !touchedMaskedKeys.has(k) || isMaskedMarker(paramValues[k]) || hasMaskedMarkerLeaf(paramValues[k]))`. 또는 최소한 `handleSubmit` 진입 시 `paramValues`에 대해 `hasMaskedMarkerLeaf`로 마지막 방어선을 하나 더 두고, "터치했지만 여전히 마커"를 고정하는 캐너리 테스트를 추가한다.

## 그 외 확인한 항목 (문제 없음, 참고)

- backend 세 표면(`toResponseExecution`/`toExecutionDto`/`stop`)·프런트 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드) 전부 마스킹/가드가 실제로 걸려 있음을 코드로 확인했다. `MASKED_INPUT_DATA_REASON` 앵커는 코드 전수(backend 6개 파일) 삭제 확인, 잔존 0건.
- `MASKED_MARKERS`(frontend, `lib/utils/masked-markers.ts`) 리터럴 집합이 backend SoT(`VALUE_MASK_MARKER='***'`/`KEY_MASK_MARKER='[REDACTED]'`/`DEPTH_MASK_MARKER='[REDACTED_DEPTH]'`, `sanitize-error-message.ts`)와 정확히 일치.
- `spec/1-data-model.md:471,550`, `spec/3-workflow-editor/3-execution.md:91`은 이번 diff 로 정확히 갱신돼 코드와 line-level 로 일치한다 — 특히 `3-execution.md:91`의 "적재된 JSON 에 마커가 **남아 있으면**"은 `editor-toolbar.tsx`의 값 기반(재평가) 구현과 정확히 부합한다(위 SPEC-DRIFT 대상인 Re-run 모달과 달리 이쪽은 drift 없음).
- `redactStoredDataForResponse`/`redactStoredErrorForResponse`는 이번 PR 에서 수정되지 않은 기존 함수이며 `null`/`undefined` 입력을 방어적으로 처리한다(신규 회귀 없음).
- i18n 신규 키(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`) ko/en 양쪽 동일 commit 등록, 타입 정합 확인.
- TODO/FIXME/HACK/XXX 신규 주석 없음(diff 전수 grep 확인).

## 요약

핵심 마스킹 정책 전환(backend 세 표면 + frontend 세 소비처)은 설계·구현·테스트·spec SoT 미러링 대부분이 촘촘하게 맞물려 있고, 이전 리뷰 라운드(`14_08_45`)가 잡은 CRITICAL 2건(모달 object/array 마커 누락, JSDoc 방치)도 이번 diff 안에서 정확히 처방돼 있음을 직접 코드로 재확인했다. 다만 그 리뷰 라운드의 WARNING #2 fix(타입 캐스팅 우회를 막기 위해 Re-run 모달의 차단 판정을 "값이 비었는가"에서 "사용자가 건드렸는가"로 전환)가 두 군데 spec 문서(`13-replay-rerun.md` §10.2, `14-external-interaction-api.md` §R17 "닫는 조건" 표)에 반영되지 않아 spec-drift 가 남았고, 같은 전환이 "터치 후 값이 여전히 마커라도 영구 해제"라는 새 엣지 케이스를 열어 두었는데 이를 막는 최종 재검증이나 테스트가 없다. 두 항목 모두 이 PR 이 명시적으로 지키려는 계약("리터럴 `'***'`가 새 실행의 실제 입력이 되면 안 된다")과 직결되지만, 발생 조건이 정상적인 사용자 흐름이 아니라 atypical 한 재입력 경로에 국한돼 WARNING 으로 판단했다.

## 위험도

MEDIUM
