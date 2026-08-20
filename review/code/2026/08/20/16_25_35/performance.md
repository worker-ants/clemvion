STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# 성능(Performance) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이 changeset 의 실질 코드 변경은 `Execution.inputData` egress 마스킹 카브아웃 폐지 한 가지다.
프롬프트에 포함된 78~143개 파일 중 절대다수는 문서(CHANGELOG/spec/plan/유저가이드)와 이전
리뷰 라운드가 남긴 `review/**` 산출물(테스트 결과·메타데이터)이라 성능 관점에서 실질 코드가
아니다. 실제로 CPU 비용에 영향을 주는 부분은 (1) backend `redactStoredDataForResponse` 를
`Execution.inputData` 에도 새로 거는 것, (2) frontend `hasMaskedMarkerLeaf` 재귀 순회 신설,
(3) 그 함수를 소비하는 `rerun-modal.tsx`/`editor-toolbar.tsx` 세 곳이다.

## 발견사항

- **[WARNING]** `hasMaskedMarkerLeaf` 가 깊이 제한 없이 재귀하는데, 에디터의 실시간 JSON 검증
  경로는 이 호출을 try/catch 밖에 두어 스택 오버플로 예외를 그대로 흘린다
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:64-73` (`hasMaskedMarkerLeaf`, 특히 66행 `Array.isArray(value)) return value.some(hasMaskedMarkerLeaf)` 및 67-70행 object 분기) / `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:103-120` (`jsonError` useMemo, 특히 118행 `if (hasMaskedMarkerLeaf(parsed)) return t("editor.runWithInputMasked");`)
  - 상세: backend 대응 함수 `deepRedactCore`(`codebase/backend/src/shared/utils/sanitize-error-message.ts:241-254`)는 `MAX_REDACT_DEPTH = 10`(112행)에서 재귀를 끊고 마커로 치환하는데, 프런트 미러인 `hasMaskedMarkerLeaf` 에는 그 짝이 없다 — 배열/객체를 만나면 무조건 한 단계 더 내려간다. `Execution.inputData` 가 backend 를 거쳐 온 값이면 depth 10 에서 이미 마스킹돼 안전하지만, `editor-toolbar.tsx` 의 "Run with Input" JSON 텍스트에어리어는 **사용자가 그 자리에서 직접 타이핑/붙여넣기한 임의 JSON**을 `JSON.parse` 한 뒤 곧바로 `hasMaskedMarkerLeaf(parsed)` 에 넘긴다(118행) — backend 검증을 거치지 않은 입력이다. V8 의 `JSON.parse` 는 반복적 구현이라 깊은 중첩도 파싱은 통과시키지만, `hasMaskedMarkerLeaf` 는 네이티브 함수 호출 스택을 그대로 쓰는 재귀라 충분히 깊게 중첩된(그러나 문법적으로는 유효한) JSON 배열/객체를 넣으면 `RangeError: Maximum call stack size exceeded` 를 던질 수 있다. 이 호출이 108행의 `try { parsed = JSON.parse(trimmed); } catch (e) { ... }` 블록 **밖**(118행)에 있어 그 예외를 못 잡는다 — `useMemo` 콜백 안(렌더 경로)에서 발생하는 uncaught exception 이므로 이벤트 핸들러 에러와 달리 상위 React 트리로 전파돼, 근처에 에러 바운더리가 없으면 에디터 화면 전체가 깨질 수 있다. "잘못된 JSON" 안내 대신 흰 화면/크래시로 퇴화하는 셈이라, 기존에 `JSON.parse` 실패만 처리하던 안전한 실패 경로보다 후퇴다.
  - 제안: `hasMaskedMarkerLeaf` 에 `deepRedactCore` 와 동일한 깊이 상한(예: 동일한 `MAX_REDACT_DEPTH` 상수를 프런트에도 미러링하거나 임의의 안전 상한)을 두어 무한정 재귀하지 않게 하거나, 최소한 118행 호출을 108-113행의 동일 try/catch 범위 안으로 옮겨 `RangeError` 도 "invalid JSON" 류 메시지로 소비하게 만든다.

- **[INFO]** `Execution.inputData` 가 목록 조회(list) 경로에서도 새로 전체 트리 마스킹을 거치게 되어, 이전에는 사실상 무비용이던 필드에 행(row) 수 × payload 크기에 비례하는 CPU 비용이 추가됐다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toExecutionDto`(목록 DTO 조립, `inputData: redactStoredDataForResponse(execution.inputData)`) 및 `toResponseExecution`(`inputData: redactStoredDataForResponse(rest.inputData)`). 정확한 줄 번호는 `git diff` 상 `toExecutionDto` 블록의 `inputData: redactStoredDataForResponse(execution.inputData),` 줄과 `toResponseExecution` 블록의 동일 패턴 줄이다(Read 로 확인한 현재 파일 기준 각각 1010행·1075행 부근).
  - 상세: 종전에는 `toExecutionDto`(목록 조회, 워크플로당 실행 리스트를 `.map` 으로 순회)에서 `inputData: execution.inputData ?? null` 로 **트리 순회가 전혀 없었다**. 이번 diff 로 `outputData`/`error` 와 동일하게 `deepRedactSecrets` 재귀 walk(패턴 매칭 포함)를 거치게 됐다 — 목록 API 한 번 호출이 이제 행마다 마스킹 대상 컬럼 2개(outputData·error) 대신 3개(inputData 포함)를 훑는다. `deepRedactSecrets` 자체는 `MAX_REDACT_DEPTH`(10) 상한·`WeakMap` identity 캐시·copy-on-change 를 이미 갖춘 잘 관리된 유틸이라 무제한 비용은 아니지만, identity 캐시는 **같은 객체 참조가 재사용될 때만** 유효하고 목록 조회에서는 매 행이 서로 다른 신규 엔티티 인스턴스이므로 캐시 히트가 없다 — 즉 이 추가 비용은 실측상 순수한 증가분이다. 이 PR 의 목적(재제출 카브아웃 폐지) 자체가 요구하는 필연적 비용이라 구조적 결함은 아니지만, 대량 실행 이력을 가진 워크플로의 실행 목록 페이지 응답 시간에 관측 가능한 영향을 줄 수 있다는 점은 기록해 둔다.
  - 제안: 별도 조치가 필요하다고 보지 않는다(보안 요구사항이 성능보다 우선). 다만 목록 페이지네이션 크기가 커지는 방향으로 바뀔 경우 이 3-컬럼 마스킹 비용을 함께 고려할 것.

