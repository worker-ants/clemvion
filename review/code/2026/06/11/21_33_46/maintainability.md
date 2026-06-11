# 유지보수성(Maintainability) 리뷰

## 발견사항

### 핵심 코드 파일: `codebase/backend/src/nodes/data/code/code.handler.ts`

- **[WARNING]** `execute()` 메서드 책임 과부하 — 150줄 이상의 단일 메서드
  - 위치: `CodeHandler.execute()` (라인 212~370)
  - 상세: 하나의 메서드 안에 (1) isolate 생성, (2) 데이터 주입, (3) 호스트 콜백 주입, (4) 부트스트랩 실행, (5) 유저 코드 컴파일·실행, (6) dual timeout 경쟁, (7) `$vars` 동기화, (8) 성공 응답 조립 등 8개의 구별되는 단계가 모두 포함되어 있다. 섹션 주석(`// --- inject...`, `// --- load dayjs...`)으로 구획을 지었지만 추출 가능한 독립 단위가 여럿이다.
  - 제안: `buildIsolateContext(isolate, input, vars, execMeta, nodeMeta, logs)` 같은 헬퍼로 주입·부트스트랩 단계를 분리하면 `execute()` 자체는 흐름 제어(timeout race, 에러 라우팅)에 집중할 수 있다.

