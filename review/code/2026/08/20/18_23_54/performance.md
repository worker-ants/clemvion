STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 성능(Performance) 코드 리뷰 — eia-inputdata-marker-guard

## 발견사항

- **[INFO]** `Execution.inputData` egress 카브아웃 폐지로 list/detail 응답 경로의 행당 마스킹 비용이 사실상 두 배가 된다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (함수 `toExecutionDto` 내 `inputData: redactStoredDataForResponse(execution.inputData)`, 함수 `toResponseExecution` 내 `inputData: redactStoredDataForResponse(rest.inputData)`) · `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (함수 `toNodeExecutionDto` 의 `inputData: redactStoredDataForResponse(row.inputData)` — 이쪽은 이번 diff 로 새로 생긴 호출이 아니라 주석만 갱신됨, 코드는 기존과 동일)
  - 상세: 종전에는 `Execution.inputData` 가 `execution.inputData ?? null`(list 경로) 또는 `...rest` 스프레드 그대로(detail 경로)로 나가는 zero-cost 패스스루였다. 이번 변경으로 `outputData`/`error` 와 동일하게 `deepRedactCore` 재귀 walk(깊이 상한 10, `Object.entries`/`.map` 순회, credential-key 정규식 매칭, JSON-looking 문자열은 `JSON.parse`+재귀+`JSON.stringify`까지)를 거친다. `findByWorkflow` 의 list 경로는 `qb.take(limit)`(기본 20)로 페이지네이션돼 있어 행 수는 유계이므로 알고리즘적으로 위험하지는 않지만, 워크플로우 트리거 파라미터가 크거나(대량 배열, 긴 텍스트 등) 깊이 상한 근처까지 중첩된 경우 행당 CPU 비용이 이전 대비 유의미하게 늘어난다. `deepRedactSecrets` 의 depth-0 `WeakMap` 캐시(`DEEP_REDACT_CACHE`)는 같은 객체 참조를 재방문할 때만 이득이 있고 `inputData` 는 `outputData`/`error` 와 별개 객체 참조이므로 이 캐시의 이득을 못 받는다 — 즉 세 컬럼 각각 독립적으로 전체 walk 를 수행한다.
  - 제안: 의도된 보안/정합성 트레이드오프이므로 즉시 조치는 불필요하다. 다만 `inputData` 페이로드가 큰 워크플로우(대량 배열 파라미터, 파일 업로드 메타 등)가 늘어날 경우 list 엔드포인트의 p95 레이턴시를 실측해 두면, 향후 회귀를 이 변경과 구분하는 데 도움이 된다.

- **[INFO]** `ReRunModal.blockedByMaskedInput` 이 `useMemo` 없이 매 렌더마다 `maskedKeys.some(...)` + 각 키에 대한 `hasMaskedMarkerLeaf` 재귀 호출을 재계산한다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` (상수 `blockedByMaskedInput` 선언부, `handleSubmit` 바로 위)
  - 상세: `paramValues`/`touchedKeys` 가 키 입력마다 갱신되므로(`setParam`) 이 컴포넌트는 필드 입력 시마다 리렌더되고, 그때마다 `blockedByMaskedInput` 이 `maskedKeys` 전체를 순회하며 `hasMaskedMarkerLeaf`(깊이 상한 10의 재귀 walk)를 다시 호출한다. Re-run 모달의 파라미터 수는 워크플로우 manual-trigger 스키마 크기(통상 수 개~수십 개)로 유계이고 `hasMaskedMarkerLeaf` 자체도 깊이 10 상한이 있어 실질적 성능 영향은 미미하다.
  - 제안: 조치 불요에 가깝다. 다만 파라미터 수가 매우 많아지는 워크플로우가 생기면 `useMemo(() => ..., [maskedKeys, paramValues, touchedKeys, useOriginalInput])` 로 감싸 불필요한 재계산을 피할 수 있다.

## 요약
이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 폐지하고 프런트 3개 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 마커 가드를 신설하는 기능/데이터-무결성 PR로, 새로운 알고리즘·자료구조·캐싱 전략을 도입하기보다 기존 `deepRedactCore`(깊이 상한 10, WeakMap depth-0 캐시, copy-on-change)와 신규 `hasMaskedMarkerLeaf`(깊이 상한 10, `.some()` 조기 종료)를 재사용·재배치하는 수준이다. 두 함수 모두 순환 참조 걱정이 없는 `JSON.parse` 산물을 대상으로 하고 깊이 상한으로 스택 오버플로/과도한 재귀를 이미 방어하고 있어 알고리즘 복잡도·메모리·블로킹 I/O 관점에서 새로운 위험은 발견되지 않았다. 유일하게 주목할 지점은 `Execution.inputData` 가 이제 `outputData`/`error` 와 같은 깊이의 재귀 마스킹을 매 응답마다 거치게 되어 행당 비용이 늘었다는 점인데, list 경로는 페이지네이션(기본 20건)으로 유계이고 detail 경로는 단건이라 실질 위험은 낮다. N+1 쿼리·캐시 무효화·지연 로딩 관련 새 이슈는 없다.

## 위험도
LOW
