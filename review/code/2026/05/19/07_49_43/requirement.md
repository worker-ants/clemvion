# 요구사항(Requirement) 리뷰 — AI Timezone Context

## 발견사항

### 기능 완전성

- **[INFO]** `buildSystemContextPrefixFromContext`에서 `workspace` 정보로 `__workspaceId`만 주입되며 workspace `name`은 전달되지 않는다.
  - 위치: `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts:276-282`
  - 상세: `workspace` 섹션 렌더링 시 `name`이 없으면 `(unnamed)` 표시가 된다. `__workspaceName` 변수를 컨텍스트에 주입하지 않으므로, 사용자가 `systemContextSections`에 `workspace`를 명시 선택해도 이름 없이 id만 출력된다. spec §11.2의 `workspace` 섹션 정의가 name 표시를 포함하므로 의도와 부분적 괴리가 있다.
  - 제안: `execution-engine.service.ts`에서 `workflow.workspace.name`을 `__workspaceName`으로 함께 주입하거나, 현재 동작(id만 표시)을 spec에 명시적으로 기록한다.

- **[INFO]** `node` 섹션의 `label`과 `type` 정보가 `buildSystemContextPrefixFromContext`에서 `context.nodeId`만 전달하고 label/type은 전달하지 않는다.
  - 위치: `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts:283-285`
  - 상세: `node` 섹션을 선택해도 `- Node: (unlabeled) (id: <nodeId>)` 형태로 출력된다. type 정보는 핸들러 레벨에서 접근 가능하나(각 핸들러는 자신의 metadata를 알고 있음) context를 통해 전달되지 않는다.
  - 제안: 현재 동작이 허용 범위라면 spec에 명시, 또는 핸들러별로 `buildSystemContextPrefixFromContext` 호출 시 `context.nodeId`와 함께 label/type을 선택적 오버라이드로 전달할 수 있도록 API를 확장한다.

- **[INFO]** plan/in-progress의 Phase B 체크리스트(`impl-ai-timezone-context.md`)에는 "config echo: 새 필드 두 개가 default 와 일치하면 echo 생략" 항목이 있으나, 이번 diff에서 해당 항목이 구현됐는지 확인되지 않는다. diff 범위 내에 config echo 관련 코드 변경이 보이지 않는다.
  - 위치: `plan/in-progress/impl-ai-timezone-context.md` B-2 항목 중 "config echo" 항목 (현재 미체크 `[ ]`)
  - 상세: plan 체크리스트 기준으로 이 항목은 아직 `[ ]` 상태이며, PR이 이 항목을 포함한다면 누락이다. PR 범위가 일부 항목만 포함하는 경우라면 체크리스트에서 명확히 구분해야 한다.
  - 제안: 이번 PR의 구현 완료 항목을 plan에서 `[x]`로 표시하고, 미포함 항목은 그대로 `[ ]`로 유지한다.

### 엣지 케이스

- **[WARNING]** `computeOffsetMinutes`에서 `'GMT'` (오프셋 없음) 파싱 시 정규식 `^GMT([+-])(\d{1,2})(?::?(\d{2}))?$`에 매치되지 않아 `0`을 반환하는데, 이 경우는 올바르게 UTC(0분)를 의미한다. 그러나 `'GMT+00:00'` 같은 케이스가 실제로 올 때도 동일한 `0` 반환이 되며, 단위 테스트에서 UTC 시간대를 명시적으로 검증하고 있으므로 허용 범위다. 단, `'GMT'` 단독 케이스(즉 UTC 계열 IANA 중 일부)에 대한 명시적 테스트가 없다.
  - 위치: `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts:204`
  - 상세: `'GMT'`가 `offsetPart`로 오는 경우 정규식 불매치 → `0` 반환, `formatUtcOffsetLabel`은 `'UTC'` 반환, `formatIsoWithTimezone`는 `'Z'` suffix를 붙인다. 동작상 올바르다. 그러나 `'Etc/GMT+5'` 같은 비표준 역방향 오프셋 IANA는 Intl API에서 `'GMT-05:00'`로 반환하므로 부호가 역전되지 않아 현재 구현이 올바르다.
  - 제안: 테스트에 `'Etc/GMT'` (= UTC)와 `'Etc/GMT+5'` (= UTC-5 실제) 케이스를 추가해 엣지 케이스 보장을 문서화한다.

