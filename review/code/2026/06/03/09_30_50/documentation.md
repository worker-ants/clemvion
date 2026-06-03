# Documentation Review

## 발견사항

### [INFO] `buildHelpers` JSDoc — 내용 충분하나 반환 타입 상세 부재
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.ts` — `buildHelpers()` JSDoc 블록 (라인 636~642)
- 상세: `buildHelpers` 의 JSDoc 은 "host realm 클로저 + sandbox 미노출" 이라는 설계 의도를 잘 설명한다. 그러나 반환 구조(`date`, `crypto.hash/uuid`, `base64.encode/decode`) 가 JSDoc 에 열거되지 않아, 함수 서명(`Record<string, unknown>`) 만으로는 API 전체를 한눈에 파악하기 어렵다. spec §2.2 테이블이 정보 출처이지만 handler 자체에도 `@returns` 또는 구체 타입 인터페이스가 있으면 IDE 인텔리센스가 개선된다.
- 제안: `buildHelpers` 의 반환 타입을 `Record<string, unknown>` 대신 인터페이스(`HelpersApi`)로 선언하거나, JSDoc `@property` 태그로 `date / crypto.hash / crypto.uuid / base64.encode / base64.decode` 를 문서화한다. 단, spec §2.2 가 이미 SoT 이므로 CRITICAL 수준은 아님.

### [INFO] `buildSandbox` — `nodeMeta` 파라미터 설명 없음
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.ts` — `buildSandbox` 함수 시그니처 (라인 766~771)
- 상세: `buildSandbox` 는 JSDoc 없이 파라미터만 나열되어 있다. 이번 PR 에서 `nodeMeta: { id: string; label: string }` 파라미터가 추가되었으나 이에 대한 설명이 없다. `execMeta` 와의 역할 구분(워크플로 실행 컨텍스트 vs 노드 자체 메타)도 코드 독자에게 즉시 명확하지 않다.
- 제안: 기존 인라인 주석 패턴에 맞게, 함수 첫 줄 또는 시그니처 위에 한 줄 주석으로 `nodeMeta` 역할("current node identity injected as `$node`")을 기술한다.

### [INFO] `code.schema.ts` timeout 필드 주석 — 이중 enforcement 분리 설명은 충분하나 한 가지 누락
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.schema.ts` — `timeout` 필드 인라인 주석 (라인 1326~1329)
- 상세: `Range enforcement stays in validateCodeConfig (spec §6 SoT)` 주석은 설계 분리 이유를 잘 기술한다. 다만 `z.number().default(30)` 에 zod 수준의 범위 제약(`.min(1).max(120)`)이 **의도적으로 없는 이유** — validateCodeConfig 가 커스텀 에러 메시지를 담당하고, zod 에러 메시지를 사용자에게 노출하지 않기 때문 — 가 주석에서 완전히 설명되지 않는다. 현재 주석은 "range enforcement 는 validateCodeConfig" 라고 언급하지만, "왜 zod `.min/.max` 를 쓰지 않았는가"를 독자가 추론해야 한다.
- 제안: 주석에 `// zod .min/.max 를 쓰지 않는 이유: validateCodeConfig 가 커스텀 에러 메시지와 비수치 가드를 단일 메시지로 통합 처리` 한 줄 추가.

### [INFO] spec §2.2 `$helpers.date` — `undefined` 입력 시 동작 미문서화
- 위치: `/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md` — §2.2 테이블
- 상세: spec §2.2 테이블은 `$helpers.date(value)` 의 `value` 파라미터를 "날짜 파싱/포매팅 (dayjs 호환)" 으로만 기술한다. `value` 가 `undefined` 일 때 `dayjs()` 가 "현재 시각" 을 반환한다는 dayjs 기본 동작이 스펙에 명시되지 않아, 사용자가 `$helpers.date()` 호출 시 결과를 예측하기 어렵다. `buildHelpers` 코드에서 `value?: unknown` 이 옵셔널이므로 실제로 `$helpers.date()` 호출이 가능하다.
- 제안: spec §2.2 테이블에 `$helpers.date(value?)` 로 표기를 바꾸고, 주석/각주로 "`value` 생략 시 현재 시각" 을 명시한다. 이는 spec 문서 업데이트이므로 project-planner 영역.

### [INFO] 테스트 파일 — `describe` 블록 spec 참조 표기 일관성
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.handler.spec.ts` — 라인 59, 82
- 상세: 신규 추가된 `describe('execute — $node (spec §2.1)')` 와 `describe('execute — $helpers (spec §2.2)')` 는 spec 섹션 참조 표기가 포함되어 명확하다. 기존 `describe('execute — basic')`, `describe('execute — security restrictions')`, `describe('execute — timeouts')` 등에는 spec 참조가 없어 스타일이 불일치한다.
- 제안: 일관성 개선을 위해 기존 describe 블록에도 해당 spec 섹션 번호를 점진적으로 추가하면 좋으나, 이는 INFO 수준이며 이번 PR 범위 밖.

### [INFO] `code.schema.spec.ts` — `codeNodeConfigSchema.shape.timeout.meta()` 접근 패턴 미설명
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/data/code/code.schema.spec.ts` — 라인 1081~1085
- 상세: `codeNodeConfigSchema.shape.timeout.meta()` 호출은 zod 의 비공식적인 `.meta()` 메서드를 사용하며, as 캐스팅으로 타입을 강제한다. 이 패턴이 왜 사용되었는지, 그리고 zod `.meta()` 가 표준 API 인지 커스텀 extension 인지에 대한 주석이 없다. 코드 독자는 `meta()` 가 어디서 왔는지 추론해야 한다.
- 제안: 해당 테스트 케이스에 한 줄 주석으로 `// zod .meta() is a custom extension from @workflow/zod-meta (or similar); returns the ui hints registered via .meta({...})` 를 추가.

## 요약

이번 변경(Code 노드 sandbox API 갭 보강 — timeout 스키마 선언, `$node`/`$helpers` 주입, timer 셰도잉)은 전반적으로 문서화 품질이 양호하다. `buildHelpers` 의 JSDoc 은 설계 근거(host realm 클로저)를 명확히 설명하고, `buildSandbox` 의 타이머 셰도잉 주석은 spec §7.3 참조를 포함한다. 또한 `code.schema.ts` 의 `timeout` 필드 인라인 주석은 zod 선언과 validateCodeConfig 간의 분리 의도를 잘 기술한다. 테스트 describe 블록에 spec 절 번호가 포함되어 구현-spec 추적성이 개선되었다. 보완이 필요한 항목은 모두 INFO 수준으로, CRITICAL 또는 WARNING 수준의 문서화 누락은 없다. spec 문서(`/Volumes/project/private/clemvion/spec/4-nodes/5-data/2-code.md`)는 이미 `$node`, `$helpers`, timeout, 타이머 차단까지 갱신되어 있어 구현과 spec 간 문서 불일치도 없다.

## 위험도

NONE
