# 부작용(Side Effect) 리뷰

## 발견사항

---

### [WARNING] `resolveSystemContextTimezone` 이 `process.env.TZ` 를 런타임에 직접 읽음

- **위치**: `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts` L54
- **상세**: `resolveSystemContextTimezone` 함수가 fallback chain 2단계로 `process.env.TZ` 를 읽는다. 이는 환경 변수의 **의도된** 읽기이며 spec §11.3 에 명시된 SoT 이지만, Node.js 프로세스 전체에 전역적으로 공유되는 값이라는 점에서 부작용 가능성이 있다. 구체적으로: (1) 테스트 환경에서 `process.env.TZ` 를 서로 다른 값으로 설정하는 테스트가 병렬 실행되면 다른 테스트의 결과에 영향을 미칠 수 있다. (2) 프로세스 외부(OS, Docker, cloud runtime)에서 `TZ` 가 UTC 가 아닌 값으로 설정되어 있을 경우, workspace 설정이 없는 노드에서 예상 외의 timezone 으로 작동한다.
- **제안**: 함수 시그니처에 `envTz?: string` 파라미터를 추가해 테스트에서 주입 가능하도록 하거나, 적어도 함수 doc-comment 에 환경 변수 의존성을 명시적으로 경고한다. 현재 spec 문서가 이 의존성을 기술하고 있으므로 즉각적 코드 변경보다 테스트 격리 가이드 추가를 권장한다.

---

### [WARNING] `execution-engine.service.ts` 에서 `findOneBy` → `findOne` 변경으로 DB 쿼리 형태 변경

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L169–172
- **상세**: 기존 `findOneBy({ id: workflowId })` 에서 `findOne({ where: { id: workflowId }, relations: ['workspace'] })` 로 변경되었다. 이는 **의도된 변경**이지만 다음 부작용 위험이 있다: (1) `workflow.workspace` 가 `null` 인 경우(workspace 가 삭제되었거나 FK 참조가 느슨하게 유지되는 경우), `workspaceTimezone` 은 `undefined` 가 되어 fallback 으로 이동한다 — 이는 정상 처리된다. (2) relations eager-load 가 추가되어 불필요하게 workspace 테이블을 JOIN 하므로, workflow 쿼리 성능이 미묘하게 저하된다. (3) 해당 위치의 `workflow` 변수는 이하 코드에서 `workflow?.workspaceId` 로 접근하는 기존 경로도 유지되어 일관성은 있다. 그러나 `findOne` 이 `findOneBy` 보다 느슨한 타입 추론을 가질 수 있어 TypeORM 버전에 따라 반환 타입 차이가 생길 수 있다.
- **제안**: `workspace` relation 이 실제로 없는(orphaned workflow) 케이스의 동작을 통합 테스트로 커버한다. 현재 unit test mock 은 `workspace: { id: 'ws-1', settings: {} }` 만 검증하며 `workspace: null` 케이스를 테스트하지 않는다.

---

### [WARNING] `__workspaceTimezone` 컨텍스트 변수 도입으로 기존 ExecutionContext consumers 에 암묵적 의존성 추가

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L178–181, `system-context-prefix.ts` L268–271
- **상세**: `ExecutionContext.variables` 에 `__workspaceTimezone` 키를 새로 추가한다. 이 변수는 명시적 타입 선언 없이 `Record<string, unknown>` 에 `typeof variables['__workspaceTimezone'] === 'string'` 런타임 가드로 접근한다. 이는 기존 `__workspaceId` 와 동일한 패턴이지만, 이 변수를 직접 참조하는 다른 코드가 있거나 future consumer 가 생길 경우, 변수의 존재 여부·형식에 대한 암묵적 계약이 타입 시스템 바깥에 있다. 또한 execution engine 외의 경로(예: 직접 핸들러를 호출하는 테스트 or 다른 실행 경로)에서 `__workspaceTimezone` 을 주입하지 않으면 prefix 의 timezone 이 항상 fallback(`process.env.TZ` → `UTC`)으로 계산된다.
- **제안**: `ExecutionContext` 인터페이스에 `__workspaceTimezone?: string` 을 명시적 옵셔널 필드로 추가하거나, 전용 타입 가드 유틸(`getContextVar<T>()`)을 도입하여 문서화된 계약으로 만드는 것을 권장한다.

---

### [INFO] `uglify-js` 의 `"dev": true` 제거 (backend `package-lock.json`)

- **위치**: `codebase/backend/package-lock.json` L18603
- **상세**: `uglify-js@3.19.3` 가 `dev` 플래그 없이 기록되어 production dependencies 에 포함되는 방식으로 lock file 이 변경되었다. `optional: true` 는 유지되므로 실제 번들 크기나 런타임 동작에는 영향이 없을 가능성이 높으나, CI 의 `npm ci --omit=dev` 처럼 dev dependency 를 제외하는 빌드 단계에서 이전에는 설치되지 않던 패키지가 설치될 수 있다.
- **제안**: 의도된 변경인지 확인한다. `npm install` 결과가 아니라 lock file 직접 편집이라면 `npm ci` 로 재현 가능성을 검증한다.

---

### [INFO] `fsevents` 의 `"dev": true` 제거 (frontend `package-lock.json`)

