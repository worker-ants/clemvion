STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 코드 리뷰 — eia-inputdata-marker-guard (15_32_34)

## 검토 방법

`git diff origin/main...HEAD --stat` (122 files changed) 로 changeset 전량을 실측하고, 프롬프트에서
diff 가 생략된 파일(`executions.service.ts`, `executions.service.spec.ts`, `rerun-modal.tsx`,
`rerun-modal.test.tsx`, `editor-toolbar-run-input.test.tsx`, spec 7개, plan 2개)은 `git diff` 로
직접 열어 전문을 확인했다. `MASKED_INPUT_DATA_REASON` 앵커 삭제 후 잔존 참조가 있는지도
`grep -rn` 으로 전수 확인했다(0건).

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지 — 재제출 소비처
3곳(폼 프리필 #1181 기완료 + 이번 PR 의 Re-run 모달·에디터 히스토리 로드)에 마커 가드를
신설해 카브아웃 조건을 닫는 단일 작업이다. 122개 변경 파일 중 다수(약 60개)는 이 작업이
거친 3라운드 코드 리뷰 + 4라운드 consistency 검토의 산출물(`review/code/**`,
`review/consistency/**`)로, 이 저장소 CLAUDE.md·developer SKILL 이 강제하는 "구현 완료 후
자동 review/fix" 표준 절차의 흔적이며 `review/` 가 gitignore 대상이 아니므로 커밋에
포함되는 것이 이 프로젝트의 정상 관행이다 — 무관한 수정으로 보지 않는다.

## 발견사항

없음.

**실제 코드 변경 파일(23개, 테스트 제외)** 은 전부 단일 목적에 직결된다:

- **backend**: `executions.service.ts`(마스킹 관문 3곳 확장 + `ResponseExecution` 타입에
  `inputData` 편입 + 구 `MASKED_INPUT_DATA_REASON` JSDoc 앵커 삭제), 자매 표면
  `background-runs.service.ts`/DTO, `execution-response.dto.ts`(Swagger JSDoc),
  `sanitize-error-message.ts`(프런트 미러 위치 갱신 주석) — 모두 "카브아웃 폐지" 결정 하나의
  반영이다. 로직 diff 는 `redactStoredDataForResponse` 를 기존 `outputData`/`error` 와 같은
  자리에 한 줄씩 추가하는 형태로, 새로운 마스킹 알고리즘이나 무관한 리팩터가 섞여 있지 않다.
- **frontend**: `rerun-modal.tsx`(프리필 스킵 + 이중 조건 제출 차단), `editor-toolbar.tsx`(JSON
  leaf 마커 검사 후 Run 차단), 신규 `lib/utils/masked-markers.ts` — 이 마지막 파일은
  "리팩터링"으로 보일 수 있으나 필요에 의한 것이다: 마커 판별기가 원래
  `dynamic-form-ui.tsx`(폼 UI 컴포넌트) 안에 있었는데, 이번 작업으로 소비처가 셋(폼·모달·툴바)이
  되면서 모달·툴바가 무관한 폼 컴포넌트를 import 해야 하는 의존 방향 문제가 생겨 공용 유틸로
  승격했다 — plan 문서(`eia-inputdata-marker-guard.md` "마커 유틸을 `lib/utils/` 로 옮긴다")가
  사전에 명시한 설계 결정이고, `dynamic-form-ui.tsx` 쪽 diff 는 함수를 그대로 옮기고 import 로
  대체한 것뿐이라 로직 변경이 없다(신규 로직은 `hasMaskedMarkerLeaf` 재귀 함수 하나뿐이며 이는
  이번 작업이 막으려는 object/array leaf 마커 문제에 정확히 대응한다).
- **i18n**: `dict/{ko,en}/{editor,history}.ts` 신규 키 2쌍 — 새로 추가된 UI 문자열
  (`runWithInputMasked`, `maskedInputBlocked`) 에 대응하며 ko/en parity 도 맞다. 무관한 키
  추가·삭제 없음.
- **docs MDX**: `run-results.{mdx,en.mdx}`, `running-a-workflow.{mdx,en.mdx}` 4파일 — 신규 차단
  UX(마스킹된 입력은 프리필되지 않고 실행이 막힌다)를 안내하는 한 문장씩만 추가. 기존 문장
  구조·다른 Step 은 손대지 않았다.
- **CHANGELOG.md** — 새 `## Unreleased` 절 하나만 추가, 기존 절은 무변경.

**import 검사**: 신규 `masked-markers.ts` import 는 `dynamic-form-ui.test.tsx`·`rerun-modal.tsx`·
`editor-toolbar.tsx`·`dynamic-form-ui.tsx` 4곳 모두 실제로 쓰이는 함수만 가져온다(`MASKED_MARKERS`/
`isMaskedMarker`/`hasMaskedMarkerLeaf`). 미사용 임포트나 불필요한 정리는 없다.

**spec 변경 7개 파일**은 전부 이 카브아웃 폐지 결론이 SoT 로 미러돼 있던 자리(§R17 표·
`1-data-model.md` §2.13·`13-replay-rerun.md` §10.2·`3-execution.md` §2.2·`12-webhook.md` §5.3·
`6-websocket-protocol.md` §4.1·`12-background.md` nodeExecutions 표)의 서술 flip 이며, 이번
`developer` 작업이 시작되기 전 선행 `project-planner` 턴(plan `spec-draft-inputdata-egress-masking.md`,
CLAUDE.md 가 요구하는 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 절차)
에서 이미 다뤄졌다 — 이번 diff 는 그 결정을 반영한 것으로 새로운 무관 spec 변경이 아니다.

**설정 변경**: 없음(package.json·tsconfig·eslint·CI 워크플로 등 변경 파일 목록에 없음).

**포맷팅/주석**: 코드 파일의 주석 변경은 전부 "카브아웃 폐지" 서사를 갱신하는 내용이고
(`2026-08-20` 날짜 표기, `MASKED_INPUT_DATA_REASON` → 서술형 인용으로 치환), 순수 공백·개행만
바꾼 자리는 없다. 이전 라운드(`14_08_45` W1)가 지적한 "인용만 고치고 문장이 끊긴" 결함은
직전 커밋들(`b0d841923`, `29d00021d`, `b46216f1f`)에서 이미 문장 단위로 재작성돼 있음을
`executions.service.ts`/`.spec.ts`/`execution-response.dto.ts` 실제 파일 열람으로 확인했다.

## 요약

이 changeset 은 "`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 소비처 3곳 마커
가드"라는 단일하고 명확한 의도를 벗어나지 않는다. 실제 프로덕션 코드 변경은 23개 파일로
좁고, 각 변경은 그 의도에 직결된다. 신규 유틸 승격(`lib/utils/masked-markers.ts`)은 소비처
증가에 따른 필요 조건이지 임의 리팩터가 아니며, 나머지는 문서(spec/plan/CHANGELOG/유저가이드/
i18n) 동반 갱신과 이 저장소가 표준 관행으로 커밋하는 review 산출물이다. 요청 범위를 넘는
기능 확장, 무관한 파일 수정, 미사용 임포트, 의도치 않은 설정 변경은 발견되지 않았다 — 선행
두 라운드(`14_08_45`, `14_44_08`)의 scope 검토도 동일하게 NONE 으로 판정했고, 이번 재검토에서도
그 결론이 유지된다.

## 위험도

NONE
