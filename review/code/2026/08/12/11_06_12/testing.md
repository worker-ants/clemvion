# 테스트(Testing) 리뷰 — 커밋 17221ecb9 (lint `no-unsafe-*` 경고 제거, 타입 주석만)

## 검증 절차 요약

- `git show 17221ecb9` 로 3파일 전 diff 를 전수 열람 (프롬프트의 unified diff 발췌가 아니라 원본 diff 로 재확인).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 실제 소스(offset 2895‑2930)를 직접 Read.
- `codebase/backend/src/modules/triggers/triggers.service.ts` 실제 소스(523‑552, 1074‑1080)를 직접 Read.
- `codebase/backend/src/scripts/migrate-node-output-refs.ts` 실제 소스(200‑500) + `migrate-node-output-refs.spec.ts` 전문을 직접 Read.
- `npx jest --testPathPatterns="(triggers|execution-engine)"` 재실행.
- `npx jest src/scripts/migrate-node-output-refs.spec.ts` 재실행.
- `npx tsc --noEmit -p tsconfig.json` 재실행(대상 3파일 필터).
- `npx prettier --version` → `3.9.6` (락파일과 일치, 실행 환경 이상 없음 확인).

---

## 지시받은 4개 질문에 대한 판정

### 1. 런타임 동작이 정말 안 바뀌었는가

`git show 17221ecb9` 전수 diff 확인 결과, 세 파일 모두 **타입 주석·제네릭 인자·`as` 단언만** 추가됐다. 값·분기·순서를 바꾸는 라인은 하나도 없다.

- `execution-engine.service.ts`: `m.query(` → `m.query<{ id: string }[]>(` (제네릭 인자 추가) + 주석 2줄. SQL 문자열·파라미터 배열·후속 `rows.length === 1` 비교는 원문 그대로.
- `triggers.service.ts`: `let result;` → `let result: SetupResult;`, `Object.getPrototypeOf(trigger)` → `Object.getPrototypeOf(trigger) as object`, import 에 `SetupResult` 타입 추가. 대입/호출 순서 불변.
- `migrate-node-output-refs.ts`: `String.replace` replacer 콜백 7곳의 파라미터에 타입 주석 추가(`match, dbl, sgl, field` → `match: string, dbl: string | undefined, ...`). 콜백 바디는 1바이트도 바뀌지 않았다.

**판정: 주장(타입 주석만) 이 사실과 일치. 런타임 동작 변경 없음.**

### 2. `m.query<{ id: string }[]>` 가 거짓 주장인가

아니다 — 근거 3가지.

1. **동일 파일 내 기존 선례**: `execution-engine.service.ts:8450` 에 이미 `const updated: Array<{ id: string }> = await this.executionRepository.query(...RETURNING id..., [...])` 패턴이 존재하고, `updated.length > 0` 로 소비된다(이 커밋 이전부터 있던 코드). 즉 "TypeORM `EntityManager.query()`/`Repository.query()` 가 Postgres `RETURNING` 절에 대해 행 배열을 직접 반환한다"는 가정은 이 커밋이 새로 만든 게 아니라 이미 이 파일 안에서 검증돼 쓰이고 있는 확립된 패턴이다.
2. **unit mock 이 같은 shape 로 스텁**: `execution-engine.service.spec.ts:4466‑4522` 의 admission 테스트들이 `m.query` mock 을 `mockResolvedValue([{ id: 'e4' }])` / `mockResolvedValueOnce([{ id: 'eSQL' }])` 처럼 **배열**로 스텁하고, 이어서 `admitted === (rows.length === 1)` 을 검증한다. mock 자체가 실제 driver 계약을 반영해 작성된 것으로, 실제 동작과 괴리가 없다.
3. **e2e 가 같은 코드 경로를 실 Postgres 로 통과시킨다**: `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` 가 정확히 이 admission transaction(§8 cap 검사)을 실 DB against 로 반복 실행한다. 만약 `m.query()` 의 실제 shape 이 `{ id: string }[]` 이 아니라면(`{ rows: [...] }` 형태 등) `rows.length` 는 `undefined`이 되어 `rows.length === 1` 이 항상 `false` → admission 이 영구 실패해 이 e2e 스위트 자체가 깨진다. 이 e2e 는 이번 커밋 이전부터 존재하던 로직을 검증하는 테스트이므로, 제네릭이 붙기 전부터 이미 이 shape 가정이 실측으로 지탱되고 있었다.

