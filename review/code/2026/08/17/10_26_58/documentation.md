# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 `Unreleased` 항목이 최종 커밋(브랜치 마지막 커밋, `fix(executions): 재제출 카브아웃을 Execution 레벨로 한정`)이 재도입한 "노드 레벨 `inputData` 마스킹"을 반영하지 못하고 있다.
  - 위치: `CHANGELOG.md:26`(`**⚠️ \`inputData\` 는 마스킹하지 않는다 (의도)**` 문단, ~26-33줄)
  - 상세: 이 문단은 "`inputData` 는 마스킹하지 않는다"를 블랭킷 서술로 적었지만, 실제 최종 상태는 **레벨에 따라 갈린다** — `Execution.inputData`(REST 최상위)는 카브아웃(비마스킹) 그대로이나 `NodeExecution.inputData`(노드 레벨, `background-runs.service.ts` / `executions.service.ts` 의 `nodeExecutions[]`)는 **마스킹된다**. 이 구분은 `spec/5-system/14-external-interaction-api.md:1585-1591`, `spec/5-system/13-replay-rerun.md:350-356`, `spec/1-data-model.md:471,550`, `spec/5-system/6-websocket-protocol.md:200-208` 에는 "2026-08-17 정정"으로 정확히 반영됐고 DTO JSDoc(`execution-response.dto.ts`, `background-run-response.dto.ts`)도 갱신됐지만, `CHANGELOG.md` 는 그 최종 커밋에서 건드려지지 않아(마지막 수정 커밋은 `b05756d9e`, 그 이전 라운드) 스테일 상태다. `git log --oneline -- CHANGELOG.md` 로 확인.
  - 제안: `⚠️ inputData 는 마스킹하지 않는다` 문단에 "단, `NodeExecution.inputData`(노드 레벨)는 재제출 소비처가 없어 마스킹 대상이다 — 카브아웃은 `Execution` 레벨 한정" 캐비엇을 추가한다.

- **[WARNING]** `plan/in-progress/eia-fanout-and-internal-data-masking.md` 의 요약 표·§철회·§부작용 섹션이 같은 최종 커밋의 레벨-기반 재택일을 반영하지 못해 spec 문서와 어긋난다.
  - 위치: `plan/in-progress/eia-fanout-and-internal-data-masking.md:32`(요약 표 B행 "`inputData` 는 **철회**"), `:159-181`(§철회 섹션, 특히 `:176-177` "되돌린 범위는 `inputData` 하나로 정확히 좁혔다"), `:188-192`(§부작용 표 — `실행 상세 API 의 inputData/outputData | 원문 | 마스킹` 행)
  - 상세: 이 plan 파일은 `39cb0bf1a` 커밋에서 마지막으로 수정됐고, 브랜치의 최종 커밋(`plan/` 파일을 건드리지 않은 채 `NodeExecution.inputData` 마스킹을 재도입)은 이 문서를 갱신하지 않았다. 그 결과 (1) 요약 표 B행이 "`inputData` 는 철회"라고만 적어 노드 레벨 마스킹 재도입을 누락하고, (2) §부작용 표의 "실행 상세 API 의 `inputData`/`outputData`: 원문→마스킹" 행이 `Execution.inputData`(실제로는 비마스킹 유지)까지 마스킹된다고 잘못 읽히며, WS/SSE 행(`:190`)에는 `input` 자체가 아예 빠져 있다(노드 이벤트 `input` 도 이제 마스킹 대상). 같은 작업의 formal spec(`14-external-interaction-api.md` 등)은 정확히 갱신됐는데 이 plan 문서만 뒤처졌다 — "plan 은 실제 상태를 반영해야 한다"는 저장소 관례에 어긋난다.
  - 제안: 표 B행과 §부작용 표에 레벨 구분(`Execution` vs `NodeExecution`) 캐비엇을 추가하거나, 최소한 최종 결정을 가리키는 각주를 §철회 말미에 붙인다.

