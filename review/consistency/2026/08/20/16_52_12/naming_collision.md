# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done, eia-inputdata-marker-guard)

## 검토 범위 확인

prompt 번들이 컨텍스트 예산 초과로 대량 절단돼 있어, `git diff origin/main...HEAD --stat` 과
파일별 `git diff` 를 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-inputdata-marker-guard`)에서
직접 실행해 변경분을 1차 근거로 확인했다. 이번 PR 의 실질 변경은:

- spec 6개 파일 prose 수정 (`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
  `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{12-webhook,13-replay-rerun,14-external-interaction-api,6-websocket-protocol}.md`)
  — **새 requirement ID·엔티티·API endpoint·이벤트명·ENV/config 키·spec 파일 경로는 도입되지 않았다.**
  전부 `Execution.inputData` egress 마스킹 카브아웃을 닫는 기존 결정(§R17)의 서술 갱신이다.
- 코드: 신규 파일 `codebase/frontend/src/lib/utils/masked-markers.ts` (마커 유틸 승격),
  `rerun-modal.tsx`/`editor-toolbar.tsx`/`dynamic-form-ui.tsx` 수정, `executions.service.ts` 의
  `MASKED_INPUT_DATA_REASON` 앵커 제거 + `ResponseExecution.inputData` 필드 추가.
- 신규 i18n 키 2개: `history.rerun.maskedInputBlocked`, `editor.runWithInputMasked`.

## 발견사항

### 충돌 없음 — 의도된 backend/frontend 이름 미러 (참고용, 등급 없음)

- **target 신규 식별자**: `MASKED_MARKERS` / `isMaskedMarker` (신규 export, `dynamic-form-ui.tsx`
  에서 `lib/utils/masked-markers.ts` 로 승격) + 신규 `hasMaskedMarkerLeaf` / `MAX_MARKER_SCAN_DEPTH`
- **기존 사용처**: `codebase/backend/src/shared/utils/sanitize-error-message.ts:150,156` 의
  동명 `MASKED_MARKERS`/`isMaskedMarker`, `MAX_REDACT_DEPTH`(L112)
- **상세**: 이름이 backend/frontend 양쪽에 동일하게 존재하지만, 파일 JSDoc(`masked-markers.ts:11`)이
  명시하듯 **backend 가 SoT 이고 frontend 는 의도적 동일-명명 미러**다(번들 분리로 직접 import
  불가) — 같은 의미의 같은 상수를 grep 으로 동기화하기 위한 설계 선택이며, `plan/complete/eia-masked-prefill-roundtrip-guard.md:82`
  에도 "이름은 backend SoT 와 **일치**시켰다"고 명문화돼 있다. 서로 다른 의미로 쓰이는 경우가
  아니므로 본 관점의 "충돌"에 해당하지 않는다.
- **판단**: 등급 없음(정보 공유만). 제안 없음 — 오히려 이름을 갈라놓는 쪽이 회귀 위험(미러
  drift)이라는 것이 해당 PR·직전 plan 의 명시적 결론이다.

### INFO — `isStructuredType`/`isStructuredField` 신설과 기존 `isStructured` 로컬 관용구의 표면적 유사

- **target 신규 식별자**: `rerun-modal.tsx` 신설 `isStructuredType(type: TriggerParameterType)`,
  `isStructuredField(name: string)` — TriggerParameter 가 object/array 타입인지 판별
- **기존 사용처**: `codebase/frontend/src/components/editor/run-results/output-shape.ts:38`
  (`isStructured: boolean` 필드), `presentation-renderers.tsx:510`, `result-timeline.tsx:173`
  (`isStructuredEnvelope`), `apply-execution-snapshot.ts:204`, `use-execution-events.ts:504`,
  `auto-form/widgets.tsx:407` — 전부 "실행 출력이 구조화 envelope(예: `conversationThread`/
  `formConfig` 래핑)인가"라는 **다른 의미**의 함수-로컬 `const isStructured`
- **상세**: 두 그룹은 스코프가 겹치지 않는 함수/모듈 로컬 식별자라 컴파일 타임 충돌은 없고,
  target 쪽은 `Type`/`Field` 접미사로 이미 구분돼 있다.다만 "구조화됨" 이라는 동일 형용사가
  실행 UI 코드베이스 전역에서 최소 두 가지 다른 도메인 개념(출력 envelope 구조화 여부 vs.
  트리거 파라미터 타입이 object/array 인가)에 반복 사용되는 점은 향후 검색·리팩터링 시
  혼동 소지가 있다.
- **제안**: 즉각 조치 불요. 향후 두 개념을 한 파일에서 함께 다룰 일이 생기면 `isStructuredType`
  쪽에 더 구체적인 접두(`isTriggerParamStructured` 등)를 고려.

### 확인 완료 — 신규 i18n 키·file path·상수 제거는 충돌·잔존 없음

- `history.rerun.maskedInputBlocked`(`spec/5-system/13-replay-rerun.md:407`,
  `codebase/frontend/src/lib/i18n/dict/{ko,en}/history.ts`), `editor.runWithInputMasked`
  (`dict/{ko,en}/editor.ts`) 는 각각 ko/en 사전에만 존재하고 기존 다른 의미로 쓰인 자리 없음.
- `codebase/frontend/src/lib/utils/masked-markers.ts` 신규 파일은 같은 디렉터리의 기존
  kebab-case 명명 컨벤션(`edge-utils.ts`, `execution-status.ts` 등)을 그대로 따르고, 동일
  파일명이 기존에 없었음을 `ls` 로 확인.
- backend `executions.service.ts` 의 `MASKED_INPUT_DATA_REASON` 상수는 이번 PR 에서 **완전
  삭제**됐고(주석 앵커 전용이라던 상수 자체), spec 쪽 참조(`ExecutionsService` 의
  `MASKED_INPUT_DATA_REASON`)도 diff 상 모두 갱신돼 dangling 참조가 남지 않았다 —
  `grep -rn "MASKED_INPUT_DATA_REASON"` 결과 코드/스펙 어디에도 잔존하지 않음(확인 완료, 결과
  생략).
- requirement/policy ID(`RR-PL-01~07`, `WH-NF-02` 등)·API endpoint(`POST /api/executions/:id/re-run`
  등)·WS/webhook 이벤트명은 이번 PR 에서 **신규 도입된 것이 없다** — 전부 기존 §R17/§10.2 등
  기존 절 안의 서술 갱신이다.

## 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 닫는 스펙·구현 정합화이며, 신규로
도입되는 requirement ID·엔티티·API endpoint·이벤트명·ENV/config 키·spec 파일 경로가 없다.
유일한 신규 코드 표면인 `lib/utils/masked-markers.ts` 의 `MASKED_MARKERS`/`isMaskedMarker`/
`hasMaskedMarkerLeaf` 는 backend SoT 와 **의도적으로 이름을 맞춘 미러**라 충돌이 아니라 오히려
정상 설계이고, `rerun-modal.tsx` 의 신규 로컬 식별자(`splitMaskedParameters`,
`isStructuredType`, `blockedByMaskedInput` 등)는 모두 파일-로컬 스코프라 다른 파일과 이름이
겹쳐도 실질 충돌이 없다. `isStructuredType` 계열과 기존 `isStructured` 로컬 관용구의 의미
차이만 INFO 로 남긴다.

## 위험도

NONE
