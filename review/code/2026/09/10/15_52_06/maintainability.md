# 유지보수성(Maintainability) 리뷰 — `trigger-workflow-ref` 캐너리, 2라운드 (13건 수정 검토)

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` · `trigger-workflow-ref.spec.ts` ·
`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`.

전제: 이 리포트는 **1라운드(`review/code/2026/09/10/14_34_18/maintainability.md`) 이후의 13건 수정**이
가독성·중복·복잡도를 악화시켰는지에 초점을 맞춘다. 검증은 `git show f71aa584e:<path>`(1라운드 착지본)와
현재 워킹트리를 직접 diff/라인카운트해 실측했다 — 저장소 파일은 전혀 수정하지 않았다(읽기만).

> **관측한 이상 상태(내가 만들지 않음) — 그대로 보고**: 리뷰 도중 `git status --short` 에
> ` M codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 가 나타났다. `git diff` 확인 결과
> `expect(typeof ref.id).toBe('string');` 한 줄이 지워진 상태(:124행 부근) — 다른 reviewer 가 진행 중인
> 뮤테이션 실험으로 보인다. 나는 이 파일을 Read 로만 열었고 Write/Edit 를 호출하지 않았다. 손대지 않고
> 그대로 두었다 — 원복은 그 실험을 진행 중인 세션의 책임이다.

## 발견사항

