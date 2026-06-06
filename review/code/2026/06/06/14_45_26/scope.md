# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** e2e 파일(`execution-park-resume.e2e-spec.ts`)에 의미 없는 포맷팅 변경이 실질 변경과 섞여 있음
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` diff hunk 1(JWT_SECRET 줄바꿈), hunk 2(`registerAndLogin` 인자 줄바꿈), hunk 3(`expect(finalUserTexts).toEqual` 배열 inline 합침)
  - 상세: 세 diff hunk 모두 기능·로직·검증 내용이 전혀 달라지지 않는 Prettier 스타일 포맷팅만이다. 이번 fix 의 핵심 목적(Carousel intra-row inconsistency 정규화)과 직접 인과관계가 없는 파일에 포맷팅만 추가됐다. plan.md 에도 이 파일에 대한 포맷팅 항목은 별도 언급이 없다(plan 은 "단위 테스트·구현" 만 명시).
  - 제안: 포맷팅 전용 변경은 별도 커밋으로 분리하는 것이 이상적이나, 기능 영향이 없고 diff 규모도 3줄 이하여서 그대로 두어도 무방하다.

- **[INFO]** `channel-web-chat` 테스트(`use-widget-eager-start.test.ts`) 수정이 이번 fix 의 핵심 범위와 간접 연관임
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` W8 flaky-race 수정
  - 상세: 수정 내용은 `waitFor(callCount===2)` → `waitFor(executionId==="e2")` 로 단언 순서를 바꿔 race condition을 제거한 것이다. 이번 버그(Carousel waiting stuck)와 직접적 인과관계는 없으나, plan.md 체크리스트에 "부수: channel-web-chat W8 eager-start flaky 테스트(race) 수정 — 기존 main 에서도 5회 중 2회 실패하던 것을 `waitFor(executionId)` 로 안정화"로 명시적으로 포함된 항목이다.
  - 제안: plan 에 명시된 의도적 수반 수정이므로 범위 이탈이 아니다. 이력 추적 명확성을 원한다면 별도 커밋으로 분리하는 것이 이상적이나 현재 구조도 허용 가능하다.

- **[INFO]** `review/`, `plan/` 산출물 파일 다수(파일 7–24)가 이번 구현 PR 커밋셋에 포함됨
  - 위치: `review/code/2026/06/06/13_57_06/` 하위 10개 파일, `review/consistency/2026/06/06/13_31_11/` 하위 2개 파일, `plan/in-progress/fix-carousel-waiting-status.md`, `plan/in-progress/spec-update-execution-engine-pre-park-window.md`
  - 상세: 이들은 모두 프로젝트 규약에 따른 의무적 부산물(code-review 산출물, consistency-check 산출물, plan 파일)이다. 코드 fix 와 무관한 로직 변경이 아니라 워크플로 규약상 필수 기록물이므로 범위 이탈이 아니다.
  - 제안: 해당 없음.

## 요약

변경된 파일 전체(24개)가 작업 목적("Carousel blocking 노드 pre-park window intra-row inconsistency로 인한 waiting UI stuck 회귀 fix")에 직접 대응하거나 프로젝트 규약에 따른 의무적 산출물에 해당한다. 핵심 구현(파일 2: backend `reconcilePreParkWaitingStatus`, 파일 6: frontend `isNodeWaitingForInput` 도입·활용), 관련 단위 테스트(파일 1, 5), plan 및 review 문서(파일 7–24)는 모두 범위 내다. 포맷팅 전용 변경(파일 3)이 실질 변경과 섞여 있고, channel-web-chat flaky 테스트 안정화(파일 4)가 핵심 범위와 간접 연관이지만 둘 다 plan에 명시되거나 기능 영향이 없는 수준이다. 불필요한 리팩토링, 무관한 기능 확장, 설정 파일 변경, 임포트 오염은 발견되지 않았다.

## 위험도

LOW
