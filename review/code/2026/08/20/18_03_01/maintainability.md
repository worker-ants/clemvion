STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

이 PR 은 이미 code review 9라운드(`14_08_45`~`17_38_33`)를 거쳤고, 현재 `HEAD`(`d446ab7ad`)
는 그 9라운드 RESOLUTION 이 전부 반영된 상태다. 이전 라운드 maintainability 지적(JSDoc 블록
분리 · `touchedMaskedKeys`→`touchedKeys` 네이밍 · swagger JSDoc 길이 규약)이 실제로 소스에
반영됐는지 직접 재확인하고, 그 위에서 실 소스(`codebase/**`, 24파일)를 가독성·네이밍·함수
길이·중첩·매직 넘버·중복·복잡도·일관성 관점으로 다시 훑었다. `review/**`·`plan/**` 산출물은
자동 생성 리포트/작업 추적 문서라 이 관점의 대상이 아니므로 제외했다.

## 이전 라운드 지적의 해소 확인 (재발 없음)

- `rerun-modal.tsx` `blockedByMaskedInput` JSDoc 두 블록 분리(`14_44_08` WARNING) → 하나의
  JSDoc 블록(표 포함)으로 병합돼 있다(현재 368~391행 부근, `blockedByMaskedInput` 선언 직전).
- `touchedMaskedKeys` 네이밍(`14_44_08`/`17_13_19` INFO) → `touchedKeys` 로 개명, 선언부에
  "모든 편집 키를 담고 `maskedKeys` 와의 교집합만 의미가 있다"는 설명이 붙어 있다.
- `MASKED_INPUT_DATA_REASON` 앵커·`touchedMaskedKeys` 문자열 전수 grep 0건 — 죽은 참조 없음.
- `ExecutionDto`/`NodeExecutionSummaryDto` 의 `inputData` swagger JSDoc 이 자매
  `BackgroundRunNodeExecutionDto` 와 같은 짧은 형식(요약 2~3문장 + SoT 링크)으로 압축돼 있다.
- 라운드9 이 새로 추가한 `fields` useMemo 의 "차단하는 키는 반드시 렌더된다" 불변식은 단일
  JSDoc 블록에 왜/무엇을 함께 적어 두었고, 로직 자체도 `declared`/`orphanMasked` 두 갈래를
  스프레드로 합치는 짧은 형태라 새 분기 복잡도를 거의 더하지 않는다.

## 발견사항

- **[INFO]** 신규 `describe` 블록이 상위 블록의 `beforeEach` 6줄을 그대로 복제한다 (기존 지적, 미조치 확인)
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:103-111`(상위 `describe("ReRunModal", ...)`) vs `:538-545`(`describe("ReRunModal — 마스킹 마커 왕복 차단", ...)`)
  - 상세: 두 `beforeEach` 본문이 `vi.clearAllMocks(); cleanup(); useLocaleStore.setState({ locale: "en" }); useWorkspaceStore.getState().reset(); routerPushMock.mockReset(); toastErrorMock.mockReset();` 로 토큰 단위까지 동일하다. `17_38_33` maintainability 리뷰가 이미 같은 자리를 지적했고 RESOLUTION 은 "선택" 으로 미조치 판정한 상태 그대로다. 지금은 무해하지만, 이후 목 초기화 순서 변경이나 새 store 리셋 추가 시 한쪽만 갱신하면 두 블록의 격리 보장이 조용히 갈릴 위험은 여전히 남아 있다.
  - 제안: (선택, 이번 라운드도 차단 사유 아님) 파일 최상위에 공용 `beforeEach` 하나만 두거나 `resetTestState()` 헬퍼로 뽑아 두 블록에서 호출.

- **[INFO]** "2026-08-20 카브아웃 폐지" 배경 서사가 6개 이상 파일에 근접 중복 서술된다 (기존에 3라운드 연속 인지·수용된 트레이드오프, 재확인)
  - 위치: `CHANGELOG.md:3-33`, `codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution` JSDoc·`toResponseExecution`/`toExecutionDto`/`stop` 인라인 주석), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-56,166-171`(게이트는 new-file 기준), `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:49-51`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:300-304`, `codebase/backend/src/modules/executions/executions.service.spec.ts`(describe JSDoc 여러 곳)
  - 상세: 종전 단일 JSDoc 앵커(`MASKED_INPUT_DATA_REASON`)가 삭제되면서 각 파일이 "왜 정책이 바뀌었는가"를 조금씩 다른 문장으로 자체 반복한다. 다음에 이 정책이 또 바뀌면 갱신 지점이 그만큼 늘어난다. CHANGELOG 자신이(`:23-25`) 이 비용을 인지하고 있고, `14_44_08`·`17_13_19`·`17_38_33` maintainability 리뷰 셋 모두 같은 항목을 "SoT + 미러 관례상 알려진 트레이드오프"로 판정했다 — 새 결함이 아니라 재확인이다.
  - 제안: (선택) `ExecutionsService.toResponseExecution` 마스킹 표를 유일한 SoT 로 삼고 다른 파일은 "SoT: 표 참조" 로 더 짧게 유지.

## 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 세 소비처(폼 프리필·
Re-run 모달·에디터 히스토리 로드)에 마커 감지 가드를 일관되게 추가한 결과물이며, 9라운드에
걸친 선행 코드 리뷰를 거쳐 이미 충분히 정제돼 있다. 마커 판별 로직(`isMaskedMarker`/
`hasMaskedMarkerLeaf`)을 컴포넌트 밖 `lib/utils/masked-markers.ts` 로 승격한 리팩터는
모달·툴바·폼 세 소비처 간 순환 의존을 없애는 명확한 개선이고, 함수들은 짧고(10~20줄 내외)
순환 복잡도가 낮으며, 정확 일치만 보는 이유·깊이 상한이 backend 상수와 같아야 하는 이유를
실측 표와 함께 JSDoc 에 남겨 가독성이 좋다. `rerun-modal.tsx` 의 3-조건 차단 판정
(`blockedByMaskedInput`)은 표로 정리한 단일 JSDoc 블록에 병합돼 있고, 스키마 드리프트로
차단이 영구화되는 경로를 막는 라운드9 의 `fields` 불변식 로직도 짧고 응집도 높게 추가됐다.
`touchedMaskedKeys`→`touchedKeys` 개명, swagger JSDoc 길이 규약 준수 등 과거 라운드가 잡은
지적은 모두 소스에서 직접 재발 없음을 확인했다. 남은 사안은 테스트 파일의 `beforeEach` 6줄
복제와 정책 배경 서사의 다중 파일 근접 중복 두 건뿐이며, 둘 다 여러 라운드에 걸쳐 이미
검토자들이 "선택/트레이드오프"로 판정한 낮은 위험의 재확인 사항이지 새로운 구조적 부채가
아니다.

## 위험도

LOW