제네릭이 "런타임 검증이 아니라 단언"이라는 지적 자체는 원론적으로 맞다(TS 제네릭은 컴파일 타임에만 존재). 그러나 이 자리의 shape 가정은 (a) 신규가 아니라 기존 무타입 코드가 이미 암묵적으로 의존하던 가정이고, (b) 같은 파일의 자매 코드에서 이미 실제로 검증된 패턴이며, (c) 전용 e2e 스위트로 실측 커버된다. **이 변경이 새로운 위험을 만들지 않는다.**

### 3. 회귀 테스트 필요 여부 및 기존 테스트 재현

동의한다 — 타입 주석만 추가하는 diff 는 별도 회귀 테스트가 불요하다(런타임 분기가 없으므로 테스트로 잡을 결함 표면이 없다). `tsc --noEmit` 이 타입 오류를 즉시 잡아준다(재실행 결과 대상 3파일 오류 0건).

기존 테스트 재현 결과:

```
$ npx jest --testPathPatterns="(triggers|execution-engine)"
Test Suites: 47 passed, 47 total
Tests:       1 skipped, 1285 passed, 1286 total
```

커밋 메시지의 "jest triggers + execution-engine 1285 passed" 를 정확히 재현했다(주의: 파일명을 좁게 지정한 `triggers.service.spec.ts execution-engine.service.spec.ts` 단독 실행은 515 만 나온다 — 47 스위트를 다 태우려면 패턴 매칭이 필요하다).

### 4. `migrate-node-output-refs.ts` 는 스크립트다 — 테스트가 있는가

**있다.** `codebase/backend/src/scripts/migrate-node-output-refs.spec.ts` (471줄, 44 테스트, 재실행 결과 전부 통과)가 `rewriteExpression`(수정된 7개 콜백이 모두 이 함수 안에 있다)을 직접 단위 테스트한다.

```
$ npx jest src/scripts/migrate-node-output-refs.spec.ts
Test Suites: 1 passed, 1 total
Tests:       44 passed, 44 total
```

단, 7개 콜백 전부가 고르게 커버되는 것은 아니다 — 아래 발견사항 참조(Pass 2 콜백 커버리지 갭).

---

## 발견사항

