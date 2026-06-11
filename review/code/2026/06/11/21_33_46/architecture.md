### 발견사항

- **[INFO]** `CodeHandler` 클래스가 실행 격리·오류 분류·결과 직렬화·설정 에코·$vars 동기화까지 모든 책임을 단일 클래스에서 처리
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` — `CodeHandler.execute()` (L212–370)
  - 상세: 단일 메서드 안에 (1) isolate 생성, (2) 컨텍스트 데이터 주입, (3) 부트스트랩 스크립트 실행, (4) 사용자 코드 컴파일·실행, (5) 이중 타임아웃 경쟁, (6) $vars 동기화, (7) 성공/실패 라우팅이 전부 인라인되어 있다. 현재 규모에서는 수용 가능하나, 메모리 스냅샷·샌드박스 풀링·실행 통계 수집 등을 추가할 경우 클래스가 비대해질 수 있다.
  - 제안: 즉각 리팩터링 필요는 없다. 단, 향후 확장을 위해 `IsolateRunner` (격리 컨텍스트 생성·실행) 또는 `SandboxFactory` (데이터 주입·부트스트랩)를 별도 클래스로 추출하는 경로를 내부 주석 또는 TODO로 남겨두면 경계를 명시할 수 있다.

- **[INFO]** `classifyError` 가 `isolated-vm` 에러 메시지를 정규식 휴리스틱으로 판별
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L431–439
  - 상세: `ivm` 라이브러리의 메모리 초과 에러 형태를 `/memory limit/i` 와 `/Isolate was disposed/i` 두 패턴으로 감지한다. 라이브러리 내부 구현이 변경되면 이 휴리스틱이 조용히 `CODE_RUNTIME_ERROR` fallback으로 빠질 수 있다. 현재는 `CODE_MEMORY_LIMIT` 분기가 테스트로 검증되어 있어 회귀는 감지 가능하다.
  - 제안: `isolated-vm`이 공식적으로 메모리 초과 시 던지는 에러 객체에 식별 가능한 `code` 프로퍼티나 `name`이 있다면 문자열 패턴 대신 그것을 우선 참조하도록 분기 순서를 조정한다. 테스트를 통한 회귀 감지가 이미 갖춰져 있으므로 CRITICAL은 아니다.

- **[WARNING]** 모듈 초기화 시점에 파일시스템 동기 읽기(`readFileSync`) 수행
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L32–35
  - 상세: `DAYJS_SOURCE = readFileSync(require.resolve('dayjs/dayjs.min.js'), 'utf-8')` 가 모듈 로드 시점(정적 초기화)에 실행된다. 이는 수 ms의 동기 I/O를 서버 시작 경로에 삽입한다. 또한 `dayjs/dayjs.min.js` 패키지 경로가 `package.json` `dependencies` 명시 없이 `require.resolve`로만 해소되어 패키지 구조가 달라지면(메이저 업그레이드, flat node_modules 미보장 환경) 런타임 오류로 즉시 이어진다. 이는 레이어 책임 관점에서 "데이터 파일 로딩" 이 서버 부트 경로에 노출된 형태다.
  - 제안: (단기) `dayjs/dayjs.min.js` 파일을 프로젝트 내부 `assets/` 로 복사해 의존성 경로 취약성을 없앤다. 또는 `readFileSync` 를 팩토리 초기화 시점(첫 `execute` 호출 또는 명시적 `init()`)으로 이동해 서버 시작 경로를 깨끗하게 유지한다.

- **[INFO]** 모듈 수준 가변 상태: `syntaxIsolate` 싱글턴
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L172
  - 상세: `syntaxIsolate` 는 모듈 레벨 `let` 으로 선언된 가변 싱글턴이다. JS 단일 스레드 특성으로 경쟁이 없고 컴파일 전용 isolate라 안전성은 확보되어 있으나, 의존성 역전 원칙(DIP) 관점에서 `CodeHandler` 가 이 상태를 암묵적으로 공유한다. 테스트 간 격리나 다중 인스턴스 시나리오에서 문제가 될 수 있다.
  - 제안: `syntaxIsolate` 를 `CodeHandler` 의 private 필드 또는 `SyntaxChecker` 클래스로 캡슐화한다. 현재 테스트가 단일 인스턴스 전제라 즉각 문제는 없다.

- **[INFO]** `BOOTSTRAP_SOURCE` 이 모듈 레벨 문자열 상수 — 보안 정책이 코드로 소산
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L78–149
  - 상세: 허용/차단 API 목록이 `BOOTSTRAP_SOURCE` 인라인 문자열 배열에 하드코딩되어 있다. 정책이 변경될 때마다 문자열 내부를 직접 편집해야 하며 TS 타입 체크나 lint가 적용되지 않는다. 보안 정책 변경 시 리뷰어가 JS 문자열 리터럴을 수동으로 확인해야 한다.
  - 제안: 차단 키 목록을 `code.handler.ts` 상단의 `const BLOCKED_GLOBALS = ['eval', 'Function', ...]` TS 배열로 분리하고, `BOOTSTRAP_SOURCE` 를 이 배열을 참조해 생성하는 팩토리 함수로 만든다. 이를 통해 정책 변경이 타입 안전 TS 편집 영역에서 이루어지도록 한다.

- **[INFO]** `wrapUserCode` 에서 사용자 코드가 `JSON.stringify` 를 통해 직렬화됨 — 의도적 설계이나 문서화 부족
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L158–167
  - 상세: 사용자 코드 반환값이 isolate 내부에서 `JSON.stringify` 되고 host에서 `JSON.parse` 되는 이중 직렬화 구조다. 이는 `dayjs` 인스턴스 같은 비-JSON 값이 `.toJSON()` 을 통해 string으로 축소되는 부작용을 낳는다. 현재 spec §5.1에 언급되어 있으나 코드 내 주석(`wrapUserCode` JSDoc)에서도 이 behaviour를 명시하고 있어 괜찮다.
  - 제안: 현재 설계 의도가 명확하게 문서화되어 있으므로 변경 불필요. 향후 `Map`/`Set` 직렬화 지원 요청이 들어올 경우 여기서 처리 경로를 확장하면 된다.

- **[WARNING]** `failure()` 메서드의 오류 코드 정규화 로직이 `classifyError()` 와 분리되어 이중 매핑 레이어 형성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L393–399
  - 상세: `classifyError()`가 내부 레거시 코드(`EXECUTION_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED`, `CODE_RUNTIME_ERROR`)를 반환하면, `failure()` 메서드가 이를 정규화 코드(`CODE_TIMEOUT`, `CODE_MEMORY_LIMIT`, `CODE_EXECUTION_FAILED`)로 다시 매핑한다. 두 단계 매핑이 서로 다른 함수에 나뉘어 있어 새 에러 유형을 추가할 때 `classifyError` 와 `failure` 두 곳을 모두 수정해야 하며 누락하기 쉽다. 이는 단일 책임 위반보다는 응집도 약화 문제다.
  - 제안: `classifyError` 가 내부 레거시 코드 대신 정규화된 공개 코드를 직접 반환하도록 단일화한다. `legacyCode` 는 `classifyError` 내부에서 반환 쌍(tuple)으로 함께 돌려주거나, `failure` 로 원본 에러를 전달해 그 안에서 메시지 패턴 분기와 정규화를 일괄 처리한다.

- **[INFO]** 격리 컨텍스트와 호스트 콜백 사이 경계(ivm.Callback)에 대한 타입 안전 부재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/code-node-isolated-vm/codebase/backend/src/nodes/data/code/code.handler.ts` L252–278 (ivm.Callback 주입부)
  - 상세: `ivm.Callback` 에 전달되는 함수 파라미터 타입이 `unknown`으로 선언되어 있고, 실제 타입 검증은 `hostHash()` 같은 host 함수 내부에서 수행된다. 이 경계는 isolate가 임의 값을 넘길 수 있는 신뢰 경계이므로 타입 어설션이 아닌 런타임 가드가 올바른 위치에 있다. 설계 자체는 적절하다.
  - 제안: 현재 방식이 정확하다. 변경 불필요.

---

### 요약

이번 변경은 `node:vm` 기반의 취약한 pseudo-sandbox를 `isolated-vm` V8 Isolate로 전면 교체하는 것으로, 아키텍처 관점에서 올바른 방향이다. 레이어 책임은 명확하게 유지되어 있으며 — NodeHandler 인터페이스를 통한 의존성 역전, `ivm.Callback` 을 통한 host/isolate 경계 명시, `ExternalCopy` 를 통한 데이터 직렬화 계층 — 핵심 보안 경계 설계는 견고하다. 주요 아키텍처 개선 여지는 두 가지다: (1) `classifyError`와 `failure()` 사이의 이중 에러 코드 매핑 레이어가 새 에러 유형 추가 시 누락 위험을 높이며 (WARNING), (2) 모듈 초기화 시점의 동기 `readFileSync` 가 서버 부트 경로에 I/O를 노출하고 패키지 경로 변경에 취약하다 (WARNING). 그 외 `BOOTSTRAP_SOURCE` 인라인 보안 정책, `syntaxIsolate` 모듈 레벨 싱글턴은 현재 규모에서 수용 가능하나 장기 확장성 관점에서 캡슐화가 권장된다.

### 위험도

LOW
