STATUS=success cross_spec review complete — 0 CRITICAL, 0 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — `Execution.inputData` egress 마스킹 카브아웃 폐지 (eia-inputdata-marker-guard)

## 검토 범위·방법

target = `spec/5-system/` (impl-done, diff-base `origin/main`). 실제 diff 는 `git diff origin/main...HEAD`
로 워킹트리에서 직접 재확인했다(프롬프트 번들이 예산 초과로 `14-external-interaction-api.md` 본문과
diff 자체를 절단했기 때문). spec 변경 파일 7개 전부와, 이들이 인용하는 `spec/conventions/node-output.md`,
`spec/conventions/secret-store.md`, `spec/2-navigation/14-execution-history.md`, `spec/data-flow/10-triggers.md`,
`spec/5-system/5-expression-language.md`, `spec/3-workflow-editor/4-ai-assistant.md` 등 `inputData` 를
언급하는 spec 전 파일(`grep -rl inputData spec/`)을 대조했다. 관련 코드 diff(`executions.service.ts`,
`execution-response.dto.ts`, `background-runs.service.ts`, `background-run-response.dto.ts`,
`sanitize-error-message.ts`, `masked-markers.ts`, i18n dict)도 spec 서술과 실제 구현이 어긋나지 않는지
교차 확인했다.

변경의 본질: `Execution.inputData` 는 2026-08-16~08-19 사이 "재제출 소비처가 있어 egress 마스킹
대상이 아니다"(카브아웃)였다. 이번 변경은 프런트 마커 가드(폼 프리필 스킵/Re-run 모달 제출 차단/에디터
히스토리 로드 실행 차단)를 완성해 카브아웃을 닫고, `Execution.inputData` 도 `NodeExecution.inputData`
와 동일하게 egress 마스킹 대상으로 전환한다.

## 발견사항

이 변경이 인용되는 7개 spec 파일(`spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`,
`spec/4-nodes/1-logic/12-background.md`, `spec/5-system/12-webhook.md`,
`spec/5-system/13-replay-rerun.md`, `spec/5-system/14-external-interaction-api.md`,
`spec/5-system/6-websocket-protocol.md`)을 전수 대조한 결과 **CRITICAL/WARNING 급 모순은 발견되지
않았다.** 카브아웃→마스킹 전환 서사(날짜 2026-08-20, "잔여 ② 해소", "축 폐기", "두 레벨 모두 마스킹")가
7개 파일에 걸쳐 일관되게 동기화돼 있고, `spec/5-system/14-external-interaction-api.md` §R17 이 SoT 로서
"카브아웃이었던 이유 → 닫는 조건 → 조건 충족 근거(3개 소비처 표)"를 명시하며 나머지 6개 파일은 그 결론만
인용하는 구조가 일관되게 유지된다. 자매 필드(`NodeExecution.inputData`, `outputData`, `error`)와의
관계(무엇이 언제부터 마스킹 대상이었는지)도 각 파일에서 동일하게 서술된다.

코드 대조에서도 어긋남이 없었다:
- `ExecutionsService.toResponseExecution`/`findAllByWorkflow`/`getChain` 세 지점 모두
  `redactStoredDataForResponse(execution.inputData)` 로 전환됐고, 관련 JSDoc(`MASKED_INPUT_DATA_REASON`
  상수 및 앵커) 이 정확히 제거·갱신됐다 — spec 이 "카브아웃 폐지"를 서술하면서 코드에 남은 카브아웃
  주석을 방치하는 패턴(과거 반복된 실패 형태, `MASKED_INPUT_DATA_REASON` 잔존)이 이번엔 없다.
- `BackgroundRunsService`/`BackgroundRunNodeExecutionDto` 도 같은 문구로 동기화됐고
  `spec/4-nodes/1-logic/12-background.md` 서술과 일치한다.
- 프런트 마커 상수 SoT(`sanitize-error-message.ts` `MASKED_MARKERS`/`MAX_REDACT_DEPTH=10`)와 프런트
  미러(`masked-markers.ts` `MASKED_MARKERS`/`MAX_MARKER_SCAN_DEPTH=10`)의 값 집합·깊이 상한이 정확히
  일치한다(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`, depth 10).
- `spec/5-system/13-replay-rerun.md` 에 추가된 i18n 키(`history.rerun.maskedInputBlocked`)가
  `codebase/frontend/src/lib/i18n/dict/{ko,en}/history.ts` 에 정확히 반영됐다.

- **[INFO]** `spec/2-navigation/14-execution-history.md` 의 응답 예시 JSON 이 마스킹 정책과 무관하게
  구식 placeholder(`"inputData": {}`, `"inputData": { "key": "value" }`)를 유지
  - target 위치: (간접) `spec/5-system/14-external-interaction-api.md` §R17 / `spec/1-data-model.md` §2.13
  - 충돌 대상: `spec/2-navigation/14-execution-history.md` L360-420 목록/상세 API 응답 예시
  - 상세: 이 예시는 자격증명 형태 값을 담고 있지 않아 마스킹 여부와 실질적으로 모순되지는 않는다
    (거짓 서술은 없음). 다만 이 문서가 다른 컬럼(`error`)의 egress 마스킹은 R-5 각주로 명시 인용하면서
    `inputData` egress 마스킹 정책 전환은 언급하지 않아, 이 예시만 보면 "마스킹 없이 원문이 나간다"로
    오독될 여지가 남는다.
  - 제안: 필수는 아니나, 다음 번 이 문서를 만질 때 §R17 각주(또는 R-5 와 같은 각주)를 한 줄 추가해
    `inputData`/`outputData`/`error` 가 egress 마스킹 대상임을 명시하면 향후 드리프트를 예방한다.
    이번 PR 범위 확장을 요구할 정도는 아니다.

## 요약

`Execution.inputData` egress 마스킹 카브아웃 폐지는 데이터 모델(`spec/1-data-model.md`), API 응답 계약
(`spec/5-system/14-external-interaction-api.md` §R17, DTO 주석), WS emit 계약(`6-websocket-protocol.md`),
Re-run/에디터 히스토리 UX(`13-replay-rerun.md`, `3-execution.md`), ingestion 방어층 서술(`12-webhook.md`),
Background 실행 하위 리소스(`4-nodes/1-logic/12-background.md`) 7개 spec 파일에 걸쳐 발생하는 넓은 변경
이지만, 모든 파일이 같은 전환 날짜(2026-08-20)·같은 근거(프런트 마커 가드 3소비처 완성)·같은 SoT(§R17)
를 일관되게 인용하며 서로 모순되지 않는다. 코드(백엔드 마스킹 관문, 프런트 마커 상수 미러, i18n)도 spec
서술과 정확히 대응한다. Cross-spec 관점에서 이 변경을 그대로 채택해도 다른 영역이 깨지거나 이중 정의가
생기지 않는다.

## 위험도
NONE
