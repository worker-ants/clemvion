### 발견사항

- **[INFO]** `touchedMaskedKeys` 라는 이름이 실제로 담는 내용보다 좁다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:238`(선언), `:308-313`(`setParam` 에서의 갱신), `:372`(소비)
  - 상세: `setParam`(308-313행)은 마스킹 여부와 무관하게 **사용자가 편집한 모든 키**를 이 Set 에 추가한다 — `prev.has(key) ? prev : new Set(prev).add(key)` 에 마스킹 여부를 가르는 분기가 없다. 실제로는 "이번 세션에 손댄 키 전체" 집합이고, `blockedByMaskedInput`(372행)이 `maskedKeys.some(...)` 안에서 `!touchedMaskedKeys.has(k)` 로 교집합만 참조할 때만 "마스킹된 채 안 건드린 키"라는 의미가 생긴다. 이름이 `touchedMaskedKeys`라서 "이미 마스킹된 키만 필터링해 담는 집합"으로 오독하기 쉽고, 이 상태를 재사용하려는 다음 사람이 필터링이 이미 되어 있다고 잘못 가정할 수 있다.
  - 제안: `touchedKeys`로 이름을 바꾸거나, 선언부 주석에 "모든 편집 키를 담고, `maskedKeys`와의 교집합만 의미가 있다"는 점을 한 줄 명시한다.

- **[INFO]** "2026-08-20 카브아웃 폐지" 배경 서사가 6개 이상 파일에 근접 중복 서술된다
  - 위치: `CHANGELOG.md:3-33`, `codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution` JSDoc·`toResponseExecution`/`toExecutionDto`/`stop` 인라인 주석), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-60,174-181`, `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:49-51`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:300-304`, `codebase/backend/src/modules/executions/executions.service.spec.ts`(describe JSDoc 여러 곳)
  - 상세: 종전에는 `executions.service.ts`에 `MASKED_INPUT_DATA_REASON`이라는 단일 JSDoc 앵커가 있어 다른 위치는 `{@link MASKED_INPUT_DATA_REASON}`으로 그쪽만 가리켰다. 이번 diff 는 그 앵커 자체(카브아웃의 근거)가 사라지므로 앵커 삭제는 타당하지만, 대신 각 파일이 "왜 2026-08-20 에 정책이 바뀌었는가"라는 같은 배경을 조금씩 다른 문장으로 자체 반복해서 담았다. 단일 SoT 포인터가 다중 로컬 요약으로 바뀐 셈이라, 다음에 이 정책이 또 바뀌면 갱신 지점이 그만큼 늘어난다.
  - 참고: CHANGELOG 자신도(`CHANGELOG.md:31-32`) "이 결론이 6개 문서에 SoT 로 미러돼 있다"고 이 비용을 이미 인지하고 있다. 이 저장소의 "SoT + 미러" 관례상 알려진 트레이드오프이므로 WARNING 이 아니라 정보성으로 남긴다.
  - 제안: (선택) `ExecutionsService.toResponseExecution` 의 마스킹 표를 유일한 SoT 로 삼고, 다른 파일들의 설명은 한두 문장 + "SoT: 표 참조" 로 더 짧게 유지하면 다음 정책 변경 시 갱신 지점을 줄일 수 있다.

### 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 세 소비처(폼 프리필 #1181·Re-run 모달·에디터 히스토리 로드)에 마커 감지 가드를 일관되게 추가했다. 여러 라운드의 선행 리뷰를 거친 상태라 코드 자체가 이미 상당히 정제돼 있다 — 마커 판별 로직(`isMaskedMarker`/`hasMaskedMarkerLeaf`)을 컴포넌트 밖 `lib/utils/masked-markers.ts` 로 승격해 모달·툴바·폼 세 소비처 간 순환 의존을 없앤 리팩터는 DRY·응집도 관점에서 명확한 개선이고, 새 유틸 파일은 함수가 짧고(각 10줄 내외) 순환 복잡도가 낮으며, 왜 정확 일치만 보는지·왜 깊이 상한이 backend `MAX_REDACT_DEPTH` 와 같아야 하는지를 코드 옆 JSDoc 에 근거(실측 표 포함)와 함께 남겨 가독성이 좋다. `rerun-modal.tsx` 의 세 조건 차단 판정(`blockedByMaskedInput`)은 조건이 세 개로 늘었지만 각 조건이 막는 회귀 경로를 표로 정리한 단일 JSDoc 블록으로 병합돼 있어(이전 라운드에 지적된 "블록 분리" 문제는 이미 해소됨) 복잡도 대비 가독성이 준수된다. `executions.service.ts` 는 카브아웃 근거였던 `MASKED_INPUT_DATA_REASON` 앵커 상수(및 `void` no-op 관용구)를 통째로 제거해 죽은 앵커 코드가 사라졌고, 세 호출부·DTO JSDoc 의 주제문이 모두 "현재 진실"을 먼저 말하고 옛 결론은 blockquote 로 내려보내는 일관된 패턴을 따른다 — 과거 라운드가 반복해서 잡았던 "주제문 방치" 결함 클래스가 이번 diff 범위에서는 재발하지 않았다. 테스트 파일들(`masked-markers.test.ts`, `rerun-modal.test.tsx`, `editor-toolbar-run-input.test.tsx`)도 각 캐너리가 "이것이 없으면 어떤 경로로 뚫리는가"를 명시해 향후 회귀 방지 문서로도 기능한다. 남은 사안은 상태 변수 이름의 정밀도와, 정책 배경 서사가 여러 파일에 근접 중복된 것 정도로 둘 다 INFO 수준이며 기능적 결함이나 구조적 부채로 보기 어렵다.

### 위험도
LOW