- **[INFO]** `getPartsInTimezone`에서 `hour === '24'` chromium 엣지 케이스를 `'00'`으로 처리하고 있으나, 이 경우 날짜가 하루 뒤로 바뀌어야 하는 상황인데 `day` 값이 그대로 남아 날짜와 시각이 불일치할 수 있다.
  - 위치: `codebase/backend/src/nodes/ai/shared/system-context-prefix.ts:180`
  - 상세: 이 케이스는 Chromium/V8의 `hour12: false`에서 자정을 `24:00`으로 반환하는 버그다. 시각을 `00:00`으로 바꾸면 해당 날짜가 실제보다 하루 전 날짜로 잘못 표시될 수 있다(예: 자정에 `2026-05-18T00:00:00+09:00` 대신 `2026-05-17T00:00:00+09:00`). 단, 이 케이스는 JS 엔진 특정 버전에서만 발생하는 희귀 케이스고 spec에서 정밀한 LLM 입력을 위한 참고 정보 제공이 목적이므로 실용적 허용 범위다.
  - 제안: 날짜까지 정확해야 한다면 `date.setHours`로 보정하거나 `date.toISOString()`을 바탕으로 재계산하는 방식을 사용한다. 현재 수준이 허용된다면 코드 주석에 "날짜 정확도 미보장" 을 명시한다.

- **[INFO]** `resolveSystemContextTimezone`에서 `process.env.TZ` 가 빈 문자열 `''`인 경우 `!candidate` 조건에서 건너뛰므로 올바르게 처리된다. 테스트도 이를 검증한다.

### TODO/FIXME

- **[INFO]** 코드 내 `TODO`, `FIXME`, `HACK`, `XXX` 주석은 검토된 diff 범위 내에서 발견되지 않았다.

### 의도와 구현 간 괴리

- **[WARNING]** `ai-agent.handler.ts`의 multi-turn 경로에서 주석이 "multi-turn 은 첫 진입 시 1회 prepend 하고 `state.systemPrompt` 로 저장돼 후속 turn 에서도 같은 prefix 를 본다 (turn 마다 재계산 불필요)"라고 적혀 있다. 그러나 diff에서 보이는 multi-turn 진입 함수는 매번 `new Date()`를 `now`로 전달하고 있으며, `state.systemPrompt` 저장 로직은 이번 diff에 포함되지 않았다.
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` multi-turn 경로 (diff 라인 306-314)
  - 상세: 주석대로 "첫 진입 시 1회"라면 resume turn(후속 turn) 에서는 이 코드 블록이 실행되지 않아야 한다. 실제로 resume turn 처리 분기가 이 코드를 건너뛰는 구조라면 주석이 맞지만, diff만으로는 resume 분기 로직을 확인할 수 없다. Information Extractor의 multi-turn 경로도 동일한 패턴이다.
  - 제안: resume turn 분기에서 이 코드 블록이 실행되는지 여부를 확인하고, 만약 실행된다면 주석의 "1회 prepend" 설명이 틀린 것이다. 실행 경로를 테스트로 명시적으로 검증한다.

- **[INFO]** `execution-engine.service.ts`의 mock 설정(파일 2)에서 `workspace: { id: 'ws-1', settings: {} }`으로 `settings`가 빈 객체다. 이는 `timezone` 미설정 케이스로, 실제 코드 경로에서 `workspaceTimezone`이 `undefined`가 되고 `''`이 `__workspaceTimezone`으로 주입된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:137-140`
  - 상세: 해당 테스트 fixture가 timezone 없는 케이스를 의도적으로 시뮬레이션하고 있는 것으로 보인다. 그런데 빈 문자열 `''`이 `__workspaceTimezone`으로 주입된 후 `resolveSystemContextTimezone('')`이 올바르게 UTC fallback을 반환하므로 기능상 문제 없다. 의도가 명확하다면 OK.