- **[WARNING]** `trigger-workflow-ref.ts` 의 설계 근거 JSDoc(4개 절, "왜 필요한가"·"자매와 차이"·
  "명명 규칙"·"왜 이 디렉터리인가")이 **함수 선언과 구문적으로 연결되지 않은 고아(orphan) 블록**이고,
  이번 13건 수정이 바로 그 고아 블록 안에 프로즈를 집중적으로 추가해 문제를 크게 키웠다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:3-64`(고아 메인 독스트링) —
    바로 뒤에 `TRIGGER_SECRET_COLUMNS` 자신의 독스트링(`:66-79`)과 그 상수 선언(`:80-83`,`:85`)이
    끼어든 뒤에야 함수 바로 위 `@param` 블록(`:88-97`)이 오고, 그다음에 `export function
    expectTriggerWorkflowRef`(`:98`)가 나온다.
  - 상세: TypeScript/에디터 hover 는 선언에 **공백만 사이에 두고 바로 붙은** JSDoc 만 그 선언의
    문서로 인식한다. `expectTriggerWorkflowRef` 위에 실제로 붙어 있는 것은 10줄짜리 `@param` 블록
    (`:88-97`)뿐이고, "왜 이 단언이 필요한가"·"자매 헬퍼와 오용 시 결과가 비대칭인 이유"·"장래
    이름 충돌을 막는 명명 규칙"·"왜 `test/helpers/` 가 아닌가" 를 담은 **62줄짜리 핵심 설계 근거는
    에디터에서 이 함수를 hover 해도 보이지 않는다.** 이 구조 자체는 1라운드 착지본(`f71aa584e`)에도
    이미 있었다(당시도 메인 독스트링→TRIGGER_SECRET_COLUMNS 독스트링→상수→`UUID_PATTERN`→`@param`→
    함수 순서). 그런데 1라운드는 이 구조를 지적하지 않았고, 이번 13건 수정은 **바로 그 고아 블록의
    내용을 38줄→62줄로(+24줄, +63%)** 키웠다(§4 `assertMatchesContract` 서술 확장, §6 비밀 컬럼
    3중 사본 경고+repo-guard 처방, §7 자매 오용 비대칭 절 신설 등 — 이 확장분이 전부 orphan 구간
    안에 들어갔다). 프로젝트 메모리(`feedback_my_own_fix_is_the_next_defect.md`)가 이미 "orphan
    JSDoc 3번" 을 반복 결함 클래스로 기록해 둔 것과 정확히 같은 형태다.
  - 제안: 최소한 함수를 직접 설명하는 메인 독스트링을 함수 바로 위(현재 `@param` 블록이 있는
    `:88` 자리)로 옮기고, `TRIGGER_SECRET_COLUMNS`/`WORKFLOW_REF_KEYS` 관련 설명은 그 상수들
    바로 위에 남긴다. 지금처럼 "제일 무거운 설계 근거가 코드 순서상 가장 먼 자리에 있는" 배치는
    다음 사람이 문서를 놓치기 쉽게 만든다.

- **[WARNING]** 같은 설명(“`assertMatchesContract` 가 이 분기를 못 잡는 이유”)이 두 파일에
  독립적으로 중복 서술돼 있고, 이번 라운드의 §4 수정이 **두 사본을 각각 따로 확장**해 드리프트
  표면을 넓혔다 — 서로 참조 링크가 없다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:14-19` vs
    `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:27-29`.
  - 상세: 1라운드 착지본에서는 이 설명이 각각 3줄/2줄의 짧은 한 문장이었다. §4 fix(RESOLUTION.md
    항목 4 — "`assertMatchesContract` 서술을 '못 잡는다' → '이 분기에 그 검증자를 거는 호출이
    0건' 으로 좁힘")가 두 파일 모두에서 **독립적으로** 적용되면서 각각 5~6줄로 늘었다. 두 설명은
    같은 사실(계약 검증자가 무능한 게 아니라 그 분기에 검증자를 거는 호출이 없다)을 표현만 살짝
    바꿔 반복한다 — 한쪽을 고치면 다른 쪽이 조용히 낡을 수 있다.
  - 같은 형태의 두 번째 중복: `expectedWorkflowId`/identity 근거(“shape 만 보면 엉뚱한 relation
    이 통과한다”, 둘 다 `review/code/2026/09/10/14_34_18` testing W1 을 인용)도
    `trigger-workflow-ref.ts:94-96` 과 `trigger-workflow-ref.e2e-spec.ts:42-45` 에 거의 같은
    문장으로 중복돼 있다 — 이번 라운드의 §1(expectedWorkflowId 추가) fix 가 두 자리 모두에 새로
    써넣은 것이다.
  - 제안: 헬퍼 파일(`trigger-workflow-ref.ts`)을 근거의 SoT 로 삼고, e2e 파일 쪽 설명은 "이유는
    헬퍼 docstring 참조" 정도로 축약해 한 자리만 상세히 유지한다.

- **[WARNING]** 신규 self-spec 4케이스(`trigger-workflow-ref.spec.ts`)가, 기존 8케이스가
  암묵적으로 지켜 온 **"테스트 순서 = 함수 내부 가드 실행 순서"** 조립 스타일을 깼다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` — 현재 순서(1~12):
    (1) 해피패스 `:35` (2) present:false+키있음 `:40` (3) present:true+키없음 `:46`
    (4) workflow=null `:56` (5) shape 어긋남 `:64` (6) id UUID 아님 `:79`
    **(7,신규) name 문자열 아님 `:94`** **(8,신규) id 문자열 아님 `:105`**
    **(9,신규) 최상위 dto=null `:114`** **(10,신규) expectedWorkflowId 불일치 `:119`**
    (11) name 빈 문자열 `:133` (12) 비밀 컬럼 혼입 `:142`.
    대조: 헬퍼 함수의 실제 가드 순서(`trigger-workflow-ref.ts`) — dto not-null `:104` → 비밀 컬럼
    `:108-110` → present:false `:112-117` → present:true(hasOwn/not-null) `:119-121` → shape 키
    `:124` → **id typeof `:125`** → **id UUID `:128`** → name typeof `:129` → name length `:130`
    → expectedWorkflowId `:132-134`.
  - 상세: 두 가지 순서 역전이 있다. ① `dto === null` 가드는 함수에서 **제일 먼저** 실행되는
    체크(`:104`)인데, 그걸 문는 신규 케이스(9번, `:114-117`)는 12개 중 9번째로 밀려나 shape/id
    관련 케이스들 뒤에 파묻혔다. ② `typeof ref.id === 'string'`(`:125`)은 `isUuidShaped`(`:128`)
    보다 **먼저** 실행되는데, spec 은 반대로 "id UUID 아님"(기존, 6번)을 먼저 배치하고 "id 문자열
    아님"(신규, 8번)을 그 뒤에 둬 소스 순서와 거꾸로다. 기존 8케이스는 대체로 함수 가드 순서를
    따라 나열돼 있었으므로(§5.4 present 분기 → shape → id 포맷 → name → 비밀 컬럼), 이 순서가
    "다음에 새 가드를 추가할 때 spec 도 같은 자리에 넣으라"는 암묵적 조립 관례로 읽힌다. 신규
    4케이스는 그 관례를 따르지 않고 파일 뒤쪽에 뭉텅이로 이어붙였다 — 기능적으로는 전부 맞지만,
    다음 사람이 "함수를 위에서부터 읽으며 대응하는 테스트를 찾는" 방식의 탐색을 방해한다.
  - 제안: `dto=null` 케이스를 4번(workflow=null) 앞이나 바로 뒤로, `id 문자열 아님` 케이스를
    6번(id UUID 아님) **앞**으로 재배치해 소스 가드 순서와 다시 맞춘다.

- **[INFO]** 위 항목의 두 신규 "자매 대조군"(name 타입 vs id 타입) 사이에 검증 엄격도 비대칭이
  있다 — 라벨은 "같은 이유의 자매 대조군" 이라고 말하지만 실제 커버리지가 다르다.
  - 위치: `trigger-workflow-ref.spec.ts:94-103`(name — `for (const bad of [42, true, {}, []])`
    로 4개 나쁜 값을 순회) vs `:105-112`(id — `{ id: 42, name: 'W' }` 단일 값 하나만 검사).
  - 상세: name 쪽은 라운드1의 뮤테이션 실측(타입 단언 삭제해도 8/8 GREEN 유지)이 실제 사각지대를
    증명했기 때문에 4개 타입(숫자·불리언·객체·배열)을 전부 방어하는 것이 의미가 있다. id 쪽은
    "같은 이유" 라고 적어 놓고 정작 숫자 하나만 테스트해, 불리언·객체·배열이 `id` 자리에 오는
    경우는 이 자매 케이스가 커버하지 않는다(다만 `isUuidShaped(String(ref.id))` 간접 방어가
    여전히 있어 실질 위험은 낮다). 라벨의 "자매" 라는 표현이 실제 대칭성보다 강한 인상을 준다.
  - 제안: 급하지 않음 — 여유가 있으면 `for (const bad of [true, {}, []])` 를 id 케이스에도
    추가해 라벨과 실제 커버리지를 맞춘다.

- **명시(재지적 아님)**: 1라운드가 지적한 `TRIGGER_SECRET_COLUMNS` 3중 사본(W1)에 대한 repo-guard
  처방은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 트래커로
  이관됐다(`RESOLUTION.md` "코드 밖으로 이관 4건" #1). 이번 라운드에서 새로 발견한 사안이 아니다.

- **[정보 — 개선 사례]** 1라운드 INFO(“`120_000` 매직 넘버”)는 이번 §11 수정에서
  `SETUP_TIMEOUT_MS = CHAT_CHANNEL_TIMEOUT_MS * 2`(`trigger-workflow-ref.e2e-spec.ts:74`)로
  깔끔하게 파생시켜 해소됐다 — 매직 넘버가 사라지고 두 상수가 같은 근거를 공유함이 코드에
  드러난다. 복잡도·가독성 부담을 늘리지 않은 좋은 수정이다.

## 정량 근거 — 주석/코드 비율 변화 (1라운드 착지본 `f71aa584e` vs 현재)

| 파일 | 주석성 줄 (전→후) | 코드 줄 (전→후) | 비고 |
|---|---|---|---|
| `trigger-workflow-ref.ts` | 54 → 87 (+33, +61%) | 40 → 48 (+8, +20%) | 주석 증가율이 코드의 3배 |
| `trigger-workflow-ref.e2e-spec.ts` | 47 → 99 (+52, +111%) | 153 → 168 (+15, +10%) | 이번 라운드에 늘어난 67줄 중 52줄(78%)이 주석 |
| `trigger-workflow-ref.spec.ts` | 14 → 25 (+11, +79%) | 94 → 133 (+39, +41%) | 신규 4케이스 자체가 실행 코드라 비율 문제 없음 |

(계산: `awk` 로 `/** ... */` 블록·`//` 라인을 "주석성", 나머지를 "코드"로 근사 카운트. 빈 줄은 코드
쪽에 섞여 있어 실제 코드 비중은 표보다 더 작다.) `trigger-workflow-ref.ts`·`.e2e-spec.ts` 두 파일은
이번 13건 수정에서 늘어난 줄의 대부분이 주석/독스트링이었다 — 이번 라운드가 지목한 "주석이 코드보다
크게 자라는 지점"이 정확히 이 두 파일이다.

