# 유지보수성(Maintainability) 리뷰

## 검토 범위

코드 변경은 6개 파일이다 — 신규 repo-guard(`trigger-secret-columns-guard.ts`) + 그 소비 spec(`trigger-secret-columns.spec.ts`), 기존 `trigger-workflow-ref.spec.ts` 의 주석 표기 정리(원문자→아라비아 숫자 통일), 그리고 `chat-channel-trigger-create.e2e-spec.ts`·`schedule-trigger.e2e-spec.ts`·`trigger-workflow-ref.e2e-spec.ts` 세 e2e 파일의 소규모 추가(주석 정정 + 기존 헬퍼 호출 3곳 삽입). 나머지 10개 파일(`plan/**`, `review/consistency/**`)은 코드가 아니라 계획·검토 산출물이라 함수 길이·중첩·순환 복잡도 같은 코드 메트릭이 적용되지 않는다 — 표·체크리스트 구조가 기존 저장소 관례(표, 각주, 인용문)를 그대로 따르고 있어 유지보수성 관점의 별도 지적사항은 없다.

## 발견사항

- **[WARNING]** vacuity 테스트의 삼항식이 실제로는 한쪽 분기에서 아무것도 검증하지 않는데, 코드만 보면 두 분기 모두를 검증하는 것처럼 읽힌다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts:59`
  - 상세: `expect(value === null ? \`${rel}: 못 읽음\` : value.length).not.toBe(0);` 에서 `value === null` 인 분기는 문자열(`` `${rel}: 못 읽음` ``)을 숫자 `0` 과 `.toBe()` 로 비교한다. 문자열과 숫자는 `toBe`(참조/원시값 엄격 동등) 상에서 항상 다르므로 이 줄은 `value === null` 인 경우 **절대 실패하지 않는 무의미한 통과**가 된다. 실제 null 검출은 바로 다음 줄 `expect(value).not.toBeNull();` 이 담당한다. 즉 59행은 "리더가 값을 못 읽으면 실패 메시지에 어느 파일인지 보여준다"는 의도로 보이지만, 그 의도된 진단 표시는 (toBe 실패가 발생하지 않으므로) 결코 트리거되지 않는다 — 죽은 코드에 가깝고, 다음에 이 패턴을 그대로 복붙하면 "라벨을 조합해 실패 메시지에 끼워 넣는 관용구"로 오인되어 다른 곳에서도 반복될 위험이 있다. 이 저장소는 vacuous assertion 에 특히 민감한 이력이 있어(형제 파일들의 "조용히 통과" 경계 사례) 더 눈에 띄는 지점이다. 다만 실질적 커버리지 결함은 아니다 — 바로 다음 줄이 null 여부를 실제로 잡아준다.
  - 제안: 삼항식을 제거하고 두 단언을 분리한다. 예: `if (value === null) throw new Error(\`${rel}: 못 읽음\`);` 후 `expect(value.length).not.toBe(0);` 처럼 null 분기와 length 분기를 명시적으로 나누면 "왜 이 줄이 존재하는가"가 코드만으로 드러난다.

- **[INFO]** `expectTriggerWorkflowRef(x, { present: true, expectedWorkflowId: workflowId })` 3-way 호출 중복.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — C-2 목록 케이스(약 `275`행대), G 케이스(약 `390`행대), H 케이스(약 `427`행대) 세 곳.
  - 상세: 동일한 인자 형태(`present: true, expectedWorkflowId: workflowId`)의 호출이 세 `it()` 에 반복된다. 다만 같은 파일 안에서 `assertMatchesContract(...)` 도 유사하게 여러 곳에 반복되는 기존 패턴이라, 이번 추가가 새로운 중복 스타일을 들여온 것은 아니고 기존 관례와 일관적이다. 세 곳 모두 서로 다른 `it()` 시나리오(목록/PATCH 비활성/PATCH 재활성)의 독립적 회귀 방어이므로 헬퍼로 더 묶는 것이 오히려 각 케이스의 "무엇을 확인하는지"를 흐릴 수 있어, 지금 형태를 유지하는 편이 합리적으로 보인다. 결함으로 등재하지 않음 — 참고용.

- **[INFO]** 원문자(①②③…) → 아라비아 숫자 통일은 가독성·grep 가능성을 실제로 개선한다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` 전역(헤더 목록 + `## 가드 3·5` 헤딩).
  - 상세: 변경 전에는 마스터 목록이 원문자였고 케이스 헤딩 하나만 원문자라 `grep '가드 [0-9]'` 로 그 케이스가 누락됐다(plan 문서가 실측으로 언급). 변경 후 `grep '[①-⑪]'` 로 확인한 결과 저장소에 잔존 원문자가 0건이라, 목적(도구로 찾을 수 있는 표기 통일)이 실제로 달성됐다. 긍정적 변경이라 별도 조치 불필요.

## 요약

핵심 신규 코드(`trigger-secret-columns-guard.ts`)는 저장소의 기존 AST 기반 repo-guard 관례(`redis-fail-open-catalog-guard.ts` 등)와 구조·네이밍·JSDoc 스타일이 잘 정렬되어 있고, 함수 길이·중첩 깊이·네이밍 모두 형제 파일과 동등한 수준이라 유지보수성 문제가 없다. `trigger-workflow-ref.spec.ts` 의 원문자→아라비아 숫자 통일은 실질적인 가독성 개선이다. 유일하게 지적할 사항은 `trigger-secret-columns.spec.ts` 의 vacuity 테스트에서 삼항식이 null 분기를 실제로 검증하지 않으면서 검증하는 것처럼 보이는 혼동 소지(WARNING)이며, 전체 커버리지에는 영향이 없다(다음 줄이 실질 검증을 담당). e2e 3파일의 추가는 기존 호출 패턴을 그대로 재사용한 소규모 삽입으로 별다른 복잡도·중복 문제를 만들지 않는다.

## 위험도

LOW
