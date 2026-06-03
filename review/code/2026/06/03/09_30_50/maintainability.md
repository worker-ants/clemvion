# 유지보수성(Maintainability) 리뷰

## 발견사항

### code.handler.ts

- **[WARNING]** `buildHelpers()`가 매 `execute()` 호출마다 새 객체를 생성함
  - 위치: `code.handler.ts` L23–38, L79
  - 상세: `buildHelpers()`는 순수 함수이며 반환 객체의 내용이 호출 간 달라지지 않는다. 매 sandbox 생성 시마다 새 클로저 묶음이 할당된다. 성능보다 유지보수 관점에서, 함수가 상태를 가지지 않는다는 의도가 코드에서 명확히 드러나지 않아 독자가 "왜 매번 새로 만드나?"라는 의문을 가질 수 있다.
  - 제안: 모듈 상수로 추출하거나(`const SANDBOX_HELPERS = buildHelpers()`) JSDoc에 "stateless, returns same-shaped object every call" 을 명시해 의도를 선언한다.

- **[WARNING]** `execute()` 메서드 내 에러 코드 문자열(`'EXECUTION_TIMEOUT'`, `'ERR_SCRIPT_EXECUTION_TIMEOUT'`, `'CODE_RUNTIME_ERROR'`)이 메서드 본문과 `failure()` 헬퍼에 분산되어 있음
  - 위치: `code.handler.ts` L205, L214, L247–249, L281–286
  - 상세: 동일한 에러 코드 리터럴이 `execute()` 내 두 곳(sync-throw 분기, async-catch 분기)과 `failure()` 내 정규화 분기까지 총 세 곳에 걸쳐 나타난다. 향후 에러 코드 체계를 변경할 때 누락 위험이 있다.
  - 제안: 파일 상단에 `const ERR = { EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT', VM_TIMEOUT: 'ERR_SCRIPT_EXECUTION_TIMEOUT', RUNTIME: 'CODE_RUNTIME_ERROR' } as const` 형태의 열거 상수를 두어 단일 진실 소스로 관리한다.

- **[WARNING]** `execute()` 내 `config` 에코 블록(`config.code`, `config.language`, `config.timeout`)이 성공 경로와 `failure()` 내에서 중복됨
  - 위치: `code.handler.ts` L236–240 (성공), L292–296 (failure)
  - 상세: 에코 객체 구조(`{ code, language, timeout }`)가 두 경로에서 동일하게 구성된다. 필드가 추가될 경우 두 곳을 모두 수정해야 한다.
  - 제안: `buildEchoConfig(config: Readonly<Record<string, unknown>>)` 순수 함수로 분리한다.

- **[INFO]** `execute()` 메서드가 약 100줄로 sync 타임아웃 처리, async Promise.race 타임아웃, 성공 반환, 에러 반환을 모두 담당
  - 위치: `code.handler.ts` L159–259
  - 상세: 현재 구조는 읽기 충분히 가능하며 각 분기에 주석이 달려 있다. 다만 `script.runInContext` 호출이 두 개의 독립적인 try-catch에 나뉘어 있어(sync throw 감지 + async race) 독자가 흐름을 추적하려면 두 블록을 모두 파악해야 한다.
  - 제안: `runScript(script, ctx, timeoutMs, logs): Promise<NodeHandlerOutput>` 로 분리하면 `execute()` 자체는 설정 조립 + 위임만 담당하게 된다. 필수 변경은 아니나 향후 실행 전략(예: Worker 전환) 시 교체 단위가 명확해진다.

- **[INFO]** `DEFAULT_TIMEOUT_SEC = 30`이 `code.schema.ts`의 `z.number().default(30)`과 중복됨
  - 위치: `code.handler.ts` L13, `code.schema.ts` L61
  - 상세: 두 곳에서 독립적으로 `30`을 선언한다. schema의 `.default(30)`이 엔진 경로를 통과하면 핸들러의 `DEFAULT_TIMEOUT_SEC`은 실질적으로 raw fixture 경유 fallback 용도다. 값 불일치 가능성은 낮지만 의도가 주석 없이는 불명확하다.
  - 제안: 주석에 "schema default가 엔진 경로를 통과하는 경우 이 값은 사용되지 않는다; raw fixture bypass 경로의 최후 방어선" 을 명시하거나, schema에서 상수를 export하여 handler가 참조하도록 한다.

