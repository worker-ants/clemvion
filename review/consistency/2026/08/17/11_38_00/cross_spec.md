# Cross-Spec 일관성 검토 — target: `spec/5-system/` (impl-prep)

## 조사 방법 (참고)

프롬프트 번들은 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md` 만 전문 포함하고 나머지 14개 `5-system/*` 파일과 `related_specs` 대부분은 컨텍스트 예산 초과로 절단되어 있었다. target 이 실질적으로 가장 최근·가장 활발히 변경된 영역(EIA §R17 마스킹 카탈로그, `4-execution-engine.md`, WS §4.1)이라고 판단해, 절단된 파일은 워크트리에서 `Read`/`grep`/`git show`로 직접 재조회했다 — 특히 `spec/5-system/14-external-interaction-api.md`(R17 전문), `spec/5-system/6-websocket-protocol.md`(§4.1), `spec/1-data-model.md`, `spec/5-system/12-webhook.md`(§5.3), `spec/5-system/13-replay-rerun.md`(§10.2), `spec/2-navigation/14-execution-history.md`(R-5), `spec/conventions/node-output.md`(Principle 7), `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/1-logic/12-background.md`(§8.2)와 대응 코드(`executions.service.ts`, `background-runs.service.ts`)를 대조했다. 최근 커밋(`89c3f3c53` #1180, `f5351e9c2` #1179, `b5e4dbb9c` #1178)의 diff도 직접 확인했다.

## 발견사항

- **[WARNING]** `12-background.md` §8.2 응답 스키마가 `outputData`/`inputData` egress 마스킹을 문서화하지 않는다 — `error` 만 문서화된 채 stale
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "적용 범위는 총칭이 아니라 열거다" (표면 여섯 목록의 (6) `BackgroundRunsService.toNodeExecutionDto`)
  - 충돌 대상: `spec/4-nodes/1-logic/12-background.md` §8.2 `nodeExecutions.data` 행 (다른 코드베이스 영역 — `4-nodes/`)
  - 상세: `f5351e9c2`(#1179, 2026-08-16)가 `12-background.md` §8.2 에 `error` 마스킹 캐비엇을 추가했고, 그 시점엔 코드도 `error` 만 마스킹했다(당시는 정합). 그런데 오늘 커밋 `89c3f3c53`(#1180, 2026-08-17 11:33)이 `background-runs.service.ts` 의 `toNodeExecutionDto`를 바꿔 `inputData`·`outputData` 도 `redactStoredDataForResponse` 로 마스킹하도록 확장했다(코드 확인, `background-runs.service.ts:305-306`). 같은 커밋에서 `14-external-interaction-api.md` §R17 의 "적용 범위는 총칭이 아니라 열거다" 항목도 "표면 여섯, **컬럼 둘**(`error`+`outputData`)"로 갱신되며 이 정확한 엔드포인트((6) `BackgroundRunsService.toNodeExecutionDto`)를 `outputData` 컬럼의 적용 표면으로 명시했다. 그러나 같은 커밋이 `spec/4-nodes/1-logic/12-background.md` 는 건드리지 않았다(`git show 89c3f3c53 --stat` 확인 — 이 파일 없음) — §8.2 의 `nodeExecutions.data` 행은 여전히 `error` 마스킹만 언급하고 `outputData`(와 `inputData`)는 침묵한다. `spec/1-data-model.md` §2.14 의 `NodeExecution.output_data`/`input_data` 행은 "응답·emit 시 마스킹" 이라 보편적으로 서술하는데, 이 엔드포인트를 소유하는 `12-background.md` 만 그 사실을 반영하지 않아 두 문서가 같은 필드에 대해 다른 인상을 준다. 이 정확한 실패 형태(코드가 표면을 넓히면 위성 문서 하나가 조용히 낡는다)는 이 저장소가 R17 본문에서 스스로 "webhook Rationale 의 whack-a-mole 우려를 이 작업 자체가 실증했다"고 적은 패턴의 재발이며, 직전 라운드(`review/consistency/2026/08/16/22_22_36/cross_spec.md` INFO)가 코드 쪽 갱신 필요성을 미리 예견했던 것의 절반(코드는 됐고 문서는 안 됨)이 실현된 상태다.
  - 제안: `12-background.md` §8.2 `nodeExecutions.data` 행에 "`outputData`/`inputData` 도 응답 egress 에서 값-패턴 마스킹을 거친다(`redactStoredDataForResponse`, DB 원문 보존) — 노드 레벨이라 `Execution.inputData` 카브아웃([EIA §R17](../../5-system/14-external-interaction-api.md) 잔여 ②)이 적용되지 않는다" 한 문장을 추가. planner 턴에서 `spec_impact`/체크리스트에 이 파일을 포함시킬 것.

## 참고 (경미 · 등급 미부여)

- `14-external-interaction-api.md` §R17 의 "표면 여섯, 컬럼 **둘**(`error`, `outputData`)" 서술과 "**`inputData` 는 이 목록의 대상이 아니다**" 문장은, 실제로는 노드 레벨(surface (5) `findById` 의 `nodeExecutions[]`, (6) `BackgroundRunsService`)에서 `NodeExecution.inputData` 도 같은 함수(`redactStoredDataForResponse`)로 마스킹되고 있어(코드 확인, `executions.service.ts:728-739`) 얼핏 자기모순처럼 읽힐 수 있다. 문서를 끝까지 읽으면 "이 목록"은 (error+outputData) 카탈로그를 가리키는 것이고 `NodeExecution.inputData` 마스킹은 바로 아래 "잔여 ②"·"레벨이 가른다" 표(WS §4.1 에도 동일 표 존재)로 별도 문서화돼 있어 실질적 모순은 아니다. 다만 "컬럼 둘"이라는 숫자가 표면에 따라 실제로는 2개(Execution 레벨)~3개(NodeExecution 레벨)로 다르다는 점을 명시하면 다음 라운드의 오독을 줄일 수 있다 — 등급 부여할 정도의 충돌은 아니라 참고로만 남긴다.

## 요약

target(`spec/5-system/`, 특히 §R17 마스킹 카탈로그 및 WS §4.1)은 `spec/1-data-model.md`·`spec/5-system/12-webhook.md`·`spec/5-system/13-replay-rerun.md`·`spec/2-navigation/14-execution-history.md`·`spec/conventions/node-output.md`·`spec/3-workflow-editor/4-ai-assistant.md`·`spec/conventions/swagger.md`와 "표면 여섯·컬럼 둘"·"`Execution` vs `NodeExecution` 레벨 카브아웃(round-trip 축)"·"ingestion vs egress 레이어 분리"·"`nodeLabel` 정정"·"`config` raw-echo 와 값-마스킹 공존"·R-5 경계 축 전부에서 실측(코드 대조 포함)상 정확히 일치했다 — 새로운 CRITICAL 급 자기모순은 발견하지 못했다. 유일한 실질 발견은 오늘 커밋(#1180)이 `background-runs.service.ts` 의 마스킹 범위를 `error`→`error`+`outputData`+`inputData` 로 넓히면서, 그 엔드포인트를 소유하는 다른 코드베이스 영역의 spec(`4-nodes/1-logic/12-background.md` §8.2)만 갱신에서 빠져 R17 SoT·`1-data-model.md`·실제 코드와 이 위성 문서 사이에 완전성 격차가 생긴 것이다(WARNING). 기능적으로는 코드가 이미 올바르게 마스킹하므로 보안 회귀는 아니며, 문서 drift 위험이다.

## 위험도

LOW