- **[INFO]** 에디터의 실시간 JSON 검증이 입력값이 바뀔 때마다 `JSON.parse` + `hasMaskedMarkerLeaf` 전체 트리 순회를 디바운스 없이 두 번(파싱 1회 + 마커 탐색 1회) 수행한다
  - 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:103-120` (`jsonError` useMemo, dependency `[jsonInput, t]`)
  - 상세: `useMemo` 라 `jsonInput` 이 바뀔 때만 재계산되므로 매 렌더마다는 아니지만, 사용자가 큰 JSON 페이로드를 붙여넣거나 타이핑할 때마다(각 keystroke 로 `jsonInput` state 가 갱신되는 통상적인 controlled input 패턴이라면) 두 번의 O(n) 순회가 메인 스레드에서 동기 실행된다. `JSON.parse` 단독 검증은 이 diff 이전에도 있던 비용이라 Big-O 등급 자체의 회귀는 아니고, `hasMaskedMarkerLeaf` 가 추가한 것은 상수 배수 정도다. 다만 디바운스가 없어 매우 큰 입력(수백KB~MB 급 JSON)에서는 타이핑 중 입력 지연(jank)이 체감될 수 있다.
  - 제안: 현재 규모(트리거 파라미터 폼 입력)에서는 실질 위험이 낮아 조치 불요로 판단한다. 만약 향후 대용량 JSON 붙여넣기가 흔한 사용 패턴이 되면 `jsonInput` 검증에 디바운스를 고려.

## 확인했으나 문제 없다고 판단한 것

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `deepRedactSecrets`/`deepRedactCore` — depth-0 `WeakMap` identity 캐시, `MAX_REDACT_DEPTH=10` 상한, copy-on-change(변경 없으면 같은 참조 반환)를 모두 갖춘 이미 검증된 공유 프리미티브다. 이번 diff 는 이 함수를 새 호출부(`Execution.inputData`)에 하나 더 연결했을 뿐 함수 자체는 건드리지 않았다.
- `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `splitMaskedParameters`(122-136행)·`blockedByMaskedInput`(372-379행) — 순회 대상이 Manual Trigger 파라미터 객체(통상 필드 수 개~수십 개)로 크기가 작고, `blockedByMaskedInput` 은 memo 되지 않은 매 렌더 재계산이지만 `maskedKeys` 크기가 작아 실질 비용은 무시할 수준이다.
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`/`.spec.ts`, `execution-response.dto.ts`, `background-run-response.dto.ts` 변경은 전부 주석/JSDoc/Swagger 설명 텍스트뿐이고 런타임 로직·호출 경로에 변화가 없다(이미 `redactStoredDataForResponse(row.inputData)` 를 호출하던 기존 코드가 그대로 유지된다).
- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `MASKED_MARKERS`/`isMaskedMarker` 를 `lib/utils/masked-markers.ts` 로 옮기고 import 로 대체한 순수 리팩터. 알고리즘·호출 빈도 변화 없음.

## 요약

이번 changeset 의 실질 코드 표면은 작다 — `Execution.inputData` 를 기존에 이미 존재하던 `deepRedactSecrets` 마스킹 관문에 추가로 연결하고, 그 값이 프런트로 되먹임(재제출)되는 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 마커 감지 가드를 신설했다. backend 쪽 추가 비용(목록 조회에서 컬럼 하나가 더 마스킹됨)은 기존에 검증된 depth-capped·캐시·copy-on-change 유틸을 재사용하므로 통제된 증가분이며 보안 요구사항상 불가피하다. 유일하게 실질적으로 짚을 문제는 프런트 신규 유틸 `hasMaskedMarkerLeaf` 가 backend 짝(`deepRedactCore`)과 달리 재귀 깊이 상한이 없고, 그 호출이 에디터의 "Run with Input" 자유 입력 JSON 검증 경로에서 기존 `JSON.parse` try/catch 범위 밖에 놓여 있어 매우 깊게 중첩된(그러나 문법적으로 유효한) 입력에 대해 uncaught `RangeError` 로 퇴화할 수 있다는 점이다 — 이는 서버 측 DoS 가 아니라 해당 사용자 브라우저 탭에 국한된 견고성 문제이며, 발생 확률도 낮은 edge case 라 배포를 막을 사안은 아니다.

## 위험도

LOW