- **[WARNING]** `run-results.mdx`/`run-results.en.mdx` 의 "Input" 행이 이제 마스킹 대상인 노드 레벨 `inputData` 에 대한 캐비엇을 담지 않아, 나란한 "Output" 행과 비대칭이다.
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx:60`(Input 행, 미변경) vs `:61`(Output 행, 마스킹 캐비엇 추가됨) / `run-results.mdx:71`(Input 행) vs `:72`(Output 행)
  - 상세: 이 두 mdx 는 노드 상세 패널의 서브탭(Preview/Input/Output/…)을 설명하며, "Input" 행은 `result.inputData`(프런트 `ResultDetail` 컴포넌트, `codebase/frontend/src/components/editor/run-results/result-detail.tsx:336-338`)를 가리키는데 이는 노드 레벨 `NodeExecution.inputData`(백엔드 `background-runs.service.ts` / `executions.service.ts` `nodeExecutions[]`)와 같은 데이터다. 최종 커밋에서 이 컬럼이 **마스킹 대상으로 재도입**됐지만(백엔드 Swagger `background-run-response.dto.ts` 설명은 갱신됨), 두 mdx 는 `b05756d9e`(inputData 마스킹 "전면 철회" 라운드) 시점 이후 갱신되지 않아 "Output" 행에만 자격증명 마스킹 캐비엇이 붙고 "Input" 행은 예전 그대로다. 사용자가 Input 탭에서 예상치 못한 `***` 를 보고 버그로 오인할 수 있다.
  - 제안: Input 행 description 끝에 Output 행과 대칭되는 문구(예: "Values detected as credentials are also shown as `***` here — the stored value itself is not lost.")를 추가한다.

- **[WARNING]** `executions.service.spec.ts` 의 신규 JSDoc 블록이 test `⑥-b`(및 `BackgroundRunsService` 자매 스펙)를 "`inputData` 비대상(마스킹 제외) 고정"의 다섯 표면 중 하나로 잘못 분류한다 — 실제로 그 테스트들은 **정반대**(노드 레벨 `inputData` 는 마스킹된다)를 검증한다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 내 `executions.service.spec.ts:1362-1376`(`it('⑧ getChain·stop …')` 바로 위 JSDoc 블록)
  - 상세: 이 블록은 "`inputData` 비대상을 이 파일의 다섯 표면에서 각각 고정한다 — 위 ①(findById)·②(findByWorkflow)가 둘, ⑥-b 가 nodeExecutions[] 로 셋째, 여기 ⑧·⑧-b 가 getChain·stop 으로 넷째·다섯째다. 여섯째 표면(BackgroundRunsService)은 background-runs.service.spec.ts 가 맡는다"라고 적는다. 그러나 `⑥-b`(`:1294-1348`)의 실제 단언은 "노드 레벨은 세 컬럼 전부 대상이다 … `inputData` 만 leaky 해도 복제되어야 한다"(`:1290-1292`, `:1331-1338`)이고, `background-runs.service.spec.ts:223-265` 도 "노드 레벨이라 `inputData` 도 마스킹 대상"임을 명시적으로 검증한다 — 즉 이 두 표면은 "비대상(exemption)"이 아니라 "마스킹 대상(enforcement)"의 캐너리다. 실제 "비대상" 캐너리는 `①`·`②`·`⑧`·`⑧-b` 넷뿐이며, 이 블록의 "다섯 표면" 이라는 수치 자체도 그 오분류에서 비롯된 오산이다. 이 저장소가 방금 고친 "흩어진 수치" 결함 클래스(`00_23_57` documentation W1)가 이번엔 방향이 아니라 **분류**에서 재발한 형태다.
  - 제안: 블록을 두 그룹으로 분리 서술한다 — "Execution 레벨 비대상(exemption) 4곳: ①②⑧⑧-b" / "노드 레벨 마스킹(enforcement) 캐너리: ⑤·⑥-b(이 파일) + `BackgroundRunsService`(자매 파일)". 표면 정본 참조(`toResponseExecution`)는 유지.

## 요약

이번 diff 의 프로덕션 코드·Swagger DTO·formal spec(`spec/5-system/14-external-interaction-api.md` 등)에 달린 문서화는 예외적으로 두텁고 정확하다 — JSDoc 이 결정의 배경·반증된 대안·소스 추적 경로까지 남기고, `MASKED_INPUT_DATA_REASON` 같은 앵커 상수로 한 곳에 근거를 모으는 패턴이 일관되게 지켜졌다. 다만 브랜치의 **가장 마지막 커밋**(재제출 카브아웃을 `Execution` 레벨로 좁히고 `NodeExecution.inputData` 마스킹을 재도입한 변경)이 formal spec 은 정확히 갱신했으면서도 세 종류의 "요약/사용자 대면" 문서 — `CHANGELOG.md`, 작업 plan(`eia-fanout-and-internal-data-masking.md`), 프런트 유저 가이드(`run-results.mdx`/`.en.mdx`) — 는 갱신하지 않아 최종 동작보다 좁게(비마스킹으로) 서술하는 상태로 남겼다. 안전 방향(실제가 문서보다 더 보호적)이라 보안 결함은 아니지만, 릴리스 노트·작업 plan·유저 가이드가 실제 배포될 동작과 다르게 읽혀 혼란을 유발할 수 있다. 추가로 새 테스트 JSDoc 한 곳이 "비대상(exemption)" 캐너리와 "마스킹 대상(enforcement)" 캐너리를 뒤섞어 분류해, 정확히 이 PR 이 근절하려던 "흩어진 수치" 결함 클래스가 방향을 바꿔 재발했다. 넷 다 WARNING 수준(문서 정확성 문제이며 프로덕션 동작 자체는 안전 방향으로 올바르다)이라 병합을 막을 필요는 없으나 이 라운드 내 정정을 권장한다.

## 위험도
MEDIUM
