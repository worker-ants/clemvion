# 테스트(Testing) 코드 리뷰 — eia-inputdata-marker-guard

## 발견사항

- **[WARNING]** 타입 캐스팅 우회를 막으려고 도입한 `touchedMaskedKeys`(터치 기반 차단)의 **바로 그 회귀 시나리오**가 테스트로 고정되지 않았다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` (`touchedMaskedKeys` 상태는 228~230행, `blockedByMaskedInput` 판정은 342~343행, 스키마 비동기 도착 시 `paramValues` 를 `coerceInput` 으로 재조정하는 effect 는 312~327행)
  - 상세: `RESOLUTION.md`(WARNING #2)는 *"스키마가 늦게 로드되면 재조정 이펙트의 `coerceInput("boolean","")` 이 `false` 를 만들어 `"" \| null \| undefined` 판정을 통과한다"* 는 값-기반 우회를 지적했고, 그 처방으로 판정 기준을 "값이 비었는가" → "사용자가 그 키를 건드렸는가"(`touchedMaskedKeys`)로 바꿨다. 코드는 정확히 그렇게 바뀌어 있다 — 312~327행의 재조정 effect 는 `setParamValues` 를 직접 호출해 `setParam`(299~304행, `touchedMaskedKeys` 를 갱신하는 유일한 자리)을 거치지 않으므로, 자동 재조정은 이제 차단을 풀지 못한다.
    그런데 신규 테스트(`codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` 537~640행 `describe("ReRunModal — 마스킹 마커 왕복 차단", ...)`)는 전부 `apiGetMock.mockResolvedValue({ data: { data: [] } })` 로 `workflowNodes` 를 고정한다 — `manual_trigger` 스키마가 **처음부터 끝까지 도착하지 않으므로** `fields` 가 fallback(all-string)에서 벗어나지 않고, 312행의 재조정 effect 가 타입 변경으로 실질 발동하는 경로 자체가 한 번도 행사되지 않는다. 정확히 이 조합("스키마가 boolean 등으로 지연 도착" + "그 필드가 마스킹으로 비워진 필드")을 시뮬레이션하는 테스트는 이 describe 안에도, 파일 전체에도 없다. 파일에 이미 있는 유일한 지연-스키마 테스트(462~513행 `"fallback 구간에 편집한 문자열이 스키마 도착 후 native 타입으로 재조정된다"`)는 이 PR 이전부터 있던 것으로, 원본 값이 `flag: false`(마스킹 아님)이고 사용자가 텍스트로 `"true"` 를 **직접 입력**한 뒤 재조정되는 시나리오라 `touchedMaskedKeys` 경로를 전혀 건드리지 않는다.
    즉 "값 기반 우회를 원천 차단했다"는 처방의 정합성을 검증하는 회귀 테스트가 없다 — 코드는 맞지만, 이 코드가 실제로 그 시나리오에서 버티는지는 아무 테스트도 확인하지 않는다. 향후 누군가 `touchedMaskedKeys` 를 제거하고 값 기반 검사로 되돌려도(혹은 재조정 effect 가 실수로 `setParam` 을 호출하도록 바뀌어도) 어떤 테스트도 RED 가 되지 않는다.
  - 제안: `describe("ReRunModal — 마스킹 마커 왕복 차단", ...)` 안에 기존 462행 테스트와 같은 패턴(스키마 GET 을 지연 resolve)으로 다음을 추가한다 — `original.inputData.parameters` 에 마스킹 마커가 있는 필드를 두고, 초기 렌더에서 Run 이 비활성인 상태를 확인 → 스키마를 `boolean` 타입으로 resolve → 재조정 이후에도 (사용자가 손대지 않았다면) Run 이 **여전히 비활성**임을 단언한다. 대조로, 사용자가 그 필드를 한 번 편집한 뒤 스키마가 도착해도 계속 활성 상태를 유지하는 것도 확인하면 양방향이 고정된다.

- **[INFO]** object/array 안쪽 마커 필드는 "채우면 풀린다" 언로크 경로가 스칼라 필드만 테스트됨
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:554` (`"그 필드를 채우면 제출이 풀린다"`, 스칼라 `apiKey` 필드만 대상) vs `:612`(`"object 파라미터 **안쪽** 마커도 제출을 막고, 값은 지우지 않는다"`, 초기 차단 상태만 단언하고 언블록은 미검증)
  - 상세: 스칼라 마커는 "비운 뒤 채우면 풀린다"는 왕복이 명시적으로 테스트됐지만(554~563행), object/array leaf 마커는 초기 차단 상태(612~630행)만 확인하고 그 필드를 편집해 `touchedMaskedKeys` 에 등록된 후 차단이 풀리는지는 확인하지 않는다. 코드 경로(`setParam` 이 타입 무관하게 동일하게 호출됨, 299~304행)상 위험은 낮지만, CRITICAL 로 처음 발견된 바로 그 표면(object/array 안쪽)이라 왕복 양방향을 전부 잠그는 편이 이 PR 의 "양방향을 고정한다" 원칙(506~511행 docstring)과 일관된다.
  - 제안: 612행 테스트에 이어 해당 object 필드를 새 값으로 편집(JSON textarea 등)한 뒤 Re-run 버튼이 활성화되는 단언을 추가.

