# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위

`origin/main...HEAD` 의 실제 diff(`git diff origin/main...HEAD`)를 대상 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard`)에서 직접
산출해 분석했다 (프롬프트 번들의 `<git diff ...>` 섹션은 예산 초과로 절단돼 있어 직접 재현).
변경 파일: `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md`,
`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md`,
`codebase/frontend/src/lib/utils/masked-markers.ts`(신규) 및 그 소비처 3곳
(`dynamic-form-ui.tsx`/`rerun-modal.tsx`/`editor-toolbar.tsx`), `codebase/backend/.../executions.service.ts`,
`execution-response.dto.ts`, i18n 사전 4개, plan 문서.

이번 변경은 **`Execution.inputData` egress 마스킹 카브아웃 폐지** — 기존 정책(§R17)을 뒤집는
것이지 새 엔티티/endpoint/이벤트/env var 를 도입하는 것이 아니다. 신규 식별자는 프런트
함수·상수·i18n 키·파일 경로 수준으로 국한된다.

## 발견사항

검토 관점 1~6(요구사항 ID, 엔티티/타입명, API endpoint, 이벤트/메시지명, 환경변수/설정키,
파일 경로) 전체에 걸쳐 **충돌 없음**. 개별 확인 내역:

- **신규 함수/상수** — `isMaskedMarker`, `hasMaskedMarkerLeaf`, `MASKED_MARKERS`
  (`codebase/frontend/src/lib/utils/masked-markers.ts`, 신규 파일),
  `splitMaskedParameters`/`blockedByMaskedInput`/`touchedMaskedKeys`
  (`codebase/frontend/src/components/executions/rerun-modal.tsx`). `git grep` 로 기존 사용처
  대조 결과 전부 유일 식별자다.
  - `MASKED_MARKERS`/`isMaskedMarker` 는 backend `sanitize-error-message.ts` 의 동명 상수와
    **의도적으로 이름이 같다** — target 문서 자체가 이유를 명시한다(마커 미러 동기화를
    grep 으로 찾을 수 있어야 하므로 이름을 backend 와 정확히 맞춘다, `masked-markers.ts`
    JSDoc). 이는 "다른 의미로 이미 사용 중"인 진짜 충돌이 아니라 **같은 개념의 cross-boundary
    미러 관용구**(같은 파일의 `DEFAULT_FILE_*` 선례와 동일 패턴)이므로 등급 부여 대상이 아님.
- **파일 경로** — `codebase/frontend/src/lib/utils/masked-markers.ts` (+ `__tests__/masked-markers.test.ts`)
  는 신규 경로이며 `lib/utils/` 하위 기존 kebab-case 명명 컨벤션(`url-validation.ts`,
  `edge-utils.ts` 등)과 일치, 기존 파일과 겹치지 않는다.
- **삭제된 구 식별자의 잔존 참조** — `MASKED_INPUT_DATA_REASON` (구 JSDoc 앵커 상수)이 diff 로
  전량 삭제됐다. `grep -rn "MASKED_INPUT_DATA_REASON" codebase/ spec/` = 0건으로, 코드·spec
  본문에 죽은 참조가 남아 있지 않음을 확인(plan/review 산출물의 역사적 언급만 남아 있고 이는
  기록이지 참조가 아님).
- **i18n 키** — 신규 `editor.runWithInputMasked`, `history.rerun.maskedInputBlocked` (ko/en 4개
  사전 파일). 기존 키와 충돌 없음, 각 소비처(`editor-toolbar.tsx`/`rerun-modal.tsx`)와 1:1 대응.
- **DTO/타입 변경** — `ResponseExecution` (`Omit<Execution, 'error' | 'inputData' | 'outputData' | ...>`)
  에 `inputData` 가 추가됐고, `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` 의
  **서술(의미)**이 바뀐다 — 그러나 타입/필드/DTO **이름 자체는 기존 그대로**이며 새 이름을
  도입하지 않는다. (내용 계약 반전의 외부 소비자 영향은 이미 plan 트래커에 별도 항목
  `14_44_08 W5` 로 등재돼 있어 이 검토 범위(신규 식별자 충돌) 밖.)
- **API endpoint / 이벤트명 / ENV var / 요구사항 ID** — 신규 도입 없음. 기존 `GET /api/executions/:id`,
  WS `execution.node.*` 이벤트, `EIA §R17` 등은 모두 기존 식별자를 그대로 재참조.
- **테스트 파일명** — `editor-toolbar-run-input.test.tsx`, `rerun-modal.test.tsx`(diff),
  `masked-markers.test.ts` 모두 신규/확장이며 형제 파일(`editor-toolbar-rbac.test.tsx` 등)과
  같은 명명 패턴을 따르고 경로 충돌 없음.

## 요약

target 변경은 새 엔티티·API endpoint·이벤트·ENV var·요구사항 ID를 전혀 도입하지 않고, 기존
`Execution.inputData` egress 마스킹 카브아웃 정책을 뒤집는 spec 문구 갱신 + 그에 따른 프런트
가드 유틸(`masked-markers.ts`) 승격이 전부다. 유일하게 "새로 생긴 식별자가 기존과 이름이
같다"고 부를 만한 사례(`MASKED_MARKERS`/`isMaskedMarker` 프런트-백엔드 동명)는 target 문서가
스스로 근거를 명시한 **의도적 미러**이며 의미 충돌이 아니다. 삭제된 구 앵커
(`MASKED_INPUT_DATA_REASON`)도 코드·spec 전체에서 잔존 참조 0건으로 깨끗이 정리됐다. 신규
식별자 충돌 관점에서 문제 없음.

## 위험도

NONE
