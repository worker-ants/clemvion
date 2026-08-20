### 발견사항

- **[WARNING]** 연속된 두 개의 JSDoc 블록이 하나의 선언 위에 분리되어 있다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:329-341` (`blockedByMaskedInput` 선언 직전)
  - 상세: `blockedByMaskedInput` 상수 위에 `/** 토글 ON 이면 막지 않는다... */` 블록과 `/** "값이 비었는가" 가 아니라... */` 블록이 서로 별개의 JSDoc 코멘트로 연속 배치되어 있다(329-334줄, 335-341줄). 두 블록 모두 같은 선언 하나를 설명하는 내용이라 의미상 한 덩어리인데, 형태상 분리돼 있어 향후 편집 시 한쪽만 갱신되고 다른 쪽이 stale 로 남을 위험이 있고, 툴팁/문서 생성기가 두 번째 블록만 인식하는 등 도구 호환성도 애매해진다.
  - 제안: 두 블록을 하나의 JSDoc(`/** ... */`)으로 합친다. "토글 ON이면 막지 않는다"와 "값이 아니라 건드림 여부로 판정한다"는 같은 판정 로직의 두 측면이므로 섹션 헤더(`## 토글 예외`, `## 판정 기준`)로 나눠 한 블록 안에 넣는 편이 일관적이다.

- **[INFO]** `touchedMaskedKeys` 라는 이름이 실제 저장 내용보다 좁다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:229` (선언), `:299-304` (`setParam` 에서의 갱신)
  - 상세: `setParam`은 마스킹 여부와 무관하게 **사용자가 편집한 모든 키**를 `touchedMaskedKeys`에 추가한다(`prev.has(key) ? prev : new Set(prev).add(key)`에 조건 분기가 없다). 실제로는 "touched keys 전체" 집합이고, `blockedByMaskedInput` 계산에서 `maskedKeys`와의 교집합만 의미가 있을 뿐이다. 이름이 `touchedMaskedKeys`라서 "이미 마스킹된 키만 필터링해 담는 집합"으로 오독하기 쉽고, 다음에 이 상태를 재사용하려는 사람이 필터링이 이미 되어 있다고 잘못 가정할 수 있다.
  - 제안: `touchedKeys`로 이름을 바꾸거나, 주석에 "모든 편집 키를 담고, `maskedKeys`와의 교집합만 의미가 있다"는 점을 한 줄 명시한다.

- **[INFO]** "2026-08-20 카브아웃 폐지" 서사가 5개 이상 파일에 근접 중복 서술된다
  - 위치: `CHANGELOG.md:3-26`, `codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution` 주석·`toResponseExecution`/`toExecutionDto`/기타 인라인 주석), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-60`, `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:49-51`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:300-304`, `codebase/backend/src/modules/executions/executions.service.spec.ts` 여러 describe/it 주석
  - 상세: 이전에는 `executions.service.ts`에 `MASKED_INPUT_DATA_REASON`이라는 단일 JSDoc 앵커가 있어 다른 위치는 `{@link MASKED_INPUT_DATA_REASON}`으로 그쪽만 가리켰다. 이번 변경으로 그 앵커가 삭제되면서, 대신 각 파일이 "2026-08-20 부터 카브아웃이 닫혔다"는 동일한 배경 설명을 조금씩 다른 문장으로 각자 반복해서 담고 있다. 단일 SoT 포인터가 다중 로컬 요약으로 바뀐 셈이라, 다음에 이 정책이 또 바뀌면(예: 잔여 갭이 마저 닫히는 경우) 갱신해야 할 지점이 늘었다.
  - 참고: PR 스스로도 CHANGELOG(`CHANGELOG.md:23-25`)에서 "이 결론이 6개 문서에 SoT 로 미러돼 있어 선행 planner 턴에서 함께 뒤집었다"고 이 비용을 이미 인지하고 감수한 것으로 보인다. 코드 자체의 결함이라기보다는 이 저장소의 "SoT + 미러" 관례상 알려진 트레이드오프이므로 CRITICAL/WARNING 으로 올리지 않고 정보성으로만 남긴다.
  - 제안: (선택) `ExecutionsService.toResponseExecution`의 마스킹 표를 유일한 SoT로 삼고, 다른 파일들의 설명을 한두 문장 + "SoT: 표 참조" 로 더 짧게 유지하면 다음 정책 변경 시 갱신 지점을 줄일 수 있다.

### 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 세 소비처(폼 프리필, Re-run 모달, 에디터 히스토리 로드)에 마커 감지 가드를 일관되게 추가했다. 마커 판별 로직(`isMaskedMarker`/`hasMaskedMarkerLeaf`)을 `lib/utils/masked-markers.ts`로 승격해 컴포넌트 간 순환 의존을 없앤 리팩터링은 DRY 관점에서 개선이며, 함수들은 짧고 순환 복잡도가 낮으며("값이 아니라 건드림 여부로 판정" 등) 판정 기준의 근거를 코드 주석에 상세히 남겨 가독성도 준수한다. 발견된 문제는 경미한 수준(연속 JSDoc 블록 분리, 상태 변수 이름의 정밀도, 그리고 저장소 관례상 이미 인지된 문서 중복 비용)으로, 기능적 결함이나 구조적 부채로 보긴 어렵다.

### 위험도
LOW