### 에러 시나리오

- **[WARNING]** `execution-engine.service.ts`에서 `workflowRepository.findOne`이 `null`을 반환하는 경우(workflow 미존재), `workflow?.workspace?.settings?.['timezone']`은 `undefined`를 반환하고, `workspaceTimezone`이 `''`으로 주입된다. 이후 `resolveSystemContextTimezone`이 UTC로 fallback하므로 기능은 동작하지만, workflow가 없는 상황에서 실행이 계속 진행되는 것이 의도된 동작인지 확인이 필요하다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:173`
  - 상세: 기존 `findOneBy` 코드도 null 반환 시 `workflow?.workspaceId ?? ''`로 빈 workspaceId를 허용했으므로, 이는 이번 변경 이전부터의 기존 허용 패턴이다. 새 변경이 새로운 null 위험을 도입하지는 않는다.
  - 제안: 현재 허용 패턴이라면 수용 가능.

- **[INFO]** `isValidIanaTimezone`이 `try/catch`로 `Intl.DateTimeFormat` 인스턴스 생성 예외를 잡아 유효성을 판단한다. 이는 표준적이고 안전한 패턴이다.

### 데이터 유효성

- **[WARNING]** `normalizeSystemContextConfig`에서 `systemContextSections`를 `Array.isArray`로 검사하고 알려진 값만 filter하는 것은 올바르다. 그러나 Zod schema(`ai-agent.schema.ts`, `text-classifier.schema.ts`, `information-extractor.schema.ts`)가 이미 enum 검증을 수행하므로, 런타임에 알 수 없는 섹션 값이 들어오는 경우는 DB에 직접 잘못된 데이터가 저장된 경우뿐이다. 이 방어 코드는 적절하다.

- **[INFO]** 세 핸들러 모두 `config`를 `Record<string, unknown>` 타입으로 `buildSystemContextPrefixFromContext`에 전달한다. Zod schema로 parse된 typed config를 넘기지 않으므로 타입 안전성은 런타임 동적 검사에 의존한다. 기존 코드베이스 패턴을 따르는 것으로 보인다.

### 비즈니스 로직

- **[CRITICAL]** `execution-engine.service.ts`에서 `workspaceTimezone`이 `undefined`인 경우(settings에 timezone 키 없음) `__workspaceTimezone`에 `''`(빈 문자열)을 주입한다. 반면 정의된 값이 있으면 `string` 그대로 주입한다. `resolveSystemContextTimezone`은 빈 문자열을 `!candidate` 조건으로 건너뛰므로 올바르게 fallback한다. 그러나 `typeof workspaceTimezone === 'string' ? workspaceTimezone : ''` 조건에서 `workspaceTimezone`이 `null`인 경우(`settings.timezone` 키가 존재하고 값이 `null`이면) `typeof null === 'object'`이므로 `''`로 처리된다. 이 케이스는 의도된 방어다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:173-182`
  - 상세: `settings?.['timezone']`이 `null`이면 `typeof null !== 'string'`이므로 `''`로 대체된다. 이후 UTC fallback이 발동한다. 비즈니스 관점에서 "timezone을 명시적으로 null로 설정한 워크스페이스는 UTC를 사용한다"는 의미로 허용 가능하다.
  - 제안: 이 케이스가 의도된 처리라면 주석이나 spec에 명시적으로 기술한다.

