# 신규 식별자 충돌 검토 — naming_collision

## 범위

`--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`. 실제 변경 파일(HEAD 워킹트리
기준 `git diff origin/main...HEAD`):

- spec: `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
  `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/12-webhook.md`,
  `spec/5-system/13-replay-rerun.md`, `spec/5-system/14-external-interaction-api.md`,
  `spec/5-system/6-websocket-protocol.md`
- code: `codebase/backend/src/modules/executions/{executions.service.ts,executions.service.spec.ts}`,
  `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`,
  `codebase/backend/src/modules/background-runs/*`, `codebase/backend/src/shared/utils/sanitize-error-message.ts`,
  `codebase/frontend/src/lib/utils/masked-markers.ts`(신규 파일) + 테스트,
  `codebase/frontend/src/components/executions/rerun-modal.tsx`,
  `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`,
  `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`,
  `codebase/frontend/src/lib/i18n/dict/{ko,en}/{editor,history}.ts`

(참고: 조립된 prompt 파일은 예산 초과로 diff 섹션 자체가 생략돼 있었다. 위 목록은 HEAD
워킹트리에서 직접 `git diff origin/main...HEAD` 로 재확인한 1차 근거다.)

## 발견사항

이번 target 은 §R17 카브아웃(`Execution.inputData` egress 마스킹 예외)을 **닫는** 변경이며,
새 요구사항 ID·엔티티·API endpoint·이벤트명·ENV/설정키를 도입하지 않는다. 도입된 신규
식별자는 아래 넷뿐이고, 전수 grep 결과 전부 충돌 없음을 확인했다.

| 신규 식별자 | 종류 | 충돌 검색 결과 |
|---|---|---|
| `codebase/frontend/src/lib/utils/masked-markers.ts` | 신규 파일 (기존 `dynamic-form-ui.tsx` 내부 `isMaskedMarker`를 승격 이동) | 동명 기존 파일 없음. 이동 후 `dynamic-form-ui.tsx` 는 duplicate 선언 없이 import 만 함(`isMaskedMarker` 단일 선언지 확인) |
| `hasMaskedMarkerLeaf` (함수, 신규) | 새 export | 코드베이스 전체에서 유일 선언(`masked-markers.ts:88`), 참조처(`rerun-modal.tsx`, `editor-toolbar.tsx`, 테스트)와 이름 충돌 없음 |
| `editor.runWithInputMasked` (i18n 키) | 신규 dict 키 | ko/en `editor.ts` 양쪽 동시 추가, 기존 키와 중복 없음 |
| `history.rerun.maskedInputBlocked` (i18n 키) | 신규 dict 키 | ko/en `history.ts` 양쪽 동시 추가, 기존 키와 중복 없음 |

기존 식별자 `MASKED_INPUT_DATA_REASON` 은 plan 이 선언한 대로 **코드·spec 전수에서 0건**
(`grep -rn "MASKED_INPUT_DATA_REASON" codebase spec` → 무결과)으로 완전 제거됐고, 반전
재사용도 하지 않았다 — "이름 유지·의미 반전"으로 인한 착오 유발 리스크(가장 흔한 충돌
패턴)가 애초에 발생하지 않았다.

§R17 카탈로그 항목("잔여 ②")은 새 번호를 만들지 않고 기존 항목을 "해소"로 갱신했고,
`spec/5-system/13-replay-rerun.md`·`14-external-interaction-api.md`·`6-websocket-protocol.md`
frontmatter `code:` 리스트에 추가된 항목(`rerun-modal.tsx`, `masked-markers.ts`,
`editor-toolbar.tsx`)도 각 리스트 내 중복 없이 1회씩만 등재됐다.

새 API endpoint, webhook/queue/SSE 이벤트명, ENV var/config key 는 diff 전체에서 관측되지
않았다(`process.env`/`@Get|@Post|@Put|@Patch|@Delete` 검색 0건) — 이 PR 은 기존 REST 응답
DTO 필드(`ExecutionDto.inputData`, `NodeExecutionSummaryDto.inputData`)의 마스킹 여부만
바꾸는 정책 변경이라 신규 표면 자체가 없다.

## 요약

target 이 새로 들여온 식별자(신규 파일 1개, 함수 1개, i18n 키 2개)는 코드베이스·spec
전수 검색으로 충돌 없음을 확인했고, 폐기한 기존 식별자(`MASKED_INPUT_DATA_REASON`)도
잔존 참조 없이 깨끗이 제거됐다. 신규 요구사항 ID·엔티티·API endpoint·이벤트·ENV/설정키
도입이 없어 해당 축의 충돌 가능성 자체가 없다. 신규 식별자 충돌 관점에서 이 target 은
문제 없음.

## 위험도

NONE
