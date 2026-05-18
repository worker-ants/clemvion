# 유지보수성(Maintainability) 리뷰

## 발견사항

### 핵심 모듈 — system-context-prefix.ts

- **[INFO]** `buildSystemContextPrefixFromContext` 와 `buildSystemContextPrefix` 의 두 단계 API 분리는 적절하다. 단, `buildSystemContextPrefixFromContext` 의 `workspace` 인자가 `id` 만 채우고 `name` 은 전달하지 않는다. config에 `workspace` 섹션이 활성화된 경우 항상 `(id: ...)` 만 보이며 이름 없이 표시된다. 이것이 의도적 제약인지 미구현인지 코드만으로 판별할 수 없다.
  - 위치: `system-context-prefix.ts` 273–282행
  - 상세: `workspace: { id: ... }` 만 넘기고 `name` 필드는 누락. `renderSection('workspace', ...)` 는 name 이 없으면 `(unnamed)` 를 fallback으로 출력한다. 기능 결손은 아니지만 `workspace` 섹션을 활성화한 사용자에게 혼란을 줄 수 있다.
  - 제안: `variables['__workspaceName']` 을 추가로 읽어 전달하거나, `workspace` 섹션이 실제로 name 을 지원하지 않는다면 섹션 옵션에서 `name` 관련 설명을 제거해 기대를 일치시킨다.

- **[INFO]** `getPartsInTimezone` 과 `computeOffsetMinutes` 는 둘 다 `Intl.DateTimeFormat` 을 별도로 초기화한다. 같은 `(date, timezone)` 쌍에 대해 두 번 포매터를 생성하므로 `formatIsoWithTimezone` 호출 1번에 포매터 2개가 생성된다. 현재 사용량에서는 성능 문제 없지만, 나중에 prefix 생성 경로가 hot path 가 되면 리팩토링 부담이 된다.
  - 위치: `system-context-prefix.ts` 133–137행
  - 상세: `formatIsoWithTimezone` → `getPartsInTimezone(date, timezone)` + `computeOffsetMinutes(date, timezone)` 가 각각 독립 `Intl.DateTimeFormat` 인스턴스를 생성.
  - 제안: 당장 변경이 필요한 수준은 아니다. 향후 hot path 화될 경우 단일 포매터에서 모든 파트를 추출하도록 통합할 수 있다.

- **[INFO]** `ALL_SECTIONS` 상수가 `SystemContextSection` 타입의 배열을 런타임 필터(`ALL_SECTIONS.includes(v as SystemContextSection)`)에 사용하기 위해 존재하지만, `ALL_SECTIONS` 에 항목을 추가하면 `SystemContextSection` 타입과 `renderSection` 의 switch 문 세 곳을 모두 동기화해야 한다. 타입과 런타임 목록 관리 지점이 3곳으로 분산되어 있다.
  - 위치: `system-context-prefix.ts` 15–26행, `renderSection` switch
  - 상세: 새 섹션을 추가할 때 (1) `SystemContextSection` 유니언, (2) `ALL_SECTIONS` 배열, (3) `renderSection` switch, (4) schema 의 `z.enum`, (5) i18n 딕셔너리 — 5곳을 동시에 수정해야 한다. switch 에 default case 가 없어 컴파일러의 exhaustive 검사(TypeScript `never`)가 없다.
  - 제안: `renderSection` switch 의 마지막에 `default: section satisfies never; return '';` 를 추가해 컴파일 시점에 누락을 감지한다. 또는 `Record<SystemContextSection, ...>` 객체 맵으로 전환해 key 목록이 타입과 자동 일치하도록 한다.

---

### 핸들러 3종 — ai-agent / text-classifier / information-extractor

- **[WARNING]** 세 핸들러에서 동일한 `buildSystemContextPrefixFromContext({ context, config, now: new Date() })` + `systemContextPrefix + systemPrompt` 패턴이 그대로 반복된다. single-turn / multi-turn 에서 각각 별도 `now: new Date()` 호출도 있어 두 호출 사이 시계가 미세하게 달라질 가능성이 있다 (실질 문제는 아니지만 코드 의도가 불명확해진다).
  - 위치:
    - `ai-agent.handler.ts` 292–297행 (single-turn 경로), 309–314행 (multi-turn 첫 턴 경로)
    - `information-extractor.handler.ts` 593–597행 (single-turn), 616–621행 (multi-turn)
    - `text-classifier.handler.ts` 789–793행
  - 상세: 총 5곳에서 동일 3줄 블록이 반복된다. 주석 문구도 거의 동일하고, 패턴 자체가 공통 헬퍼로 추출 가능하다. `now: new Date()` 가 호출마다 별도 인스턴스라 동일 실행 내 single-turn 과 multi-turn 분기가 다른 `now` 를 쓰지만 실제로는 동시에 진입할 수 없으므로 기능 버그는 아니다.
  - 제안: 중복 코드 자체는 `buildSystemContextPrefixFromContext` 가 이미 추상화를 제공하므로 현재 호출 형태로 허용 가능하다. 그러나 `now: new Date()` 를 각 핸들러의 execute 진입부에서 한 번만 캡처해 single-turn / multi-turn 경로에서 동일 인스턴스를 공유하면 의도가 더 명확해진다.

