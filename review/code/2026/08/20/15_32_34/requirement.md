STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard (15_32_34)

## 검토 방법

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처(폼 프리필·
Re-run 모달·에디터 히스토리 로드) 3곳 마커 가드 신설을 다룬다. 동일 작업이 이미 세 라운드
(`14_08_45` CRITICAL 2/WARNING 7 → `14_44_08` WARNING 8 → `15_10_25` WARNING 2)의 requirement
리뷰·fix 를 거쳤다. 이번 라운드는 (a) 프롬프트에 실린 diff 전량 확인, (b) diff 가 생략된 핵심
파일(`executions.service.ts`, `rerun-modal.tsx`, 두 test 파일)을 `Read`/`grep` 으로 직접 열어
실제 소스와 대조, (c) `spec/5-system/14-external-interaction-api.md` §R17 원문·`spec/1-data-model.md`·
`spec/5-system/13-replay-rerun.md`·`6-websocket-protocol.md`·`12-webhook.md`·
`spec/4-nodes/1-logic/12-background.md`·`spec/3-workflow-editor/3-execution.md` 7개 spec 문서와
구현을 line-level 로 재대조하는 방식으로 진행했다.

## 발견사항

- **[INFO]** `POST /executions/:id/re-run` 서버측이 `inputOverride` 값 자체가 마스킹 마커
  리터럴(`'***'` 등)이어도 거부하지 않는다 — UI 우회(직접 API 호출)로 왕복 오염을 재현할 수 있다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`useOriginal` 분기,
    `resolveTriggerParameters(schema, dto.inputOverride ?? {})` 호출부. `useOriginal` 함수 검색:
    `dto.useOriginalInput`)
  - 상세: 이 PR 이 세운 가드(폼 프리필 스킵·Re-run 모달 제출 차단·에디터 히스토리 로드 차단)는
    전부 **프런트엔드**에 있다. `resolveTriggerParameters` 는 타입·필수값만 검증하므로 curl 등으로
    직접 `inputOverride: { apiKey: "***" }` 를 보내면 그대로 통과해 새 Execution 의 실제 입력이
    리터럴 `'***'` 가 된다 — 이 PR 이 막으려던 "조용한 데이터 오염" 이 API 레벨에서 그대로
    재현된다. 다만 **이번 PR 이 새로 만든 결함은 아니다** — §R17 자체가 이 가드의 범위를 "UI
    정상 흐름 방어" 로 명시하고 있고(`spec/5-system/14-external-interaction-api.md` "닫는 조건"
    문단), `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 `14_44_08` W6 로
    이미 등재돼 향후 defense-in-depth 항목으로 트래킹 중이다. security reviewer 도 이전 라운드에서
    "기밀성 침해 아님 + 기존 defer 결정" 으로 INFO 판정했다.
  - 제안: 트래커 항목(`14_44_08` W6)대로 별건으로 진행 — `resolveTriggerParameters` 또는
    `create`/`re-run` 진입점에서 `inputOverride` 의 값이 `isMaskedMarker` 와 정확히 일치하면
    `INVALID_INPUT` 을 반환하는 얕은 서버측 체크를 검토. 이번 PR 을 막을 사안은 아니다.

- **[INFO]** 동일 작업을 가리키는 두 문서(plan frontmatter title vs CHANGELOG 제목)가 "재제출
  소비처 개수" 를 다른 기준(2 vs 3)으로 세어 나란히 읽으면 모순처럼 보인다
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md` frontmatter `title` ("...마커 가드
    **선행**") vs `CHANGELOG.md:3` ("...마커 가드 **3곳**")
  - 상세: plan 은 "이 작업이 새로 세우는 소비처"(Re-run 모달·에디터 히스토리 로드) 2곳만 세고,
    CHANGELOG 는 "닫는 조건을 충족한 총 소비처"(#1181 폼 프리필 포함) 3곳을 센다. 각자 문서
    내부에서는 일관되지만 나란히 보면 숫자가 갈린다. 이미 직전 라운드 documentation 리뷰
    (`14_44_08` INFO)가 지적했고 조치 불요로 defer 됐다 — 기능 결함이 아니라 재확인 차원으로만
    남긴다.
  - 제안: 조치 불요. (선택) plan 제목에 "(총 3곳 중 나머지 2곳)" 한정어를 붙이면 혼동을 없앨 수
    있다.

## 실측 확인 — 재플래그하지 않는 항목 (직전 라운드가 이미 잡아 fix 됐고, 이번 라운드 재검증 통과)

아래는 CRITICAL/WARNING 으로 잡혔던 이전 발견이 실제 코드에서 해소돼 있음을 이번 라운드에서
직접 재확인한 것들이다(재지적하지 않는다):

- **`hasMaskedMarkerLeaf` 가 Re-run 모달에도 적용됨** (`14_08_45` C1 fix 확인) —
  `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `splitMaskedParameters` 가
  스칼라는 `isMaskedMarker`, object/array 는 `hasMaskedMarkerLeaf` 로 분기하고, 후자는 값을
  지우지 않고 `maskedKeys` 에만 편입한다. `object 파라미터 안쪽 마커도 제출을 막고, 값은 지우지
  않는다` 테스트(`rerun-modal.test.tsx:612`)가 이 경로를 고정.
- **차단 판정이 "터치 AND 마커부재" 두 조건의 합** (`14_44_08` W2 fix 확인) —
  `blockedByMaskedInput = !useOriginalInput && maskedKeys.some((k) => !touchedMaskedKeys.has(k) ||
  hasMaskedMarkerLeaf(paramValues[k]))` (`rerun-modal.tsx:345-349`). "건드린 뒤 값이 다시 마커면
  계속 막는다" 캐너리(`rerun-modal.test.tsx:637`)와 "마스킹 키가 둘이면 하나만 채워도 계속
  막힌다" 캐너리(`:675`)가 `some`→`every`/조건 축소 뮤테이션을 각각 잡는다.
  `useOriginalInput` 토글 ON 시 차단이 풀리는 캐너리(`:594`)도 확인.
- **`ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc 주제문 갱신** (`14_08_45`
  C2 fix 확인) — `execution-response.dto.ts:52` "값-패턴 마스킹 **대상이다**" 로 주제문 자체가
  현재형이고, 옛 서술은 `> 2026-08-20 이전에는...` blockquote 로 내려가 있다.
- **`executions.service.spec.ts` describe 소제목 갱신** (`14_44_08` W7 fix 확인) — 1109행
  `## 두 레벨 모두 마스킹 대상이다` 로 주제문이 현재형이고, 아래 `describe('outputData +
  inputData 마스킹 — 표면 전수 (2026-08-20 부터 두 레벨 모두)', ...)` 와 정합한다.
  `MASKED_INPUT_DATA_REASON` grep 0건(코드 전수, `plan/`·`CHANGELOG.md` 의 역사적 언급만 남음)도
  실측 확인.
- **backend 마스킹 관문 6표면 모두 `inputData` 를 포함** — `ExecutionsService.toResponseExecution`
  JSDoc 의 "읽기 표면 목록" 표(1035-1047행)가 6곳(`findById`·`getChain`·`stop`·`toExecutionDto`·
  `findById` 의 `nodeExecutions[]`·`BackgroundRunsService.toNodeExecutionDto`)을 열거하고,
  실제 `redactStoredDataForResponse(...)` 호출부 4곳(`executions.service.ts:1010-1011,
  1075-1076`, `background-runs.service.ts:305-306`, `findById` 내부 `nodeExecutions[]` map)이
  그 표와 일치한다.
- **frontend `MASKED_MARKERS` ↔ backend `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`
  리터럴 일치** — `sanitize-error-message.ts:115,117,119` (`'***'`/`'[REDACTED]'`/
  `'[REDACTED_DEPTH]'`) 와 `lib/utils/masked-markers.ts` 의 `MASKED_MARKERS` 가 정확히 같은 세
  값. `masked-markers.test.ts` 가 이 SoT 일치를 직접 단언.
- **i18n 키 타입 안전성** — `Dict` 타입이 `WidenString<typeof ko>` 로 ko 를 SoT 삼아 유도되므로
  (`dict/types.ts`), `ko/history.ts`/`ko/editor.ts` 에 신규 키(`maskedInputBlocked`,
  `runWithInputMasked`)가 없으면 `en` 쪽이 구조적으로 타입 에러가 난다 — 두 로케일 모두 실제로
  키를 추가했음을 확인했고, 호출부(`t("history.rerun.maskedInputBlocked")`,
  `t("editor.runWithInputMasked")`) 와 경로가 정확히 일치.
- **에디터 히스토리 로드의 실제 유입 경로 검증** (`14_08_45` INFO-5 fix 확인) —
  `editor-toolbar-run-input.test.tsx:476` 테스트가 textarea 직접 주입이 아니라 `Load from
  History` 버튼 클릭 → `getById` → `JSON.stringify` → `setJsonInput` 경로를 실제로 타며, submit
  버튼이 disabled 되고 `role="alert"` 가 뜸을 확인한다. `editor-toolbar.tsx` 의
  `handleRunWithInput`/제출 버튼 모두 `<form>` 없이 `onClick` + `disabled={... || jsonError !=
  null}` 로만 게이트돼 있어 우회 경로(Enter 키 등)가 없음을 코드로 확인.
- **오탐 경계 캐너리 양방향 고정** — `masked-markers.test.ts`, `rerun-modal.test.tsx`,
  `editor-toolbar-run-input.test.tsx` 모두 "마커를 포함만 하는 값"(`a***b`, `***bold***`,
  `postgres://***@db/prod`)은 차단하지 않는다는 캐너리를 갖고 있어, §R17/masked-markers.ts
  JSDoc 이 명시한 "정확 일치만 잡는다(의도)" 경계와 코드·spec·테스트 세 자리가 일치한다.

## Spec fidelity 교차검증 — 문제 없음

- `spec/1-data-model.md` §`Execution.input_data`/`NodeExecution.input_data` 두 행 모두 "응답·
  emit 시 자격증명 값-패턴 마스킹" 으로 갱신, 카브아웃 서술이 과거형(`2026-08-20 이전에는...`)
  으로만 남아 있음 — 구현(양 컬럼 모두 마스킹)과 일치.
- `spec/5-system/13-replay-rerun.md` §10.2 가 "값이 비었는가" 초판을 버리고 최종 AND-조건
  ("사용자가 채우고 그리고 값에 마커가 없을 때까지") 으로 재작성돼 있음 — `rerun-modal.tsx` 의
  `blockedByMaskedInput` 로직과 문장 단위로 일치.
  → 이는 **SPEC-DRIFT 아님**: 리뷰가 지적한 시점에 이미 spec 도 함께 최종본으로 정정돼 있다
  (`15_10_25`/`14_44_08` WARNING 1 fix 로 `plan/in-progress/eia-inputdata-marker-guard.md` 에
  경위가 남아 있음).
- `spec/5-system/6-websocket-protocol.md` — "레벨이 가른다" 축이 명시적으로 폐기되고 "두 레벨
  모두 마스킹" 으로 갱신, `input`/`inputData` 3행(Execution REST/NodeExecution REST/WS node
  emit) 이 모두 "함" 으로 통일 — 구현과 일치.
- `spec/5-system/12-webhook.md` §5.3 — "그 갭을 덮는 후속 층이 생겼다" 로 갱신되면서도
  "expression `$trigger.headers` 는 egress 를 타지 않아 ingestion 층이 여전히 유일한 방어" 캐비엇을
  남겨, 마스킹 확장이 ingestion 층을 대체하지 않는다는 정확한 경계를 유지.
- `spec/4-nodes/1-logic/12-background.md` §8.2 — background-run 본문 노드 `nodeExecutions[]` 의
  `inputData` 설명이 "Execution 레벨 한정" 서술에서 "두 레벨 모두" 로 갱신, `background-runs.
  service.ts` 구현과 일치.
- `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ②" — "닫는 조건은 충족됐다
  (2026-08-20)" 표가 3개 소비처·가드 형태·시점을 정확히 열거하고, 각주("강제를 안내로 낮추지
  않았다")가 Re-run 모달의 "제출 자체를 막는다" 설계와 정확히 대응.

## 요약

3라운드에 걸친 선행 리뷰(`14_08_45`→`14_44_08`→`15_10_25`)가 CRITICAL 2건·WARNING 다수를 이미
해소했고, 이번 라운드에서 diff 전량과 spec 7개 문서를 독립적으로 재대조한 결과 새로운
CRITICAL/WARNING 은 발견되지 않았다. 핵심 요구사항(카브아웃 폐지, 3개 소비처 마커 가드,
object/array leaf 처리, 터치+값 AND 판정, backend 6표면 마스킹 정합)이 코드·spec·테스트 세
층위에서 일관되게 구현·반영돼 있다. 남은 항목은 모두 이전 라운드에서 이미 트래커에 등재되고
"이번 PR 을 막을 사안이 아니다" 로 명시적으로 defer 된 것들(서버측 `inputOverride` 마커 리터럴
거부, 게이트 4곳 통합 헬퍼, 응답 의미 반전의 외부 소비자 확인)이며, 이번 재검토에서도 그 판단이
유효함을 확인했다.

## 위험도

LOW