- **[WARNING]** `classifyError()` 내 `message` 정규식 기반 오류 분류 — fragile 매직 패턴
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` 라인 431~439
  - 상세: `isolated-vm`이 메모리 초과 시 던지는 메시지 문자열(`/memory limit/i`, `/Isolate was disposed/i`)에 의존해 에러를 분류한다. 라이브러리 내부 메시지 문자열은 semver 보장 범위 밖이므로 마이너/패치 업그레이드에 취약하다.
  - 제안: 라이브러리가 제공하는 구조화된 에러 타입이나 `err.code` 필드를 우선 사용하고, 정규식을 폴백으로만 유지하거나 주석에 `isolated-vm 6.x` 버전 핀과 함께 "메시지 형식 불변 가정"을 명시한다.

- **[WARNING]** 에러 코드 정규화 로직이 `failure()` 내부에 인라인으로 중첩 삼항 연산
  - 위치: 라인 392~399
  - 상세: `normalizedCode` 산출부가 3단 삼항 연산으로 구현되어 있어 새 에러 코드가 추가될 때 확장이 어렵다. `classifyError()`와 `failure()` 두 곳에 에러 코드 변환 책임이 나눠져 있어 SoT가 불명확하다.
  - 제안: 내부 legacy 코드 → 정규화 코드 매핑 테이블(`const LEGACY_TO_NORMALIZED: Record<string, string>`)을 상수로 정의하고, `failure()` 내 삼항 연산을 `LEGACY_TO_NORMALIZED[errorCode] ?? errorCode`로 대체한다.

- **[INFO]** `BOOTSTRAP_SOURCE` 상수가 인라인 문자열 리터럴로 정의된 JS 소스 코드
  - 위치: 라인 78~149
  - 상세: 72줄짜리 JS 문자열이 TypeScript 파일 안에 하드코딩되어 있다. 현재는 주석이 풍부해 의도가 명확하지만, 편집기 지원(문법 하이라이팅, 린트)이 없어 오타나 JS 문법 오류가 런타임까지 발견되지 않는다. 반면 별도 `.js` 파일로 분리하면 모듈 로드 방식에 따라 번들 복잡도가 늘어날 수 있다.
  - 제안: 현재 인라인 방식은 허용 수준이지만, `syntaxCheck(BOOTSTRAP_SOURCE)`를 모듈 로드 시 1회 실행하는 단언 가드를 추가하거나, 빌드 타임 린트 대상에 포함시키는 방안을 고려한다.

- **[INFO]** `syntaxIsolate` 모듈 레벨 변경 가능 상태 — 테스트 격리 위험
  - 위치: 라인 172
  - 상세: `let syntaxIsolate: ivm.Isolate | undefined`가 모듈 레벨에서 선언되어 있다. 단위 테스트가 여러 `validate()` 호출을 수행할 때 동일 isolate가 공유된다. 테스트 환경에서 isolate 수명이 예상보다 길어질 수 있다.
  - 제안: 현재 주석이 "JS는 단일 스레드라 직렬화됨"을 설명하므로 기능 문제는 없다. 단, `dispose()` 없이 프로세스 종료 시까지 유지됨을 주석에 명시하면 혼란이 줄어든다.

- **[INFO]** `wrapUserCode()` 내 `"use strict"` 위치가 IIFE 외부
  - 위치: 라인 159~167
  - 상세: 생성된 코드 구조를 보면 `"use strict"`가 IIFE body 첫 줄(`(async () => {` 바로 다음)이 아니라 유저 코드 내부 async function 안에 놓여 있다. 외부 IIFE 자체는 strict 모드가 아니다. `BOOTSTRAP_SOURCE`에서 이미 `"use strict"`로 전체 컨텍스트를 선언하므로 실질 영향은 없지만 의도가 모호하다.
  - 제안: 코드 구조 주석에 "BOOTSTRAP_SOURCE의 strict 모드가 컨텍스트 전역에 적용됨"을 명시하거나, IIFE 최상단에 `"use strict"`를 배치해 의도를 자명하게 한다.

---

### `codebase/backend/src/nodes/data/code/code.handler.spec.ts`

- **[INFO]** 메모리 한도 초과 테스트의 `timeout: 30` 설정 — 의도가 불명확한 매직 값
  - 위치: 라인 213 (`timeout: 30`)
  - 상세: `timeout: 30`(초)으로 설정했으나 test runner 타임아웃은 `30_000`(ms, 라인 224). 메모리 초과가 30초 내에 발생해야 한다는 의도는 이해 가능하지만, 두 숫자의 단위가 달라 처음 읽는 독자에게 혼란을 줄 수 있다.
  - 제안: 인라인 주석으로 `// code-node timeout (seconds)` / `// jest timeout (ms)` 단위를 명시한다.

- **[INFO]** `port?: string` 타입 단언이 테스트 타입 캐스트에만 등장
  - 위치: 라인 219 (`port?: string`)
  - 상세: 성공 케이스 타입 캐스트와 달리 메모리 초과 케이스에만 `port?: string`이 포함되어 있다. 일관된 결과 타입을 위한 공유 헬퍼나 인터페이스 부재가 드러난다.
  - 제안: 현재 스케일에서 큰 문제는 아니지만, 반복되는 `as unknown as { output: ...; meta: ... }` 패턴을 공유 헬퍼 타입으로 추출하면 테스트 코드 유지보수성이 향상된다.

---

### `codebase/backend/src/nodes/core/error-codes.ts`

- **[INFO]** 주석 문체가 다른 에러 코드 항목과 상이
  - 위치: 라인 101~103
  - 상세: 기존 에러 코드들은 단순 `// 카테고리명` 구분자만 가지지만, `CODE_MEMORY_LIMIT`은 em dash와 부가 설명이 붙은 JSDoc 스타일 인라인 주석을 사용한다. 코드베이스 내 일관성 관점에서 미미한 불일치다.
  - 제안: 다른 에러 코드들도 같은 수준의 인라인 설명을 갖도록 통일하거나, `CODE_MEMORY_LIMIT`의 주석을 간략하게 줄인다.

---

## 요약

이번 변경의 핵심은 `node:vm`에서 `isolated-vm`으로의 전면 재작성이다. 전반적으로 코드 의도가 주석을 통해 잘 문서화되어 있고, 섹션 구분 주석 덕분에 `execute()` 내 흐름이 추적 가능하다. 그러나 `execute()` 메서드가 150줄 이상으로 여러 책임을 한꺼번에 담고 있어 향후 변경 시 영향 범위가 넓다. `classifyError()`의 메시지 정규식 기반 분류는 라이브러리 업그레이드 시 silent regression 위험이 있으며, 에러 코드 정규화 삼항 체인은 새 코드 추가 때마다 수정 포인트가 늘어난다. 이 두 WARNING이 중기적으로 가장 실질적인 유지보수 부담이다. 나머지는 가독성 또는 일관성 개선 수준의 INFO이며, 기능 정확성에는 영향이 없다.

## 위험도

LOW