- **[INFO]** `ai-agent.handler.ts` 의 multi-turn 경로에 붙은 주석은 "multi-turn 은 첫 진입 시 1회 prepend 하고 `state.systemPrompt` 로 저장돼 후속 turn 에서도 같은 prefix 를 본다"고 설명하지만, 해당 코드 경로가 실제로 첫 진입 여부를 조건으로 갈라지는지 diff 에서 확인할 수 없다. 주석이 코드보다 앞서 있어 독자가 주석을 믿고 코드를 추적하기 어렵다.
  - 위치: `ai-agent.handler.ts` 306–308행 (multi-turn 경로 주석)
  - 제안: "첫 진입 시 1회" 를 실제 코드 조건(`if (!state.systemPrompt)` 등)이 보장함을 주석 안에 해당 라인 번호로 명시하거나, 조건이 다른 경로에 있다면 교차 참조를 추가한다.

---

### execution-engine.service.ts

- **[INFO]** `workflow?.workspace?.settings?.['timezone']` 와 같이 optional chaining 에 string 인덱스 접근(`['timezone']`)이 혼용된다. `settings` 가 `Record<string, unknown>` 등 동적 타입이라 dot notation 이 불가한 맥락이겠지만, 타입 선언과 함께 보지 않으면 이유를 알 수 없다.
  - 위치: `execution-engine.service.ts` diff +173행
  - 상세: `typeof workspaceTimezone === 'string' ? workspaceTimezone : ''` 로 타입 가드 후 빈 문자열 fallback 을 한다. `resolveSystemContextTimezone` 도 빈 문자열을 유효하지 않은 IANA로 처리해 UTC fallback 으로 내려가므로 동작상 문제 없다. 그러나 빈 문자열보다 `undefined` 를 전달하는 편이 의도가 더 명확하다.
  - 제안: `typeof workspaceTimezone === 'string' && workspaceTimezone ? workspaceTimezone : undefined` 로 변경해 undefined 로 전달하면 `resolveSystemContextTimezone` 의 `!candidate` 분기와 의미상 일치한다.

---

### 스키마 3종 — ai-agent / text-classifier / information-extractor schema

- **[WARNING]** `includeSystemContext` / `systemContextSections` 의 zod 스키마 정의가 세 파일(`ai-agent.schema.ts`, `text-classifier.schema.ts`, `information-extractor.schema.ts`)에 거의 동일하게 복제되어 있다. UI 메타데이터(`label`, `widget`, `group`, `hint`, `options`, `visibleWhen`) 까지 포함한 약 30줄이 세 번 반복된다.
  - 위치:
    - `ai-agent.schema.ts` diff +341~370행
    - `text-classifier.schema.ts` diff +824~854행
    - `information-extractor.schema.ts` diff +646~676행
  - 상세: `order` 번호만 다르고 나머지는 동일하다. 향후 hint 문구나 섹션 목록을 변경할 때 세 파일을 동시에 수정해야 하며 하나라도 빠지면 노드 간 스펙 불일치가 발생한다.
  - 제안: `shared/system-context-prefix.ts` 와 같은 공통 파일에 `buildSystemContextSchemaFields(orderStart: number)` 헬퍼를 만들어 zod 스키마 조각을 반환하도록 하면 변경 지점이 1곳으로 줄어든다. 단, zod `.meta()` 의 `order` 가 각 노드마다 달라야 한다면 파라미터로 받으면 된다.

- **[INFO]** `ai-agent.schema.ts` 의 `includeSystemContext` 에 할당된 `order: 42` 는 문맥 없이 보면 의미가 불분명하다. 다른 필드들의 순서 번호 체계를 보지 않으면 이 번호가 의도적으로 배치된 것인지 알 수 없다.
  - 위치: `ai-agent.schema.ts` diff +349행
  - 제안: 스키마 파일 상단 또는 해당 섹션 주석에 `order` 번호 체계를 간략히 설명하는 1줄 코멘트를 추가한다.

---

### cafe24 메타데이터 — customer.ts / product.ts