- **[WARNING]** `CAFE24_TIMEZONE_SUFFIX` 상수가 `codebase/backend/src/nodes/integration/cafe24/metadata/index.ts`에 정의되어 export된다. spec의 `conventions/cafe24-api-metadata.md §5.3`을 SoT로 참조하고 있으나, 상수 문자열 자체가 spec 본문의 표현과 일치하는지 검증할 방법이 코드에는 없다. 텍스트 변경 시 drift 가능성이 있다.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/index.ts:902-903`
  - 상세: 상수 자체가 단순 string이므로 spec과의 싱크를 보장하는 테스트가 없다. 다만 `cafe24-mcp-tool-provider.spec.ts`에서 이 문자열의 일부를 직접 `toContain` 검사하고 있어, spec 표현 변경 시 테스트도 함께 수정해야 함을 환기하는 효과가 있다.
  - 제안: 허용 가능하나, 상수 변경 시 테스트도 함께 갱신해야 함을 주석으로 명시하거나 테스트에서 상수 자체를 import해 비교한다.

- **[INFO]** Cafe24 메타데이터의 `until` 필드(`customer.ts`, `product.ts`)는 `since`와 달리 description 갱신이 이번 diff에서 일부 누락된 것으로 보인다.
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/customer.ts:881` — `until` 필드의 `description`이 없음 (기존 그대로 비어있음)
  - 상세: `customer.ts`의 `until` 필드에는 `description`이 없어 메타데이터 spec 검증 테스트(`metadata.spec.ts`의 §5.2 위반 검출)에서는 `if (!desc) continue`로 건너뛰어 통과한다. 그러나 `since`는 업데이트되고 `until`은 미업데이트인 비대칭이 발생했다.
  - 제안: `customer.ts`의 `until`에도 `description`을 추가(`'ISO8601 datetime (KST, UTC+9) — created_before'`)하거나, plan의 "~20–30 row 추정" 항목에 명시적으로 포함한다.

### 반환값

- **[INFO]** `buildSystemContextPrefix`는 비어있지 않을 경우 반드시 `\n\n`으로 끝나도록 설계되어 있으며, 테스트(`out.endsWith('\n\n')`)로 검증된다. 호출 측에서 단순 concat(`systemContextPrefix + systemPrompt`)하는 패턴과 잘 맞는다.

- **[INFO]** `formatIsoWithTimezone`에서 `getPartsInTimezone`이 `null`을 반환하면 `date.toISOString()` fallback이 있다. 주석에 "should not happen"이라 표기되어 있으나, 이 경우 UTC ISO string이 반환되어 timezone 정보 없이 전달된다. 이 경우는 이미 `resolveSystemContextTimezone`이 유효한 IANA를 보장하므로 실제 도달 불가능 경로다.

---

## 요약

이번 변경은 AI 노드 3종(AI Agent, Text Classifier, Information Extractor)에 시스템 컨텍스트 prefix를 자동 prepend하고, Cafe24 MCP 도구 description에 KST timezone suffix를 추가하는 기능을 완전히 구현하고 있다. 공통 헬퍼(`system-context-prefix.ts`)는 잘 설계되어 있으며 SoT precedence(Workspace.settings.timezone → process.env.TZ → UTC), 유효성 검증, 섹션별 렌더링, 중복 제거 등 spec §11의 요구사항을 충실히 반영한다. 테스트 커버리지도 단위 테스트 수준에서 충분하다. 주요 관심 사항은: (1) multi-turn 경로에서 "첫 진입 1회 prepend" 주석과 매번 `new Date()`를 전달하는 구현 사이의 일치 여부 확인, (2) workspace `name`과 node `label/type` 미주입으로 인해 해당 섹션을 활성화해도 불완전한 정보가 출력되는 점, (3) `customer.ts`의 `until` 필드 description 갱신 누락이다. plan 체크리스트상 미완료 항목(config echo, e2e 테스트, frontend UI)은 이번 PR 범위 밖임을 명확히 해야 한다.

---

## 위험도

MEDIUM
