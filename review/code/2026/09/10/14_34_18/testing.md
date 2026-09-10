# 테스트(Testing) 리뷰 — `trigger-workflow-ref` 캐너리

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` (헬퍼) +
`trigger-workflow-ref.spec.ts` (self-spec) + `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (e2e).

## 검증 방법

- `triggers.service.ts` 전문을 읽어 `create`/`findAll`/`findOneDetail`/`update` 4경로가 실제로
  `workflow` 를 채우는지 소스로 대조.
- 헬퍼 self-spec 을 실제로 실행(8/8 GREEN, `0.1~0.2s`), 그 위에 두 종류의 뮤테이션을 직접 넣어
  RED/GREEN 을 관측 — 저장소 파일은 원본을 scratch(`/private/tmp/.../scratchpad`)에 `cp` 로
  백업한 뒤 고쳤고, 각 실험 직후 scratch 백업으로 `cp` 복원했다(`git checkout` 미사용).
  최종 `git status --short` 로 `codebase/` 하위가 clean 함을 확인했다(review 산출물 디렉터리만
  untracked로 남아 있음 — 무관).
- e2e(`trigger-workflow-ref.e2e-spec.ts`)는 Docker DB 가 필요해 이 리뷰 세션에서는 재실행하지
  않았다 — 대신 `chatChannel` 재조회 뮤테이션이 어떤 메커니즘으로 #5 만 물게 되는지 TypeORM
  엔티티 필드 선언 + `JSON.stringify` 의 `undefined` 드롭 규칙을 근거로 정적 추적했다(아래 §1).

## 저자 주장 검증/반증

### 주장 A — "chatChannel 재조회에서 `relations:['workflow']` 를 지우면 #5 만 RED, #1~#4 는 GREEN"

**정적 추적으로 지지(re-run 은 안 함).** `Trigger.workflow: Workflow;` 는 초기화식 없는 클래스
필드다(`entities/trigger.entity.ts:47-48`). `tsconfig.json` 의 `target: ES2023`(`useDefineForClassFields`
기본 true) 하에서 이런 필드는 인스턴스에 **own property, 값 `undefined`** 로 얹힌다 — 이 저장소가
같은 메커니즘으로 이미 한 번 발을 헛디딘 사례가 `triggers.service.ts:500-505`(`update()`의 `rest`
필드) 주석에 그대로 남아 있다. 관계가 로드 안 되면 `refreshed.workflow === undefined` 이고,
`sanitizeForResponse` 는 `if (wf)` 가 false 라 `overrides.workflow` 를 안 채우지만 `Object.assign`
이 `trigger`(=own property `workflow: undefined`)를 그대로 복사하므로 결과 객체도 `workflow: undefined`
를 갖는다. **`JSON.stringify` 는 `undefined` 값의 키를 드롭**하므로 실제 wire 응답에는 `workflow`
키 자체가 없어진다 — 그래서 `expectTriggerWorkflowRef(..., {present:true})` 의
`Object.hasOwn(record,'workflow')` 가 `false` 로 걸린다. #1~#4 는 이 재조회 분기(`if (chatChannel)`)를
전혀 안 타므로(플레인 생성·목록·단건·일반 PATCH) 영향이 없다는 것도 소스상 맞다. **결론: 저자
주장은 코드 경로상 일관적이고 재현 메커니즘이 명확하다.**

### 주장 B — "헬퍼의 `null`-vs-부재 가드를 무르게 하면 self-spec 정확히 1건만 RED"

**직접 뮤테이션으로 재현·확인.** `trigger-workflow-ref.ts:79` 의
`expect(Object.hasOwn(record, 'workflow')).toBe(false);` 를 `expect(record.workflow == null).toBe(true);`
로 바꿔(느슨한 `==null` 비교) `jest shared/testing/trigger-workflow-ref.spec.ts` 실행:

```
Tests: 1 failed, 7 passed, 8 total
● expectTriggerWorkflowRef › `null` 은 부재가 아니다 — 양쪽 판정 모두에서 실패한다
```

정확히 저자가 말한 그 1건(`null` 가드 테스트)만 RED, 나머지 7건 GREEN. 원복 후 재실행하여 8/8
GREEN 회복 확인. **주장 B 확인.**

## 점검 관점별 소견

### 1. 다섯 e2e 케이스 중 vacuous 한 것이 있는가

