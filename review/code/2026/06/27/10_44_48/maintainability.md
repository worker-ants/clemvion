## 발견사항

### loader.ts

- **[INFO]** 중간 변수 `item` 이 불필요한 이름 추가
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-queue-replay-arguments/codebase/packages/web-chat-sdk/src/loader.ts` 104-105행
  - 상세: `for (const queuedCall of queued)` 다음 줄에서 `const item = queuedCall as unknown` 으로 즉시 재바인딩한다. 하나의 값에 두 이름(`queuedCall`, `item`)이 생겨 추적 비용이 늘고, `item` 이라는 이름은 `queuedCall` 이 이미 표현하는 "큐 항목" 의미를 중복 기술한다. TypeScript cast 는 루프 본문 내 조건식에 인라인으로 적용할 수 있다.
  - 제안: 변수 제거 후 조건식을 `queuedCall as unknown` 으로 직접 캐스팅하거나, `isArrayLike(v: unknown): v is ArrayLike<unknown>` 같은 명명된 타입 가드 함수로 분리해 루프 헤더를 단순화한다.

- **[INFO]** `Array.prototype.slice.call` 보다 `Array.from` 이 의도를 더 명확히 표현
  - 위치: 113행
  - 상세: `Array.prototype.slice.call(item as ArrayLike<unknown>)` 은 동작은 동일하나, `Array.from` 에 비해 "array-like 를 Array 로 변환" 의도가 즉각적으로 읽히지 않는다. 프로젝트 다른 파일에서 관용적으로 쓰이는 패턴도 아니어서 문체 일관성 측면에서도 경미한 마찰이 있다.
  - 제안: `const args = Array.from(item as ArrayLike<unknown>);` 로 교체.

- **[INFO]** 루프 전 주석 블록이 5행으로 길어 스캔 비용 증가
  - 위치: 99-103행
  - 상세: 주석 자체의 내용은 정확하고 유용하다. 다만 "왜 `Array.isArray` 를 쓰면 안 되는가"에 대한 역사적 배경과 스펙 참조가 혼재돼 있어 처음 읽는 개발자에게는 읽는 비용이 있다. plan 문서(`plan/complete/web-chat-loader-queue-replay-arguments.md`)에 상세 분석이 이미 기록돼 있으므로 코드 내 주석은 핵심 제약만 담고 plan 참조를 추가하면 충분하다.
  - 제안: 주석을 2행 내외로 압축. 예: `// 스텁은 push(arguments) 하므로 큐 항목은 array-like. Array.isArray 로 걸러내면 boot 가 무음 누락된다(plan: web-chat-loader-queue-replay-arguments).`

### loader.spec.ts

- **[INFO]** 기존 "큐잉한 호출 replay" 테스트와의 스텁 생성 방식 불일치 — 의도적이지만 주석이 없으면 혼란 가능
  - 위치: 130-148행 (신규 테스트)
  - 상세: 기존 첫 번째 테스트(111행)는 실제 큐잉 로직을 가진 스텁(`...a` rest 파라미터로 push)을 만드는 반면, 신규 테스트는 no-op 함수 스텁(`(() => {})`)에 `.q` 를 수동 주입한다. 이 차이는 버그 재현에 필수적이며 주석(137행)으로 설명돼 있다. 단, 두 스텁 생성 방식이 같은 `describe` 블록 안에 혼재해 있어 처음 보는 사람은 "왜 다른 방식인가" 를 137행 주석을 찾아야만 알 수 있다.
  - 제안: 138행 스텁 선언 바로 위에 `// 의도: 실제 큐 로직 없이 .q 직접 주입 — push(arguments) 산출물을 정확히 재현하기 위해` 한 줄을 추가하면 충분하다.

- **[INFO]** 테스트 설명 문자열이 35자를 초과해 CI/보고 잘림 가능
  - 위치: 130행
  - 상세: `"array-like(arguments) 큐 항목도 replay — 실제 스텁은 push(arguments) (회귀: #709 테스트 갭)"` 는 명확하지만 테스트 러너 출력·PR 코멘트에서 잘릴 수 있다. 심각한 문제는 아니나, 기존 테스트명 길이와 비교하면 다소 길다.
  - 제안: `"array-like(arguments) 큐 항목 replay — push(arguments) 스텁 회귀(#709)"` 정도로 단축 고려.

---

## 요약

변경 규모가 작고(loader.ts 약 13행 교체, 테스트 1개 추가) 핵심 로직은 정확하다. 발견된 유지보수성 이슈는 모두 INFO 수준으로, 이름 중복(`queuedCall`→`item`), 구식 관용구(`Array.prototype.slice.call` vs `Array.from`), 긴 주석 블록, 스텁 생성 방식 불일치 설명 부족이 해당된다. 회귀 테스트는 버그 재현 조건(`Array.isArray === false` assertion)을 명시적으로 포함하고 있어 향후 실수를 막는 가드로서 충분히 기능한다. 코드베이스 내 기존 스타일과도 대체로 일관되며, 수정이 필요한 위험 요소는 없다.

## 위험도

LOW
