# 변경 범위(Scope) 리뷰

## 발견사항

### **[INFO]** schedules-page.test.tsx — viewer RBAC `queryByTitle` → `queryByRole` 교정이 flaky 수정과 함께 포함
- 위치: `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx`, diff 두 번째 hunk (L389–L379 영역)
- 상세: 이번 변경의 주 의도는 flaky 수정 2건(status-badge fake timer, schedules openAddDialog 다중 매칭)이다. 그런데 `schedules-page.test.tsx` 에는 추가로 viewer RBAC 테스트의 `queryByTitle(/^edit$/i)` → `queryByRole("button", { name: /^edit$/i })` 교정이 포함되어 있다. 이 교정은 이전 리뷰(13_47_12) INFO #1에서 권고된 사항으로, false-negative 구조 결함(항상 null 반환)을 수정한다. 변경 범위가 "flaky 수정"을 넘어 "false-negative 테스트 교정"까지 확장된 것이다.
- 평가: 같은 파일·같은 테스트 영역에서의 교정이며, false-negative 수정이라 테스트 신뢰성을 실제로 향상시킨다. 리뷰 권고 사항의 즉각 적용으로 볼 수 있다. 프로덕션 코드 변경이 아니고, 새 테스트 케이스 추가도 아닌 기존 assertion 방식 교정이므로 over-engineering이나 무관한 리팩토링으로 보기 어렵다. 다만 flaky 수정과 false-negative 교정은 개념적으로 다른 변경이므로, 단일 PR/커밋에 혼재한다는 점은 관찰한다.
- 제안: 범위 이탈로 차단할 필요는 없다. 필요 시 커밋 메시지나 PR 설명에 두 변경(flaky fix + false-negative 교정)을 명시적으로 구분하면 충분하다.

---

변경된 나머지 파일(파일 3~11)은 모두 `review/code/2026/06/28/13_47_12/` 및 `review/code/2026/06/28/14_34_54/` 하위 리뷰 산출물(SUMMARY.md, _retry_state.json, maintainability.md, requirement.md, scope.md, testing.md, meta.json 등)이다. 이 파일들은 코드 리뷰 오케스트레이터가 생성하는 내부 상태·산출물로, 프로젝트 컨벤션(`review/` 산출물은 커밋 포함)상 정상적인 포함이다.

## 요약

이번 변경은 테스트 전용 flaky 수정 2건(status-badge fake timer 격리, schedules openAddDialog 다중 매칭)을 핵심으로 한다. 여기에 이전 리뷰 INFO 권고 사항인 `queryByTitle` false-negative 교정이 같은 파일(schedules-page.test.tsx)에 함께 포함되어 있어 범위가 미세하게 확장된 관찰이 있으나, 이 교정은 프로덕션 코드 미변경·기존 테스트 assertion 방식 개선·false-negative 구조 결함 제거로서 의미 있고 무해한 범위 확장이다. 리뷰 산출물 파일들은 오케스트레이터 컨벤션상 정상 포함이다. 전체적으로 의도된 범위를 실질적으로 벗어난 변경은 없다.

## 위험도

NONE