**프롬프트가 제기한 두 우려 모두 반증됨 — 하지만 근접한 진짜 약점이 하나 있다.**

- **#1 (생성, `beforeAll` 캡처 바디)**: `beforeAll` 은 `expect(plain.status).toBe(201)` 로
  생성 실패를 이미 하드 게이트하고, 이어서 `plainTriggerId = plain.body.data.id as string`
  가 `data` 가 `null`/`undefined` 이면 그 자리에서 `TypeError` 로 죽는다 — Jest 는 `beforeAll`
  이 던지면 그 `describe` 전체를 실패 처리하므로, "생성이 조용히 실패했는데 단언은 통과" 하는
  시나리오는 이 파일 구조상 발생하지 않는다. **프롬프트의 우려는 반증됨.**
- **#2 (목록에서 `find`)**: `find` 결과를 헬퍼에 바로 넘기지 않고
  `expect(listed).toBeDefined()` 를 먼저 명시적으로 건다(`trigger-workflow-ref.e2e-spec.ts:150`
  대응 소스 라인). `undefined` 면 여기서 바로 실패한다. **프롬프트의 우려는 반증됨.**

- **그런데 진짜 약점은 `present:false` 분기 자체에 있다** — 헬퍼가 최상위 `dto` 인자가
  **`null`** 인 경우를 못 거른다. `expect(dto).toBeDefined()`(`trigger-workflow-ref.ts:70`)는
  Jest 의미상 `undefined` 만 거르고 `null` 은 통과시킨다. `record = (dto ?? {})` 로 `null` 이
  `{}` 로 치환되고, 빈 객체는 당연히 `workflow` 키가 없으니 `present:false` 검사를 무사통과한다.
  **e2e #1 에서 이게 안 터지는 건 헬퍼 덕이 아니라 앞서 `.id` 를 읽는 코드가 우연히 먼저 막아주기
  때문**이다 — 헬퍼 자신은 "top-level DTO 가 `null` 이면 안 된다" 는 것을 보장하지 않는다.
  self-spec 에도 이 경로(최상위 `dto=null`, 중첩 `workflow: null` 이 아니라)를 문 테스트가 없다.
  향후 이 헬퍼가 `.id` 를 먼저 안 읽는 다른 `present:false` 호출부에 재사용되면 조용히 뚫릴 수
  있다. — **WARNING**

### 2. `present: true` 분기가 충분히 강한가

