STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard (16_25_35)

## 검토 방법

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지 +
재제출 소비처(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드) 3곳 마커 가드 신설을 다룬다.
이미 5라운드(`14_08_45`→`14_44_08`→`15_10_25`→`15_32_34`→`15_59_17`)의 requirement 리뷰·fix
를 거쳐 CRITICAL 2건 · WARNING 다수 · SPEC-DRIFT 1건이 모두 해소된 상태다(각 라운드
RESOLUTION.md 로 확인). 이번 라운드는 (a) `git log`로 직전 라운드 이후 신규 커밋이
없음(HEAD=`e1607c737`, 직전 라운드 fix 커밋과 동일)을 확인하고, (b) 핵심 코드
(`rerun-modal.tsx`, `masked-markers.ts`, `editor-toolbar.tsx`, `executions.service.ts`,
`background-runs.service.ts`)와 관련 spec 3곳(`14-external-interaction-api.md` §R17,
`13-replay-rerun.md` §10.2, `1-data-model.md`)을 `Read`로 직접 재대조해 5라운드 fix 가
실제로 착지했는지, 그리고 이번 라운드에서만 관측 가능한 새 결함이 있는지 독립적으로
재검증했다.

## 재확인 — 직전 라운드(`15_59_17`) SPEC-DRIFT 가 실제로 해소됐음을 실측 확인

`15_59_17` requirement 리뷰가 지적한 SPEC-DRIFT("Re-run 모달 차단 판정이 코드·테스트엔
세 조건인데 spec 3곳 + CHANGELOG 는 여전히 '두 조건'만 서술")는 커밋 `e1607c737`(RESOLUTION
W1·W2)에서 수정됐다. 직접 대조 결과:

- `spec/5-system/14-external-interaction-api.md:1571` — §R17 "닫는 조건" 표 Re-run 모달
  행이 `"세 조건이 모두 참일 때까지 제출 차단"` + 세 우회 경로(타입 캐스팅·되돌린 마커·
  **무효 JSON**)를 정확히 열거.
- `spec/5-system/13-replay-rerun.md:361-364` — §10.2 캐비엇이 `"사용자가 그 필드를 채우고
  · 값에 마커가 남아 있지 않고 · 구조 필드라면 JSON 파싱에 성공할 때까지"` 세 조건 + 무효
  JSON 캐비엇을 명시.
- `CHANGELOG.md:19-27` — "차단 판정은 세 조건의 합" + 세 우회 경로 각각을 불릿으로 열거.
- 코드(`rerun-modal.tsx:372-379` `blockedByMaskedInput`)의 `maskedKeys.some((k) =>
  !touchedMaskedKeys.has(k) || hasMaskedMarkerLeaf(paramValues[k]) || (isStructuredField(k)
  && typeof paramValues[k] === "string"))` 세 `||` 절과 spec 서술이 **line-level 로 정확히
  대응**한다.

## 발견사항

없음. 아래 항목을 직접 코드·spec·테스트 3층위에서 재확인했으며 새로운 CRITICAL/WARNING 은
발견하지 못했다.

## 재확인 — 핵심 요구사항이 구현·spec·테스트에 일관되게 반영됨

- **backend 마스킹 관문 6표면**(`toResponseExecution`·`toExecutionDto`·`findById` 의
  `nodeExecutions[]` map·`BackgroundRunsService.toNodeExecutionDto`·`getChain`·`stop`)이
  모두 `inputData`를 포함 — `executions.service.ts:1068-1080`, `background-runs.service.ts`
  실측 확인. `ResponseExecution`/`ResponseNodeExecution` 타입이 `inputData: Record<string,
  unknown> | null` 로 넓혀져 있어 마스커의 `null` 반환을 타입 시스템이 강제.
- **`MASKED_INPUT_DATA_REASON` 앵커 전수 삭제** — `grep -rn` 코드베이스·spec 전체 0건 실측
  재확인(claim 대로).
