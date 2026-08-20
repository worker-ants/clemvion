STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 유지보수성(Maintainability) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

이 PR 은 이미 code review 8라운드(`14_08_45`~`17_13_19`)를 거쳤고, 현재 `HEAD`(`1539349f5`)
는 그 8라운드 RESOLUTION 이 전부 반영된 상태다. 이전 라운드들의 maintainability 지적
(JSDoc 블록 분리 · `touchedMaskedKeys` 네이밍)이 실제로 해소됐는지를 소스에서 직접 재확인하고,
그 위에서 이번 누적 diff(`origin/main...HEAD`, 실질 코드 24파일 + plan/spec + 방대한
`review/**` 산출물)를 유지보수성 관점으로 다시 훑었다. `review/**`·`plan/**` 산출물은
자동 생성 리뷰 리포트/작업 추적 문서라 가독성·네이밍·복잡도 기준을 적용할 대상이 아니므로
제외하고, 실 소스(`codebase/**`)에 집중했다.

## 이전 라운드 지적의 해소 확인 (재발 없음)

- `rerun-modal.tsx`의 `blockedByMaskedInput` 관련 JSDoc 두 블록 분리(`14_44_08` WARNING) →
  현재 하나의 JSDoc 블록에 표로 병합돼 있다(`blockedByMaskedInput` 선언 직전).
- `touchedMaskedKeys` 네이밍(`14_44_08`/`17_13_19` INFO, "담긴 내용보다 이름이 좁다") →
  `touchedKeys`로 개명됐고 선언부에 "모든 편집 키를 담고 `maskedKeys`와의 교집합만 의미가
  있다"는 설명이 붙었다.
- `MASKED_INPUT_DATA_REASON` 앵커·`touchedMaskedKeys` 문자열 전수 grep 0건 — 죽은 참조 없음.

## 발견사항

- **[INFO]** 신규 `describe` 블록이 상위 블록의 `beforeEach` 를 6줄 그대로 복제한다
  - 위치: `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx` — 상위 `describe("ReRunModal", ...)`의 `beforeEach`(파일 상단, `renderModal` 헬퍼 정의 직후)와 이번 diff 가 추가한 `describe("ReRunModal — 마스킹 마커 왕복 차단", ...)`의 `beforeEach`(같은 파일 신규 블록 최상단)
  - 상세: 두 `beforeEach` 본문이 `vi.clearAllMocks(); cleanup(); useLocaleStore.setState({ locale: "en" }); useWorkspaceStore.getState().reset(); routerPushMock.mockReset(); toastErrorMock.mockReset();` 로 토큰 단위까지 동일하다. 신규 블록은 같은 파일 안에 있으므로 상위 스코프의 정리 로직을 재사용할 수 있는데도 별도 `describe`로 분리하면서 그대로 복사했다. 지금은 무해하지만, 이후 누군가 목 초기화 순서를 바꾸거나 새 store 리셋을 추가할 때 한쪽만 갱신하면 두 describe 블록의 격리 보장이 조용히 갈릴 수 있다(이 저장소가 반복 겪어 온 "미러 중 하나만 갱신" 패턴과 같은 클래스).
  - 제안: 파일 최상위(모든 `describe` 밖)에 공용 `beforeEach` 하나만 두거나, 정리 로직을 `resetTestState()` 같은 헬퍼로 뽑아 두 블록에서 호출한다.

- **[INFO]** "2026-08-20 카브아웃 폐지" 배경 서사가 6개 이상 파일에 근접 중복 서술된다 (기존에 인지·수용된 트레이드오프, 재확인)
  - 위치: `CHANGELOG.md:3-33`, `codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution` JSDoc·`toResponseExecution`/`toExecutionDto`/`stop` 인라인 주석), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-60,174-181`(게이트 숫자는 new-file 기준), `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:49-51`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:300-304`, `codebase/backend/src/modules/executions/executions.service.spec.ts`(describe JSDoc 여러 곳)
  - 상세: 종전에는 `executions.service.ts`의 `MASKED_INPUT_DATA_REASON` 이라는 단일 JSDoc 앵커를 다른 자리들이 `{@link MASKED_INPUT_DATA_REASON}` 으로만 가리켰다. 이 PR 이 그 앵커(카브아웃의 근거) 자체를 삭제한 것은 타당하지만, 대신 각 파일이 "왜 2026-08-20 에 정책이 바뀌었는가"라는 같은 배경을 조금씩 다른 문장으로 자체 반복해서 담았다. 단일 SoT 포인터가 다중 로컬 요약으로 바뀐 셈이라, 다음에 이 정책이 또 바뀌면 갱신해야 할 지점이 그만큼 늘어난다.
  - 참고: CHANGELOG 자신이(`CHANGELOG.md:23-25`) "이 결론이 6개 문서에 SoT 로 미러돼 있어 선행 planner 턴에서 함께 뒤집었다"고 이 비용을 이미 인지하고 있고, 직전 두 라운드(`14_44_08`, `17_13_19`)의 maintainability 리뷰도 같은 항목을 INFO 로 남기며 "SoT + 미러" 관례상 알려진 트레이드오프로 판정했다 — 새로운 결함이 아니라 재확인이다.
  - 제안: (선택, 이 PR 을 막을 사안 아님) `ExecutionsService.toResponseExecution` 의 마스킹 표를 유일한 SoT 로 삼고 다른 파일은 "SoT: 표 참조" 로 더 짧게 유지하면 다음 정책 변경 시 갱신 지점을 줄일 수 있다.

## 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 마커 감지 가드를 일관되게 추가한 결과물이며, 8라운드에 걸친 선행 코드 리뷰를 거쳐 이미 상당히 정제돼 있다. 마커 판별 로직(`isMaskedMarker`/`hasMaskedMarkerLeaf`)을 컴포넌트 밖 `lib/utils/masked-markers.ts` 로 승격한 리팩터는 순환 의존을 없애는 명확한 개선이고, 함수들은 짧고(각 10~20줄) 순환 복잡도가 낮으며, 정확 일치만 보는 이유·깊이 상한이 backend 상수와 같아야 하는 이유를 실측 표와 함께 JSDoc 에 남겨 가독성이 좋다. `rerun-modal.tsx` 의 3-조건 차단 판정(`blockedByMaskedInput`)은 이전 라운드가 지적한 "JSDoc 블록 분리"가 이미 단일 표-블록으로 병합됐고, 상태 변수 이름(`touchedMaskedKeys`→`touchedKeys`)도 담긴 내용에 맞게 정정됐다 — 재발 없음을 소스에서 직접 확인했다. `MASKED_INPUT_DATA_REASON` 앵커 삭제로 죽은 코드도 사라졌다. 남은 사안은 신규 테스트 `describe` 블록의 `beforeEach` 6줄 복제(신규, INFO)와 정책 배경 서사의 다중 파일 근접 중복(기존에 반복 인지·수용된 트레이드오프, INFO) 둘뿐이며 둘 다 기능적 결함이나 구조적 부채가 아니다.

## 위험도

LOW
