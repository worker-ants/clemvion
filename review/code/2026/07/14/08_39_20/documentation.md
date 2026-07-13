# 문서화(Documentation) Review

## 발견사항

- **[INFO]** nodeId 면제 근거 주석 재프레이밍 — spec/CHANGELOG/plan 과 정합
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`resolveWaitingNodeExecutionId` JSDoc, `@param expectedNodeId`)
    - `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`interact()` 진입부 inline 주석 + `assertNodeId` JSDoc, 2곳)
    - `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` (F-1 테스트 상단 주석)
  - 상세: 기존 주석은 `in_process_trusted` 면제 근거를 "nodeId 를 모르므로/알지 못하므로"(진입점의 정보 가용성)로 설명했으나, 실제로는 `in_process_trusted` **scope 자체**가 면제 대상이고, `dto.nodeId`(예: `HooksService.handleFormStep` 이 `formState.nodeId` 를 채워 보내는 케이스)가 있어도 `isInternalCtx(ctx)` 판정만으로 `expectedNodeId=undefined` 가 확정된다(`interaction.service.ts` L119: `const expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId;`). 이번 델타는 이 네 곳의 주석을 "scope 단위 면제, nodeId 가용 여부와 무관"으로 정정해 코드 실제 동작과 일치시켰다. `handleFormStep`(`codebase/backend/src/modules/hooks/hooks.service.ts`)을 직접 대조한 결과 주장(`nodeId: formState.nodeId` 를 실제로 채워 보내면서도 동일 정책으로 면제됨)이 코드와 일치함을 확인했다.
  - 교차 확인: `spec/5-system/4-execution-engine.md` §7.5.1 표(라인 1055), `CHANGELOG.md`(라인 7), `plan/in-progress/eia-command-waiting-surface-guard.md`(라인 122)가 이미 동일한 "scope 단위 면제 + form 제출도 nodeId 알아도 동일 policy" 프레이밍을 담고 있어, 이번 주석 변경은 기존에 앞서 갱신된 spec/CHANGELOG/plan 을 코드 주석이 뒤늦게 따라잡는 방향 — 문서-코드 drift 를 줄이는 개선이다.
  - 제안: 없음. 순수 주석 정합화이며 동작 변경이 없다(로직 라인 `expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId` 자체는 diff 대상 아님).

- **[INFO]** `interaction.service.spec.ts` F-1 테스트 제목("nodeId 없어도 수용")과 주석 프레이밍 폭 불일치 — 실질 문제 아님
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` L268-271 (F-1 `it()` 블록)
  - 상세: 갱신된 주석은 "nodeId 가용 여부와 무관"이라는 더 넓은 주장(= nodeId 가 있어도 없어도 면제)을 담지만, 바로 아래 테스트 자체는 nodeId 를 아예 전달하지 않는 케이스(`submit_message`, dto 에 nodeId 필드 없음)만 검증한다. "internal ctx + dto.nodeId 존재" 조합(예: `handleFormStep` 이 실제로 보내는 `submit_form` + `nodeId` 동시 존재 케이스)을 직접 exercising 하는 유닛 테스트는 이 근처에 보이지 않는다.
  - 제안: 문서화 관점의 필수 수정은 아니다(주석 자체의 정확성 문제는 아니며, 실제 코드 동작도 위에서 확인한 대로 일치). 다만 향후 회귀 방지 관점에서 "internal ctx + dto.nodeId 존재해도 expectedNodeId=undefined" 를 직접 assert 하는 케이스를 F-1 인접에 추가하면 주석이 주장하는 "scope 단위, nodeId 가용 여부 무관" 이 테스트로도 뒷받침된다. (선택 사항, 이번 리뷰의 CRITICAL/WARNING 대상 아님)

- **[INFO]** README/CHANGELOG/API 문서 추가 필요성 없음
  - 위치: 해당 없음
  - 상세: 이번 변경은 4곳의 기존 JSDoc/inline 주석 문구만 교체한 순수 문서 정합화이며, 공개 API 시그니처·동작·환경변수·설정 옵션 변경이 없다. CHANGELOG 는 이미 해당 behavior 변경(§7.5.1 nodeId 일치 검사 도입)과 scope 면제 프레이밍을 기록하고 있어 추가 항목 불필요.
  - 제안: 없음.

## 요약
본 델타는 `in_process_trusted`(chat-channel) nodeId 면제의 근거를 "진입점이 nodeId 를 모른다"에서 "scope 단위 정책적 면제(nodeId 가용 여부 무관)"로 정정하는 4곳의 순수 주석 변경이다. 실제 코드(`isInternalCtx(ctx) ? undefined : dto.nodeId`)와 `HooksService.handleFormStep` 의 `nodeId` 전달 여부를 직접 대조한 결과 새 주석의 주장이 정확했고, 이미 갱신되어 있던 spec §7.5.1·CHANGELOG·plan 의 동일 프레이밍과도 합치해 문서-코드 drift 가 해소됐다. 발견된 사항은 모두 INFO 등급이며, 테스트 커버리지 확장(선택 사항) 외에 추가 문서 조치는 불필요하다.

## 위험도
NONE