- **위치**: `codebase/frontend/package-lock.json` L6839
- **상세**: `fsevents@2.3.2` 가 `dev` 플래그 없이 기록되어 production 의존성으로 변경되었다. `fsevents` 는 macOS 전용 `optional` 패키지이며 실제 런타임 동작에 영향은 없지만, 위와 동일한 이유로 dev-omit 빌드 환경에서 설치 여부가 달라질 수 있다.
- **제안**: backend `uglify-js` 와 동일하게 의도된 변경인지 확인한다.

---

### [INFO] `CAFE24_TIMEZONE_SUFFIX` 상수가 `index.ts` 로 노출됨 — 모든 importer 에 공개 API 변경

- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/index.ts` L902–903
- **상세**: `CAFE24_TIMEZONE_SUFFIX` 상수가 `metadata/index.ts` 의 named export 로 추가되었다. 이 파일은 Cafe24 메타데이터의 public API entry point 이므로, 이 export 를 `import * as` 혹은 barrel import 하는 모든 consumer 에게 새 심볼이 노출된다. 이는 breaking change 가 아닌 추가적 export 이므로 기존 코드에는 영향이 없으나, 이 상수를 자체적으로 정의하고 있는 코드가 있다면 충돌 가능성이 있다.
- **제안**: 현재 코드베이스 내에 동일 문자열을 hardcode 한 곳이 없는지 확인한다(이미 테스트로 검증되고 있음). 문제 없음.

---

### [INFO] 새 config 필드(`includeSystemContext`, `systemContextSections`) 가 기존 저장된 노드 설정에 default 로 적용됨 — 묵시적 동작 변경

- **위치**: 각 핸들러 schema 파일 (`ai-agent.schema.ts`, `text-classifier.schema.ts`, `information-extractor.schema.ts`)
- **상세**: Zod schema 에 `.default(true)` / `.default(['time', 'timezone'])` 로 새 필드가 추가된다. 기존에 저장된 노드 config 에는 이 필드가 없으므로 런타임에서 default 가 적용되어 **모든 기존 AI 노드 실행에 System Context Prefix 가 자동 prepend 된다**. 이는 의도된 스펙 동작이지만, 기존 노드의 systemPrompt 앞에 새 텍스트가 추가된다는 점에서 기존 실행 결과와 비교할 때 LLM 응답이 미묘하게 달라질 수 있다. 이는 side effect 관점에서 언급할 가치가 있는 **의도된 행동 변경**이다.
- **제안**: 롤아웃 이전에 주요 고객의 기존 워크플로에서 regression 테스트를 수행하거나, 옵트아웃 경로(`includeSystemContext: false`)를 문서화하여 기존 사용자에게 안내한다.

---

### [INFO] `buildSystemContextPrefixFromContext` 에서 `new Date()` 를 호출자가 주입 — 일관성 주의

- **위치**: `ai-agent.handler.ts` L292–296, L309–313; `information-extractor.handler.ts` L593–597, L616–620; `text-classifier.handler.ts` L789–793
- **상세**: 각 handler 에서 `now: new Date()` 로 현재 시각을 생성하여 주입한다. 함수 자체가 `Date` 를 생성하지 않아 테스트 가능성은 좋다. 단, multi-turn agent 의 경우 "첫 진입 시 1회만 prepend" 설계임에도 불구하고, `now` 는 매 진입 시 새로 생성된다. 코드 주석은 "execution-frozen" 이라고 기술하고 있으나 실제로는 함수 호출 시점의 wall clock 이다. resume turn 에서도 새 시각으로 재계산되는 것이 설계상 허용된 것인지, 아니면 첫 진입 시각을 state 에 저장해야 하는지 명확하지 않다.
- **제안**: multi-turn 에서 prefix 가 첫 turn 에서만 추가된다면(`state.systemPrompt` 에 freeze 됨), 후속 turn 에서는 `buildSystemContextPrefixFromContext` 자체가 호출되지 않는 경로인지 확인한다. 호출되더라도 결과가 무시된다면 현 설계에 문제가 없다.

---

## 요약

이번 변경은 AI 노드 실행 시 `__workspaceTimezone` 컨텍스트 변수를 execution engine 에서 한 번 조회하여 3개 AI 핸들러에 전달하고, 각 핸들러가 systemPrompt 앞에 System Context Prefix 를 prepend 하는 기능이다. 전반적으로 부작용 설계는 적절하다: 새 전역 변수 도입 없음, 파일시스템 접근 없음, 외부 네트워크 호출 없음, 이벤트/콜백 변경 없음. 주요 부작용 위험은 두 가지다. 첫째, `resolveSystemContextTimezone` 이 `process.env.TZ` 를 읽는 점 — 테스트 격리가 필요하다. 둘째, 기존에 저장된 모든 AI 노드 config 에 `includeSystemContext: true` default 가 적용되어 실행 결과가 달라진다는 점 — 이는 의도된 변경이지만 기존 사용자에게는 silent behavior change 다. `findOneBy` → `findOne` + relations 변경은 DB 쿼리 형태 변경이나 기능적으로는 안전하다. package-lock.json 의 `dev` 플래그 변경은 의도 확인이 필요하다.

## 위험도

MEDIUM
