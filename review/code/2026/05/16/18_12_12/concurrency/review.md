### 발견사항

- **[INFO]** best-effort audit try/catch 분리는 동시성 관점에서 적절하나, `saved` 변수의 비원자적 흐름 명확화 필요
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — 변경된 `create()` 메서드, 라인 +117~+147
  - 상세: `save()`와 `auditLogsService.record()` 를 두 개의 독립 try/catch 블록으로 분리한 구조는 Node.js 단일 스레드 이벤트 루프 관점에서 경쟁 조건을 유발하지 않는다. 두 await 은 순차적으로 실행되며, `saved` 변수는 첫 번째 블록 완료 후에만 두 번째 블록에서 참조된다. 따라서 공유 상태에 대한 동시 접근 문제는 없다. 다만, `let saved: Integration` 선언 후 첫 번째 try 블록이 throw 하면 `saved` 는 uninitialized 상태이고, 두 번째 try 블록에서 `saved.id` 를 참조하는 코드(logger.warn 내 `saved.id`)가 TypeScript 컴파일러 레벨에서는 허용되지만 런타임 safe 여부가 흐름 분석에 의존한다. 실제로는 첫 번째 catch 가 항상 re-throw 하므로 두 번째 블록에 도달할 때 `saved` 는 반드시 초기화되어 있다 — 하지만 이 의존성이 명시적이지 않아 향후 리팩토링 시 오류 가능성이 있다.
  - 제안: `let saved: Integration` 대신 TypeScript 의 definite assignment assertion(`saved!`)이나 `const saved = await ...` 로 스코프를 명확히 하는 것이 더 안전하다. 또는 두 번째 try 블록 시작부에 `// saved is guaranteed to be initialized here (first try always rethrows on failure)` 주석으로 의도를 명시한다.

- **[INFO]** audit log best-effort 정책에서 동시 요청 간 독립성 확인
  - 위치: `backend/src/modules/integrations/integrations.service.ts` — `create()` 메서드 전체
  - 상세: Node.js 이벤트 루프 기반 NestJS 환경에서, 동시에 복수의 `create()` 요청이 들어와도 각 호출은 독립적인 async 실행 컨텍스트를 가진다. `saved` 변수는 클로저 스코프에 격리되므로 요청 간 공유 상태 문제가 없다. `auditLogsService.record` 내부가 DB write 를 수행한다면 DB 커넥션 풀 경합은 발생할 수 있지만, 이는 커넥션 풀 설정 레벨의 문제이며 이번 변경 범위 밖이다.
  - 제안: 현재 구조는 동시성 관점에서 안전하다. 추가 조치 불필요.

### 요약

이번 변경은 `integrations.service.ts` 의 `create()` 메서드에서 `save()` 와 `auditLogsService.record()` 를 두 개의 독립 try/catch 블록으로 분리하여 audit 실패가 사용자에게 500 으로 노출되지 않도록 한 리팩토링이다. Node.js 단일 스레드 이벤트 루프 특성상 async/await 순차 실행 구조 내에서 경쟁 조건이나 데드락, 스레드 안전성 문제는 발생하지 않는다. `saved` 변수의 uninitialized 가능성은 첫 번째 catch 의 re-throw 보장으로 런타임 안전하지만, 코드 의도가 명시적이지 않아 향후 리팩토링 시 잠재적 혼란 요소가 될 수 있다. 테스트 파일(`integrations.service.spec.ts`) 변경은 best-effort 정책 회귀 감지용으로 동시성 관점에서 특이사항 없다. 전체적으로 동시성 위험도는 낮다.

### 위험도

LOW
