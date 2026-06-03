### 발견사항

- **[INFO]** `buildSandbox` 시그니처에 `nodeMeta` 파라미터 추가
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.ts` L62–70 (`buildSandbox` 함수 선언), L172 (`execute` 내 호출부)
  - 상세: `buildSandbox(input, vars, execMeta, logs)` → `buildSandbox(input, vars, execMeta, nodeMeta, logs)` 로 파라미터 순서가 바뀌었다. 그러나 이 함수는 `private` (모듈 로컬) 이고 파일 내 단일 호출지(`execute` 메서드)만 존재한다. 외부 노출이 없으므로 호출자 영향 없음.
  - 제안: 없음. 현재 처리가 적절.

- **[INFO]** `$helpers` 클로저가 host realm `Buffer` / `node:crypto` / `dayjs` 를 사용
  - 위치: `code.handler.ts` L643–658 (`buildHelpers`)
  - 상세: 샌드박스 내부 코드는 `Buffer`, `crypto`, `dayjs` 에 직접 접근할 수 없지만, `$helpers` 함수들은 host realm 클로저이므로 해당 모듈을 사용한다. 이는 의도된 설계이며 커밋 메시지와 JSDoc 에도 명시되어 있다. 함수 결과(문자열·숫자·dayjs 인스턴스)가 vm context 경계를 넘어 반환되지만, `dayjs` 객체는 vm 내에서 메서드 호출이 가능한 host realm 객체다.
  - 잠재 고려: `$helpers.date()` 가 반환하는 `dayjs` 인스턴스는 host realm 객체로, sandbox 코드가 이를 통해 host realm 의 prototype chain 에 접근 가능하다. 그러나 `dayjs` 는 immutable value object 이며 Node.js 네이티브 API 에 접근하는 경로를 제공하지 않으므로 실질적 위험은 낮다.
  - 제안: 현 설계 수용 가능. 향후 보안 강화 시 `dayjs` 결과를 plain object로 serialize 하여 반환하는 방식 고려 가능.

- **[INFO]** `$helpers.crypto.hash`에 algorithm 입력 미검증
  - 위치: `code.handler.ts` `buildHelpers` 내 `crypto.hash`
  - 상세: `createHash(algorithm)` 은 지원하지 않는 알고리즘이 전달되면 Node.js `ERR_OSSL_EVP_UNSUPPORTED` 등 런타임 에러를 throw 한다. 이 에러는 sandbox 경계를 벗어나 `execute` 의 `catch` 블록에서 `CODE_EXECUTION_FAILED` 로 정상 래핑된다. 의도치 않은 부작용은 없으며, 에러 경로는 기존 런타임 에러 처리와 동일하다.
  - 제안: 없음. 에러 처리 흐름이 일관됨.

- **[INFO]** `codeNodeConfigSchema` 에 `timeout` 필드 추가 — 스키마 shape 변경
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.schema.ts` L1330–1335
  - 상세: `codeNodeConfigSchema` 는 `.passthrough()` 를 사용하므로 기존 직렬화된 config 에 `timeout` 이 없어도 `default(30)` 이 채운다. 기존 저장된 workflow config 가 `parse()` 를 거치면 `timeout: 30` 이 추가된다. DB/스토리지에 저장된 raw config 자체는 변경되지 않으며, 파싱 시점에만 기본값이 채워진다. `CodeConfig` 타입에 `timeout: number` 필드가 추가되어 이 타입을 정적으로 사용하는 코드가 있다면 컴파일 타임 영향이 있을 수 있으나, `config: Record<string, unknown>` 패턴으로 핸들러가 수신하므로 런타임 호환성 문제는 없다.
  - 제안: 없음. `.passthrough()` + `default` 조합이 하위 호환을 보장함.

- **[INFO]** `codeNodeConfigSchema` export 추가 (`code.schema.ts` → `code.schema.spec.ts`)
  - 위치: `code.schema.spec.ts` 임포트 변경 — `codeNodeConfigSchema` 신규 import
  - 상세: 테스트 파일 전용 변경이며 프로덕션 코드에 영향 없음. `codeNodeConfigSchema` 는 이미 `code.schema.ts` 에서 export 되고 있었으므로 새 export 도입이 아니라 기존 export 의 신규 사용.

- **[INFO]** `setTimeout` / `setInterval` / `setImmediate` 명시 `undefined` 셰도잉
  - 위치: `code.handler.ts` L827–829 (`buildSandbox` 반환 객체)
  - 상세: vm context 는 이미 이들을 노출하지 않으나, sandbox 딕셔너리에 `undefined` 로 명시함으로써 계약을 선언적으로 문서화한다. 기존 동작에 변화 없음. host realm `setTimeout` (Promise.race 타임아웃용) 은 `execute` 메서드 내에서 직접 사용하며 sandbox 에 노출되지 않으므로 타임아웃 메커니즘에 영향 없다.
  - 제안: 없음.

### 요약

이번 변경은 Code 노드 sandbox 에 `$node` / `$helpers` 를 추가하고 `timeout` 스키마를 선언하는 기능 확장이다. 부작용 관점에서 핵심 위험 지점인 `buildSandbox` 시그니처 변경은 모듈 로컬 함수라 외부 호출자에 영향이 없고, `$helpers` 클로저는 host realm 자원(Buffer/crypto/dayjs)을 사용하지만 sandbox 코드에 직접 노출하지 않는 설계가 JSDoc 과 커밋 메시지에 명확히 기술되어 있다. `codeNodeConfigSchema` 의 `timeout` 필드 추가는 `.passthrough()` + `default(30)` 조합으로 기존 config 하위 호환을 유지한다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 의존성 변경, 의도치 않은 네트워크 호출, 이벤트/콜백 변경은 없다. 공개 API(`NodeHandler.execute` 시그니처, `CodeHandler` 클래스의 public 계약)는 변경되지 않았다.

### 위험도

LOW
