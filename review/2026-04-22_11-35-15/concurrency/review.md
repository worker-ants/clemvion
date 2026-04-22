## 발견사항

- **[INFO]** `stripControlFields` — 제어 필드 없을 때 원본 참조 반환
  - 위치: `execution-engine.service.ts` `stripControlFields` 메서드
  - 상세: 제어 필드(`_selectedPort`, `port`, `status`, `_resumeState`)가 없는 경우 새 객체를 만들지 않고 원본 `output` 참조를 그대로 반환합니다. `ParallelExecutor`가 여러 브랜치에 동일한 노드 출력을 동시에 전달할 때, 두 브랜치가 동일한 객체 참조를 공유하게 됩니다. Node.js는 단일 스레드이므로 순수한 경쟁 조건은 아니지만, 어떤 핸들러가 입력을 변경(mutate)한다면 다른 브랜치의 데이터가 오염될 수 있습니다.
  - 제안: 기존 `stripSelectedPort`와 동일한 패턴이므로 신규 도입 위험은 아닙니다. 다만 핸들러가 입력을 변경하지 않는다는 컨벤션이 명시적으로 강제되지 않습니다.

- **[INFO]** `toEngineFlatShape` — `base.data = output` 원본 참조 저장
  - 위치: `handler-output.adapter.ts` `toEngineFlatShape` 함수
  - 상세: `adapted.port`가 선언되어 있고 `base.data`가 없을 때 `base.data = output`으로 원본 출력 객체의 참조를 저장합니다. 반환된 `base` 객체는 새로 생성되지만, `base.data`는 캐시된 원본을 가리킵니다. 이후 다른 비동기 컨텍스트에서 같은 캐시 항목을 읽으면 얕은 공유 상태가 됩니다.
  - 제안: 이 역시 구조적으로 기존 설계에서 비롯된 것이며, 현재 변경 자체가 도입한 문제는 아닙니다. 방어적으로 처리하려면 `{ ...output }` 형태로 얕은 복사를 적용할 수 있습니다.

---

### 요약

변경된 코드는 동시성 처리와 직접적인 관련이 낮습니다. 핵심 변경사항(`stripControlFields`, `toEngineFlatShape` 오버라이드 로직, `condition-evaluator.util.ts`)은 모두 동기적 순수 함수이거나 로컬 변수만 변이하므로 경쟁 조건이나 데드락을 새로 유발하지 않습니다. 다만 `stripControlFields`가 제어 필드 부재 시 원본 참조를 반환하고 `toEngineFlatShape`가 `base.data`에 원본 참조를 저장하는 패턴은 병렬 실행 컨텍스트에서 핸들러가 입력을 변이하지 않는다는 암묵적 컨벤션에 의존합니다. 이는 기존 아키텍처에서 이어진 구조적 특성이며 이번 변경이 새로 도입한 위험은 아닙니다.

### 위험도

**LOW**