- **[INFO]** `since` / `until` 필드 description 에 `'Naive ISO 도 Cafe24 가 KST 로 해석'` 이라는 한국어 문장이 영어 description 문자열 안에 혼재한다. `customer.ts`, `product.ts` 두 파일에서 동일 패턴이 반복된다.
  - 위치: `customer.ts` diff +879행, `product.ts` diff +992/999/1009/1016행
  - 상세: description 은 LLM 에 직접 전달되므로 자연어 일관성이 중요하다. 한글과 영어 혼용은 LLM 이 파싱하는 context 에서도 불일치를 만든다.
  - 제안: 전체를 영어로 통일한다. 예: `'ISO8601 datetime (KST, UTC+9) — created_after. Cafe24 interprets naive ISO as KST.'`

- **[WARNING]** `product.ts` 의 두 operation(`product_list`, 두 번째 operation)에서 동일한 `since`/`until` description 패턴이 그대로 복사되어 있다. 나아가 이 description 포맷은 `customer.ts` 의 것과도 동일하다.
  - 위치: `product.ts` diff +992–1016행
  - 상세: 동일한 KST 설명 문구가 최소 4곳(`customer.since`, `product_list.since`, `product_list.until`, 두 번째 product operation 의 `since`/`until`)에 반복된다. 장기적으로 더 많은 operation 에도 같은 패턴이 적용될 예정(plan B-1 에 ~20–30 row 추정 명시)이다.
  - 제안: `CAFE24_DATETIME_FIELD_DESCRIPTION` 같은 공통 템플릿 상수 또는 헬퍼를 만들어 반복 문자열을 생성하는 방식을 고려한다. 단, 각 필드마다 `created_after`/`created_before` 같은 의미가 다르므로 suffix 부분만 공통화하는 것이 현실적이다.

---

### 테스트 파일 3종

- **[INFO]** 세 핸들러 spec 파일(`ai-agent.handler.spec.ts`, `text-classifier.handler.spec.ts`, `information-extractor.handler.spec.ts`)의 "System Context Prefix" describe 블록이 구조적으로 거의 동일하다. 각각 (1) prefix 포함 검증, (2) `includeSystemContext: false` 시 미포함 검증 두 테스트가 반복된다. 이는 공통 헬퍼의 동작이 각 핸들러에 올바르게 위임되는지를 검증하는 연기 테스트(regression test)로서 적절하며, `system-context-prefix.spec.ts` 가 핵심 로직을 별도 커버하고 있다. 현재 구조는 수용 가능하다.
  - 위치: 세 `.handler.spec.ts` 파일의 "System Context Prefix" describe
  - 상세: 각 테스트가 핸들러의 통합 호출 경로를 검증하는 목적이 명확하고, 중복이지만 제거하면 핸들러 단에서의 회귀 감지력이 떨어진다.
  - 제안: 변경 불필요. 단, `ai-agent.handler.spec.ts` 의 multi-turn 경로에 대한 System Context Prefix 테스트가 없다. multi-turn 첫 턴에서도 prefix 가 붙는다는 동작 보장이 테스트로 커버되면 더 완전하다.

---

### package-lock.json 변경 (파일 1, 22)

- **[INFO]** `package-lock.json` 의 변경은 peer/optional dependency 정리(`chokidar` 중복 제거, `uglify-js` `dev` 플래그 정정, `fsevents` `dev` 플래그 정정)로, 코드 로직과 무관한 lock file 갱신이다. 유지보수성 관점의 별도 지적 사항 없음.

---

## 요약

이번 변경의 핵심인 `system-context-prefix.ts` 는 단일 책임 헬퍼로 잘 설계되어 있으며, `resolveSystemContextTimezone` 의 SoT precedence 구현과 `buildSystemContextPrefix` 의 섹션 기반 구성 방식은 가독성이 우수하다. 주요 유지보수성 문제는 두 가지다: (1) 동일한 zod 스키마 조각(`includeSystemContext` / `systemContextSections` + UI meta)이 세 핸들러 스키마 파일에 30줄씩 복제되어 향후 변경 시 3곳을 동기화해야 하는 점, (2) cafe24 메타데이터 date/time 필드 설명 중 한국어/영어 혼용과 반복 문구가 LLM 에 전달되는 description 의 언어 일관성을 훼손하는 점. `renderSection` switch 에 exhaustive 검사 누락도 섹션 타입 확장 시 silent failure 위험이 있어 간단한 `satisfies never` 추가로 해소할 수 있다. 전체적으로 구조는 건전하며 명확한 spec 참조 주석이 코드 의도를 잘 전달하고 있다.

## 위험도

LOW
