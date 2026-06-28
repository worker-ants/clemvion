# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 이전 리뷰 세션 산출물이 동일 PR에 포함
  - 위치: `review/code/2026/06/28/13_47_12/` 하위 파일 7개 (SUMMARY.md, _retry_state.json, maintainability.md, meta.json, requirement.md, scope.md, testing.md)
  - 상세: 이 파일들은 이전 리뷰 사이클(13:47:12 세션)의 산출물로, 코드 변경(flaky 수정)과는 다른 사이클에서 생성된 리뷰 결과물이다. 코드 변경 범위 자체를 일탈하는 수정은 아니며 (`review/` 경로는 리뷰 산출물 저장 위치), 미커밋 상태로 남아있다가 이번 변경과 함께 커밋된 것으로 보인다. 동작에는 영향 없으나 PR 변경 범위를 파악할 때 노이즈가 생긴다.
  - 제안: 리뷰 산출물 커밋은 해당 리뷰 사이클의 커밋으로 분리하거나 동일 커밋에 포함하더라도 커밋 메시지에 리뷰 산출물 포함 사실을 명시하면 이력 추적이 명확해진다. 동작 영향 없으므로 즉시 필수 아님.

- **[INFO]** `status-badge.test.tsx` 변경이 이전 리뷰(13:47:12) 범위에 없었음
  - 위치: `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx`
  - 상세: 직전 리뷰 세션(13:47:12)은 `schedules-page.test.tsx` 단일 파일만 대상으로 했고, `status-badge.test.tsx`는 이번 세션(14:34:54)에서 처음 포함됐다. 변경 의도(flaky 수정)는 동일 범주이며, `vi.useFakeTimers()` + `beforeEach`/`afterEach` 추가는 `Date.now()` 상대 시간 경계 단언의 비결정성을 제거하는 정당한 수정이다. 범위 이탈이라기보다는 "동일 flaky 수정 작업의 두 번째 파일"로 해석이 자연스럽다.
  - 제안: PR 설명 또는 커밋 메시지에 두 파일(schedules-page + status-badge) 모두 flaky 수정 대상임을 명시하면 리뷰 범위 혼동을 방지할 수 있다. 현재 범위 내 변경으로 판단.

## 요약

이번 변경의 실질 코드 수정은 두 테스트 파일의 flaky 해소에만 집중되어 있으며 의도 범위를 벗어나지 않는다. `schedules-page.test.tsx`의 `findByRole → findAllByRole + [0]` + `queryByTitle → queryByRole` 수정, `status-badge.test.tsx`의 `vi.useFakeTimers()` 도입 모두 flaky 원인 제거라는 단일 목적에 충실하다. 불필요한 리팩토링, 기능 확장, 무관한 파일 수정, 설정 변경은 없다. 이전 리뷰 세션(13:47:12) 산출물 7개가 함께 포함된 점은 PR 이력 가독성에 경미한 노이즈를 주지만 `review/` 경로의 정규 산출물로서 변경 범위 이탈에 해당하지 않는다.

## 위험도

NONE
