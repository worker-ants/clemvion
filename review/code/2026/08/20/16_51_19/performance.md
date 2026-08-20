STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# 성능(Performance) 코드 리뷰 — eia-inputdata-marker-guard

## 컨텍스트

이 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 폐지하고, 재제출 소비처
3곳(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드)에 마커 감지 가드를 추가한다. 실질
코드 변경은 소수 파일(`masked-markers.ts` 승격, `rerun-modal.tsx`, `editor-toolbar.tsx`,
backend `executions.service.ts`/`background-runs.service.ts`)에 집중돼 있고, 나머지
diff 대부분은 이미 여러 라운드 리뷰를 거친 `review/**`·`spec/**`·`CHANGELOG.md` 문서
산출물이라 성능 관점에서는 검토 대상이 아니다.

## 발견사항

- **[INFO]** backend 목록 엔드포인트(list)가 `inputData` 마스킹 스캔을 새로 편입해 행당 작업량이 늘었다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 의 `toExecutionDto`(1010행, `redactStoredDataForResponse(execution.inputData)` 신규 호출) 및 `toResponseExecution`(1074행 부근) — 둘 다 `rows.map((e) => this.toResponseExecution(e))`(612행)·목록 조립 경로에서 매 행마다 호출된다.
  - 상세: 종전엔 목록 응답에서 `error`/`outputData` 두 컬럼만 `deepRedactSecrets` 깊이-우선 재귀 스캔(`MAX_REDACT_DEPTH=10`, `codebase/backend/src/shared/utils/sanitize-error-message.ts:204-254`)을 탔는데, 이번 변경으로 `inputData` 가 세 번째 컬럼으로 편입돼 페이지당(기본 목록 페이지 크기만큼) 스캔 대상이 1.5배로 늘었다. 다만 이 작업은 이미 잘 유계화돼 있다 — 재귀 깊이 상한 10, 문자열 리프마다 정규식 치환, 객체 identity 기준 `WeakMap` 캐시(같은 참조가 두 번 지나가면 1회만 walk), copy-on-change(값이 안 바뀐 서브트리는 원본 참조 재사용)로 불필요한 shallow-copy 를 피한다. 실행 파라미터(`inputData`)는 통상 소규모 JSON 이라 실사용 영향은 낮지만, 보안/무결성 요구가 낳은 의도된 비용이므로 별도 조치보다는 인지 목적으로 남긴다.
  - 제안: 조치 불요. 다만 대규모 `parameters`(예: 대형 배열/파일 메타데이터를 트리거 입력으로 받는 워크플로)가 실제로 관측되면 목록 응답에서 `inputData` 요약(길이 상한 truncate 등)을 고려할 수 있다 — 지금은 근거가 없는 조기 최적화다.