- **[INFO]** `rewriteExpression` Pass 2 콜백(`.output.meta.<field>` → `.meta.<field>` 축약)이 spec 에서 직접 트리거되지 않는다
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.ts:289-307` (특히 콜백 시그니처 292-297줄, 이번 커밋에서 타입 주석이 붙은 자리)
  - 상세: `rewriteExpression` 은 Pass 1/2/3/4/4b/5/6 총 7개 정규식 콜백으로 구성되고, 이번 커밋은 그중 7곳 모두에 파라미터 타입을 붙였다. `migrate-node-output-refs.spec.ts` 전문을 확인한 결과 Pass 1(`.output.output.`), Pass 3(`.output.config.` 축약 — `does not touch .output.config.<f> for fields already in config` 테스트가 실제로는 축약 동작을 검증), Pass 4(단일 레벨 `.output.<field>`), Pass 4b(`RENAMED_META_FIELDS`), Pass 5(status 리터럴), Pass 6(legacy error envelope) 은 각각 전용 `it(...)` 로 입력 문자열이 해당 정규식에 매치하도록 구성돼 있다. 반면 Pass 2 의 정규식 `\$node\[...\]\.output\.meta\.([A-Za-z_]...)` 에 매치하는 입력(`"…output.meta.…"` 리터럴을 포함하는 테스트 문자열)은 spec 파일 전체에 하나도 없다(grep 확인). 즉 이 콜백은 현재 스위트에서 한 번도 실행되지 않는다.
  - spec 파일 상단 docstring(`migrate-node-output-refs.spec.ts:1-6`)은 "순수 문자열 pass 는 idempotency·edge case 까지 lock in 한다"고 명시하는데, Pass 2 는 이 주장의 예외다.
  - 이 갭은 이번 커밋이 만든 것이 아니다(로직 변경 없이 타입만 붙었으므로 커밋 전부터 존재). 타입 주석 자체의 정합성은 `tsc` 가 정적으로 보장하므로 이 갭이 이번 diff 의 회귀 위험을 높이지는 않는다. 다만 스크립트가 다루는 5개 패스 중 유일하게 실증되지 않은 경로이므로 향후 이 패스의 로직(예: `match.replace('.output.meta.', '.meta.')` 치환 순서/중복 매치)이 바뀔 때 회귀를 잡아줄 안전망이 없다.
  - 제안: `rewriteExpression('{{ $node["X"].output.meta.someField }}', typeMap({...}))` 형태의 케이스 1개를 `structural path preservation` 또는 신규 `describe` 블록에 추가해 Pass 2 를 직접 커버.

- **[INFO]** `triggers.service.ts` 의 `Object.getPrototypeOf(trigger) as object` 를 감싸는 `sanitizeChatChannelForResponse` 는 unit spec 에서 전혀 언급되지 않고 e2e 로만 커버된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:523-552` (단언이 붙은 줄은 546)
  - 상세: `sanitizeChatChannelForResponse` 와 그 파생 필드 `hasBotToken` 은 `triggers.service.spec.ts` / `triggers.controller.spec.ts` / `triggers.web-chat.spec.ts` 어디에서도 grep 되지 않는다(0건). `hasBotToken` 이 등장하는 유일한 테스트는 `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` 뿐이다. 커밋이 재현을 주장한 "jest 1285 passed" 는 unit 스위트 숫자이며 이 e2e 를 포함하지 않는다 — 즉 이 라인은 이번 검증 절차(unit jest 재실행)의 커버리지 밖에 있고, e2e(별도 인프라 필요, 이번 리뷰에서 미실행)로만 실증된다.
  - `as object` 단언 자체는 `Object.getPrototypeOf()` 의 반환 타입(`object | null`)을 `Object.create()` 의 매개변수 타입에 맞추는 순수 타입 좁히기이고 `Trigger` 엔티티 인스턴스에 대해 `getPrototypeOf` 가 `null` 을 반환할 실제 가능성은 없으므로 런타임 위험은 없다고 판단한다. 정보 제공 목적의 기록.
  - 제안: 이번 커밋 스코프 밖. 필요 시 `sanitizeChatChannelForResponse` 의 prototype 보존(getter 접근 가능 여부) 을 단언하는 unit 테스트를 별도로 추가하면 e2e 의존도를 낮출 수 있다.

---

## 요약

커밋 17221ecb9 은 `git show` 전수 대조로 실제로 타입 주석·제네릭 인자·`as` 단언만 추가했음을 확인했고, 값·분기·순서 변경은 전무하다. 가장 위험해 보였던 `m.query<{ id: string }[]>` 제네릭도 (1) 동일 파일 내 기존 `Repository.query(...RETURNING...)` 선례, (2) 그 shape 를 그대로 스텁하는 unit mock, (3) 같은 admission 트랜잭션을 실 Postgres 로 반복 실행하는 `execution-concurrency-cap.e2e-spec.ts` 세 겹으로 뒷받침돼 새로운 위험을 만들지 않는다. `triggers`+`execution-engine` jest 재실행은 커밋이 주장한 `47 suites / 1285 passed / 1 skipped`(패턴 `(triggers|execution-engine)`)를 정확히 재현했다. `migrate-node-output-refs.ts` 는 스크립트지만 전용 unit spec(44 테스트, 전부 통과)이 수정된 7개 콜백이 속한 `rewriteExpression` 을 직접 검증한다 — 다만 7개 중 Pass 2(`.output.meta.` 축약) 콜백만 유일하게 spec 입력이 매치하지 않아 실행된 적이 없다. 이는 이번 커밋이 만든 갭이 아니라 기존 스크립트의 pre-existing 갭이며, 타입 주석 diff 자체의 정합성은 `tsc`(대상 3파일 오류 0건)가 정적으로 보장하므로 이번 변경의 회귀 위험을 높이지 않는다. 별도 회귀 테스트를 요구할 근거는 찾지 못했다 — "타입 주석이라 불요하다"는 원 판정에 동의한다.

## 위험도

LOW