## 요약

13건의 수정 자체는 개별적으로 타당한 근거를 갖고 있고(뮤테이션으로 실측한 사각지대를 각각 정확히
겨냥), 코드 로직에 새 결함을 만들지는 않았다. 그러나 유지보수성 관점에서 두 가지 구조적 비용이
쌓였다. 첫째, `trigger-workflow-ref.ts` 의 핵심 설계 근거 JSDoc 은 1라운드 이전부터 함수 선언과
구문적으로 분리된 "고아" 위치에 있었는데, 이번 수정들이 정확히 그 고아 블록 안에 프로즈를 집중
투입해(38→62줄) 문제의 체감 크기를 키웠다 — 실제로 함수를 hover 하면 보이는 문서는 10줄뿐이고
가장 무거운 설명은 안 보인다. 둘째, `assertMatchesContract` 무력화 이유와 `expectedWorkflowId`
identity 근거가 헬퍼 파일과 e2e 파일 양쪽에 독립적으로 중복 확장돼, 앞으로 한쪽만 고쳐지고
다른 쪽이 낡을 위험 표면이 넓어졌다. 셋째, 요청받은 대로 신규 self-spec 4케이스의 조립 스타일을
기존 8케이스와 대조한 결과, 함수의 가드 실행 순서를 따르던 기존 관례를 두 지점(dto=null 의 배치,
id 타입 체크 대 UUID 포맷 체크의 순서)에서 어겼다 — 기능은 맞지만 코드를 위에서 아래로 읽으며
대응 테스트를 찾는 탐색성을 떨어뜨린다. 반대로 매직 넘버 파생(`SETUP_TIMEOUT_MS`)처럼 복잡도를
늘리지 않고 깔끔히 해소한 수정도 있다. 1라운드가 등재한 비밀 컬럼 3중 사본 문제는 이미 트래커로
이관돼 있어 재지적하지 않았다.

## 위험도

LOW — 전부 테스트 전용 코드의 문서 배치·중복·조립 순서 문제이고 런타임 동작·판정 로직에는 결함이
없다. 다만 "고아 JSDoc" 은 이 저장소가 반복적으로 겪어 온 결함 클래스이므로, 다음 라운드에 다시
독스트링을 확장하기 전에 위치부터 바로잡는 것을 권한다.

STATUS: success