- **Re-run 모달 3조건 AND 판정** — `blockedByMaskedInput`이 (터치 여부) AND (현재 값에
  마커 없음, `hasMaskedMarkerLeaf`로 스칼라·중첩 공통 처리) AND (구조 필드면 coerce 성공)
  세 조건 전부를 요구. `rerun-modal.test.tsx`에 세 우회 경로 각각의 캐너리(`637`행 "건드린
  뒤 값이 다시 마커면 계속 막는다", `675`행 "마스킹 키가 둘이면 하나만 채워도 계속
  막힌다", `706`행 "object 필드를 무효 JSON 으로 만들어도 계속 막는다")가 존재.
- **에디터 히스토리 로드** (`editor-toolbar.tsx:103-119`) — JSON 파싱 성공 후에만
  `hasMaskedMarkerLeaf(parsed)` 검사, 파싱 실패 시엔 마커 검사를 건너뛰어 사유 중복을
  피함(spec §2.2와 line-level 일치). `editor-toolbar-run-input.test.tsx`에 실제 유입 경로
  (`getById → JSON.stringify → setJsonInput`) 재현 테스트 + 오탐 경계 캐너리(`***bold***`)
  존재.
- **`useOriginalInput` 토글 ON 경로는 차단하지 않음** — `blockedByMaskedInput =
  !useOriginalInput && ...`로 정확히 구현, 캐너리(`rerun-modal.test.tsx:594`)로 고정.
  서버가 원본 엔티티를 직접 읽어 재제출 오염 경로 자체가 없다는 설계와 일치.
- **`masked-markers.ts` 유틸** — `MASKED_MARKERS`(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)가
  backend `sanitize-error-message.ts`의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/
  `DEPTH_MASK_MARKER` 리터럴과 정확히 일치. `isMaskedMarker`(정확 일치)·
  `hasMaskedMarkerLeaf`(재귀 leaf 순회) 모두 직접 단위 테스트(`masked-markers.test.ts`)로
  non-string/null/undefined/object/array 입력 경로가 개별 커버됨.
- **`dynamic-form-ui.tsx` 리팩터** — 마커 상수·판별기가 `lib/utils/masked-markers.ts`로
  이동한 뒤 원 위치에 dangling export/미사용 import가 남지 않았음을 확인
  (`isMaskedMarker` import 후 `initialValueFor`/렌더 두 지점에서 사용).
- **i18n parity** — `runWithInputMasked`(editor.ts ko/en), `maskedInputBlocked`(history.ts
  ko/en) 4개 키 모두 존재, 호출부(`editor-toolbar.tsx`의 `t("editor.runWithInputMasked")`,
  `rerun-modal.tsx`의 `t("history.rerun.maskedInputBlocked")`)와 키 경로 일치.
- **유저 가이드 MDX 4파일**(`run-results.mdx`/`.en.mdx`, `running-a-workflow.mdx`/`.en.mdx`)
  이 Re-run 비활성화 조건·"원본 입력 그대로 사용" 우회·`Load from History` 차단 UX를 반영.
- **plan 체크리스트**(`plan/in-progress/eia-inputdata-marker-guard.md`)의 `[x]` 항목들이
  실제 코드 상태와 일치 — 유일한 미완료(`[ ] push → PR`)는 작업 자체가 아직 push 전임을
  정확히 반영.

## 요약

5라운드에 걸친 선행 requirement 리뷰(및 병행 consistency 체크)가 CRITICAL 2건·WARNING
다수·SPEC-DRIFT 1건을 모두 해소했고, 이번 독립 재검증에서도 핵심 요구사항(카브아웃 폐지,
3개 소비처 마커 가드, object/array leaf 처리, "터치 AND 마커부재 AND 구조 파싱성공" 세
조건 판정, backend 6표면 마스킹, i18n/문서 동반 갱신)이 코드·spec·테스트 세 층위에서
line-level로 정확히 일치함을 확인했다. 새로 발견한 CRITICAL/WARNING/SPEC-DRIFT는 없다.

## 위험도

NONE
