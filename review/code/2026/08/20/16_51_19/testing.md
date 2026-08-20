STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard (16_51_19, 라운드 7)

## 컨텍스트

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지 +
재제출 소비처 3곳(폼 프리필·Re-run 모달·에디터 히스토리 로드) 마커 가드를 다룬다. 이미
6라운드(`14_08_45`→`14_44_08`→`15_10_25`→`15_32_34`→`15_59_17`→`16_25_35`)의 code review 가
testing 관점에서 촘촘히 훑었고, 각 라운드가 발견한 우회 경로(값-empty 판정 우회, touch 영구
해제, 무효 JSON 폴백, boolean+지연 스키마, 재귀 깊이 상한 부재, frontend 미러 테스트 과대
주장)를 캐너리로 고정해 왔다. 실제 소스(`executions.service.ts`/`.spec.ts`,
`background-runs.service.ts`/`.spec.ts`, `rerun-modal.tsx`/`.test.tsx`,
`editor-toolbar.tsx`/`editor-toolbar-run-input.test.tsx`, `masked-markers.ts`/`.test.ts`)를
직접 열어 `git diff origin/main...HEAD` 전량과 대조 재검토했다. `16_25_35` 라운드가 남긴
WARNING 2건(깊이 상한 부재, plan 라운드 카운트)은 이번 diff 에 실측상 반영돼 있다
(`masked-markers.ts` 의 `MAX_MARKER_SCAN_DEPTH = 10` + `masked-markers.test.ts` 의 경계
2건·스택 회귀 1건, `editor-toolbar.tsx` 의 2층 방어 try/catch).

이전 라운드 대비 신규로 짚을 결함을 하나 찾았다 — `15_59_17` 라운드가 제안했던 수정 범위
중 **절반만** 반영됐다.

## 발견사항

- **[WARNING]** `15_59_17` W6 이 "outputData/inputData 양쪽" 을 요구했는데 `background-runs.service.spec.ts` 는 여전히 `outputData` 표면만 고쳤다 — 노드 레벨 ingestion 마커 보존이 `inputData` 쪽에서 미검증
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:274` (`it('body nodeExecutions[].outputData 의 \`[REDACTED]\` 마커를 덮지 않는다', ...)`)
  - 상세: `15_59_17` 라운드 testing 리뷰는 "ingestion `[REDACTED]` 마커 보존" 캐너리가 `outputData` 에만 있고 `inputData` 에는 없다는 갭을 지적하면서, 제안에 **두 파일**을 명시했다 — `executions.service.spec.ts` 의 `⑥` 확장(완료됨, 커밋 `e1607c737`에서 `inputData.headers` 단언이 추가돼 지금 `:1296`~`:1301`에 남아 있다) **그리고** `background-runs.service.spec.ts:274` 의 `inputData` 버전 추가. 실제로 반영된 것은 전자뿐이다 — `git log -S`(커밋 `e1607c737`, RESOLUTION `15_59_17` W6)를 확인해도 수정 파일은 `executions.service.spec.ts` 하나만 언급되고, 이번 diff 시점 `background-runs.service.spec.ts:274` 테스트는 지금도 `makeBodyNodeExec({ id: 'body-marker', error: null, outputData: { request: { headers: { authorization: '[REDACTED]', ... } } } })` 처럼 `outputData` 만 마커로 채우고 `inputData` 는 지정하지 않는다(따라서 기본값 `null` — `makeBodyNodeExec` 기본값 참조). 이 자리는 `NodeExecution.inputData` 가 실제로 egress 마스킹 관문(`maskIfPresent(ne.inputData, redactStoredDataForResponse)`, `executions.service.ts` 및 `background-runs.service.ts`)을 지나는 표면이고, webhook ingestion 이 `Execution.inputData.headers` 에 남기는 `[REDACTED]` 가 12-webhook §5.3 계약의 원 동기다 — 그런데 정확히 `background-runs` 표면에서는 이 계약이 `inputData` 쪽에서 검증되지 않는다.
    이 저장소가 같은 파일의 바로 위 JSDoc(`:270-272`)에서 스스로 경고하는 "표면 A 는 있는데 표면 B 는 없다"(`23_50_03` testing W4, 원래는 `outputData` 가 없던 쪽) 패턴이 축을 바꿔(`inputData` 가 없는 쪽) 재발한 형태다. 함수 자체(`redactStoredDataForResponse`)는 `inputData`/`outputData` 를 구분하지 않으므로 현재 동작이 깨져 있을 가능성은 낮지만(`redact-stored-error.spec.ts` 단위 테스트가 함수 수준 마커 보존을 고정), 트래커에 이미 등재된 "마스킹 게이트 4곳 통합 헬퍼"(`spec-sync-external-interaction-api-gaps.md:315`) 리팩터가 `background-runs.service.ts` 의 `inputData` 배선만 실수로 다른 함수로 바꿔도 지금은 어떤 테스트도 잡지 못한다.
  - 제안: `background-runs.service.spec.ts:274` 테스트(또는 인접 신설 `it`)에 `makeBodyNodeExec` 의 `inputData` 에도 `{ headers: { authorization: '[REDACTED]', 'content-type': '...' } }` 를 채우고, 결과의 `nodeExecutions.data[0].inputData.headers` 가 `[REDACTED]` 를 보존하는지 단언을 추가한다. `executions.service.spec.ts` 의 `⑥`(`:1296`~`:1301`)이 같은 패턴을 이미 보여주므로 이식 비용은 낮다.

## 확인했으나 재지적하지 않은 것

- **프런트 3-조건 판정**(`touchedMaskedKeys` · `hasMaskedMarkerLeaf` · 구조 필드 coerce 실패)은
  각 조건이 빠지면 정확히 그 조건을 겨눈 캐너리가 RED 가 되도록 `rerun-modal.test.tsx` 에
  고정돼 있다 — 재확인 결과 6라운드 동안 누적된 캐너리(무효 JSON 폴백, touch 영구해제,
  `some`→`every`, boolean+지연 스키마, 다중 마스킹 키, "원본 입력 그대로 사용" 우회 예외)가
  모두 유효하게 남아 있다.
- **`masked-markers.ts` 의 깊이 상한**은 값 검사 우선순위(`isMaskedMarker` 가 깊이 컷보다
  먼저)와 상한 자체(10/11 경계)가 서로 다른 두 테스트로 분리 고정돼 있고, 뮤테이션(값-깊이
  순서 교환, 깊이 검사 삭제)이 각각 다른 단언을 RED 로 만든다는 것을 `16_25_35` RESOLUTION 이
  실측했다 — 재확인 결과 diff 상태와 일치.
- **backend `executions.service.spec.ts`**: `①`(`findById`)·`②`(`findByWorkflow`)·`⑤`(노드
  레벨)·`⑥`(ingestion 마커, `outputData`+`inputData` 양쪽)·`⑧`/`⑧-b`(`getChain`/`stop`) 전
  표면에서 반전된 방향(과거 "원문 보존" → 현재 "마스킹")을 직접 단언한다. `describe` 소제목도
  `## 두 레벨 모두 마스킹 대상이다` 로 최신 결론과 일치(`14_44_08` W7·`15_10_25` W1 이 지적한
  "주제문 방치" 패턴이 이 파일에서는 이미 해소돼 있음).