### code.schema.ts

- **[INFO]** `codeNodeOutputSchema`와 `codeNodeConfigSchema` 모두 `timeout: z.number()` 필드를 선언하나 서로 다른 컨텍스트(입력 설정 vs 출력 에코)임에도 같은 파일에 혼재
  - 위치: `code.schema.ts` L12–35 (output schema), L37–67 (config schema)
  - 상세: 현재 파일 크기(128줄)는 적정하며 응집도가 높다. 다만 output schema의 `timeout`은 `.optional()`인 반면 config schema는 `.default(30)`을 가지므로, 두 스키마가 같은 파일에 있다면 둘 사이 의미 차이를 명시하는 섹션 구분 주석이 도움이 된다.
  - 제안: `// --- Config schema (input) ---` / `// --- Output schema (execution result echo) ---` 구분 주석 추가.

### code.handler.spec.ts

- **[INFO]** `$helpers` 테스트 각 케이스에서 `execute()` 호출 + `as unknown as { output: ... }` 캐스팅 패턴이 반복됨
  - 위치: `code.handler.spec.ts` L83–129
  - 상세: 4개 테스트 모두 동일한 `(await handler.execute(null, { code: '...' }, context)) as unknown as { output: T }` 패턴을 사용한다. 현재 수준(4개)에서는 허용 가능하지만 헬퍼를 늘릴 때마다 반복된다.
  - 제안: `async function execCode<T>(code: string): Promise<{ output: T }>` 형태의 테스트 헬퍼를 describe 블록 상단에 두어 코드 중복을 줄인다. 이미 파일의 다른 describe 블록들도 같은 패턴을 공유하므로 파일 수준 헬퍼로 올려도 좋다.

- **[INFO]** `$node` fallback 테스트에서 `context`를 수정하지 않고 beforeEach에서 생성된 상태 그대로 사용하는 의도가 주석으로만 설명됨
  - 위치: `code.handler.spec.ts` L71–79
  - 상세: "Direct-invoke fixtures may omit nodeId/nodeLabel" 주석이 있어 의도는 파악 가능하나, `context`에 `nodeId`/`nodeLabel` 필드 자체가 없음을 명시하면 더 명확하다.
  - 제안: `// context has no nodeId/nodeLabel set — verifies '' fallback` 처럼 assert 의도를 코드에 가깝게 명시하거나, `delete context.nodeId` 를 명시적으로 호출해 "이 필드가 없음"이 테스트의 전제임을 코드로 표현한다.

## 요약

전체적으로 코드 구조는 명확하고 주석 품질이 높다. 가장 주목할 유지보수성 위험은 두 가지다. 첫째, 에러 코드 리터럴(`'EXECUTION_TIMEOUT'`, `'ERR_SCRIPT_EXECUTION_TIMEOUT'`)이 `execute()` 분기와 `failure()` 정규화 로직에 분산되어 있어 에러 코드 체계 변경 시 누락 가능성이 있다. 둘째, `execute()` 성공 경로와 `failure()` 내에서 config 에코 객체가 중복 구성되어 필드 추가 시 두 곳을 모두 수정해야 한다. `buildHelpers()` 호출 방식과 `DEFAULT_TIMEOUT_SEC` 중복 선언은 낮은 수준의 명확성 문제다. 테스트 파일의 execute 패턴 반복은 헬퍼 함수로 정리하면 향후 케이스 추가 비용이 줄어든다. 심각한 구조적 결함은 없으며 기존 코드베이스 스타일 및 컨벤션 준수도 양호하다.

## 위험도

LOW
