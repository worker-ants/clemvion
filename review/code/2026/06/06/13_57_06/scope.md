### 발견사항

- **[INFO]** e2e 파일(파일 3)의 포맷팅 전용 변경이 실질 변경과 함께 포함됨
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`, diff hunk 1·2
  - 상세: `JWT_SECRET` 삼항 연산자 줄바꿈, `registerAndLogin()` 인자 3개를 각각 별도 라인으로 분리, `expect(finalUserTexts).toEqual([...])` 배열을 1-line 으로 합침 — 모두 의미 변경 없는 포맷팅만. 이 파일의 이번 커밋 목적(회귀 픽스)과 직접 관계 없음.
  - 제안: 포맷팅 전용 변경이 실질 변경과 섞여 있으면 diff 가독성이 떨어짐. 하지만 Prettier autoformat 에 의한 자동 조정으로 보이며, 해당 라인은 기능·로직에 영향 없음 — 그대로 두어도 무방하나, 가능하면 포맷팅 커밋을 별도로 분리하는 것이 이상적.

- **[INFO]** channel-web-chat 테스트(파일 4) 수정이 이번 fix 범위와 간접적으로 연관됨
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`, W8 테스트 케이스
  - 상세: plan.md 의 체크리스트에 명시적으로 "부수: channel-web-chat W8 eager-start flaky 테스트(race) 수정"으로 기록됨. 수정 내용은 `waitFor(callCount===2)` → `waitFor(executionId==="e2")`로 테스트 assertion 순서를 바꿔 race condition 을 제거한 것. 이번 버그(carousel waiting stuck)와 직접적인 인과관계는 없지만, 같은 PR 에서 함께 발견·수정된 flaky 테스트를 정리한 것으로 plan 에 명시되어 있어 의도적인 포함.
  - 제안: scope 관점에서 이 변경이 이번 fix의 핵심 목적과 다른 파일·레이어이므로, 가능하면 별도 커밋으로 분리하는 것이 이력 추적에 유리. 그러나 plan 에 명시된 항목이므로 범위 이탈이라기보다 의도적 수반 수정으로 볼 수 있음.

### 요약

변경된 7개 파일 모두 이번 작업 목적("Carousel blocking 노드의 intra-row inconsistency 로 인한 waiting UI stuck 회귀 fix")에 직접 대응한다. 핵심 구현(파일 2: backend `reconcilePreParkWaitingStatus`, 파일 6: frontend `isNodeWaitingForInput` 도입·활용), 관련 단위 테스트(파일 1, 5), plan 문서(파일 7)는 모두 범위 내다. 파일 3(e2e)에는 의미 없는 포맷팅 변경이 섞여 있고, 파일 4(channel-web-chat)는 이번 버그와 직접 인과관계는 없지만 plan 에 명시된 부수 flaky 테스트 안정화로 의도적 포함이다. 불필요한 리팩토링, 기능 확장, 무관 파일 수정, 임포트 오염 등은 발견되지 않았다.

### 위험도

LOW