- **`dynamic-form-ui.test.tsx`**: `MASKED_MARKERS` import 경로만 `../dynamic-form-ui` →
  `@/lib/utils/masked-markers` 로 갱신됐고, 승격된 유틸의 동작 자체는
  `masked-markers.test.ts` 신규 스위트(직접 단위 테스트, non-string 입력 경로 포함)가
  커버한다 — 컴포넌트 테스트가 재검증할 필요가 없는 순수 이동이라 회귀 위험 없음.
- **테스트 격리**: `rerun-modal.test.tsx` 신규 `describe("ReRunModal — 마스킹 마커 왕복
  차단", ...)` 는 기존 `describe("ReRunModal", ...)` 와 형제 레벨이며 자체 `beforeEach` 에서
  mock/store/router 를 리셋한다 — 상태 누수 없음. `masked-markers.test.ts` 는 순수 함수만
  다뤄 mock 자체가 없다.
- **Mock 적절성**: `executions.service.spec.ts`/`background-runs.service.spec.ts` 는
  `redactStoredDataForResponse`/`redactStoredErrorForResponse` 를 모킹하지 않고 실구현을
  그대로 태운다 — 배선(어느 필드가 그 함수를 타는가)과 함수 자체(마커 보존·copy-on-change)를
  분리해 검증하는 구조가 유지된다.
- **`.only`/`.skip` 잔존 없음**: 이번 diff 로 변경된 `.spec.ts`/`.test.tsx` 전체를 grep 한
  결과 없음.

## 요약

핵심 마스킹-차단 로직(프런트 3소비처·backend 3표면)의 테스트는 7라운드에 걸쳐 매우 촘촘히
다져졌고, 각 라운드가 발견한 우회 경로가 정확한 캐너리로 남아 있음을 재확인했다. 유일하게
남은 결함은 `15_59_17` 라운드가 명시적으로 지적한 "ingestion 마커 보존 캐너리가
`inputData` 표면을 안 본다"는 갭이 `executions.service.spec.ts` 쪽에서만 고쳐지고
`background-runs.service.spec.ts`(노드 레벨, 같은 계약)에서는 그대로 남아 있다는 점이다 —
같은 리뷰가 같은 파일 안에서 스스로 경고한 "표면 A/표면 B 비대칭" 패턴이 축을 바꿔 재발한
형태라 WARNING 으로 올린다. 함수 자체는 단위 테스트로 보호되므로 현재 동작이 깨져 있을
가능성은 낮지만, 배선을 보호하는 테스트가 이 표면에서는 없다.

## 위험도

LOW
