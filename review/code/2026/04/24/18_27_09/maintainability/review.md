### 발견사항

- **[WARNING]** `labelLookalikeHint`가 `findByLabel`의 순회 로직을 중복 구현
  - 위치: `shadow-workflow.ts` — `labelLookalikeHint` 메서드
  - 상세: `for (const node of this.nodes.values()) { if (node.label === value) }` 패턴은 `findByLabel(label)`이 이미 수행하는 동일한 선형 탐색임. 두 메서드가 독립적으로 유지되면 향후 `findByLabel`의 로직(예: 대소문자 무시 옵션 등)을 변경할 때 `labelLookalikeHint`가 누락될 위험이 있음.
  - 제안: `const node = this.findByLabel(value); if (!node) return null;`로 위임하고 hint 문자열 생성 로직만 남김.

- **[WARNING]** `labelLookalikeHint` 내 `safeValue`와 `safeLabel`이 항상 동일한 값
  - 위치: `shadow-workflow.ts`:673–680 (diff 기준 추가 구간)
  - 상세: 진입 조건이 `node.label === value`이므로 두 변수에 동일한 입력이 들어가 `sanitizeLlmProvidedString`이 두 번 호출됨. 변수명이 서로 다른 값을 암시해 가독성을 해침. 힌트 메시지도 "Value X matches the label of node X"처럼 동어반복이 됨.
  - 제안: 변수를 `safe`(또는 `safeId`) 하나로 통합하고, 힌트 문구도 `"'SendEmail' is a node label, not a UUID — use id '11111111-…' instead."` 형태로 명확화.

- **[WARNING]** `updateNode`에는 call-site 인라인 주석이 있고 `removeNode`에는 없는 비대칭
  - 위치: `shadow-workflow.ts` — `updateNode`(주석 있음) vs `removeNode`(주석 없음)
  - 상세: 두 메서드는 동일한 `labelLookalikeHint` 호출 패턴을 사용하나, `updateNode`의 diff에만 3줄 인라인 설명이 붙고 `removeNode`는 주석 없이 동일 코드가 추가됨. 일관성이 없으면 "왜 여기엔 없지?"라는 의문을 유발함.
  - 제안: 두 곳 모두 주석을 제거하거나(JSDoc이 이미 있으므로), 동일한 짧은 주석을 붙임.

- **[INFO]** `labelLookalikeHint`가 `build*` 네이밍 컨벤션을 따르지 않음
  - 위치: `shadow-workflow.ts` — 메서드명
  - 상세: 동류 메서드인 `buildPortNotFoundResult`, `buildUnknownNodeTypeResult`는 `build` 접두사를 사용하는 반면 이 메서드는 동사 없이 명사구로 명명됨. 반환값이 `string | null`(결과 전체가 아님)이라 차이는 있지만 `buildLabelAsIdHint`처럼 동사를 붙이면 탐색 시 일관성이 높아짐.
  - 제안: `buildLabelAsIdHint` 또는 `labelAsIdHint`로 변경.

- **[INFO]** `addEdge` else-branch의 우선순위 로직이 다소 조밀함
  - 위치: `shadow-workflow.ts` — `addEdge` 내 새 else 블록
  - 상세: `sourceHint === null && !this.nodes.has(targetId)` 체이닝은 "source가 매치 실패했을 때만 target 확인"이라는 의도를 한 번에 파악하기 어려움. 인라인 주석이 도움을 주지만, 변수명 자체로 의도를 표현하기 어려운 구조.
  - 제안: 두 호출을 `??` 체이닝으로 병합하거나, 명시적인 early-return으로 분리해 의도를 드러냄.

- **[INFO]** `system-prompt.spec.ts`의 신규 정규식이 섹션 범위를 고정하지 않음
  - 위치: `system-prompt.spec.ts` — 새 it 블록 assertions
  - 상세: `expect(prompt).toMatch(/never.*label|label.*never/i)` 등은 프롬프트 전체에서 매칭하므로, 대상 규칙이 엉뚱한 섹션에 존재해도 테스트가 통과함. 기존 다른 it 블록도 동일 패턴을 사용하므로 파일 내 일관성은 있으나, 섹션 순서 회귀 테스트(아래 `5-block structural layout` describe)와의 역할 분리가 불명확해짐.
  - 제안: 현 수준(파일 내 일관성)은 허용 가능하나, 중요 제약은 위치 기반 단언(`indexOf` + 비교)을 추가해 보완하는 것을 고려.

---

### 요약

이번 변경은 LLM이 노드 label을 UUID 자리에 잘못 넣는 실수를 자동 감지해 힌트를 반환하는 기능으로, 설계 의도와 테스트 커버리지가 명확하다. 가장 두드러지는 유지보수 부채는 `labelLookalikeHint`가 이미 존재하는 `findByLabel`을 재발명한다는 점이며, 내부에서 항상 동일한 값이 되는 두 변수(`safeValue`/`safeLabel`)를 별도 명명해 가독성을 낮춘다. `updateNode`와 `removeNode` 간 인라인 주석 비대칭도 소규모지만 일관성을 해친다. 나머지는 네이밍 관례나 단언 범위 등 INFO 수준의 사항이며, 전반적인 코드 품질은 기존 파일과 동등한 수준을 유지하고 있다.

### 위험도

**LOW**