- **[INFO]** 에디터 "Run with Input" JSON 텍스트에어리어에서 키 입력마다 마커 leaf 스캔이 추가됐다
  - 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:103-124` (`jsonError` = `useMemo(..., [jsonInput, t])`), 신규 `hasMaskedMarkerLeaf(parsed)` 호출(117행 부근)
  - 상세: 이 `useMemo` 는 `jsonInput` 이 바뀔 때마다(즉 사용자가 텍스트에어리어에 한 글자 입력할 때마다) 재실행돼 이미 `JSON.parse` 를 태우고 있었다. 이번 diff 는 그 파싱 결과에 `hasMaskedMarkerLeaf` 재귀 스캔(깊이 상한 10, `codebase/frontend/src/lib/utils/masked-markers.ts:88-111`)을 추가로 얹는다. 사용자가 직접 타이핑하는 테스트 입력은 통상 작아 체감 지연은 없을 것으로 보이나, "히스토리에서 불러오기"로 큰 `Execution.inputData` JSON 을 통째로 textarea 에 적재한 뒤 사용자가 그 텍스트를 추가 편집하는 경로에서는 매 키 입력마다 전체 구조를 O(노드 수) 로 재스캔한다(파싱과 별개로). `useMemo` 라 `t`(로케일 함수 참조가 안정적이지 않다면) 변경 시에도 재계산되지만, 이 부분은 이번 diff 범위 밖이라 심각한 문제로 보진 않는다.
  - 제안: 조치 불요 수준. 다만 향후 대형 JSON 히스토리 로드가 실사용에서 문제로 관측되면 `jsonError` 를 `debounce` 하거나, 파싱된 값의 최상위 leaf 개수에 상한을 두는 방어를 고려할 수 있다.

- **[INFO]** `rerun-modal.tsx` 의 `touchedMaskedKeys` 갱신이 편집마다 `Set` 을 통째로 복사한다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:308-313` (`setParam` 내부 `new Set(prev).add(key)`)
  - 상세: 파라미터 입력 필드를 편집할 때마다(`onChange`) `touchedMaskedKeys` Set 전체를 얕은 복사(`new Set(prev)`)한 뒤 키를 추가한다. Re-run 모달의 필드 수는 Manual Trigger 파라미터 스키마 크기(통상 한 자릿수~수십 개)로 유계이므로 실질 비용은 무시할 만하다 — 알고리즘적으로는 편집 1회당 O(현재 touched 키 수) 복사가 발생하는 구조라는 점만 기록해 둔다.
  - 제안: 조치 불요.

## 확인했으나 문제 삼지 않은 것

- `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `scanForMarker` — 재귀 깊이 상한(10)을 backend `MAX_REDACT_DEPTH` 와 일치시키고, 값 검사를 깊이 검사보다 먼저 수행해 상한 지점의 치환 마커를 놓치지 않도록 순서를 잡았다. `JSON.parse` 산물에는 순환 참조가 있을 수 없다는 전제로 방문 집합(visited set)을 생략한 것도 정확하다 — 불필요한 `Set`/`WeakSet` 오버헤드를 피한 설계다.
- backend `deepRedactCore`/`deepRedactObject`(`sanitize-error-message.ts:241-294`) — 배열/객체 모두 copy-on-change 이고, depth-0 결과를 `WeakMap` 으로 캐시해 같은 객체가 한 응답 안에서 두 번 지나가도 1회만 walk 한다. 이번 PR 은 이 프리미티브를 새 컬럼(`inputData`)에 재사용만 할 뿐 자체 복잡도를 바꾸지 않는다.
- `background-runs.service.ts` 의 `reconciledNodeExecutions.map(...)` — `inputData`/`outputData`/`error` 세 컬럼 모두 무변화면 원본 행 참조를 그대로 재사용(대규모 ForEach 실행의 행 수만큼 shallow-copy 를 피하는 기존 최적화, 692행 주석)이 `inputData` 편입 이후에도 정확히 유지된다.
- N+1 쿼리·블로킹 I/O·신규 캐시 무효화 로직은 이 changeset 에 없다 — 전부 이미 페치된 행(엔티티)의 값-레벨 후처리(masking)이고 DB/외부 호출 왕복이 추가되지 않는다.

## 요약

이번 변경은 알고리즘적으로 새로운 복잡도나 N+1, 블로킹 I/O 를 도입하지 않는다. 핵심은 기존에 잘 유계화된(재귀 깊이 상한 10, WeakMap identity 캐시, copy-on-change) 마스킹 프리미티브(`deepRedactSecrets`/`hasMaskedMarkerLeaf`)를 세 번째 컬럼(`inputData`)까지 확장 적용한 것으로, 목록 응답 행당 작업량과 JSON 에디터의 키 입력당 스캔량이 소폭 늘었으나 모두 상한이 있고 실사용 데이터 크기(트리거 파라미터)에 비례해 무시할 만한 수준이다. 프런트 `rerun-modal.tsx`/`editor-toolbar.tsx` 의 신규 판정 로직도 폼 필드 수·파라미터 크기에 선형이며 별도 캐싱이 필요할 규모가 아니다. CRITICAL/WARNING 급 성능 결함은 발견되지 않았다.

## 위험도

LOW