- **[INFO]** `ReRunModal` — "실제 마스킹 값이 없으면 어떤 필드도 잠기지 않는다"는 캐너리가 스칼라·object 마커 존재 케이스와 짝을 이루긴 하지만, **스칼라와 object 마커가 동시에 섞인** 원본(`{ apiKey: "***", headers: { apiKey: "***" } }` 형태)에 대한 테스트는 없음
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` (533~640행 `describe` 전체)
  - 상세: `splitMaskedParameters`(`codebase/frontend/src/components/executions/rerun-modal.tsx:126~157`)는 각 키를 독립적으로 순회하므로 혼합 케이스가 실패할 구조적 이유는 없어 보이지만, `maskedKeys` 배열이 여러 항목을 담는 경로 자체는 현재 테스트에서 한 번도 길이 2 이상으로 행사되지 않는다(모든 테스트가 마스킹 필드 1개). `maskedKeys.some(...)` (rerun-modal.tsx:343) 같은 다항 로직은 원소가 1개일 때와 2개 이상일 때 (예: 한쪽만 touched 인 상태) 다르게 행동할 수 있는 자리라 커버리지 공백이다.
  - 제안: 필수는 아니나, `maskedKeys.length >= 2` 인 fixture 로 "한쪽만 채워도 다른 쪽이 남아 있으면 계속 막힌다"를 한 번 고정하면 `some` 대 `every` 뮤테이션을 잡아낼 수 있다.

## 요약

이번 변경은 `Execution.inputData` 마스킹 카브아웃 폐지를 backend 5개 표면(findById/getChain/stop 은 `toResponseExecution` 한 함수로 묶임·목록·노드 레벨)과 frontend 3개 재제출 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 걸쳐 반영했고, backend 테스트(`executions.service.spec.ts`)는 되돌렸던 캐너리 방향을 정확히 재반전했으며 표면 커버리지(①②⑤⑥-b⑧⑧-b)가 구현의 마스킹 지점과 1:1 로 대응해 갭이 없다. frontend 는 직전 라운드에서 CRITICAL 로 잡힌 "object/array 안쪽 마커 우회"를 `hasMaskedMarkerLeaf` 로 막고 모달·툴바 양쪽에 적용했으며 뮤테이션 검증(중첩 검사 제거 시 RED)까지 거쳤고, 신규 `masked-markers.ts` 공용 유틸도 non-string 입력·정확일치 경계를 직접 단위 테스트로 고정해 종전 "컴포넌트 렌더 경유만"이던 갭을 메웠다. 유일하게 남는 실질 공백은, 같은 RESOLUTION 라운드에서 "값 기반 판정이 스키마 지연 로드의 타입 캐스팅에 뚫린다"고 지적하고 터치 기반 판정으로 고친 그 코드 변경 자체를 검증하는 회귀 테스트가 없다는 점이다 — 코드는 정확해 보이지만 그 정확함을 지키는 테스트가 없어 향후 조용히 재발할 수 있는 자리다. 나머지는 소소한 왕복-대칭성 공백(INFO)이다.

## 위험도

LOW
