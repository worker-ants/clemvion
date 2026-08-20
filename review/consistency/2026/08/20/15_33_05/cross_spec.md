# Cross-Spec 일관성 검토 — `spec/5-system/` (Execution.inputData 카브아웃 폐지 + 프런트 마커 가드)

## 검토 범위

- target: `spec/5-system/` (impl-done, diff-base `origin/main`)
- 이번 작업의 실체: `Execution.inputData` 의 egress 마스킹 카브아웃을 폐지하고, 재제출
  소비처 3곳(폼 프리필 `dynamic-form-ui.tsx` · Re-run 모달 `rerun-modal.tsx` · 에디터
  히스토리 로드 `editor-toolbar.tsx`)에 마스킹-마커 가드를 세워 "마스킹된 값이 실제
  입력이 되는" 데이터 오염 경로를 닫음.
- 함께 갱신된 파일: `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,14-external-interaction-api}.md`,
  `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`(§2.2 한 줄),
  `spec/4-nodes/1-logic/12-background.md` — 코드(`executions.service.ts`,
  `sanitize-error-message.ts`, 신규 `masked-markers.ts`, `rerun-modal.tsx`,
  `editor-toolbar.tsx`)와 대조 확인.

## 발견사항

- **[WARNING]** `Execution.inputData` 의 WS 전달 여부에 대한 서술이 target 과 `3-execution.md` §8 에서 정반대다
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 "`input` 마스킹은 REST 노드
    레벨과 일치한다" 캐비엇 (미변경 기존 서술이나, 본 PR 이 그 위 문단에서 "두 레벨이
    REST·WS 양쪽에서 같은 규칙을 따른다" 로 재확인·강화함) · `spec/5-system/14-external-interaction-api.md`
    "`input`/`inputData` 는 두 레벨 모두 마스킹한다" 표 (`WS node 이벤트 input (emit) | 함`)
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` §8 "inputData 데이터 흐름" —
    **"WebSocket 이벤트에는 inputData가 포함되지 않음"** / "REST 폴링을 통해서만 NodeResult
    에 반영됨" 이라고 정반대로 서술
  - 상세: target 은 `execution.node.completed` emit payload 의 `input` 필드가 REST
    `nodeExecutions[].inputData` 와 **같은 프런트 store 슬롯**(`nodeResults[].inputData`)
    으로 들어가므로 "한쪽만 가리면 flip-flop 이 난다" 는 전제로 마스킹 정책을 정당화한다.
    실제 코드로 확인됨 — `execution-engine.service.ts` 의 `NODE_COMPLETED` emit 이
    `input: nodeExecution.inputData` 를 싣고(6119 부근), 프런트
    `use-execution-events.ts` 가 그 필드를 `inputData: payload.input` 로 store 에 반영한다
    (744행 등). 즉 target 의 "WS 도 inputData 를 나른다" 주장이 코드와 일치하고,
    `3-execution.md` §8 의 "WS 에는 inputData 가 없다" 주장이 코드와 어긋난다. 이 항목은
    이번 diff 가 새로 만든 결함은 아니다(§8 문구는 이번 PR 이 건드리지 않았다) — 하지만
    이번 PR 이 "두 레벨 모두 같은 규칙" 이라며 정확히 이 메커니즘(WS 가 `input` 을 실어
    같은 슬롯에 꽂힌다는 전제)을 재확인·의존하는 문서를 늘렸기 때문에, `3-execution.md`
    를 그대로 신뢰하는 독자는 "REST 폴링만이 유일한 소스라 마스킹 flip-flop 위험이 없다"
    고 오판할 수 있다 — 이 저장소가 과거 정확히 이 클래스의 오판으로 CRITICAL 을 낸 이력
    (`01_17_49` cross_spec CRITICAL, target 문서 자체가 인용)이 있는 영역이라 방치 비용이
    낮지 않다.
  - 제안: `3-execution.md` §8 을 "`execution.node.completed` 는 `input`(=NodeExecution
    의 inputData, 마스킹됨)을 포함하며 REST 폴링 값과 같은 store 슬롯에 병합된다. 늦게
    도착하는 이벤트가 먼저 도착한 값을 지우지 않도록 병합 시 `??` 로 보존한다" 정도로
    갱신 — 이번 marker-guard PR 의 범위에 없었다면 `plan/in-progress/spec-sync-websocket-protocol-gaps.md`
    또는 신규 항목으로 등재해 정정을 트래킹.

- **[INFO]** target 자체 i18n 카탈로그(§10.4)가 같은 target 파일이 §10.2 에서 막 도입한 새 UI 상태를 누락
  - target 위치: `spec/5-system/13-replay-rerun.md` §10.2 (마스킹 마커 재입력 강제 —
    이번 PR 신규) vs §10.4 "i18n 키" 테이블
  - 충돌 대상: 같은 파일 내부이므로 엄밀히는 cross-spec 이 아니라 self-consistency 이지만,
    §10.4 테이블은 이 기능의 i18n 키 **카탈로그 SoT** 로 유지되고 있어(다른 문서들이
    §10.4 를 인용) 실제 코드(`codebase/frontend/src/lib/i18n/dict/{ko,en}/history.ts` 의
    `maskedInputBlocked`, `rerun-modal.tsx` 의 `t("history.rerun.maskedInputBlocked")`)와
    문서가 벌어졌다는 점에서 언급함
  - 상세: `history.rerun.maskedInputBlocked` 키가 dict 파일·컴포넌트에는 존재하나 §10.4
    표에 행이 없다. (참고: `editor-toolbar.tsx` 의 `editor.runWithInputMasked` 키는
    애초에 `3-execution.md`/target 어디에도 i18n 카탈로그 관례가 없어 이 항목과는 다른
    사안 — 기존에도 `editor.runWithInputEmpty` 등이 카탈로그화돼 있지 않았으므로 이번
    PR 이 만든 회귀가 아니다.)
  - 제안: `13-replay-rerun.md` §10.4 표에 `history.rerun.maskedInputBlocked` 행 추가.

## 점검했으나 충돌 없음 (근거 요약)

- **데이터 모델**: `spec/1-data-model.md` 의 `Execution.input_data` / `NodeExecution.input_data`
  주석이 target 의 새 정책("두 레벨 모두 마스킹, DB 는 원문 보존")과 정확히 미러됨. 코드
  `executions.service.ts` (`ResponseExecution.inputData` 타입 추가, `toResponseExecution`/
  `toExecutionDto`/`toNodeExecutionDto` 세 표면 모두 `redactStoredDataForResponse` 적용)와도
  일치.
- **API 계약**: `execution-response.dto.ts`/`background-run-response.dto.ts` 의 Swagger
  설명이 카브아웃 폐지를 정확히 반영. `MASKED_INPUT_DATA_REASON` 상수는 코드 전역에서
  완전히 제거됨(잔존 참조 0건, grep 확인) — 죽은 앵커 없음.
- **요구사항 ID**: 새 ID 부여 없음(기존 `EIA §R17`/`RR-PL-02` 범위 내 갱신).
- **상태 전이**: Execution/NodeExecution 상태 머신 자체는 불변 — 이번 변경은 egress
  표현 계층에 한정.
- **RBAC**: 권한 모델 변경 없음. `verifyOwnership`/역할 게이트 서술 미변경.
- **계층 책임**: `masked-markers.ts` 를 `dynamic-form-ui.tsx` 내부에서 `lib/utils/` 로
  승격한 것은 세 소비처(폼·Re-run 모달·툴바)가 공유하는 정당한 리팩터 — "SoT 는 backend,
  프런트는 미러" 라는 기존 관례를 그대로 유지. `spec/5-system/14-external-interaction-api.md`
  의 `code:` frontmatter 에 세 파일이 모두 추가되어 spec-impl 매핑도 갱신됨.
- **12-webhook.md 의 "ingestion 층은 대체되지 않는다" 캐비엇**: `$trigger.headers` 표현식
  값은 egress 를 타지 않는다는 주장은 `spec/5-system/5-expression-language.md` 의
  "1차 마스킹은 webhook ingestion 시점" 서술과 일치 — 모순 없음.
- **spec/3-workflow-editor/4-ai-assistant.md 의 별도 마스킹 규칙**(`maskSensitiveFields`,
  `****<last4>` 형태)은 EIA §R17 계열(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 마커
  형태가 다르지만, 이는 AI 어시스턴트 tool-call 표면 고유의 **기존(pre-existing)** 별도
  마스킹 유틸이며 이번 PR 이 손대지 않았고 재제출 경로도 없어 이번 변경과 충돌하지 않음.

## 요약

target(`spec/5-system/`)의 `Execution.inputData` 카브아웃 폐지는 `spec/1-data-model.md`,
DTO 주석, `4-nodes/1-logic/12-background.md` 등 함께 갱신된 6개 파일과 내적으로 잘
미러되어 있고, 코드(`executions.service.ts`/`sanitize-error-message.ts`/신규
`masked-markers.ts`/세 소비처 컴포넌트)와도 정확히 일치한다. 유일하게 실질적인 발견은
`spec/3-workflow-editor/3-execution.md` §8 이 "WS 이벤트에는 inputData 가 없다" 고
target 과 정반대로 서술하는 pre-existing 불일치인데, 코드로 검증한 결과 target(WS 도
`input` 을 실어 같은 store 슬롯에 병합됨)이 사실과 맞고 `3-execution.md` 쪽이 stale
하다 — 이번 PR 의 diff 가 만든 결함은 아니지만 이번 PR 이 강화한 "두 레벨 동일 규칙"
서사의 핵심 전제와 직접 충돌하므로 함께 정정을 권한다. 그 외 i18n 카탈로그 한 줄 누락은
경미한 완결성 이슈다. 두 발견 모두 기능을 막지 않고 CRITICAL 급 모순은 없다.

## 위험도

LOW