**빠진 게 하나 있다: 참조 동일성(identity) 검증이 전혀 없다.** 헬퍼는 `workflow` 의 **shape**
(정확히 `['id','name']` 키셋 · `id` UUID 형식 · `name` 비어있지 않음)만 본다. 그 `id`/`name`
이 **실제로 그 트리거가 가리키는 워크플로우**(테스트가 `beforeAll` 에서 만든 `workflowId`)와
일치하는지는 어디서도 확인하지 않는다 — `grep` 으로 전수 확인: e2e 파일에서 `workflowId` 는
트리거를 **생성할 때만** 쓰이고(48/58/98/111행), 응답의 `workflow.id`/`workflow.name` 과
비교하는 코드는 **0건**이다. 즉 "workflow 가 있긴 한데 엉뚱한 relation(다른 워크플로우, 심지어
`id`/`name` 을 우연히 갖는 다른 엔티티)에서 채워졌다" 는 회귀는 UUID 형식 + 비어있지 않은
문자열이기만 하면 **네 개의 `present:true` 케이스(#2~#5) 전부**를 조용히 통과한다. 프롬프트가
정확히 지목한 "wrong relation" 시나리오가 실제로 뚫리는 구멍이다. — **WARNING**

- 반대로 "extra nested object"(여분 키가 섞여 들어오는 경우)는 `Object.keys(ref).sort()).toEqual([...WORKFLOW_REF_KEYS].sort())`
  가 정확한 키셋 등가비교라 잘 막는다 — self-spec 도 이를 명시적으로 문다("여분 키·누락 키 각각").
  이 축은 **강하다.**

### 3. 선언된 표면(4경로) 대비 커버리지 갭

- `create`(2 서브경로) / `findAll` / `findOneDetail` / `update`(2 서브경로) = "6 형태" 주장은
  소스와 정합한다. `history`·`DELETE`·rotate 3종이 `TriggerDto` 가 아닌 별도 응답 shape
  (`{secret,rotatedAt}`, `{token}`, `rotateBotToken` 리턴)을 쓰는 것도 컨트롤러에서 직접 확인—
  "대상 밖" 주장 정확.
- **`type: 'schedule'` 분기는 `findAll`/`findOneDetail` 양쪽 다 이 캐너리로 전혀 안 걸린다.**
  다섯 케이스가 만드는 트리거는 전부 `type: 'webhook'` 이다. 소스를 추적한 결과 schedule
  enrichment(`Object.assign(t, {cronExpression, timezone, nextRunAt})`, `triggers.service.ts:317-330`
  · `:359-365`)는 **제자리 mutate** 라서 이미 로드된 `workflow` own property 를 건드리지 않고,
  최종적으로 같은 `sanitizeForResponse` 를 타므로 지금 구현상으로는 `workflow` 처리가 webhook
  타입과 동일하다 — 실제로 다르게 동작하지는 않는다는 것을 코드로 확인했다. 다만 **저장소 전체를
  뒤져도 schedule 타입 트리거에 대해 `workflow` **positive presence** 를 문 테스트는 없다**
  (`schedule-trigger.e2e-spec.ts` C-2 는 cron/timezone/nextRunAt 과 `assertMatchesContract` 만
  검사하는데, §5.4 키 생략형 규약상 `assertMatchesContract` 는 애초에 부재를 위반으로 안 보므로
  이 축을 못 잡는다). 지금은 안전하지만, 장래 schedule enrichment 가 in-place mutate 대신
  **새 plain object 를 spread** 로 만드는 방식으로 바뀌면(흔한 리팩터 패턴) 이 캐너리도
  `schedule-trigger.e2e-spec.ts` 도 못 잡는 사각지대가 생긴다. — **INFO** (현재 정확성은 확인됨,
  회귀 방어력만 얕음)

### 4. Flakiness·격리

- 트리거 rename(#4)이 #2/#3 이 읽는 것과 같은 `plainTriggerId` 를 대상으로 하지만, #2/#3 은
  `name` 값을 전혀 단언하지 않는다(상태 코드·`workflow` shape 만) — 그러므로 선언 순서가
  바뀌거나(Jest 는 파일 내 `it()` 순서를 기본 보존하지만) retry 로 #4 가 먼저 실행돼도 #2/#3
  의 pass/fail 에 영향이 없다. **실질적 순서 의존성 없음 — 프롬프트 우려 반증.**
- `uniqueEmail`/`uniqueName` 이 `Date.now()+Math.random()` 조합이라 파일간 병렬 샤딩에도
  워크스페이스/이름 충돌 위험 없음.
- `afterAll` 이 raw `DELETE FROM trigger` 만 하고 `chatTriggerId` 에 대해 `setupChatChannel` 이
  만든 secret_store row(`botTokenRef`)는 정리하지 않는다 — `TriggersService.remove()` 를 안
  거치므로 `secrets.deleteByPrefix` 가 안 불린다. 다만 이는 **이 PR 만의 문제가 아니다** —
  `chat-channel-trigger-create.e2e-spec.ts` 도 동일하게 raw DELETE 만 한다(확인). 기존 관례를
  그대로 따른 것이라 새 회귀는 아니지만, 두 파일 다 잠재적 잔존 row 이슈를 안고 있다. — **INFO**

### 5. Self-spec 자체의 완결성 — 뮤테이션으로 확인

**실측(직접 뮤테이션 + jest 실행)**: 헬퍼의 `expect(typeof ref.name).toBe('string');`
(`trigger-workflow-ref.ts:92`) 를 주석 처리해도 **self-spec 8/8 GREEN 유지** — 즉 이 줄을 없애는
"완화" 는 self-spec 이 전혀 감지하지 못한다. 원인: 뒤따르는 `String(ref.name).length).toBeGreaterThan(0)`
검사가 `name` 이 숫자 등 문자열이 아닌 값이어도 `String()` 변환 후 길이만 보므로(`String(0)`→`"0"`,
길이 1) 통과시킨다. self-spec 은 `name: ''`(빈 문자열)만 테스트하지 non-string `name`(숫자·불리언
등)은 아예 테스트 케이스가 없다.

대조군으로 `id` 쪽의 `expect(typeof ref.id).toBe('string')` 도 self-spec 이 직접 문 적은 없지만,
그 뒤 `String(ref.id)).toMatch(UUID_PATTERN)` 가 사실상 모든 non-string 값(스킹된 문자열 표현이
UUID 형식일 확률은 사실상 0)을 걸러내므로 **간접적으로 방어된다** — `name` 쪽엔 그런 간접
방어가 없다(빈 문자열 여부만 보고 타입은 안 본다). **비대칭적 취약점** — WARNING.

그 외 self-spec 은 각 실패 경로(`present` 불일치 양방향·`null`·여분/누락 키·UUID 아님·빈 이름·
비밀 컬럼 혼입 양방향)를 개별적으로 RED 로 문다는 원칙을 잘 지키고, 통과 케이스와 실패 케이스를
분리해 시나리오 이름에 의도를 명확히 적어 가독성도 좋다.

## 뮤테이션 실험 로그 (재현용)

| # | 대상 | 변경 | 결과 |
|---|---|---|---|
| 1 | `trigger-workflow-ref.ts:92` `typeof ref.name` 체크 | 주석 처리 | self-spec **8/8 GREEN 유지** (감지 못 함) |
| 2 | `trigger-workflow-ref.ts:79` `Object.hasOwn(...) toBe(false)` | `record.workflow == null` 로 완화 | self-spec **1 FAIL / 7 PASS** (저자 주장 B 그대로 재현) |

두 실험 모두 원본을 `/private/tmp/claude-501/.../scratchpad/trigger-workflow-ref.ts.orig` 에
`cp` 로 백업한 뒤 저장소 파일을 직접 고쳐 실행했고, 실험 직후 같은 백업으로 `cp` 복원했다.
최종 `git status --short` 로 `codebase/` 이하 diff 없음(clean) 확인 — 원복 실패 없음.

## 요약

캐너리의 핵심 주장(재조회 분기에서 `relations` 를 빼면 #5 만 RED)은 TypeORM 필드 초기화 +
`JSON.stringify` 의 `undefined` 드롭 메커니즘으로 소스상 정합했고, 헬퍼의 `null`-vs-부재 가드가
정확히 self-spec 1건에 걸린다는 저자의 두 번째 측정치는 동일 뮤테이션으로 직접 재현해 확인했다.
프롬프트가 제기한 "#1/#2 vacuous 우려"와 "#4 rename 이 #2/#3 을 깨뜨릴 순서 의존성"은 소스 추적으로
반증됐다. 다만 새로 발견한 세 가지 실질적 약점이 있다: (1) `present:true` 검사가 `workflow` 의
**shape** 만 보고 그것이 **올바른 워크플로우를 가리키는지**(identity)는 전혀 확인하지 않아, 엉뚱한
relation 에서 채워진 그럴듯한 UUID+이름도 통과한다, (2) 헬퍼의 `present:false` 분기는 최상위 `dto`
가 `null` 이어도 통과하며 이 회귀에 대한 e2e 의 방어는 헬퍼 자체가 아니라 우연한 호출 순서에
의존한다, (3) self-spec 은 `name` 필드의 타입 체크 줄을 지워도 감지 못 한다(뮤테이션으로 실측
확인) — `id` 는 UUID 정규식이 간접 방어하지만 `name` 은 그런 이차 방어가 없다. 세 가지 모두
지금 당장 잘못된 프로덕션 동작을 놓치고 있는 것은 아니지만(특히 (2)는 현재 호출 순서 덕에 우연히
막혀 있고, (3)은 실제 `name` 컬럼이 항상 문자열인 DB 스키마상 발생 가능성이 낮다), 이 헬퍼가
"헬퍼가 무르게 바뀌면 다섯 자리가 동시에 조용히 통과한다" 는 자신의 존재 이유를 스스로 완전히
충족하지는 못했다는 뜻이다. 부수적으로 schedule 타입 트리거에 대한 `workflow` positive-presence
커버리지가 저장소 전체에 0건인 점도 낮은 리스크지만 기록해 둘 가치가 있다.

## 위험도

LOW — 테스트 전용 변경이고 핵심 회귀 재현(주장 A·B)은 검증됐다. 발견된 갭은 모두 "지금 당장
깨진 것" 이 아니라 "다음 회귀가 새는 자리를 넓힌다" 는 성격의 WARNING/INFO 이며, 프로덕션
코드에는 영향이 없다.
