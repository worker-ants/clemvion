# 유지보수성(Maintainability) 리뷰 결과

델타 `17221ecb9` — 3개 파일, lint warning 46→21(부분 처분, 21건 잔여는 WIP 로 명시 disclosure). 코드 자체는 변경하지 않고 콜백 파라미터·제네릭·변수 선언에 타입만 붙인 기계적 수정.

## 발견사항

- **[INFO]** `migrate-node-output-refs.ts` 의 콜백 파라미터 다중 줄 전개 — 가독성은 경미하게만 저하, 타입 별칭 추출은 선택적 개선(강제 사유 아님)
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.ts:247-252`(Pass 1), `:292-297`(Pass 2), `:312-317`(Pass 3), `:332-337`(Pass 4), `:437-442`(Pass 4b), `:487-492`(Pass 6)
  - 상세: 오케스트레이터 프롬프트는 "7곳이 같은 형태" 라고 했지만 실제로는 **6곳**이 동일 형태 `(match: string, dbl: string | undefined, sgl: string | undefined, field: string) => string` 이고, Pass 5(`:467`, `(match: string, op: string, status: string) => {`)는 캡처 그룹 개수·옵셔널 여부가 달라 **다른 형태**다 — 공용 타입 하나로 7곳을 커버할 수는 없다(6곳만 해당).
    6곳의 타입 구조는 실제로 동일하게 반복된다. 다만 이 반복은 **로직 중복이 아니라 타입 시그니처 중복**이고, 각 Pass 는 이미 `// Pass N: ...` 주석으로 의미가 구분되어 있어 시그니처 4~6줄이 늘어난 것 자체가 "무엇을 하는 코드인지" 파악을 어렵게 만들지는 않는다. 원래 1줄이던 콜백 헤더가 5~6줄로 늘어난 것은 `String.prototype.replace` 의 lib.es5 타입(`replacer: (substring: string, ...args: any[]) => string`)이 강제하는 최소한의 명시 타입이며, prettier 가 인자 개수 때문에 자동으로 줄바꿈한 결과다 — 저자가 임의로 늘어뜨린 스타일이 아니다.
  - 제안: 원한다면 아래처럼 module-level 타입 별칭 + named const 로 추출하면 6곳의 타입 반복을 1곳으로 줄이고 각 pass 에 의미있는 이름(`replaceDoubleNestedOutput` 등)도 붙일 수 있다.
    ```ts
    type QuotedLabelFieldReplacer = (
      match: string,
      dbl: string | undefined,
      sgl: string | undefined,
      field: string,
    ) => string;
    ```
    다만 이건 **정직하게 말해 필수는 아니다** — 함수 바깥으로 6개의 named const 를 끌어내면 "정규식 바로 옆에 콜백이 붙어 있는" 현재의 지역성(regex 와 replacer 를 한 호출에서 동시에 보는 것)을 잃는 대가가 있고, 이 파일은 실행 빈도가 낮은 1회성 마이그레이션 스크립트라 트래픽·변경 빈도가 낮다. 강제성 있는 결함이 아니라 선택적 리팩터로 남겨도 무방하다.

- **[INFO]** `execution-engine.service.ts` 주석("`EntityManager.query` 는 `Promise<any>` 라…") — 코드를 반복하지 않고 실제로 유용
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2909-2910`
  - 상세: `const rows = await m.query<{ id: string }[]>(...)` 바로 다음 줄(`:2923` 부근)에서 `rows.length === 1` 로 소비된다. 주석은 단순히 "이건 `Promise<any>` 다" 를 반복하는 게 아니라 (a) 제네릭을 안 붙이면 `.length` 접근까지 `any` 로 새는 **구체적 파급 효과**, (b) `RETURNING id` SQL 절이 실제 row shape 을 결정한다는 **선택한 타입의 근거**를 설명한다. 타입 주석 자체(`<{ id: string }[]>`)만 보면 "왜 이 shape 인지"는 알 수 없으므로 주석이 정보를 추가한다 — 코드가 스스로 말하는 것의 반복이 아니다.
  - 판정: 문제 없음(발견 아님, 질의 응답 목적으로만 기재).

- **[INFO]** `triggers.service.ts` 의 `SetupResult` import 추가 — 순환 참조 신규 생성 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:31`
  - 상세: `triggers.service.ts → chat-channel/types` 엣지는 이 델타 이전부터 이미 존재했다(같은 줄에서 기존에도 `ChatChannelConfig` 를 이 경로에서 import). 이번 변경은 **같은 import 문에 named import 하나를 추가**한 것뿐이라 모듈 그래프에 새 엣지를 만들지 않는다. `chat-channel/types.ts` 자체도 `../../shared/conversation-thread/conversation-thread.types` 하나만 import 하는 leaf 모듈이라 `triggers` 로 돌아오는 역방향 엣지가 없다(`SetupResult` 도 같은 파일에 정의됨, `types.ts:454`). 순환 참조 소지는 없다.
  - 판정: 문제 없음(발견 아님, 질의 응답 목적으로만 기재).

- **[INFO]** 같은 원인(라이브러리 경계의 암묵적 `any`)의 다른 자리 — 이번 델타가 건드린 3개 파일 내부에는 누락 없음, 저장소 전체에는 무관한 잔여 21건이 있으나 이미 disclosure 됨
  - 위치: 확인한 범위 — `codebase/backend/src/scripts/migrate-node-output-refs.ts`(`String.replace` 콜백 전수), `codebase/backend/src/modules/triggers/triggers.service.ts`(`let` 선언 전수, `:274`/`:360`/`:719`/`:1055`/`:1063`/`:1077`/`:1191`/`:1263`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`.query(` 호출 전수, `:2908`/`:8164`/`:8450`)
  - 상세:
    - `migrate-node-output-refs.ts` 안의 `String.replace(regex, callback)` 형태 7곳(6+1) 전부 이번 델타에서 타입이 붙었다. 같은 파일의 `match.replace('...', '...')` 형태(문자열 치환, 콜백 아님)는 애초에 이 lint 규칙 대상이 아니라 안 고친 게 아니라 해당 없음.
    - `triggers.service.ts` 의 다른 `let` 선언들(`:274`,`:360` 등)은 이미 `saved`(타입 `Trigger`)로 초기화돼 타입이 추론되므로 `any` 로 새지 않는다 — `:1077` 만 무초기화라 `any` 였고 그게 이번에 고쳐진 자리다. 같은 클래스의 미수정 자리는 없다.
    - `execution-engine.service.ts` 안의 다른 `.query()` 호출(`:8164`, `:8450`)은 각각 `const live: unknown[] = ...`, `const updated: Array<{ id: string }> = ...` 로 **이미 타입이 붙어 있다**(이번 델타 이전부터). 즉 이번에 고친 `:2908` 자리가 이 파일에서 유일하게 무주석이었던 곳이고, 나머지는 이미 정합했다.
    - `eslint src` 재실행 결과 이 3개 파일에는 warning 이 0건이다(`✖ 21 problems` 는 전부 다른 파일: `workspace-reflection-canary.ts`, `chat-channel.dispatcher.ts`, `executions.service.ts`, `idempotency.interceptor.ts`, `chat-channel-config.dto.ts`, `ai-agent.schema.ts`, `render-tool-provider.ts`). 이 잔여 21건은 이번 델타의 커밋 메시지("아직 미완 — 21건 남음")와 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 이미 추적되고 있어, 이번 델타의 결함이 아니라 **의도적으로 범위 밖에 남긴 후속 작업**이다.
    - 참고로 `manager.query<T>()`/`dataSource.query<T>()` 제네릭 타입 패턴은 `knowledge-base.service.ts`, `agent-memory.service.ts`, `rag-search.service.ts` 등에서 30곳 넘게 이미 쓰이고 있는 기존 컨벤션이라(예: `knowledge-base.service.ts:362` 의 `manager.query<{ id: string }[]>(...)`), 이번 `execution-engine.service.ts:2911` 의 수정은 새 패턴을 도입한 게 아니라 **기존 컨벤션을 따라간 것**이다(§8 일관성 관점에서 긍정적).
  - 판정: 이번 델타 범위 안에서는 누락 없음. 저장소 전체의 잔여 warning 은 별개 사실이며 이미 문서화된 WIP.

## 요약

세 파일 모두 로직 변경 없이 라이브러리 경계(`String.replace` 콜백, `EntityManager.query()`, 무초기화 `let`)에서 새던 암묵적 `any` 에 타입만 붙인 기계적 수정이다. `migrate-node-output-refs.ts` 의 콜백 시그니처 반복(6곳, 프롬프트가 말한 7곳이 아님 — 1곳은 형태가 다름)은 타입 별칭으로 DRY 할 여지가 있지만 로직 중복이 아니라 타입 중복이고 각 pass 가 이미 주석으로 구분되어 있어 강제 수정 사유는 아니다. `execution-engine.service.ts` 의 신규 주석은 실제로 정보를 더한다(제네릭을 안 붙였을 때의 파급과 shape 근거). `SetupResult` import 는 이미 존재하던 모듈 엣지에 named import 하나를 얹은 것이라 순환 참조 신규 생성 소지가 없다. 같은 원인의 미수정 자리는 델타가 건드린 3개 파일 안에서는 발견되지 않았고, `.query<T>()` 제네릭 패턴은 저장소 전역에서 이미 지배적인 기존 컨벤션이라 이번 수정이 그와 정합한다. 저장소 전체의 잔여 21건 warning 은 이번 델타와 무관한 다른 파일·다른 규칙(`no-unsafe-assignment`/`no-unsafe-call`/`no-unsafe-return` 등)이고 커밋 메시지·plan 문서에 이미 추적되고 있어 이번 델타의 결함으로 볼 수 없다.

## 위험도

NONE
STATUS: OK
