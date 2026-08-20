STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

이 PR 은 이미 code review 10라운드(`14_08_45`~`18_03_01`)를 거쳤고, 직전 maintainability
라운드(`18_03_01`)가 LOW 로 판정한 상태다. 이번 세션(`18_23_54`)이 보는 diff 는 직전 라운드
이후 유일하게 추가된 커밋 `2c628f6ac`("`[object Object]` 를 실제 입력으로 만들 뻔했다 —
라운드10 처분")까지 포함한다. 그 커밋의 실 코드 변경분(`rerun-modal.tsx` 의
`inferTypeFromValue` 헬퍼 추가 + 관련 JSDoc, `rerun-modal.test.tsx` 신규 회귀 테스트,
`CHANGELOG.md` 범위 명시)을 직접 읽고, `18_03_01` maintainability 가 남긴 두 INFO(재확인
대상)가 여전히 유효한지 소스에서 재확인했다. `masked-markers.ts`/`masked-markers.test.ts`,
`rerun-modal.tsx` 전문, `executions.service.ts`의 `toResponseExecution`/`ResponseExecution`
JSDoc, `background-runs.service.ts`/`.spec.ts`, `dynamic-form-ui.tsx`, `editor-toolbar.tsx`
의 관련 부분도 현재 상태로 다시 읽었다. `review/**`(174개 이상의 라운드별 산출물)는 이
관점의 리뷰 대상이 아니므로(자동 생성 리포트, 코드 아님) 제외했다.

## 발견사항

- **[INFO]** `rerun-modal.test.tsx` 의 두 `describe` 블록이 동일한 `beforeEach` 6줄을 복제한다 (기존 지적 재확인 — 3라운드 연속 미조치, 선택 판정 유지)
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:103-111`(`describe("ReRunModal", ...)`) vs `:538-546`(`describe("ReRunModal — 마스킹 마커 왕복 차단", ...)`)
  - 상세: `vi.clearAllMocks(); cleanup(); useLocaleStore.setState({ locale: "en" }); useWorkspaceStore.getState().reset(); routerPushMock.mockReset(); toastErrorMock.mockReset();` 6줄이 토큰 단위까지 동일하게 두 블록에 각각 존재한다. `17_38_33`·`18_03_01` 두 라운드가 이미 같은 자리를 지적했고 매번 "선택, 차단 사유 아님"으로 미조치 판정됐다. 지금도 그 상태 그대로다 — 향후 mock 초기화 순서 변경이나 새 store reset 추가 시 한쪽만 갱신하면 두 블록의 격리 보장이 조용히 갈릴 위험은 남아 있다.
  - 제안: (선택, 이번에도 비차단) 파일 최상위에 `resetTestState()` 헬퍼를 뽑아 두 `beforeEach` 에서 호출.

- **[INFO]** "2026-08-20 카브아웃 폐지" 배경 서사가 6개 이상 파일에 근접 중복 서술된다 (기존 3라운드 연속 인지·수용된 SoT+미러 트레이드오프, 재확인)
  - 위치: `CHANGELOG.md:3-40`(이번 커밋에서 "닫힌 범위" 단락이 더 추가돼 최상단 항목이 한층 길어졌다), `codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution` JSDoc·`toResponseExecution` 인라인 주석), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-56,166-171`, `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:49-51`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:300-304`
  - 상세: 종전 단일 JSDoc 앵커(`MASKED_INPUT_DATA_REASON`)가 삭제되면서 각 파일이 "왜 정책이 바뀌었는가"를 각자 반복 서술한다. 이번 커밋은 CHANGELOG 최상단 항목에 "닫힌 범위(UI 정상 흐름 한정)" caveat 을 추가로 얹어 그 파일의 근접 중복이 한 단락 더 늘었다. `14_44_08`·`17_13_19`·`17_38_33`·`18_03_01` 네 라운드 모두 같은 항목을 "SoT+미러 관례상 알려진 트레이드오프"로 판정했다 — 새 결함이 아니라 재확인이다.
  - 제안: (선택) `ExecutionsService.toResponseExecution` 마스킹 표를 유일한 SoT 로 삼고 다른 파일은 "SoT: 표 참조" 로 더 짧게 유지.

- **[INFO]** `ReRunModal` 컴포넌트가 단일 파일 608줄로 커졌고, fetch(워크플로 노드·노드 정의) · 파생 상태(외부호출 breakdown, dry-run 적용성, 필드 목록) · 마스킹 차단 판정 · 값 coerce · 제출 핸들러 · 전체 JSX 렌더까지 한 컴포넌트가 담당한다 (기존에 "4번째 소비처 생기면 판단"으로 유예된 항목, 재확인)
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` 전체 (특히 208~452행 `ReRunModal` 함수 본체)
  - 상세: 각 관심사(마스킹 판정 3조건, orphan 타입 추론, 스키마 지연 도착 재조정 등)는 개별적으로는 짧고 JSDoc 이 충실하지만, 한 함수 스코프 안에 `useMemo` 5개·`useEffect` 4개·지역 함수 2개가 공존해 파일을 처음 읽는 사람이 전체 데이터 흐름을 한 번에 파악하기 어렵다. `15_10_25` RESOLUTION 이 이미 "모달 훅 추출은 4번째 소비처가 생길 때 판단할 일"로 유예했고, 이번 라운드까지도 소비처는 여전히 셋(폼 프리필·Re-run 모달·에디터 히스토리 로드)이라 그 유예 조건은 아직 성립하지 않는다 — 새로운 위험이 아니라 파일이 계속 자라고 있다는 관측이다.
  - 제안: (선택, 비차단) 다음에 이 파일을 다시 건드릴 일이 생기면 `useMaskedFieldGuard(originalParameters, maskedKeys)` 형태로 마스킹 판정 관련 상태(`touchedKeys`/`fields`/`blockedByMaskedInput`)를 별도 훅으로 뽑는 것을 고려. 지금 당장 강제할 사안은 아니다.

## 요약

직전 라운드(`18_03_01`, LOW)가 이미 9라운드에 걸쳐 정제된 코드로 판정한 상태이며, 이번
세션이 보는 유일한 신규 코드 변경(커밋 `2c628f6ac`)은 그 판정을 흔들지 않는다 —
`inferTypeFromValue` 헬퍼는 5줄짜리 순수 함수로 기존 `isStructuredType`/`isStructuredField`
와 이름·역할이 명확히 구분되고, orphan 필드 전용이라는 스코프 제약이 JSDoc 에 정확히
못박혀 있다. 새로 추가된 회귀 테스트(`[object Object]` 렌더 방지)도 독립적이고 자기서술적이다.
마커 판별 로직(`isMaskedMarker`/`hasMaskedMarkerLeaf`)의 `lib/utils/masked-markers.ts` 승격,
백엔드 `toResponseExecution` 마스킹 표 단일화, `touchedKeys` 개명 등 앞선 라운드가 이미
고친 구조적 개선도 모두 현재 소스에서 재발 없이 유지되고 있음을 직접 확인했다. 남은 사안
셋은 전부 INFO 이고 여러 라운드에 걸쳐 이미 "선택/트레이드오프/유예 조건 미성립"으로 판정된
항목의 재확인이지, 새로운 가독성·중첩·매직넘버·중복·복잡도 결함이 아니다.

## 위험도

LOW
