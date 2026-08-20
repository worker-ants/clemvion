# 정식 규약 준수 검토 — `spec/5-system/` (`Execution.inputData` 마커 가드, 2026-08-20)

## 검토 대상

`git diff origin/main...HEAD` 기준 `spec/5-system/12-webhook.md` · `13-replay-rerun.md` ·
`14-external-interaction-api.md` · `6-websocket-protocol.md` (총 4개 spec 파일, 78+/45-)와
그 근거 구현(`codebase/frontend/src/lib/utils/masked-markers.ts` 신설, `rerun-modal.tsx` ·
`editor-toolbar.tsx` · `dynamic-form-ui.tsx` · backend `executions.service.ts` /
`execution-response.dto.ts` 등). 부수적으로 같은 결정을 미러하는 `spec/1-data-model.md` ·
`spec/3-workflow-editor/3-execution.md` · `spec/4-nodes/1-logic/12-background.md` 도
정합성 참고용으로 함께 확인했다(선언된 target 범위 밖이라 판정에는 포함하지 않음).

## 발견사항

없음 — CRITICAL·WARNING 급 정식 규약 위반을 발견하지 못했다. 아래는 검토 과정에서 명시적으로
확인한 준수 근거(참고용, 비차단)다.

- **[INFO] `frontend-layering.md` 이동 규약을 모범적으로 따름**
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `code:` (신규
    `codebase/frontend/src/lib/utils/masked-markers.ts` 등재) · 본문 "왜 컴포넌트에서 여기로
    옮겼나 (2026-08-20)" 캐비엇
  - 관련 규약: `spec/conventions/frontend-layering.md` §3 "위반 시 해소법" — 상위 계층
    (`components/`)이 소유하던 유틸을 소비처가 여럿(폼 프리필·Re-run 모달·에디터 툴바)이
    되며 `src/lib/utils/`로 승격
  - 상세: `masked-markers.ts`는 원래 `components/editor/run-results/dynamic-form-ui.tsx`
    안에 있었는데, `rerun-modal.tsx`(`components/executions/`)·`editor-toolbar.tsx`
    (`components/editor/toolbar/`)가 이를 import해야 하는 상황이 되자 `lib/utils/`로
    이동했다. 이는 §3이 명시한 "필요한 유틸을 lib로 이동"의 정확한 사례이며, ESLint
    레이어 가드(`components → lib` 허용, `lib → components` 금지)도 위반하지 않는다.
  - 제안: 없음(수정 불요). 준수 사례로 기록.

- **[INFO] `i18n-userguide.md` Principle 1·2 완전 준수**
  - target 위치: 코드 diff `codebase/frontend/src/lib/i18n/dict/{ko,en}/{editor,history}.ts`
    (신규 키 `editor.runWithInputMasked` · `history.rerun.maskedInputBlocked`), 소비부
    `rerun-modal.tsx`/`editor-toolbar.tsx`의 `t("...")` 호출
  - 관련 규약: `spec/conventions/i18n-userguide.md` Principle 1(TSX 하드코딩 금지) ·
    Principle 2(ko/en leaf key parity)
  - 상세: 새 UI 문자열 2종 모두 dict 키를 경유하며 ko/en 4개 파일에 대칭 추가됐다. 문체도
    해요체로 기존 파일과 일관되고, `_glossary.md` 금지어를 쓰지 않았다.
  - 제안: 없음.

- **[INFO] User Guide MDX가 Principle 6-B(내부 SoT 노출 금지)를 지킴**
  - target 위치: `codebase/frontend/src/content/docs/05-run-and-debug/{run-results,running-a-workflow}{,.en}.mdx`
    의 신규 문장
  - 관련 규약: `spec/conventions/i18n-userguide.md` Principle 6-B
  - 상세: `EIA §R17`·`spec/5-system/...`·내부 anchor id 등 사용자가 열람 불가능한 참조를
    본문에 노출하지 않고, 사용자 가시 동작("마스킹돼 있어 프리필되지 않는다", "Use original
    input을 켜면 원문으로 실행된다")만으로 재서술했다.
  - 제안: 없음.

- **[INFO] `spec-impl-evidence.md` frontmatter 규약 준수**
  - target 위치: `13-replay-rerun.md`·`14-external-interaction-api.md` frontmatter `code:`
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` §2 (code: 경로가 실존해야 함)
  - 상세: 신규 등재된 3개 파일(`masked-markers.ts`·`rerun-modal.tsx`·`editor-toolbar.tsx`)
    경로를 워크트리에서 절대경로로 직접 확인했고 전부 존재한다. `MASKED_INPUT_DATA_REASON`
    상수 제거에 맞춰 DTO 주석의 참조도 dangling 없이 `ExecutionsService.toResponseExecution`
    로 갱신됐다.
  - 제안: 없음.

## 요약

이번 diff(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3원 소비처)는
정식 규약 관점에서 특이한 위반을 만들지 않았다. (1) 신설 유틸 `masked-markers.ts`의 위치·이름
(`MASKED_MARKERS`/`isMaskedMarker`가 backend `sanitize-error-message.ts`와 문자 그대로 동일)이
`frontend-layering.md`의 레이어 이동 절차를 정확히 따랐고, (2) 신규 UI 문자열 2종이
`i18n-userguide.md`의 dict-경유·ko/en parity·해요체·내부 SoT 비노출 규약을 전부 충족하며,
(3) `spec/5-system/` 4개 파일의 frontmatter `code:` 목록이 실제 존재하는 신규 코드 경로로
정확히 갱신됐고 문서 구조(Overview/본문/Rationale, 기존 "~~잔여 N~~ 해소" 표기 관용구)도 유지됐다.
API 문서(swagger.md) DTO 데코레이터는 이번 diff에서 필드 존재/타입이 바뀌지 않아(JSDoc 텍스트만
갱신) 해당 규약의 적용 대상이 아니었다. 선언된 target 범위(`spec/5-system/`) 밖이지만 같은
결정을 미러하는 `spec/1-data-model.md`·`3-workflow-editor/3-execution.md`·
`4-nodes/1-logic/12-background.md`도 대조했고 문구·앵커가 서로 어긋나지 않았다.

## 위험도

NONE
